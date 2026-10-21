import { describe, it, expect } from 'vitest';
import {
  PERMISSIONS,
  TEACHER_PERMISSIONS,
  BRANCH_ADMIN_PERMISSIONS,
} from '@campus-verse/shared/constants';
import {
  resolvePermissions,
  defaultPermissions,
  allPermissionKeys,
} from '@/modules/auth/permissionResolver';

describe('resolvePermissions', () => {
  it('gives full access to the group owner', () => {
    expect(Object.keys(resolvePermissions({ code: 'GROUP_OWNER' }))).toEqual(
      expect.arrayContaining(['finance.feeCounter', 'clubs.manage', 'students.fees'])
    );
  });

  it('keeps custom roles as saved, with the assistant on until decided', () => {
    const permissions = { 'hostel.rooms': ['view'] };
    expect(resolvePermissions({ code: 'WARDEN_ASSISTANT', permissions })).toEqual({
      ...permissions,
      'ai.assistant': ['use'],
    });
    // Saved in the editor with the assistant off: it stays off.
    expect(
      resolvePermissions({
        code: 'WARDEN_ASSISTANT',
        permissions,
        permissionKeysSeen: allPermissionKeys(),
      })
    ).toEqual(permissions);
  });

  it('tops up a never-customised built-in role with its defaults', () => {
    const out = resolvePermissions({ code: 'TEACHER', permissions: {} });
    expect(out['teaching.myClasses']).toEqual(TEACHER_PERMISSIONS['teaching.myClasses']);
  });

  it('honours what an admin switched off once the role was saved', () => {
    const saved = { ...TEACHER_PERMISSIONS } as Record<string, string[]>;
    delete saved['health.records'];
    const out = resolvePermissions({
      code: 'TEACHER',
      permissions: saved,
      permissionKeysSeen: allPermissionKeys(),
    });
    expect(out['health.records']).toBeUndefined();
    expect(out['teaching.myClasses']).toBeDefined();
  });

  it('still adds modules released after the role was saved', () => {
    const out = resolvePermissions({
      code: 'ACCOUNTANT',
      permissions: { 'finance.feeCounter': ['view'] },
      permissionKeysSeen: allPermissionKeys().filter((k) => k !== 'students.fees'),
    });
    expect(out['students.fees']).toEqual(['view']);
    expect(out['finance.feeCounter']).toEqual(['view']); // saved actions win
  });

  it('gives admins the modules they used to reach by bypass, without teacher-only keys', () => {
    const d = defaultPermissions('BRANCH_ADMIN')!;
    expect(d['health.records']).toEqual(PERMISSIONS['health.records']);
    expect(d['transport.buses']).toEqual(PERMISSIONS['transport.buses']);
    expect(BRANCH_ADMIN_PERMISSIONS['students.fees']).toEqual(['view']);
    expect(resolvePermissions({ code: 'BRANCH_ADMIN' })['teaching.myClasses']).toBeUndefined();
  });

  it('lets an admin role be customised too', () => {
    const out = resolvePermissions({
      code: 'BRANCH_ADMIN',
      permissions: { 'students.list': ['view'] },
      permissionKeysSeen: allPermissionKeys(),
    });
    expect(out).toEqual({ 'students.list': ['view'] });
  });
});
