import { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { collections } from '../config/database';
import { logger } from '../lib/logger';

/**
 * Application-wide activity / audit trail.
 *
 * A single global middleware that records EVERY authenticated mutating request
 * (POST/PUT/PATCH/DELETE) into `audit_logs` — who did what, on which resource,
 * with what result — without any per-service wiring. It hooks `res.on('finish')`
 * so the actor/tenant/branch (set by each route's auth middleware) are populated
 * by the time we record, and wraps `res.json` to capture a created entity's id.
 *
 * This is request-level (no field-level before/after diffs); domain modules that
 * need richer trails (AI assistant, approvals) keep their own explicit entries.
 */

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Sensitive keys scrubbed from the recorded change-summary.
const SENSITIVE_KEYS = new Set([
  'password',
  'currentpassword',
  'newpassword',
  'confirmpassword',
  'oldpassword',
  'token',
  'refreshtoken',
  'accesstoken',
  'secret',
  'apikey',
  'otp',
  'pin',
  'cvv',
]);

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
const MAX_CHANGE_BYTES = 8_000;

/** Routes never worth auditing (noise) or too sensitive to record bodies for. */
function isSkipped(method: string, path: string): boolean {
  if (!MUTATING.has(method)) return true;
  if (path.startsWith('/api/v1/auth/login')) return true;
  if (path.startsWith('/api/v1/auth/refresh')) return true;
  if (path.startsWith('/api/v1/auth/forgot-password')) return true;
  if (path.startsWith('/api/v1/auth/reset-password')) return true;
  if (path.startsWith('/api/v1/auth/signup')) return true;
  if (path.includes('/ai/chat/stream')) return true; // SSE, high-volume
  return false;
}

/** Shallow-redact a request body for storage: scrub secrets, summarise nesting. */
function redact(body: unknown, depth = 0): unknown {
  if (body === null || body === undefined) return undefined;
  if (typeof body !== 'object') return body;
  if (Array.isArray(body)) return `[array(${body.length})]`;
  if (depth >= 3) return '[object]';
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      out[k] = '[redacted]';
    } else if (v && typeof v === 'object') {
      out[k] = redact(v, depth + 1);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Cap the change-summary so a huge payload can't bloat the audit collection. */
function capSize(value: unknown): unknown {
  if (value === undefined) return undefined;
  try {
    const json = JSON.stringify(value);
    if (json.length <= MAX_CHANGE_BYTES) return value;
    return { _truncated: true, preview: json.slice(0, MAX_CHANGE_BYTES) };
  } catch {
    return undefined;
  }
}

/** Derive a human-ish action + resource from the method and path. */
function deriveAction(method: string, path: string): { resource: string; action: string } {
  const parts = path
    .replace(/^\/api\/v1\//, '')
    .split('?')[0]
    .split('/')
    .filter(Boolean);
  const verb = method === 'POST' ? 'create' : method === 'DELETE' ? 'delete' : 'update';
  if (parts.length === 0) return { resource: 'unknown', action: `unknown.${verb}` };

  const last = parts[parts.length - 1];
  const prev = parts[parts.length - 2];
  const isId = (s: string | undefined) => !!s && OBJECT_ID_RE.test(s);

  if (isId(last)) {
    // .../{resource}/{id}  → update or delete
    const resource = prev ?? parts[0];
    return { resource, action: `${resource}.${verb}` };
  }
  if (isId(prev)) {
    // .../{resource}/{id}/{subaction}  → a named action, e.g. students/:id/promote
    const resource = parts[parts.length - 3] ?? parts[0];
    return { resource, action: `${resource}.${last}` };
  }
  // .../{collection}  (create) or a named action with no id → use the last segment
  return { resource: last, action: `${last}.${verb}` };
}

/** The last ObjectId-looking segment of the path = the target entity, if any. */
function extractTargetId(path: string): string | null {
  const segs = path.split('?')[0].split('/');
  for (let i = segs.length - 1; i >= 0; i--) {
    if (OBJECT_ID_RE.test(segs[i])) return segs[i];
  }
  return null;
}

function toObjectId(value: string | undefined | null): ObjectId | null {
  if (!value || !OBJECT_ID_RE.test(value)) return null;
  try {
    return new ObjectId(value);
  } catch {
    return null;
  }
}

export function auditLog(req: Request, res: Response, next: NextFunction): void {
  const method = req.method;
  const path = req.originalUrl.split('?')[0];

  if (isSkipped(method, path)) {
    next();
    return;
  }

  // Capture a created entity's id from the JSON envelope ({ data: { _id } }).
  let createdId: string | null = null;
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    try {
      const data = (body as { data?: { _id?: unknown; id?: unknown } } | undefined)?.data;
      const id = data?._id ?? data?.id;
      if (id) createdId = String(id);
    } catch {
      /* non-standard body — ignore */
    }
    return originalJson(body as never);
  }) as Response['json'];

  res.on('finish', () => {
    // Only authenticated actions (req.user is set by the route's auth middleware).
    const user = req.user;
    if (!user) return;

    const statusCode = res.statusCode;
    const { resource, action } = deriveAction(method, path);
    const targetId = toObjectId(extractTargetId(path) ?? createdId);
    // Top-level module = first path segment (e.g. students, admissions, finance).
    const moduleName =
      path
        .replace(/^\/api\/v1\//, '')
        .split('?')[0]
        .split('/')
        .filter(Boolean)[0] ?? null;

    const entry = {
      _id: new ObjectId(),
      tenantId: toObjectId(req.tenantId),
      branchId: toObjectId(req.branchId),
      userId: toObjectId(user.userId),
      actorEmail: user.email,
      actorRole: user.roleCode,
      module: moduleName,
      method,
      path,
      action,
      targetType: resource,
      targetId,
      statusCode,
      success: statusCode < 400,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      // No body for deletes (the id is the meaningful part); redact + cap others.
      changes: method === 'DELETE' ? undefined : capSize(redact(req.body)),
      source: 'http' as const,
      createdAt: new Date(),
    };

    collections.auditLogs
      .insertOne(entry)
      .catch((err) => logger.warn({ err, action }, 'audit log write failed'));
  });

  next();
}
