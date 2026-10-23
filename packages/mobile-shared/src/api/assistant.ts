import { apiClient, API_URL } from './client';
import { secureStorage } from '../services/secureStorage';
import { useAuthStore } from '../store/authStore';

/** Same event protocol as the web assistant (/ai/chat/stream, Server-Sent Events). */
export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}
export interface FormFieldSpec {
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'textarea' | 'select' | 'date' | 'hidden';
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
}
export interface ProposedAction {
  id: string;
  tool: string;
  title: string;
  fields?: Array<{ label: string; value: string }>;
  args?: Record<string, unknown>;
  /** Present when the proposal is an editable form. */
  form?: { submitLabel: string; fields: FormFieldSpec[]; values: Record<string, unknown> };
}
export interface StreamHandlers {
  onDelta: (text: string) => void;
  onTool: (name: string) => void;
  onAction: (action: ProposedAction) => void;
  onNavigate?: (href: string) => void;
  onError: (message: string) => void;
  onDone: () => void;
}

/**
 * Stream a reply. React Native's fetch can't read a response body as it
 * arrives, so this uses XMLHttpRequest progress events and parses the SSE
 * frames incrementally. Returns a function that aborts the request.
 */
export async function streamAssistant(messages: ChatTurn[], h: StreamHandlers): Promise<() => void> {
  // Any authenticated call refreshes an expired access token first.
  await apiClient.get('/auth/me').catch(() => undefined);
  const token = await secureStorage.getAccessToken();
  const branchId = (await secureStorage.getBranchId()) || useAuthStore.getState().selectedBranchId;

  const xhr = new XMLHttpRequest();
  let seen = 0;
  let buffer = '';
  let finished = false;
  const finish = () => {
    if (!finished) {
      finished = true;
      h.onDone();
    }
  };

  const handleBlock = (block: string) => {
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).trim());
    }
    let payload: Record<string, unknown> = {};
    try {
      payload = data.length ? (JSON.parse(data.join('\n')) as Record<string, unknown>) : {};
    } catch {
      return;
    }
    if (event === 'delta') h.onDelta(String(payload.text ?? ''));
    else if (event === 'tool') h.onTool(String(payload.name ?? ''));
    else if (event === 'confirm') h.onAction(payload as unknown as ProposedAction);
    else if (event === 'form') {
      const p = payload as unknown as ProposedAction & { submitLabel: string; fields: FormFieldSpec[]; values: Record<string, unknown> };
      h.onAction({ id: p.id, tool: p.tool, title: p.title, form: { submitLabel: p.submitLabel, fields: p.fields, values: p.values ?? {} } });
    } else if (event === 'navigate') h.onNavigate?.(String(payload.href ?? ''));
    else if (event === 'error') h.onError(String(payload.message ?? 'Something went wrong.'));
    else if (event === 'done') finish();
  };

  const pump = () => {
    const text = xhr.responseText ?? '';
    buffer += text.slice(seen);
    seen = text.length;
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      if (block.trim()) handleBlock(block);
    }
  };

  xhr.open('POST', `${API_URL}/ai/chat/stream`);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('Accept', 'text/event-stream');
  if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
  if (branchId) xhr.setRequestHeader('X-Branch-Id', branchId);
  xhr.onprogress = pump;
  xhr.onload = () => {
    if (xhr.status >= 400) {
      let message = 'The assistant is unavailable right now.';
      try {
        message = (JSON.parse(xhr.responseText) as { error?: { message?: string } }).error?.message ?? message;
      } catch {
        /* not JSON */
      }
      h.onError(message);
    } else pump();
    finish();
  };
  xhr.onerror = () => {
    h.onError('Could not reach the assistant. Check your connection.');
    finish();
  };
  xhr.send(JSON.stringify({ messages }));
  return () => xhr.abort();
}

/** Run a confirmed action (the server re-checks permission and re-validates). */
export async function executeAssistantAction(tool: string, args: Record<string, unknown>): Promise<{ message?: string; link?: string }> {
  const res = await apiClient.post('/ai/chat/execute', { tool, args });
  return (res.data?.data ?? {}) as { message?: string; link?: string };
}
