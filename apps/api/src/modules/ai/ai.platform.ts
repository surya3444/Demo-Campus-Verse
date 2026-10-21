import { z } from 'zod';
import { env } from '../../config/env';
import { ApiError } from '../../middleware/errorHandler';
import { describeEndpoint, findEndpoint, listArea } from './ai.catalog';
import type { ZodTypeAny } from 'zod';
import type {
  ActionForm,
  ConfirmCard,
  FormField,
  ToolContext,
  ToolDefinition,
  ToolResult,
} from './ai.types';

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

type Def = { typeName?: string } & Record<string, unknown>;
const defOf = (x: ZodTypeAny) => (x as unknown as { _def: Def })._def;

/** Peel optional/default/effects wrappers off a zod field. */
function unwrap(schema: ZodTypeAny): { inner: ZodTypeAny; optional: boolean } {
  let inner = schema;
  let optional = false;
  for (let i = 0; i < 8; i++) {
    const d = defOf(inner);
    if (['ZodOptional', 'ZodNullable', 'ZodDefault', 'ZodCatch'].includes(d.typeName ?? '')) {
      optional = true;
      inner = d.innerType as ZodTypeAny;
    } else if (d.typeName === 'ZodEffects') inner = d.schema as ZodTypeAny;
    else if (d.typeName === 'ZodPipeline') inner = d.in as ZodTypeAny;
    else if (d.typeName === 'ZodBranded') inner = d.type as ZodTypeAny;
    else break;
  }
  return { inner, optional };
}

function objectShape(schema: ZodTypeAny): Record<string, ZodTypeAny> | null {
  const { inner } = unwrap(schema);
  const d = defOf(inner);
  return d.typeName === 'ZodObject' ? (d.shape as () => Record<string, ZodTypeAny>)() : null;
}

const EDITABLE = ['ZodString', 'ZodNumber', 'ZodBoolean', 'ZodEnum', 'ZodNativeEnum', 'ZodDate'];
const LONG_TEXT =
  /description|notes?|message|content|body|remarks|address|bio|summary|details|reason|purpose|instructions/i;

function fieldFor(name: string, inner: ZodTypeAny, required: boolean): FormField {
  const d = defOf(inner);
  const label = humanize(name);
  const base = { name, label, required };
  switch (d.typeName) {
    case 'ZodNumber':
      return { ...base, type: 'number' };
    case 'ZodBoolean':
      return {
        ...base,
        type: 'select',
        options: [
          { value: 'true', label: 'Yes' },
          { value: 'false', label: 'No' },
        ],
      };
    case 'ZodEnum':
    case 'ZodNativeEnum': {
      const values = (
        d.typeName === 'ZodEnum' ? (d.values as string[]) : Object.values(d.values as object)
      ).filter((v): v is string => typeof v === 'string');
      return {
        ...base,
        type: 'select',
        options: values.map((v) => ({ value: v, label: humanize(v) })),
      };
    }
    case 'ZodDate':
      return { ...base, type: 'date' };
    default: {
      const checks = ((d.checks as Array<{ kind: string }> | undefined) ?? []).map((c) => c.kind);
      if (checks.includes('email')) return { ...base, type: 'email' };
      if (checks.includes('date') || checks.includes('datetime') || /date$/i.test(name))
        return { ...base, type: 'date' };
      if (/phone|mobile/i.test(name)) return { ...base, type: 'tel' };
      return { ...base, type: LONG_TEXT.test(name) ? 'textarea' : 'text' };
    }
  }
}

function formValue(v: unknown): unknown {
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
  return v;
}

/**
 * An editable form for a change to an endpoint with a declared body schema:
 * plain fields become inputs (enums → dropdowns), while ids and nested data
 * travel hidden. Null when the endpoint has no schema, or when a required id
 * is missing (the model must resolve it first).
 */
function buildForm(
  args: Record<string, unknown>
): { form: ActionForm; values: Record<string, unknown> } | null {
  const method = String(args.method ?? '').toUpperCase();
  if (!['POST', 'PUT', 'PATCH'].includes(method)) return null;
  const path = String(args.path ?? '');
  const e = findEndpoint(method, path);
  const shape = e?.body ? objectShape(e.body) : null;
  if (!shape) return null;
  const body = (args.body && typeof args.body === 'object' ? args.body : {}) as Record<
    string,
    unknown
  >;
  const changed =
    Array.isArray(args.changed) && args.changed.length ? new Set(args.changed as string[]) : null;

  const fields: FormField[] = [];
  const extra: Record<string, unknown> = {};
  for (const [name, schema] of Object.entries(shape)) {
    const { inner, optional } = unwrap(schema);
    const editable = EDITABLE.includes(defOf(inner).typeName ?? '') && !/Ids?$/.test(name);
    if (!editable || (changed && !changed.has(name))) {
      if (name in body) extra[name] = body[name];
      else if (!editable && !optional) return null;
      continue;
    }
    fields.push(fieldFor(name, inner, !optional));
  }
  if (fields.length === 0) return null;
  // Required first, then whatever the model already filled, then the rest.
  fields.sort(
    (a, b) =>
      Number(!!b.required) - Number(!!a.required) || Number(b.name in body) - Number(a.name in body)
  );
  for (const f of fields.slice(16)) if (f.name in body) extra[f.name] = body[f.name];
  const shown = fields.slice(0, 16);

  const values: Record<string, unknown> = {
    __method: method,
    __path: path,
    __summary: (args.summary as string) ?? '',
    __extra: JSON.stringify(extra),
  };
  for (const f of shown) if (f.name in body) values[f.name] = formValue(body[f.name]);
  const hidden = ['__method', '__path', '__summary', '__extra'].map((name) => ({
    name,
    label: name,
    type: 'hidden' as const,
  }));
  return {
    form: {
      title: (args.summary as string) || `${method === 'POST' ? 'Create' : 'Update'}: ${path}`,
      submitLabel: method === 'POST' ? 'Create' : 'Save changes',
      fields: [...shown, ...hidden],
    },
    values,
  };
}

/** A submitted form back into a call_api request, typed per the endpoint schema. */
function fromForm(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || !('__path' in raw)) return raw;
  const { __method, __path, __summary, __extra, ...vals } = raw as Record<string, unknown>;
  const method = String(__method ?? '').toUpperCase();
  const path = String(__path ?? '');
  const shape = (() => {
    const e = findEndpoint(method, path);
    return e?.body ? objectShape(e.body) : null;
  })();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(String(__extra || '{}')) as Record<string, unknown>;
  } catch {
    body = {};
  }
  for (const [k, v] of Object.entries(vals)) {
    const t = shape?.[k] ? defOf(unwrap(shape[k]).inner).typeName : undefined;
    body[k] =
      t === 'ZodNumber'
        ? Number(v)
        : t === 'ZodBoolean'
          ? v === 'true' || v === true
          : t === 'ZodDate'
            ? new Date(String(v))
            : v;
  }
  return { method, path, summary: __summary || undefined, body };
}

const callArgs = z.preprocess(
  fromForm,
  z
    .object({
      method: z.enum(METHODS),
      path: z.string().startsWith('/', 'path must start with /').max(300),
      query: z.record(z.unknown()).optional(),
      body: z.unknown().optional(),
      // Shown to the user; never a reason to reject the call.
      summary: z
        .string()
        .optional()
        .transform((v) => v?.slice(0, 240)),
      changed: z.array(z.string()).max(30).optional(),
    })
    .superRefine((a, issue) => {
      const e = findEndpoint(a.method, a.path);
      if (!e) {
        issue.addIssue({
          code: 'custom',
          message: `${a.method} ${a.path} is not a known endpoint — call list_api for the area first`,
        });
        return;
      }
      if (a.method !== 'GET' && e.body) {
        const r = e.body.safeParse(a.body ?? {});
        if (!r.success) {
          for (const i of r.error.issues.slice(0, 8)) {
            issue.addIssue({
              code: 'custom',
              message: `body.${i.path.join('.') || '(root)'}: ${i.message}`,
            });
          }
        }
      }
    })
);

const humanize = (k: string) =>
  k
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());

function show(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 140);
  return String(v).slice(0, 140);
}

function confirmCard(args: Record<string, unknown>): ConfirmCard {
  const method = args.method as string;
  const body = (args.body && typeof args.body === 'object' ? args.body : {}) as Record<
    string,
    unknown
  >;
  // For updates that resend the whole record, show only what actually changes.
  const changed =
    Array.isArray(args.changed) && args.changed.length ? new Set(args.changed as string[]) : null;
  const fields = Object.entries(body)
    .filter(([k]) => (changed ? changed.has(k) : true))
    .filter(([k]) => !/id$/i.test(k) || k === 'id')
    .slice(0, 14)
    .map(([k, v]) => ({ label: humanize(k), value: show(v) }));
  const verb = method === 'DELETE' ? 'Delete' : method === 'POST' ? 'Create / run' : 'Update';
  return {
    title: (args.summary as string) || `${verb}: ${args.path as string}`,
    fields:
      method === 'DELETE'
        ? [{ label: 'Warning', value: 'This permanently removes the record.' }, ...fields]
        : fields,
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
      properties: {
        area: { type: 'string', description: 'e.g. "finance/fee-counter", "hostel", "hr/payroll"' },
      },
      required: ['area'],
      additionalProperties: false,
    },
    async execute(ctx, args): Promise<ToolResult> {
      const list = listArea(ctx.user, String(args.area ?? ''));
      if (list.length === 0)
        return {
          data: {
            error: `No actions available in "${String(args.area)}". Pick an area from the Platform areas list.`,
          },
        };
      const detailed = list.length <= 40;
      return {
        data: {
          area: args.area,
          endpoints: list
            .slice(0, 80)
            .map((e) => (detailed ? describeEndpoint(e) : { call: `${e.method} ${e.path}` })),
          ...(detailed
            ? {}
            : { hint: 'Many endpoints — call list_api with a sub-area to see input shapes.' }),
        },
      };
    },
  },

  {
    name: 'call_api',
    description:
      'Perform any platform action as the signed-in user, using an endpoint from list_api. GET reads data and returns it immediately (use filters/search/limit query params to keep results small; resolve names to ids with a GET first). POST/PUT/PATCH/DELETE change data: the user is shown a confirmation card and it runs only when they approve — include a short human "summary" of exactly what will happen. Replace :params in the path with real ids obtained from earlier GET calls.',
    kind: 'write',
    isWrite: (args) => String(args.method ?? args.__method ?? 'GET').toUpperCase() !== 'GET',
    requiredPermission: { module: '*', action: '*' },
    parameters: {
      type: 'object',
      properties: {
        method: { type: 'string', enum: [...METHODS] },
        path: {
          type: 'string',
          description: 'Endpoint path below /api/v1 with real ids, e.g. /students/665f…/360',
        },
        query: {
          type: 'object',
          description: 'Query-string parameters',
          additionalProperties: true,
        },
        body: {
          type: 'object',
          description: 'JSON body for POST/PUT/PATCH',
          additionalProperties: true,
        },
        summary: {
          type: 'string',
          description:
            'For changes: one short plain sentence the user confirms, e.g. "Collect ₹12,000 from Devika Antony by UPI"',
        },
        changed: {
          type: 'array',
          items: { type: 'string' },
          description:
            'For PUT/PATCH that resend a whole record: the body fields whose values actually change',
        },
      },
      required: ['method', 'path'],
      additionalProperties: false,
    },
    argsSchema: callArgs,
    confirm: confirmCard,
    buildForm,
    async execute(ctx, args): Promise<ToolResult> {
      const method = String(args.method).toUpperCase();
      const path = String(args.path);
      // Only catalogued endpoints: keeps sign-in, platform admin, payouts etc. out of reach.
      if (!findEndpoint(method, path)) {
        return {
          data: { error: `${method} ${path} is not available. Call list_api for the area first.` },
        };
      }
      const { ok, status, json } = await callPlatform(
        ctx,
        method,
        path,
        args.query as Record<string, unknown>,
        args.body
      );
      if (!ok) {
        const err = (json.error ?? {}) as { code?: string; message?: string; details?: unknown };
        const message = err.message ?? `Request failed (HTTP ${status})`;
        if (method === 'GET') return { data: { error: message, details: err.details } };
        throw new ApiError(
          err.code ?? 'ACTION_FAILED',
          message,
          status,
          err.details as unknown[] | undefined
        );
      }
      if (method === 'GET') return { data: compact({ data: json.data, meta: json.meta }) };
      return {
        data: {
          message:
            (json.message as string) ||
            `Done — ${(args.summary as string) || `${method} ${path}`}.`,
          result: compact(json.data),
        },
      };
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
      properties: {
        href: {
          type: 'string',
          description: 'A path from the Pages list, optionally with an id, e.g. /students/abc123',
        },
      },
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
