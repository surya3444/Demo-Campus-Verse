import { describe, it, expect, vi } from 'vitest';

vi.mock('@/config/database', () => ({ collections: {}, getDb: vi.fn() }));

import { loginStatus } from '@/modules/organization/departmentOverview.service';

describe('loginStatus — mirrors the sign-in checks', () => {
  it('no user → no_account', () => {
    expect(loginStatus(undefined).state).toBe('no_account');
  });
  it('pending (temporary password) can sign in but must set a password', () => {
    expect(loginStatus({ status: 'pending' }).state).toBe('first_login');
    expect(loginStatus({ status: 'active', security: { mustChangePassword: true } }).state).toBe(
      'first_login'
    );
  });
  it('inactive or deleted → disabled; past validUntil → expired', () => {
    expect(loginStatus({ status: 'inactive' }).state).toBe('disabled');
    expect(loginStatus({ status: 'deleted' }).state).toBe('disabled');
    expect(loginStatus({ status: 'active', validUntil: new Date(Date.now() - 1000) }).state).toBe(
      'expired'
    );
  });
  it('active with a last sign-in → active and the date', () => {
    const r = loginStatus({ status: 'active', lastLogin: new Date('2026-10-14T10:00:00Z') });
    expect(r).toEqual({ state: 'active', lastLogin: '2026-10-14T10:00:00.000Z' });
  });
});
