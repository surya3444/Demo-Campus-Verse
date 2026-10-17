import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Request } from 'express';
import { rateLimitKey } from '../../middleware/rateLimit';

const { SECRET } = vi.hoisted(() => ({ SECRET: 'test-access-secret-at-least-32-characters' }));
vi.mock('../../config/env', () => ({
  env: { JWT_ACCESS_SECRET: SECRET, RATE_LIMIT_WINDOW_MS: 60000, RATE_LIMIT_MAX_REQUESTS: 300 },
}));

const req = (authorization?: string) =>
  ({ headers: authorization ? { authorization } : {}, ip: '10.0.0.7' }) as unknown as Request;

describe('rateLimitKey', () => {
  it('gives each signed-in user their own bucket', () => {
    const a = jwt.sign({ userId: 'u1' }, SECRET);
    const b = jwt.sign({ userId: 'u2' }, SECRET);
    expect(rateLimitKey(req(`Bearer ${a}`))).toBe('user:u1');
    expect(rateLimitKey(req(`Bearer ${b}`))).toBe('user:u2');
  });

  it('falls back to the IP for anonymous, forged or expired tokens', () => {
    const forged = jwt.sign({ userId: 'u1' }, 'some-other-secret-that-is-long-enough');
    const expired = jwt.sign({ userId: 'u1', exp: Math.floor(Date.now() / 1000) - 60 }, SECRET);
    for (const h of [undefined, 'Bearer garbage', `Bearer ${forged}`, `Bearer ${expired}`]) {
      expect(rateLimitKey(req(h))).toBe('ip:10.0.0.7');
    }
  });
});
