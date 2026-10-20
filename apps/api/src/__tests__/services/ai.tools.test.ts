import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import type { TokenPayload } from '@campus-verse/shared';

// All mocks live in a hoisted block so the (hoisted) vi.mock factories below can
// reference them without TDZ errors.
const mocks = vi.hoisted(() => ({
  collections: {
    classes: { findOne: vi.fn() },
    sections: { findOne: vi.fn() },
    academicBatches: { findOne: vi.fn() },
    branches: { findOne: vi.fn() },
    leads: { findOne: vi.fn(), find: vi.fn() },
    auditLogs: { insertOne: vi.fn() },
  },
  studentService: { findAll: vi.fn(), getStats: vi.fn() },
  leadService: {
    findAll: vi.fn(),
    getStats: vi.fn(),
    create: vi.fn(),
    updateStage: vi.fn(),
    addFollowup: vi.fn(),
  },
  financeReportsService: { getDuesSummary: vi.fn() },
  feeTransactionService: { getDaySheet: vi.fn(), getCollectionSummary: vi.fn() },
  studentAttendanceService: { getDailyReport: vi.fn() },
  staffService: { getStats: vi.fn() },
  leaveService: { getApprovalStats: vi.fn() },
  dashboardService: { getBranchKPIs: vi.fn(), getBranchTodaySummary: vi.fn() },
}));

// env.ts validates JWT secrets at import; aiService imports it. Stub it (the
// executeAction path under test never touches the OpenAI key).
vi.mock('@/config/env', () => ({
  env: {
    OPENAI_API_KEY: undefined,
    OPENAI_CHAT_MODEL: 'gpt-4o-mini',
    OPENAI_CHAT_MODEL_COMPLEX: 'gpt-4o',
  },
}));

vi.mock('@/config/database', () => ({ collections: mocks.collections, getDb: vi.fn() }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/modules/student/student.service', () => ({ studentService: mocks.studentService }));
vi.mock('@/modules/admission/lead.service', () => ({ leadService: mocks.leadService }));
vi.mock('@/modules/finance/reports.service', () => ({
  financeReportsService: mocks.financeReportsService,
}));
vi.mock('@/modules/finance/feeTransaction.service', () => ({
  feeTransactionService: mocks.feeTransactionService,
}));
vi.mock('@/modules/attendance/studentAttendance.service', () => ({
  studentAttendanceService: mocks.studentAttendanceService,
}));
vi.mock('@/modules/hr/staff.service', () => ({ staffService: mocks.staffService }));
vi.mock('@/modules/hr/leave.service', () => ({ leaveService: mocks.leaveService }));
vi.mock('@/modules/dashboard/dashboard.service', () => ({
  dashboardService: mocks.dashboardService,
}));

import { buildToolsForUser, getPermittedTool, TOOLS } from '../../modules/ai/ai.tools';
import { aiService } from '../../modules/ai/ai.service';
import { ApiError } from '../../middleware/errorHandler';

const TENANT = new ObjectId().toString();
const BRANCH = new ObjectId().toString();

function makeUser(permissions: Record<string, string[]>, roleLevel = 5): TokenPayload {
  return {
    userId: new ObjectId().toString(),
    tenantId: TENANT,
    email: 'u@test.com',
    roleCode: 'TEACHER',
    roleLevel,
    permissions,
    accessScope: { type: 'branch', branchIds: [BRANCH] },
    type: 'access',
  } as TokenPayload;
}

const ctx = (user: TokenPayload) => ({ tenantId: TENANT, branchId: BRANCH, user });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buildToolsForUser — permission filtering', () => {
  it('exposes only the tools a user is permitted for', () => {
    const user = makeUser({ 'students.list': ['view'] });
    const names = buildToolsForUser(user).map((t) => t.name);
    expect(names).toContain('get_student_stats');
    expect(names).toContain('find_students');
    expect(names).not.toContain('get_fee_dues');
    expect(names).not.toContain('get_staff_stats');
  });

  it('maps finance permissions to the matching finance tools', () => {
    const user = makeUser({ 'finance.dues': ['view'], 'finance.collections': ['view'] });
    const names = buildToolsForUser(user)
      .map((t) => t.name)
      .sort();
    expect(names).toEqual(['call_api', 'get_fee_collection', 'get_fee_dues', 'list_api', 'open_page']);
  });

  it('offers only the platform tools when no dedicated tool matches', () => {
    const names = buildToolsForUser(makeUser({ 'teaching.myClasses': ['view'] })).map((t) => t.name);
    expect(names.sort()).toEqual(['call_api', 'list_api', 'open_page']);
  });

  it('offers nothing to a user without any permissions', () => {
    expect(buildToolsForUser(makeUser({}))).toHaveLength(0);
  });

  it('read tools require "view"; write tools require create/edit and carry schema+confirm', () => {
    for (const tool of TOOLS) {
      expect(tool.requiredPermission.module).toBeTruthy();
      if (tool.kind === 'read') {
        expect(tool.requiredPermission.action).toBe('view');
      } else {
        expect(['create', 'edit']).toContain(tool.requiredPermission.action);
        expect(tool.argsSchema).toBeTruthy();
        // Write tools propose the action either via a confirmation card
        // (confirm) or an inline prefilled form (form) — see ai.types.ts
        expect(typeof tool.confirm === 'function' || !!tool.form).toBe(true);
      }
    }
  });

  it('exposes write tools only with the matching create/edit permission', () => {
    const viewer = makeUser({ 'admissions.leads': ['view'] });
    const viewerNames = buildToolsForUser(viewer).map((t) => t.name);
    expect(viewerNames).toContain('get_lead_stats');
    expect(viewerNames).not.toContain('create_lead');
    expect(viewerNames).not.toContain('update_lead_stage');

    const editor = makeUser({ 'admissions.leads': ['view', 'create', 'edit'] });
    const editorNames = buildToolsForUser(editor).map((t) => t.name);
    expect(editorNames).toEqual(
      expect.arrayContaining([
        'get_lead_stats',
        'create_lead',
        'update_lead_stage',
        'add_lead_followup',
      ])
    );
  });
});

describe('executeAction — server re-checks permission and validates args', () => {
  it('executes create_lead with ctx tenant/branch + acting user, stripping spoofed fields', async () => {
    mocks.leadService.create.mockResolvedValue({
      _id: new ObjectId().toString(),
      leadNumber: 'LD25-0001',
      displayName: 'John Doe',
    });

    const user = makeUser({ 'admissions.leads': ['create'] });
    const result = await aiService.executeAction(ctx(user), 'create_lead', {
      firstName: 'John',
      lastName: 'Doe',
      phone: '9999999999',
      tenantId: 'EVIL', // not in the schema → stripped by zod before service call
    });

    expect(mocks.leadService.create).toHaveBeenCalledTimes(1);
    const [calledTenant, calledBranch, data, createdBy] = mocks.leadService.create.mock.calls[0];
    expect(calledTenant).toBe(TENANT);
    expect(calledBranch).toBe(BRANCH);
    expect(createdBy).toBe(user.userId);
    expect(data).not.toHaveProperty('tenantId');
    expect(data).toMatchObject({
      firstName: 'John',
      lastName: 'Doe',
      contact: { phone: '9999999999' },
    });
    expect(String(result.data && (result.data as Record<string, unknown>).message)).toContain(
      'Created lead LD25-0001'
    );
  });

  it('rejects a write the user is not permitted for (403) without touching the service', async () => {
    const user = makeUser({ 'admissions.leads': ['view'] }); // no create
    await expect(
      aiService.executeAction(ctx(user), 'create_lead', {
        firstName: 'A',
        lastName: 'B',
        phone: '12345',
      })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.leadService.create).not.toHaveBeenCalled();
  });

  it('rejects invalid args (400) before executing', async () => {
    const user = makeUser({ 'admissions.leads': ['create'] });
    await expect(
      aiService.executeAction(ctx(user), 'create_lead', { firstName: 'A' }) // missing lastName/phone
    ).rejects.toBeInstanceOf(ApiError);
    expect(mocks.leadService.create).not.toHaveBeenCalled();
  });
});

describe('getPermittedTool', () => {
  it('returns the tool when permitted, null otherwise', () => {
    const allowed = makeUser({ 'finance.dues': ['view'] });
    expect(getPermittedTool(allowed, 'get_fee_dues')?.name).toBe('get_fee_dues');
    expect(getPermittedTool(allowed, 'get_staff_stats')).toBeNull();
    expect(getPermittedTool(allowed, 'no_such_tool')).toBeNull();
  });
});

describe('tenant/branch isolation — tools never trust model args', () => {
  it('find_students injects ctx tenant/branch and ignores any tenantId in args', async () => {
    mocks.studentService.findAll.mockResolvedValue({
      data: [
        {
          displayName: 'Asha Rao',
          admissionNumber: 'APP24-1',
          status: 'active',
          currentEnrollment: { className: '10', sectionName: 'A' },
          contact: { phone: '900' },
        },
      ],
      meta: { total: 1 },
    });

    const user = makeUser({ 'students.list': ['view'] });
    const tool = getPermittedTool(user, 'find_students')!;

    const result = await tool.execute(ctx(user), {
      search: 'asha',
      tenantId: 'EVIL_TENANT', // attacker-controlled; must be ignored
      branchId: 'EVIL_BRANCH',
    });

    expect(mocks.studentService.findAll).toHaveBeenCalledTimes(1);
    const [calledTenant, calledBranch, params] = mocks.studentService.findAll.mock.calls[0];
    expect(calledTenant).toBe(TENANT);
    expect(calledBranch).toBe(BRANCH);
    expect(calledTenant).not.toBe('EVIL_TENANT');
    expect(params).toMatchObject({ search: 'asha' });
    // The injected args must not have leaked the spoofed tenant/branch through.
    expect(params).not.toHaveProperty('tenantId', 'EVIL_TENANT');

    expect(result.data).toMatchObject({ total: 1 });
    expect(result.link).toContain('/students');
  });

  it('get_fee_dues reports a clear message when no academic batch is current', async () => {
    mocks.collections.academicBatches.findOne.mockResolvedValue(null);
    const user = makeUser({ 'finance.dues': ['view'] });
    const tool = getPermittedTool(user, 'get_fee_dues')!;
    const result = await tool.execute(ctx(user), {});
    expect(mocks.financeReportsService.getDuesSummary).not.toHaveBeenCalled();
    expect(JSON.stringify(result.data)).toContain('No active academic batch');
  });
});
