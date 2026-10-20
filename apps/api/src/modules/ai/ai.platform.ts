import { z } from 'zod';
import { env } from '../../config/env';
import { ApiError } from '../../middleware/errorHandler';
import { describeEndpoint, findEndpoint, listArea } from './ai.catalog';
import type { ConfirmCard, ToolContext, ToolDefinition, ToolResult } from './ai.types';

/**
 * Generic tools that let the assistant use the whole platform. Calls go through
 * the real HTTP API with the user's own token, so authentication, RBAC, module
 * gating, branch scoping, validation and audit logging all apply exactly as if
 * the user had clicked through the UI. Reads run inline; anything that changes
 * data is proposed as a confirmation card and runs only after the user approves.
 */

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

/** Keep tool output small enough for the model: trim long strings, images and big lists. */
function shrink(value: unknown, depth = 0, maxList = 25): unknown {
  if (typeof value === 'string') {
    if (value.startsWith('data:')) return '[file]';
    return value.length > 300 ? `${value.slice(0, 300)}…` : value;
  }
  if (Array.isArray(value)) {
    const items = value.slice(0, maxList).map((v) => shrink(v, depth + 1, maxList));
    return value.length > maxList ? [...items, `…and ${value.length - maxList} more`] : items;
  }
  if (value && typeof value === 'object') {
    if (depth > 5) return '[…]';
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (['password', 'passwordHash', 'refreshToken', 'tokens', '__v'].includes(k)) continue;
      out[k] = shrink(v, depth + 1, maxList);
    }
    return out;
  }
  return value;
}

function compact(json: unknown): unknown {
  for (const max of [25, 10, 4]) {
    const s = shrink(json, 0, max);
    if (JSON.stringify(s).length < 14000) return s;
  }
  return { note: 'Response too large; narrow the request with filters or limit.' };
}

async function callPlatform(
  ctx: ToolContext,
  method: string,
  path: string,
  query?: Record<string, unknown>,
  body?: unknown
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  if (!ctx.authToken) throw new Error('Not signed in');
  const url = new URL(`http://127.0.0.1:${env.PORT}/api/v1${path}`);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${ctx.authToken}`,
      'X-Branch-Id': ctx.branchId,
      'Content-Type': 'application/json',
      'X-Client-Source': 'ai-assistant',
    },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

const callArgs = z
  .object({
    method: z.enum(METHODS),
    path: z.string().startsWith('/', 'path must start with /').max(300),
    query: z.record(z.unknown()).optional(),
    body: z.unknown().optional(),
    summary: z.string().max(200).optional(),
    changed: z.array(z.string()).max(30).optional(),
  })
  .superRefine((a, issue) => {
    const e = findEndpoint(a.method, a.path);
    if (!e) {
      issue.addIssue({ code: 'custom', message: `${a.method} ${a.path} is not a known endpoint — call list_api for the area first` });
      return;
    }
    if (a.method !== 'GET' && e.body) {
      const r = e.body.safeParse(a.body ?? {});
      if (!r.success) {
        for (const i of r.error.issues.slice(0, 8)) {
          issue.addIssue({ code: 'custom', message: `body.${i.path.join('.') || '(root)'}: ${i.message}` });
        }
      }
    }
  });

const humanize = (k: string) => k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

function show(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 140);
  return String(v).slice(0, 140);
}

function confirmCard(args: Record<string, unknown>): ConfirmCard {
  const method = args.method as string;
  const body = (args.body && typeof args.body === 'object' ? args.body : {}) as Record<string, unknown>;
  // For updates that resend the whole record, show only what actually changes.
  const changed = Array.isArray(args.changed) && args.changed.length ? new Set(args.changed as string[]) : null;
  const fields = Object.entries(body)
    .filter(([k]) => (changed ? changed.has(k) : true))
    .filter(([k]) => !/id$/i.test(k) || k === 'id')
    .slice(0, 14)
    .map(([k, v]) => ({ label: humanize(k), value: show(v) }));
  const verb = method === 'DELETE' ? 'Delete' : method === 'POST' ? 'Create / run' : 'Update';
  return {
    title: (args.summary as string) || `${verb}: ${args.path as string}`,
    fields: method === 'DELETE' ? [{ label: 'Warning', value: 'This permanently removes the record.' }, ...fields] : fields,
  };
}

export const PLATFORM_TOOLS: ToolDefinition[] = [
  {
    name: 'list_api',
    description:
      'List the exact actions available in one area of the platform (see "Platform areas" in the system prompt), with each endpoint\'s query and body shape. Call this before call_api whenever no dedicated tool fits. Use a sub-area like "finance/structures" for full input shapes; a top-level area like "hostel" lists everything in it.',
    kind: 'read',
    requiredPermission: { module: '*', action: '*' },
    parameters: {
      type: 'object',
      properties: { area: { type: 'string', description: 'e.g. "finance/fee-counter", "hostel", "hr/payroll"' } },
      required: ['area'],
      additionalProperties: false,
    },
    async execute(ctx, args): Promise<ToolResult> {
      const list = listArea(ctx.user, String(args.area ?? ''));
      if (list.length === 0) return { data: { error: `No actions available in "${String(args.area)}". Pick an area from the Platform areas list.` } };
      const detailed = list.length <= 40;
      return {
        data: {
          area: args.area,
          endpoints: list.slice(0, 80).map((e) => (detailed ? describeEndpoint(e) : { call: `${e.method} ${e.path}` })),
          ...(detailed ? {} : { hint: 'Many endpoints — call list_api with a sub-area to see input shapes.' }),
        },
      };
    },
  },

  {
    name: 'call_api',
    description:
      'Perform any platform action as the signed-in user, using an endpoint from list_api. GET reads data and returns it immediately (use filters/search/limit query params to keep results small; resolve names to ids with a GET first). POST/PUT/PATCH/DELETE change data: the user is shown a confirmation card and it runs only when they approve — include a short human "summary" of exactly what will happen. Replace :params in the path with real ids obtained from earlier GET calls.',
    kind: 'write',
    isWrite: (args) => String(args.method ?? 'GET').toUpperCase() !== 'GET',
    requiredPermission: { module: '*', action: '*' },
    parameters: {
      type: 'object',
      properties: {
        method: { type: 'string', enum: [...METHODS] },
        path: { type: 'string', description: 'Endpoint path below /api/v1 with real ids, e.g. /students/665f…/360' },
        query: { type: 'object', description: 'Query-string parameters', additionalProperties: true },
        body: { type: 'object', description: 'JSON body for POST/PUT/PATCH', additionalProperties: true },
        summary: { type: 'string', description: 'For changes: one plain sentence the user confirms, e.g. "Collect ₹12,000 from Devika Antony by UPI"' },
        changed: { type: 'array', items: { type: 'string' }, description: 'For PUT/PATCH that resend a whole record: the body fields whose values actually change' },
      },
      required: ['method', 'path'],
      additionalProperties: false,
    },
    argsSchema: callArgs,
    confirm: confirmCard,
    async execute(ctx, args): Promise<ToolResult> {
      const method = String(args.method).toUpperCase();
      const path = String(args.path);
      // Only catalogued endpoints: keeps sign-in, platform admin, payouts etc. out of reach.
      if (!findEndpoint(method, path)) {
        return { data: { error: `${method} ${path} is not available. Call list_api for the area first.` } };
      }
      const { ok, status, json } = await callPlatform(ctx, method, path, args.query as Record<string, unknown>, args.body);
      if (!ok) {
        const err = (json.error ?? {}) as { code?: string; message?: string; details?: unknown };
        const message = err.message ?? `Request failed (HTTP ${status})`;
        if (method === 'GET') return { data: { error: message, details: err.details } };
        throw new ApiError(err.code ?? "ACTION_FAILED", message, status, err.details as unknown[] | undefined);
      }
      if (method === 'GET') return { data: compact({ data: json.data, meta: json.meta }) };
      return { data: { message: (json.message as string) || `Done — ${(args.summary as string) || `${method} ${path}`}.`, result: compact(json.data) } };
    },
  },

  {
    name: 'open_page',
    description:
      'Take the user to a page of the app. Use when they ask to open/go to/show a screen, or when a page is the best place to finish a task. Only pages from the "Pages" list are valid.',
    kind: 'read',
    requiredPermission: { module: '*', action: '*' },
    parameters: {
      type: 'object',
      properties: { href: { type: 'string', description: 'A path from the Pages list, optionally with an id, e.g. /students/abc123' } },
      required: ['href'],
      additionalProperties: false,
    },
    async execute(ctx, args): Promise<ToolResult> {
      const href = String(args.href ?? '');
      const known = (ctx.pages ?? []).some((p) => href === p.href || href.startsWith(`${p.href}/`));
      if (!href.startsWith('/') || (ctx.pages?.length && !known)) {
        return { data: { error: `"${href}" is not a page this user can open.` } };
      }
      return { data: { navigate: href }, link: href };
    },
  },
];
