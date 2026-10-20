import type { Application } from 'express';
import type { ZodTypeAny } from 'zod';
import type { TokenPayload } from '@campus-verse/shared';
import { readMeta, type MiddlewareMeta } from '../../middleware/meta';
import { hasPermission } from '../../middleware/rbac';

/**
 * Every API endpoint the assistant may drive on the user's behalf, read from the
 * live Express router: path, method, required permission and input schemas come
 * from the middleware itself (requirePermission / validate*), so the catalog can
 * never drift from what the platform actually does.
 */
export interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Path below /api/v1, e.g. /finance/fee-structures/:id */
  path: string;
  permissions: Array<{ module: string; action: string }>;
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  /** Field names read from the handler's own code when no schema is declared. */
  bodyFields?: string[];
  queryFields?: string[];
  matcher: RegExp;
}

/**
 * Field names a handler reads from req.body / req.query, taken from its source
 * (`const { a, b } = req.body`, `req.query.c`). A fallback for the routes that
 * validate inside the controller instead of with a zod schema.
 */
function fieldsRead(fn: unknown, source: 'body' | 'query'): string[] {
  if (typeof fn !== 'function') return [];
  const code = Function.prototype.toString.call(fn);
  const names = new Set<string>();
  const destructure = new RegExp(`(?:const|let|var)\\s*\\{([^}]*)\\}\\s*=\\s*req\\.${source}\\b`, 'g');
  for (const m of code.matchAll(destructure)) {
    for (const part of m[1].split(',')) {
      const name = part.split(/[:=]/)[0].replace(/\.\.\./, '').trim();
      if (/^\w+$/.test(name)) names.add(name);
    }
  }
  for (const m of code.matchAll(new RegExp(`req\\.${source}\\.(\\w+)`, 'g'))) names.add(m[1]);
  for (const m of code.matchAll(new RegExp(`req\\.${source}\\[['"](\\w+)['"]\\]`, 'g'))) names.add(m[1]);
  return [...names].slice(0, 30);
}

// Surfaces the assistant must never drive: sign-in/session, platform admin, the
// public website, raw uploads, its own endpoints and machine-to-machine hooks.
const EXCLUDED = [
  /^\/auth\b/,
  /^\/admin\b/,
  /^\/ai\b/,
  /^\/upload\b/,
  /^\/careers\b/,
  /^\/blog\b/,
  /^\/marketing-leads\b/,
  /^\/registration\b/,
  /^\/scheduler\b/,
  /webhook/i,
  /\/payouts?\b/i, // real money leaves the bank: humans only
  /\/razorpay/i,
];

let catalog: Endpoint[] | null = null;
let appRef: Application | null = null;

/** Called once at startup with the fully-mounted app. */
export function registerApp(app: Application): void {
  appRef = app;
  catalog = null;
}

interface Layer {
  route?: { path: unknown; methods: Record<string, boolean>; stack: Layer[] };
  handle: { stack?: Layer[] } & object;
  regexp: RegExp & { fast_slash?: boolean };
  keys: Array<{ name: string }>;
}

/** Recover the mount path Express 4 compiled into a router layer's regexp. */
function mountPath(layer: Layer): string {
  if (layer.regexp.fast_slash) return '';
  let i = 0;
  const src = layer.regexp.source
    .replace(/^\^/, '')
    .replace(/\\\/\?\(\?=\\\/\|\$\)$/, '')
    .replace(/\(\?:\(\[\^\\\/\]\+\?\)\)/g, () => `:${layer.keys[i++]?.name ?? 'param'}`)
    .replace(/\\\//g, '/');
  return src.replace(/\/$/, '');
}

function walk(stack: Layer[], prefix: string, inherited: MiddlewareMeta[], out: Endpoint[]): void {
  const metas = [...inherited];
  for (const layer of stack) {
    if (layer.route) {
      if (typeof layer.route.path !== 'string') continue;
      const all = [...metas, ...layer.route.stack.map((l) => readMeta(l.handle)).filter(Boolean)] as MiddlewareMeta[];
      const path = (prefix + layer.route.path).replace(/\/$/, '') || '/';
      for (const m of Object.keys(layer.route.methods)) {
        const method = m.toUpperCase() as Endpoint['method'];
        if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) continue;
        out.push({
          method,
          path,
          permissions: all.flatMap((x) => x.permission ?? []),
          body: all.find((x) => x.body)?.body as ZodTypeAny | undefined,
          query: all.find((x) => x.query)?.query as ZodTypeAny | undefined,
          bodyFields: fieldsRead(layer.route.stack.at(-1)?.handle, 'body'),
          queryFields: fieldsRead(layer.route.stack.at(-1)?.handle, 'query'),
          matcher: /$^/,
        });
      }
    } else if (layer.handle.stack) {
      walk(layer.handle.stack, prefix + mountPath(layer), metas, out);
    } else {
      const meta = readMeta(layer.handle);
      if (meta) metas.push(meta);
    }
  }
}

export function getCatalog(): Endpoint[] {
  if (catalog) return catalog;
  const router = (appRef as unknown as { _router?: { stack: Layer[] } })?._router;
  if (!router) return [];
  const found: Endpoint[] = [];
  walk(router.stack, '', [], found);
  const seen = new Set<string>();
  catalog = found
    .filter((e) => e.path.startsWith('/api/v1/'))
    .map((e) => {
      // Drop inline param patterns (/leaves/:id([0-9a-f]{24})) — ids are matched loosely.
      const path = e.path.slice('/api/v1'.length).replace(/:(\w+)\([^)]*\)/g, ':$1');
      const rx = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:(\w+)/g, '[^/]+');
      return { ...e, path, matcher: new RegExp(`^${rx}$`) };
    })
    .filter((e) => !EXCLUDED.some((rx) => rx.test(e.path)))
    .filter((e) => {
      const k = `${e.method} ${e.path}`;
      return seen.has(k) ? false : (seen.add(k), true);
    });
  return catalog;
}

export function canUse(user: TokenPayload, e: Endpoint): boolean {
  // Routes guarded by requireAnyPermission list alternatives; any one suffices.
  return e.permissions.length === 0 || e.permissions.some((p) => hasPermission(user, p.module, p.action));
}

export function findEndpoint(method: string, path: string): Endpoint | undefined {
  const clean = path.split('?')[0].replace(/\/$/, '');
  const list = getCatalog().filter((e) => e.method === method.toUpperCase() && e.matcher.test(clean));
  // Prefer literal segments over params (/students/stats over /students/:id).
  return list.sort((a, b) => (b.path.match(/\/[^:/][^/]*/g)?.length ?? 0) - (a.path.match(/\/[^:/][^/]*/g)?.length ?? 0))[0];
}

const areaOf = (path: string) => path.split('/').filter((x) => x && !x.startsWith(':')).slice(0, 2).join('/');

/**
 * The map the model navigates by: every area the user may act in, e.g.
 * "finance: fee-counter, structures, transactions". Compact enough to live in
 * the system prompt so the model always knows where to look.
 */
export function areaIndex(user: TokenPayload): string {
  const groups = new Map<string, Set<string>>();
  for (const e of getCatalog()) {
    if (!canUse(user, e)) continue;
    const [top, sub] = areaOf(e.path).split('/');
    if (!groups.has(top)) groups.set(top, new Set());
    if (sub) groups.get(top)!.add(sub);
  }
  return [...groups].map(([top, subs]) => `${top}: ${[...subs].join(', ') || '(root)'}`).join('\n');
}

/** Endpoints in an area ("finance" or "finance/structures") the user may call. */
export function listArea(user: TokenPayload, area: string): Endpoint[] {
  const want = area.replace(/^\/+|\/+$/g, '').toLowerCase();
  return getCatalog().filter((e) => canUse(user, e) && (areaOf(e.path) === want || areaOf(e.path).startsWith(`${want}/`)));
}

type Def = { typeName?: string } & Record<string, unknown>;

/**
 * Describe a zod schema as a compact TypeScript-like shape the model can follow,
 * e.g. `{ amount: number; mode?: "cash"|"upi"; items: { name: string }[] }`.
 */
export function describeSchema(schema: ZodTypeAny | undefined, depth = 0): string {
  if (!schema) return 'none';
  const def = (schema as unknown as { _def: Def })._def;
  if (depth > 4) return 'object';
  const inner = (s: unknown) => describeSchema(s as ZodTypeAny, depth + 1);
  switch (def.typeName) {
    case 'ZodString': {
      const checks = (def.checks as Array<{ kind: string }> | undefined)?.map((c) => c.kind) ?? [];
      const fmt = ['email', 'datetime', 'date', 'url', 'uuid', 'regex'].find((k) => checks.includes(k));
      return fmt && fmt !== 'regex' ? `string(${fmt})` : 'string';
    }
    case 'ZodNumber':
      return 'number';
    case 'ZodBoolean':
      return 'boolean';
    case 'ZodDate':
      return 'string(date)';
    case 'ZodAny':
    case 'ZodUnknown':
      return 'any';
    case 'ZodLiteral':
      return JSON.stringify(def.value);
    case 'ZodEnum':
      return (def.values as string[]).map((v) => JSON.stringify(v)).join('|');
    case 'ZodNativeEnum':
      return Object.values(def.values as object).filter((v) => typeof v === 'string').map((v) => JSON.stringify(v)).join('|');
    case 'ZodArray':
      return `${inner(def.type)}[]`;
    case 'ZodOptional':
    case 'ZodNullable':
    case 'ZodDefault':
    case 'ZodCatch':
    case 'ZodReadonly':
      return inner(def.innerType);
    case 'ZodEffects':
      return inner(def.schema);
    case 'ZodPipeline':
      return inner(def.in);
    case 'ZodBranded':
      return inner(def.type);
    case 'ZodLazy':
      return 'object';
    case 'ZodRecord':
      return `Record<string, ${inner(def.valueType)}>`;
    case 'ZodUnion':
    case 'ZodDiscriminatedUnion': {
      const opts = (Array.isArray(def.options) ? def.options : [...(def.options as Map<unknown, unknown>).values()]) as unknown[];
      return opts.slice(0, 4).map(inner).join(' | ');
    }
    case 'ZodIntersection':
      return `${inner(def.left)} & ${inner(def.right)}`;
    case 'ZodObject': {
      const shape = (def.shape as () => Record<string, ZodTypeAny>)();
      const parts = Object.entries(shape).map(([k, v]) => {
        const t = (v as unknown as { _def: Def })._def.typeName;
        const optional = t === 'ZodOptional' || t === 'ZodDefault' || v.isOptional?.();
        return `${k}${optional ? '?' : ''}: ${describeSchema(v, depth + 1)}`;
      });
      return `{ ${parts.join('; ')} }`;
    }
    default:
      return 'any';
  }
}

/** One endpoint as the model sees it. */
export function describeEndpoint(e: Endpoint): Record<string, string> {
  const out: Record<string, string> = { call: `${e.method} ${e.path}` };
  if (e.query) out.query = describeSchema(e.query).slice(0, 900);
  else if (e.queryFields?.length) out.query = `{ ${e.queryFields.join(', ')} } (all optional)`;
  if (e.body) out.body = describeSchema(e.body).slice(0, 1800);
  else if (e.method !== 'GET' && e.method !== 'DELETE' && e.bodyFields?.length) {
    out.body = `{ ${e.bodyFields.join(', ')} } (types not declared; *Id fields take ids from GET results)`;
  } else if (e.method === 'PUT' || e.method === 'PATCH') {
    out.body = 'same field names as the record returned by the matching GET; send only what changes';
  } else if (e.method === 'POST' && !e.path.includes('/:')) {
    out.body = 'not declared; mirror the field names of records from the matching list GET';
  }
  return out;
}
