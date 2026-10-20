import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { TokenPayload } from '@campus-verse/shared';
import { collections } from '../../config/database';
import { hasPermission } from '../../middleware/rbac';
import { ApiError } from '../../middleware/errorHandler';
import { logger } from '../../lib/logger';
import { now } from '../../utils/dates';
import { studentService } from '../student/student.service';
import { leadService } from '../admission/lead.service';
import { financeReportsService } from '../finance/reports.service';
import { feeTransactionService } from '../finance/feeTransaction.service';
import { studentAttendanceService } from '../attendance/studentAttendance.service';
import { staffService } from '../hr/staff.service';
import { leaveService } from '../hr/leave.service';
import { dashboardService } from '../dashboard/dashboard.service';
import { gradeService } from '../teaching/grade.service';
import { reportCardService } from '../exams/reportCard.service';
import { timetableService } from '../teaching/timetable.service';
import type { ToolContext, ToolDefinition, ToolResult } from './ai.types';
import { PLATFORM_TOOLS } from './ai.platform';

const NO_ARGS = { type: 'object', properties: {}, additionalProperties: false } as const;

/** Shown when a student-scoped tool runs but no student record is linked. */
const NO_STUDENT_MSG = 'No student record is linked to your account.';

function todayISO(): string {
  return now().format('YYYY-MM-DD');
}

function monthStartISO(): string {
  return now().startOf('month').format('YYYY-MM-DD');
}

/** Resolve the tenant/branch's current academic batch (needed for dues). */
async function resolveCurrentBatchId(tenantId: string, branchId: string): Promise<string | null> {
  const tenantObj = new ObjectId(tenantId);
  const branchObj = new ObjectId(branchId);
  const batch =
    (await collections.academicBatches.findOne(
      { tenantId: tenantObj, branchId: branchObj, isCurrent: true },
      { projection: { _id: 1 } }
    )) ??
    (await collections.academicBatches.findOne(
      { tenantId: tenantObj, isCurrent: true },
      { projection: { _id: 1 } }
    ));
  return batch ? batch._id.toString() : null;
}

/** Resolve a class by display/name within the branch → classId string. */
async function resolveClassId(ctx: ToolContext, className?: string): Promise<string | undefined> {
  if (!className) return undefined;
  const cls = await collections.classes.findOne(
    {
      tenantId: new ObjectId(ctx.tenantId),
      branchId: new ObjectId(ctx.branchId),
      $or: [
        { displayName: { $regex: `^${escapeRegex(className)}$`, $options: 'i' } },
        { name: { $regex: `^${escapeRegex(className)}$`, $options: 'i' } },
      ],
    },
    { projection: { _id: 1 } }
  );
  return cls?._id.toString();
}

async function resolveSectionId(
  ctx: ToolContext,
  sectionName?: string,
  classId?: string
): Promise<string | undefined> {
  if (!sectionName) return undefined;
  const filter: Record<string, unknown> = {
    tenantId: new ObjectId(ctx.tenantId),
    branchId: new ObjectId(ctx.branchId),
    name: { $regex: `^${escapeRegex(sectionName)}$`, $options: 'i' },
  };
  if (classId) filter.classId = new ObjectId(classId);
  const section = await collections.sections.findOne(filter, { projection: { _id: 1 } });
  return section?._id.toString();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compactStudent(s: Record<string, unknown>): Record<string, unknown> {
  const enrollment = (s.currentEnrollment ?? {}) as Record<string, unknown>;
  const contact = (s.contact ?? {}) as Record<string, unknown>;
  return {
    name: s.displayName ?? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim(),
    admissionNumber: s.admissionNumber,
    class: enrollment.className,
    section: enrollment.sectionName,
    status: s.status,
    phone: contact.phone,
  };
}

/**
 * Resolve a single active lead the user referenced by leadNumber (exact) or a
 * name/phone search. Throws a clear, model-readable error when nothing matches
 * or the search is ambiguous, so the assistant can ask the user to clarify.
 */
async function resolveLead(
  ctx: ToolContext,
  ref: { leadNumber?: string; search?: string }
): Promise<{ leadId: string; displayName: string; leadNumber: string; stage: string }> {
  const base = { tenantId: new ObjectId(ctx.tenantId), branchId: new ObjectId(ctx.branchId) };

  if (ref.leadNumber) {
    const lead = await collections.leads.findOne({
      ...base,
      leadNumber: { $regex: `^${escapeRegex(ref.leadNumber)}$`, $options: 'i' },
    });
    if (!lead) {
      throw new ApiError('LEAD_NOT_FOUND', `No lead found with number "${ref.leadNumber}".`, 404);
    }
    return {
      leadId: lead._id.toString(),
      displayName: lead.displayName as string,
      leadNumber: lead.leadNumber as string,
      stage: lead.stage as string,
    };
  }

  if (ref.search) {
    const rx = { $regex: escapeRegex(ref.search), $options: 'i' };
    const matches = await collections.leads
      .find({
        ...base,
        status: 'active',
        $or: [
          { firstName: rx },
          { lastName: rx },
          { displayName: rx },
          { leadNumber: rx },
          { 'contact.phone': rx },
        ],
      })
      .limit(6)
      .toArray();

    if (matches.length === 0) {
      throw new ApiError('LEAD_NOT_FOUND', `No active lead matches "${ref.search}".`, 404);
    }
    if (matches.length > 1) {
      const candidates = matches
        .map((l) => `${l.displayName as string} (${l.leadNumber as string})`)
        .join(', ');
      throw new ApiError(
        'LEAD_AMBIGUOUS',
        `Multiple leads match "${ref.search}": ${candidates}. Ask the user which one (use the lead number).`,
        400
      );
    }
    const lead = matches[0];
    return {
      leadId: lead._id.toString(),
      displayName: lead.displayName as string,
      leadNumber: lead.leadNumber as string,
      stage: lead.stage as string,
    };
  }

  throw new ApiError('LEAD_REF_REQUIRED', 'Provide a lead number or a name/phone to search.', 400);
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Find a section from loose wording ("mech year 4 A", "Grade 5 B"): every word
 * must prefix-match the class name or equal the section name. Throws a
 * model-readable error listing candidates when nothing or too much matches.
 */
async function resolveSectionByName(ctx: ToolContext, query: string): Promise<{ id: string; label: string }> {
  const base = { tenantId: new ObjectId(ctx.tenantId), branchId: new ObjectId(ctx.branchId) };
  const [sections, classes] = await Promise.all([
    collections.sections.find(base, { projection: { name: 1, classId: 1 } }).toArray(),
    collections.classes.find(base, { projection: { displayName: 1, name: 1 } }).toArray(),
  ]);
  const className = new Map(classes.map((c) => [String(c._id), String(c.displayName ?? c.name ?? '')]));
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && !['year', 'class', 'section', 'sec', 'grade', 'the', 'of'].includes(w));
  const scored = sections.map((sec) => {
    const cls = className.get(String(sec.classId)) ?? '';
    const tokens = cls.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const secName = String(sec.name ?? '').toLowerCase();
    const hits = words.filter((w) => w === secName || tokens.some((t) => t === w || (w.length > 2 && t.startsWith(w)))).length;
    return { id: String(sec._id), label: `${cls} · Section ${String(sec.name ?? '')}`, hits, exactSection: words.includes(secName) };
  });
  const best = Math.max(0, ...scored.map((x) => x.hits));
  let top = scored.filter((x) => x.hits === best && best > 0);
  if (top.length > 1 && top.some((x) => x.exactSection)) top = top.filter((x) => x.exactSection);
  if (top.length === 1 && best >= Math.min(words.length, 2)) return top[0];
  if (top.length === 0) throw new ApiError('SECTION_NOT_FOUND', `No class/section matches "${query}".`, 404);
  throw new ApiError(
    'SECTION_AMBIGUOUS',
    `"${query}" matches several sections: ${top.slice(0, 8).map((x) => x.label).join('; ')}. Ask the user which one.`,
    400
  );
}

type TimetableRow = { dayOfWeek: number; startTime?: string; endTime?: string; slotOrder?: number; subjectName?: string; teacherName?: string; className?: string; sectionName?: string; roomNumber?: string; batchName?: string | null };

/** A week as compact day → periods rows, small enough to show whole. */
function weekView(rows: TimetableRow[], withClass: boolean) {
  return [...new Set(rows.map((r) => r.dayOfWeek))]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((d) => ({
      day: DAYS[d] ?? String(d),
      periods: rows
        .filter((r) => r.dayOfWeek === d)
        .sort((a, b) => (a.slotOrder ?? 0) - (b.slotOrder ?? 0))
        .map((r) =>
          [
            `${r.startTime ?? ''}–${r.endTime ?? ''}`,
            r.subjectName,
            withClass ? `${r.className ?? ''} ${r.sectionName ?? ''}`.trim() : r.teacherName,
            r.batchName ? `batch ${r.batchName}` : '',
            r.roomNumber ? `room ${r.roomNumber}` : '',
          ]
            .filter(Boolean)
            .join(' | ')
        ),
    }));
}

/** Best-effort audit trail for AI-initiated writes. Never blocks the action. */
async function writeAudit(
  ctx: ToolContext,
  action: string,
  targetType: string,
  targetId: string | null,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    await collections.auditLogs.insertOne({
      _id: new ObjectId(),
      tenantId: new ObjectId(ctx.tenantId),
      branchId: new ObjectId(ctx.branchId),
      userId: new ObjectId(ctx.user.userId),
      actorEmail: ctx.user.email,
      actorRole: ctx.user.roleCode,
      // The AI write tools today are all admissions/lead actions; surface them
      // under that module so the activity log's module filter includes them.
      module: 'admissions',
      action,
      targetType,
      targetId: targetId ? new ObjectId(targetId) : null,
      success: true,
      source: 'ai_assistant',
      metadata: { ...metadata, source: 'ai_assistant' },
      createdAt: new Date(),
    });
  } catch (err) {
    logger.warn({ err, action }, 'AI audit log write failed');
  }
}

const LEAD_SOURCES = [
  'walk_in',
  'referral',
  'website',
  'social_media',
  'advertisement',
  'event',
  'other',
] as const;
const ACTIVE_LEAD_STAGES = [
  'new',
  'contacted',
  'interested',
  'followup',
  'visit_scheduled',
  'visited',
] as const;
const FOLLOWUP_TYPES = ['call', 'email', 'visit', 'meeting'] as const;

/** Turn a snake/lower enum value into a human label, e.g. walk_in → "Walk-in". */
function humanizeEnum(value: string): string {
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Build select options from a readonly enum tuple. */
function enumOptions(values: readonly string[]): { value: string; label: string }[] {
  return values.map((v) => ({ value: v, label: humanizeEnum(v) }));
}

// Strict argument schemas for write tools — validated before a confirmation card
// is shown AND again before execution. The model's JSON-schema-constrained output
// is not trusted for mutations.
const createLeadArgs = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  phone: z.string().trim().min(4).max(20),
  email: z.string().email().optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  className: z.string().trim().optional(),
  notes: z.string().trim().max(1000).optional(),
});

const updateStageArgs = z
  .object({
    leadNumber: z.string().trim().optional(),
    search: z.string().trim().optional(),
    newStage: z.enum(ACTIVE_LEAD_STAGES),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.leadNumber || v.search, {
    message: 'Provide leadNumber or search to identify the lead',
  });

const addFollowupArgs = z
  .object({
    leadNumber: z.string().trim().optional(),
    search: z.string().trim().optional(),
    type: z.enum(FOLLOWUP_TYPES),
    notes: z.string().trim().min(1).max(1000),
    nextFollowupDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
      .optional(),
  })
  .refine((v) => v.leadNumber || v.search, {
    message: 'Provide leadNumber or search to identify the lead',
  });

// ===========================================================================
// Tool definitions. Each `execute` receives the trusted ctx (tenantId/branchId
// from the authenticated request) plus the model-provided business inputs.
// Read tools run inline; write tools are proposed and only execute after the
// user confirms (see ai.service / the /ai/chat/execute endpoint).
// ===========================================================================

export const TOOLS: ToolDefinition[] = [
  {
    name: 'get_branch_summary',
    description:
      "BRANCH-WIDE TOTALS ONLY, never for one person. Get a snapshot of the current branch right now: active student & staff counts, today's fee collection, today's attendance, pending staff leaves, and upcoming events. Use for broad 'how are we doing today / give me a summary' questions.",
    parameters: NO_ARGS,
    kind: 'read',
    requiredPermission: { module: 'dashboard.branchView', action: 'view' },
    async execute(ctx): Promise<ToolResult> {
      const [kpis, today] = await Promise.all([
        dashboardService.getBranchKPIs(ctx.tenantId, ctx.branchId),
        dashboardService.getBranchTodaySummary(ctx.tenantId, ctx.branchId),
      ]);
      return { data: { kpis, today }, link: '/dashboard' };
    },
  },

  {
    name: 'get_student_stats',
    description:
      'BRANCH-WIDE TOTALS ONLY, never for one person. Get overall student counts for the current branch: total, active, inactive, and gender distribution. Use for "how many students do we have", "gender split", etc. For class-specific counts or finding individuals, use find_students instead.',
    parameters: NO_ARGS,
    kind: 'read',
    requiredPermission: { module: 'students.list', action: 'view' },
    async execute(ctx): Promise<ToolResult> {
      const stats = await studentService.getStats(ctx.tenantId, ctx.branchId);
      return { data: stats, link: '/students' };
    },
  },

  {
    name: 'find_students',
    description:
      'Search/list students in the current branch with optional filters, returning the matching total count and a sample list. Use for "how many students in class 10", "show withdrawn students", "find student by name or admission number".',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        search: { type: 'string', description: 'Name, admission number, or phone fragment' },
        className: { type: 'string', description: 'Class/grade name e.g. "10" or "Grade 5"' },
        sectionName: { type: 'string', description: 'Section name e.g. "A"' },
        status: {
          type: 'string',
          enum: ['active', 'inactive', 'alumni', 'archived', 'transferred', 'withdrawn'],
        },
        gender: { type: 'string', enum: ['male', 'female', 'other'] },
        limit: { type: 'integer', minimum: 1, maximum: 25, description: 'Max rows (default 10)' },
      },
    },
    kind: 'read',
    requiredPermission: { module: 'students.list', action: 'view' },
    async execute(ctx, args): Promise<ToolResult> {
      const classId = await resolveClassId(ctx, args.className as string | undefined);
      const sectionId = await resolveSectionId(
        ctx,
        args.sectionName as string | undefined,
        classId
      );
      const limit = Math.min(Number(args.limit) || 10, 25);
      const result = await studentService.findAll(ctx.tenantId, ctx.branchId, {
        search: args.search as string | undefined,
        status: args.status as string | undefined,
        gender: args.gender as string | undefined,
        classId,
        sectionId,
        limit,
        page: 1,
      });

      const params = new URLSearchParams();
      if (args.status) params.set('status', String(args.status));
      if (args.search) params.set('search', String(args.search));
      const query = params.toString();

      return {
        data: {
          total: result.meta.total,
          shown: result.data.length,
          students: result.data.map((s) => compactStudent(s as Record<string, unknown>)),
        },
        link: query ? `/students?${query}` : '/students',
      };
    },
  },

  {
    name: 'get_fee_dues',
    description:
      'BRANCH-WIDE TOTALS ONLY, never for one person. Get outstanding fee dues for the current branch in the active academic batch: total billed, collected, outstanding balance, collection %, concessions and fines. Use for "how much is pending", "total dues", "collection rate".',
    parameters: NO_ARGS,
    kind: 'read',
    requiredPermission: { module: 'finance.dues', action: 'view' },
    async execute(ctx): Promise<ToolResult> {
      const academicBatchId = await resolveCurrentBatchId(ctx.tenantId, ctx.branchId);
      if (!academicBatchId) {
        return { data: { message: 'No active academic batch is configured for this branch.' } };
      }
      // Scoped to this single branch, so grandTotal == this branch's totals
      // (and it is fully typed, unlike the per-branch aggregate rows).
      const { grandTotal } = await financeReportsService.getDuesSummary(ctx.tenantId, {
        academicBatchId,
        branchId: ctx.branchId,
      });
      return { data: grandTotal, link: '/finance/reports' };
    },
  },

  {
    name: 'get_fee_collection',
    description:
      'BRANCH-WIDE TOTALS ONLY, never for one person. Get fee collection figures for the current branch. period "today" returns today\'s day-sheet (totals + breakdown by payment mode); "this_month" or "custom" returns a date-range collection summary. Use for "today\'s collection", "how much did we collect this month".',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        period: { type: 'string', enum: ['today', 'this_month', 'custom'] },
        fromDate: { type: 'string', description: 'YYYY-MM-DD, required when period=custom' },
        toDate: { type: 'string', description: 'YYYY-MM-DD, required when period=custom' },
      },
      required: ['period'],
    },
    kind: 'read',
    requiredPermission: { module: 'finance.collections', action: 'view' },
    async execute(ctx, args): Promise<ToolResult> {
      const period = String(args.period);
      if (period === 'today') {
        const data = await feeTransactionService.getDaySheet(
          ctx.tenantId,
          ctx.branchId,
          todayISO()
        );
        return { data, link: '/finance/reports' };
      }
      const from = period === 'custom' ? String(args.fromDate) : monthStartISO();
      const to = period === 'custom' ? String(args.toDate) : todayISO();
      const data = await feeTransactionService.getCollectionSummary(
        ctx.tenantId,
        ctx.branchId,
        from,
        to
      );
      return { data, link: '/finance/reports' };
    },
  },

  {
    name: 'get_attendance_today',
    description:
      'BRANCH-WIDE TOTALS ONLY, never for one person. Get student attendance for a given date (defaults to today) in the current branch: branch totals (present/absent/late/leave) and a per-class breakdown. Use for "today\'s attendance rate", "who\'s absent today".',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        date: { type: 'string', description: 'YYYY-MM-DD (defaults to today)' },
      },
    },
    kind: 'read',
    requiredPermission: { module: 'attendance.view', action: 'view' },
    async execute(ctx, args): Promise<ToolResult> {
      const date = (args.date as string | undefined) || todayISO();
      const data = await studentAttendanceService.getDailyReport(ctx.tenantId, ctx.branchId, date);
      return { data, link: '/attendance/view' };
    },
  },

  {
    name: 'get_lead_stats',
    description:
      'Get admission lead/enquiry information for the current branch. mode "stats" returns totals, count by pipeline stage, and follow-ups due. mode "list" returns a sample of leads optionally filtered by stage. Use for "leads in followup", "conversion pipeline", "new enquiries".',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        mode: { type: 'string', enum: ['stats', 'list'] },
        stage: {
          type: 'string',
          description: 'Active-pipeline stage to filter by',
          enum: ['new', 'contacted', 'interested', 'followup', 'visit_scheduled', 'visited'],
        },
        limit: { type: 'integer', minimum: 1, maximum: 25 },
      },
      required: ['mode'],
    },
    kind: 'read',
    requiredPermission: { module: 'admissions.leads', action: 'view' },
    async execute(ctx, args): Promise<ToolResult> {
      if (String(args.mode) === 'list') {
        const result = await leadService.findAll(ctx.tenantId, ctx.branchId, {
          stage: args.stage as string | undefined,
          limit: Math.min(Number(args.limit) || 10, 25),
          page: 1,
        });
        return {
          data: {
            total: result.meta.total,
            leads: result.data.map((l) => {
              const lead = l as Record<string, unknown>;
              return {
                name: lead.displayName,
                leadNumber: lead.leadNumber,
                stage: lead.stage,
                nextFollowupDate: lead.nextFollowupDate,
              };
            }),
          },
          link: '/admissions/leads',
        };
      }
      const stats = await leadService.getStats(ctx.tenantId, ctx.branchId);
      return { data: stats, link: '/admissions/leads' };
    },
  },

  {
    name: 'get_staff_stats',
    description:
      'BRANCH-WIDE TOTALS ONLY, never for one person. Get staff/employee counts for the current branch (total, active, by department/designation as available). Use for "how many staff", "teaching vs non-teaching".',
    parameters: NO_ARGS,
    kind: 'read',
    requiredPermission: { module: 'hr.staff', action: 'view' },
    async execute(ctx): Promise<ToolResult> {
      const stats = await staffService.getStats(ctx.tenantId, ctx.branchId);
      return { data: stats, link: '/hr/staff' };
    },
  },

  {
    name: 'get_leave_requests',
    description:
      'Get staff leave approval stats for the current branch: pending requests, total pending days, and counts approved/rejected this month. Use for "pending leave requests", "how many staff want leave".',
    parameters: NO_ARGS,
    kind: 'read',
    requiredPermission: { module: 'hr.leaves', action: 'view' },
    async execute(ctx): Promise<ToolResult> {
      const stats = await leaveService.getApprovalStats(ctx.tenantId, ctx.branchId);
      return { data: stats, link: '/hr/leaves' };
    },
  },

  // ---- Write tools (proposed → confirmed → executed) ----

  {
    name: 'get_timetable',
    description:
      'Get a weekly class timetable (day → periods with time, subject and teacher). Identify it by ONE of: section (loose class wording like "Mech Year 4 A" or "Grade 5 B"), student (name or admission number — returns their section\'s timetable), or teacher (staff name or employee id — returns the periods they teach). Use for "timetable of …", "what does X have on Monday", "when does teacher Y teach".',
    kind: 'read',
    requiredPermission: { module: 'teaching.timetable', action: 'view' },
    parameters: {
      type: 'object',
      properties: {
        section: { type: 'string', description: 'Class + section wording, e.g. "B.Tech Mechanical Year 4 A"' },
        student: { type: 'string', description: 'Student name or admission number' },
        teacher: { type: 'string', description: 'Teacher name or employee id' },
      },
      additionalProperties: false,
    },
    async execute(ctx, args): Promise<ToolResult> {
      const base = { tenantId: new ObjectId(ctx.tenantId), branchId: new ObjectId(ctx.branchId) };
      if (args.teacher) {
        const rx = { $regex: escapeRegex(String(args.teacher).trim()), $options: 'i' };
        const staff = await collections.staff
          .find({ ...base, status: { $ne: 'terminated' }, $or: [{ displayName: rx }, { employeeId: rx }] }, { projection: { displayName: 1, employeeId: 1 } })
          .limit(6)
          .toArray();
        if (staff.length !== 1) {
          return { data: { error: staff.length ? `Several staff match: ${staff.map((x) => `${x.displayName} (${x.employeeId})`).join(', ')}. Ask which one.` : `No staff member matches "${String(args.teacher)}".` } };
        }
        const rows = (await timetableService.getMyTimetable(ctx.tenantId, ctx.branchId, String(staff[0]._id))) as TimetableRow[];
        return { data: { teacher: staff[0].displayName, periodsPerWeek: rows.length, week: weekView(rows, true) }, link: '/teaching/timetable' };
      }
      let section: { id: string; label: string };
      if (args.student) {
        const q = String(args.student).trim();
        // "Devika Antony (MEDC-AY2627-0918)": an admission number anywhere wins, else the name.
        const tokens = q.split(/[\s(),]+/).filter(Boolean);
        const name = q.replace(/\(.*?\)/g, '').trim();
        const rx = { $regex: escapeRegex(name || q), $options: 'i' };
        const byNumber = await collections.students.countDocuments({ ...base, status: 'active', admissionNumber: { $in: tokens } });
        const students = await collections.students
          .find({ ...base, status: 'active', ...(byNumber ? { admissionNumber: { $in: tokens } } : { displayName: rx }) }, { projection: { displayName: 1, admissionNumber: 1, currentEnrollment: 1 } })
          .limit(6)
          .toArray();
        if (students.length !== 1) {
          return { data: { error: students.length ? `Several students match: ${students.map((x) => `${x.displayName} (${x.admissionNumber})`).join(', ')}. Ask which one.` : `No active student matches "${q}".` } };
        }
        const e = (students[0].currentEnrollment ?? {}) as Record<string, unknown>;
        if (!e.sectionId) return { data: { error: `${students[0].displayName} is not assigned to a section.` } };
        section = { id: String(e.sectionId), label: `${String(e.className ?? '')} · Section ${String(e.sectionName ?? '')} (${students[0].displayName})` };
      } else if (args.section) {
        section = await resolveSectionByName(ctx, String(args.section));
      } else {
        return { data: { error: 'Say which class/section, student or teacher.' } };
      }
      const rows = (await timetableService.getSectionTimetable(ctx.tenantId, ctx.branchId, section.id)) as TimetableRow[];
      if (rows.length === 0) return { data: { section: section.label, message: 'No timetable has been set up for this section yet.' }, link: '/teaching/timetable' };
      return { data: { section: section.label, periodsPerWeek: rows.length, week: weekView(rows, false) }, link: '/teaching/timetable' };
    },
  },

  {
    name: 'create_lead',
    description:
      'Open a form for the user to create a new admission lead/enquiry. Call this IMMEDIATELY when the user wants to add or create a lead — you do NOT need any details first. Pass whatever fields the user already mentioned and leave the rest out; the app renders a prefilled form for them to complete and submit. Do not ask the user to type the fields out in chat.',
    kind: 'write',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        phone: { type: 'string', description: 'Contact phone' },
        email: { type: 'string' },
        source: { type: 'string', enum: [...LEAD_SOURCES] },
        className: { type: 'string', description: 'Class/grade the lead is interested in' },
        notes: { type: 'string' },
      },
    },
    requiredPermission: { module: 'admissions.leads', action: 'create' },
    argsSchema: createLeadArgs,
    form: {
      title: 'Create admission lead',
      submitLabel: 'Create lead',
      fields: [
        { name: 'firstName', label: 'First name', type: 'text', required: true },
        { name: 'lastName', label: 'Last name', type: 'text', required: true },
        { name: 'phone', label: 'Contact phone', type: 'tel', required: true },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'source', label: 'Source', type: 'select', options: enumOptions(LEAD_SOURCES) },
        {
          name: 'className',
          label: 'Interested in',
          type: 'text',
          help: 'Class / grade the lead is interested in',
        },
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ],
    },
    async execute(ctx, rawArgs): Promise<ToolResult> {
      const a = createLeadArgs.parse(rawArgs);
      const classId = await resolveClassId(ctx, a.className);
      const lead = await leadService.create(
        ctx.tenantId,
        ctx.branchId,
        {
          firstName: a.firstName,
          lastName: a.lastName,
          contact: { phone: a.phone, email: a.email },
          interestedIn: classId ? { classId } : {},
          source: a.source ?? 'other',
          notes: a.notes,
        },
        ctx.user.userId
      );
      const created = lead as Record<string, unknown>;
      const leadId = created._id ? String(created._id) : null;
      await writeAudit(ctx, 'ai.lead.create', 'lead', leadId, { leadNumber: created.leadNumber });
      return {
        data: {
          message: `Created lead ${created.leadNumber} for ${a.firstName} ${a.lastName}.`,
          leadNumber: created.leadNumber,
        },
        link: '/admissions/leads',
      };
    },
  },

  {
    name: 'update_lead_stage',
    description:
      "Open a form for the user to move an admission lead to a different pipeline stage. Call this IMMEDIATELY when the user wants to update/move a lead's stage — you do NOT need any details first. Pass whatever the user mentioned (lead number, name/phone, target stage) and leave the rest out; the app renders a prefilled form for them to complete and submit.",
    kind: 'write',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        leadNumber: { type: 'string' },
        search: { type: 'string', description: 'Name or phone, if the lead number is unknown' },
        newStage: { type: 'string', enum: [...ACTIVE_LEAD_STAGES] },
        notes: { type: 'string' },
      },
    },
    requiredPermission: { module: 'admissions.leads', action: 'edit' },
    argsSchema: updateStageArgs,
    form: {
      title: 'Update lead stage',
      submitLabel: 'Update stage',
      fields: [
        { name: 'leadNumber', label: 'Lead number', type: 'text', placeholder: 'e.g. LD25001' },
        {
          name: 'search',
          label: 'Or find by name / phone',
          type: 'text',
          help: 'Fill the lead number, or a name/phone to look the lead up.',
        },
        {
          name: 'newStage',
          label: 'New stage',
          type: 'select',
          required: true,
          options: enumOptions(ACTIVE_LEAD_STAGES),
        },
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ],
    },
    async execute(ctx, rawArgs): Promise<ToolResult> {
      const a = updateStageArgs.parse(rawArgs);
      const lead = await resolveLead(ctx, { leadNumber: a.leadNumber, search: a.search });
      await leadService.updateStage(
        ctx.tenantId,
        lead.leadId,
        a.newStage,
        a.notes,
        ctx.user.userId
      );
      await writeAudit(ctx, 'ai.lead.update_stage', 'lead', lead.leadId, {
        from: lead.stage,
        to: a.newStage,
      });
      return {
        data: { message: `Moved ${lead.displayName} (${lead.leadNumber}) to "${a.newStage}".` },
        link: '/admissions/leads',
      };
    },
  },

  {
    name: 'add_lead_followup',
    description:
      'Open a form for the user to log a follow-up (call/email/visit/meeting) on an admission lead, optionally scheduling the next follow-up date. Call this IMMEDIATELY when the user wants to add/log a follow-up — you do NOT need any details first. Pass whatever the user mentioned (lead number, name/phone, type, notes) and leave the rest out; the app renders a prefilled form for them to complete and submit.',
    kind: 'write',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        leadNumber: { type: 'string' },
        search: { type: 'string' },
        type: { type: 'string', enum: [...FOLLOWUP_TYPES] },
        notes: { type: 'string' },
        nextFollowupDate: { type: 'string', description: 'YYYY-MM-DD' },
      },
    },
    requiredPermission: { module: 'admissions.leads', action: 'edit' },
    argsSchema: addFollowupArgs,
    form: {
      title: 'Add lead follow-up',
      submitLabel: 'Log follow-up',
      fields: [
        { name: 'leadNumber', label: 'Lead number', type: 'text', placeholder: 'e.g. LD25001' },
        {
          name: 'search',
          label: 'Or find by name / phone',
          type: 'text',
          help: 'Fill the lead number, or a name/phone to look the lead up.',
        },
        {
          name: 'type',
          label: 'Type',
          type: 'select',
          required: true,
          options: enumOptions(FOLLOWUP_TYPES),
        },
        { name: 'notes', label: 'Notes', type: 'textarea', required: true },
        { name: 'nextFollowupDate', label: 'Next follow-up date', type: 'date' },
      ],
    },
    async execute(ctx, rawArgs): Promise<ToolResult> {
      const a = addFollowupArgs.parse(rawArgs);
      const lead = await resolveLead(ctx, { leadNumber: a.leadNumber, search: a.search });
      await leadService.addFollowup(
        ctx.tenantId,
        lead.leadId,
        {
          type: a.type,
          notes: a.notes,
          nextFollowupDate: a.nextFollowupDate ? new Date(a.nextFollowupDate) : undefined,
        },
        ctx.user.userId
      );
      await writeAudit(ctx, 'ai.lead.add_followup', 'lead', lead.leadId, { type: a.type });
      return {
        data: {
          message: `Logged a ${a.type} follow-up for ${lead.displayName} (${lead.leadNumber}).`,
        },
        link: '/admissions/leads',
      };
    },
  },

  // ===========================================================================
  // Student self-scoped tools. These are the ONLY tools offered to STUDENT
  // users, and every one hard-filters on ctx.studentId so a student can read
  // strictly their own data — never another student's, never branch totals.
  // ===========================================================================

  {
    name: 'get_my_attendance',
    description:
      'Get the signed-in student\'s OWN attendance: their day-by-day records and totals over an optional date range (defaults to the running academic year). Use for "my attendance", "how many days was I absent", "my attendance percentage".',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        fromDate: { type: 'string', description: 'YYYY-MM-DD (optional)' },
        toDate: { type: 'string', description: 'YYYY-MM-DD (optional)' },
      },
    },
    kind: 'read',
    studentScoped: true,
    requiredPermission: { module: 'attendance.view', action: 'view' },
    async execute(ctx, args): Promise<ToolResult> {
      if (!ctx.studentId) return { data: { message: NO_STUDENT_MSG } };
      const data = await studentAttendanceService.getStudentHistory(
        ctx.tenantId,
        ctx.branchId,
        ctx.studentId,
        args.fromDate as string | undefined,
        args.toDate as string | undefined
      );
      return { data, link: '/student/attendance' };
    },
  },

  {
    name: 'get_my_fees',
    description:
      'Get the signed-in student\'s OWN fee summary: total billed, paid, concessions, and outstanding balance across their fee assignments. Use for "my fees", "how much do I owe", "my pending dues".',
    parameters: NO_ARGS,
    kind: 'read',
    studentScoped: true,
    requiredPermission: { module: 'finance.feeStructures', action: 'view' },
    async execute(ctx): Promise<ToolResult> {
      if (!ctx.studentId) return { data: { message: NO_STUDENT_MSG } };
      const data = await studentService.getFeeSummary(ctx.tenantId, ctx.studentId);
      return { data, link: '/student/fees' };
    },
  },

  {
    name: 'get_my_grades',
    description:
      'Get the signed-in student\'s OWN assignment grades from their teachers. Use for "my grades", "my marks", "how did I do on my assignments".',
    parameters: NO_ARGS,
    kind: 'read',
    studentScoped: true,
    requiredPermission: { module: 'teaching.grades', action: 'view' },
    async execute(ctx): Promise<ToolResult> {
      if (!ctx.studentId) return { data: { message: NO_STUDENT_MSG } };
      const data = await gradeService.getStudentGrades(ctx.tenantId, ctx.studentId);
      return { data, link: '/student/grades' };
    },
  },

  {
    name: 'get_my_report_cards',
    description:
      'Get the signed-in student\'s OWN published exam report cards (per exam: subject marks, percentage, grade, and rank). Use for "my report card", "my exam results", "how did I do in the mid-terms".',
    parameters: NO_ARGS,
    kind: 'read',
    studentScoped: true,
    requiredPermission: { module: 'exams.reportCards', action: 'view' },
    async execute(ctx): Promise<ToolResult> {
      if (!ctx.studentId) return { data: { message: NO_STUDENT_MSG } };
      const data = await reportCardService.listForStudent(ctx.tenantId, ctx.studentId);
      return { data, link: '/student/grades' };
    },
  },

  {
    name: 'get_my_profile',
    description:
      'Get the signed-in student\'s OWN profile: name, admission number, class and section, and roll number. Use for "what\'s my roll number", "which class am I in", "my admission number".',
    parameters: NO_ARGS,
    kind: 'read',
    studentScoped: true,
    requiredPermission: { module: 'students.details', action: 'view' },
    async execute(ctx): Promise<ToolResult> {
      if (!ctx.studentId) return { data: { message: NO_STUDENT_MSG } };
      const student = (await studentService.findById(ctx.tenantId, ctx.studentId)) as Record<
        string,
        unknown
      >;
      return { data: compactStudent(student), link: '/profile' };
    },
  },
];

const ALL_TOOLS: ToolDefinition[] = [...TOOLS, ...PLATFORM_TOOLS];

function isStudentUser(user: TokenPayload): boolean {
  return user.roleCode === 'STUDENT';
}

/**
 * Whether this tool is offered to this user. Students are offered ONLY
 * student-scoped tools; every other role is offered ONLY the branch/operational
 * tools. This partition is what keeps branch-wide aggregates (e.g. branch
 * attendance/summary) out of a student's reach even though they may technically
 * hold the underlying view permission.
 */
function toolAvailableTo(user: TokenPayload, tool: ToolDefinition): boolean {
  if (isStudentUser(user) !== !!tool.studentScoped) return false;
  // Platform tools are gated per endpoint (catalog filter + the API's own RBAC).
  if (tool.requiredPermission.module === '*') return Object.keys(user.permissions ?? {}).length > 0;
  return hasPermission(user, tool.requiredPermission.module, tool.requiredPermission.action);
}

/** Tools the given user is permitted to use, by role scope + RBAC permissions. */
export function buildToolsForUser(user: TokenPayload): ToolDefinition[] {
  return ALL_TOOLS.filter((tool) => toolAvailableTo(user, tool));
}

/** Look up a permitted tool by name for a user (null if not allowed/unknown). */
export function getPermittedTool(user: TokenPayload, name: string): ToolDefinition | null {
  const tool = ALL_TOOLS.find((t) => t.name === name);
  if (!tool) return null;
  return toolAvailableTo(user, tool) ? tool : null;
}
