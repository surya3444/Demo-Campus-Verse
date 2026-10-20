import type { ZodSchema } from 'zod';

/**
 * Machine-readable facts a middleware carries about the route it guards. The AI
 * assistant reads these to build its catalog of what the platform can do
 * (see modules/ai/ai.catalog.ts); request handling ignores them.
 */
export interface MiddlewareMeta {
  permission?: Array<{ module: string; action: string }>;
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
  all?: ZodSchema;
}

export const META = Symbol('middlewareMeta');

export function tagMiddleware<T extends object>(meta: MiddlewareMeta, fn: T): T {
  return Object.assign(fn, { [META]: meta });
}

export function readMeta(fn: unknown): MiddlewareMeta | undefined {
  return (fn as { [META]?: MiddlewareMeta } | null)?.[META];
}
