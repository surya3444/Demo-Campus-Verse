import { useAuthStore } from '@/store/authStore';
import { useBranchStore } from '@/store/branchStore';
import { refreshAccessToken, endSessionIfUnrecoverable } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface PendingActionField {
  label: string;
  value: string;
}

/** A write action the assistant proposed; the user confirms before it runs. */
export interface PendingAction {
  id: string;
  tool: string;
  title: string;
  fields: PendingActionField[];
  args: Record<string, unknown>;
}

export type FormFieldType = 'text' | 'email' | 'tel' | 'number' | 'textarea' | 'select' | 'date';

export interface FormFieldOption {
  value: string;
  label: string;
}

export interface FormField {
  name: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: FormFieldOption[];
}

/** An editable form the assistant proposed; the user fills it in and submits. */
export interface PendingForm {
  id: string;
  tool: string;
  title: string;
  submitLabel: string;
  fields: FormField[];
  values: Record<string, unknown>;
}

export interface StreamHandlers {
  onDelta: (text: string) => void;
  onTool: (name: string) => void;
  onConfirm: (action: PendingAction) => void;
  onForm: (form: PendingForm) => void;
  onError: (message: string) => void;
  onDone: () => void;
}

/**
 * Build auth headers for an AI fetch call. The axios request interceptor that
 * refreshes tokens doesn't run for fetch, so refresh proactively here.
 */
async function authHeaders(): Promise<Record<string, string>> {
  const auth = useAuthStore.getState();
  let token = auth.accessToken;
  if (auth.isAuthenticated && auth.accessToken && auth.isTokenExpired()) {
    try {
      const { accessToken, expiresIn } = await refreshAccessToken();
      useAuthStore.getState().setAccessToken(accessToken, expiresIn);
      token = accessToken;
    } catch {
      // fall through with the stale token; the server 401s → friendly error.
    }
  }
  const branchId = useBranchStore.getState().selectedBranchId;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(branchId ? { 'X-Branch-Id': branchId } : {}),
  };
}

/**
 * fetch wrapper that reactively refreshes the access token once on a 401 and
 * retries. The streaming / execute calls use raw fetch (axios can't stream), so
 * they don't benefit from the axios 401 interceptor the rest of the app relies
 * on — without this, an expired token surfaces as a "Token expired" error with
 * no recovery. `authHeaders()` already refreshes proactively; this covers the
 * cases it misses (clock skew, an idle tab, or a failed proactive refresh).
 */
async function fetchWithAuthRetry(
  url: string,
  init: Omit<RequestInit, 'headers'>
): Promise<Response> {
  const res = await fetch(url, { ...init, headers: await authHeaders() });
  if (res.status !== 401 || !useAuthStore.getState().isAuthenticated) return res;

  try {
    const { accessToken, expiresIn } = await refreshAccessToken();
    useAuthStore.getState().setAccessToken(accessToken, expiresIn);
  } catch (err) {
    // Transient → surface the original 401 (retryable) and keep the session.
    // Genuine 401 → session is dead; re-auth cleanly so chat + APIs work again.
    endSessionIfUnrecoverable(err);
    return res;
  }
  // Retry once with the freshly-minted token.
  return fetch(url, { ...init, headers: await authHeaders() });
}

interface SseEvent {
  event: string;
  data: Record<string, unknown>;
}

function parseSseBlock(raw: string): SseEvent {
  let event = 'message';
  let dataStr = '';
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
  }
  if (!dataStr) return { event, data: {} };
  try {
    return { event, data: JSON.parse(dataStr) as Record<string, unknown> };
  } catch {
    return { event, data: {} };
  }
}

/**
 * POST the conversation to the AI assistant and stream the reply.
 *
 * axios can't stream response bodies, so this uses fetch + ReadableStream and
 * parses the Server-Sent Events manually. The axios request interceptor that
 * refreshes tokens doesn't run for fetch, so we proactively refresh here.
 */
export async function streamChat(
  messages: ChatTurn[],
  handlers: StreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  let res: Response;
  try {
    res = await fetchWithAuthRetry(`${API_URL}/ai/chat/stream`, {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ messages }),
      signal,
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return;
    handlers.onError('Could not reach the assistant. Check your connection and try again.');
    return;
  }

  if (!res.ok) {
    let message = 'The assistant is unavailable right now. Please try again.';
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body?.error?.message) message = body.error.message;
    } catch {
      /* non-JSON error body */
    }
    handlers.onError(message);
    return;
  }

  if (!res.body) {
    handlers.onError('The assistant returned an empty response.');
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        if (!block.trim()) continue;
        const { event, data } = parseSseBlock(block);
        if (event === 'delta') handlers.onDelta(String(data.text ?? ''));
        else if (event === 'tool') handlers.onTool(String(data.name ?? ''));
        else if (event === 'confirm') handlers.onConfirm(data as unknown as PendingAction);
        else if (event === 'form') handlers.onForm(data as unknown as PendingForm);
        else if (event === 'error')
          handlers.onError(String(data.message ?? 'Something went wrong.'));
        else if (event === 'done') handlers.onDone();
      }
    }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return;
    handlers.onError('The connection was interrupted. Please try again.');
  }
}

/**
 * Execute a confirmed write action. The server re-checks permission and
 * re-validates args, so this is safe to call with the proposed action as-is.
 * Returns the success payload; throws an Error with a friendly message on failure.
 */
export async function executeAction(action: {
  tool: string;
  args: Record<string, unknown>;
}): Promise<{ message?: string; link?: string }> {
  let res: Response;
  try {
    res = await fetchWithAuthRetry(`${API_URL}/ai/chat/execute`, {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ tool: action.tool, args: action.args }),
    });
  } catch {
    throw new Error('Could not reach the server. Please try again.');
  }

  const body = (await res.json().catch(() => null)) as {
    success?: boolean;
    data?: { message?: string; link?: string };
    error?: { message?: string };
  } | null;

  if (!res.ok || !body?.success) {
    throw new Error(body?.error?.message ?? 'The action could not be completed.');
  }
  return { message: body.data?.message, link: body.data?.link };
}
