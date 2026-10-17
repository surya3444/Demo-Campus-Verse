import { ObjectId, WithId, Document, Filter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import {
  CreatePromotionPolicyInput,
  UpdatePromotionPolicyInput,
  PromoteStaffInput,
} from '@campus-verse/shared/schemas';
import { payrollService } from './payroll.service';

/**
 * Promotions: designation change with history, validated against the
 * designation ladder (Designation.level, 1 = highest — finally read by code),
 * with salary revision driven by configurable PromotionPolicy rules. The
 * payroll side reuses the existing revision machinery (new assignment, prior
 * marked 'revised'); personalAllowances carry forward untouched.
 */

interface PromotionPolicyDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId?: ObjectId;
  fromDesignationId: ObjectId;
  toDesignationId: ObjectId;
  increment:
    | { type: 'percentage'; value: number; base: 'basic' | 'gross' }
    | { type: 'fixed'; value: number }
    | { type: 'structure'; structureId: string };
  requiresApproval: boolean;
  status: 'active' | 'inactive';
  createdBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface StaffPromotionDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  staffId: ObjectId;
  fromDesignationId?: ObjectId;
  toDesignationId: ObjectId;
  policyId?: ObjectId;
  effectiveFrom: Date;
  lateral?: boolean;
  status: 'pending' | 'applied' | 'rejected';
  salaryChange?: { previousNet: number; newNet: number };
  requestedBy: ObjectId;
  requestedAt: Date;
  decidedBy?: ObjectId;
  decidedAt?: Date;
  rejectionReason?: string;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

type SalaryComponent = { code: string; name: string; amount: number };

/** Round to whole rupees — payroll amounts are integral by convention. */
const round = (n: number) => Math.round(n);

class PromotionService {
  // ─── Policies ─────────────────────────────────────────────────────────────

  async createPolicy(
    tenantId: string,
    branchId: string | undefined,
    data: CreatePromotionPolicyInput,
    createdBy?: string
  ) {
    const [from, to] = await Promise.all([
      collections.designations.findOne({
        _id: new ObjectId(data.fromDesignationId),
        tenantId: new ObjectId(tenantId),
      }),
      collections.designations.findOne({
        _id: new ObjectId(data.toDesignationId),
        tenantId: new ObjectId(tenantId),
      }),
    ]);
    if (!from || !to) {
      throw new ApiError('DESIGNATION_NOT_FOUND', 'From/to designation not found', 404);
    }

    if (data.increment.type === 'structure') {
      const structure = await collections.salaryStructures.findOne({
        _id: new ObjectId(data.increment.structureId),
        tenantId: new ObjectId(tenantId),
      });
      if (!structure) {
        throw new ApiError('STRUCTURE_NOT_FOUND', 'Salary structure not found', 404);
      }
    }

    const duplicate = await collections.promotionPolicies.findOne({
      tenantId: new ObjectId(tenantId),
      fromDesignationId: new ObjectId(data.fromDesignationId),
      toDesignationId: new ObjectId(data.toDesignationId),
      ...(branchId ? { branchId: new ObjectId(branchId) } : { branchId: { $exists: false } }),
      status: 'active',
    });
    if (duplicate) {
      throw new ApiError(
        'DUPLICATE_POLICY',
        'An active policy for this designation pair already exists',
        409
      );
    }

    const now = new Date();
    const doc: PromotionPolicyDocument = {
      _id: new ObjectId(),
      tenantId: new ObjectId(tenantId),
      ...(branchId && { branchId: new ObjectId(branchId) }),
      fromDesignationId: new ObjectId(data.fromDesignationId),
      toDesignationId: new ObjectId(data.toDesignationId),
      increment: data.increment,
      requiresApproval: data.requiresApproval ?? false,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      ...(createdBy && { createdBy: new ObjectId(createdBy) }),
    };

    await collections.promotionPolicies.insertOne(doc);
    logger.info({ tenantId, policyId: doc._id.toString() }, 'Promotion policy created');
    return this.formatPolicy(
      doc as WithId<PromotionPolicyDocument>,
      await this.designationMap(tenantId)
    );
  }

  async listPolicies(tenantId: string, branchId?: string) {
    const filter: Filter<Document> = { tenantId: new ObjectId(tenantId) };
    if (branchId) {
      // Branch view: tenant-wide policies + this branch's overrides.
      filter.$or = [{ branchId: { $exists: false } }, { branchId: new ObjectId(branchId) }];
    }
    const policies = (await collections.promotionPolicies
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray()) as WithId<PromotionPolicyDocument>[];

    const names = await this.designationMap(tenantId);
    return policies.map((p) => this.formatPolicy(p, names));
  }

  async updatePolicy(tenantId: string, policyId: string, data: UpdatePromotionPolicyInput) {
    const existing = (await collections.promotionPolicies.findOne({
      _id: new ObjectId(policyId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<PromotionPolicyDocument> | null;
    if (!existing) {
      throw new ApiError('POLICY_NOT_FOUND', 'Promotion policy not found', 404);
    }

    if (data.increment?.type === 'structure') {
      const structure = await collections.salaryStructures.findOne({
        _id: new ObjectId(data.increment.structureId),
        tenantId: new ObjectId(tenantId),
      });
      if (!structure) {
        throw new ApiError('STRUCTURE_NOT_FOUND', 'Salary structure not found', 404);
      }
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.increment !== undefined) updateData.increment = data.increment;
    if (data.requiresApproval !== undefined) updateData.requiresApproval = data.requiresApproval;
    if (data.status !== undefined) updateData.status = data.status;

    await collections.promotionPolicies.updateOne({ _id: existing._id }, { $set: updateData });

    const updated = (await collections.promotionPolicies.findOne({
      _id: existing._id,
    })) as WithId<PromotionPolicyDocument>;
    return this.formatPolicy(updated, await this.designationMap(tenantId));
  }

  async deletePolicy(tenantId: string, policyId: string) {
    const result = await collections.promotionPolicies.deleteOne({
      _id: new ObjectId(policyId),
      tenantId: new ObjectId(tenantId),
    });
    if (result.deletedCount === 0) {
      throw new ApiError('POLICY_NOT_FOUND', 'Promotion policy not found', 404);
    }
    return { success: true };
  }

  // ─── Promotion workflow ───────────────────────────────────────────────────

  async promote(
    tenantId: string,
    branchId: string,
    staffId: string,
    data: PromoteStaffInput,
    requestedBy: string
  ) {
    const staff = await collections.staff.findOne({
      _id: new ObjectId(staffId),
      tenantId: new ObjectId(tenantId),
      status: 'active',
    });
    if (!staff) {
      throw new ApiError('STAFF_NOT_FOUND', 'Active staff member not found', 404);
    }

    const fromDesignationId = staff.employment?.designationId as ObjectId | undefined;
    if (fromDesignationId?.toString() === data.toDesignationId) {
      throw new ApiError('SAME_DESIGNATION', 'Staff already holds this designation', 400);
    }

    const [fromDesignation, toDesignation] = await Promise.all([
      fromDesignationId
        ? collections.designations.findOne({ _id: fromDesignationId })
        : Promise.resolve(null),
      collections.designations.findOne({
        _id: new ObjectId(data.toDesignationId),
        tenantId: new ObjectId(tenantId),
      }),
    ]);
    if (!toDesignation) {
      throw new ApiError('DESIGNATION_NOT_FOUND', 'Target designation not found', 404);
    }

    // The ladder finally gets read: level 1 is highest, so a promotion must
    // move to a numerically LOWER level unless explicitly flagged lateral.
    if (
      !data.lateral &&
      fromDesignation &&
      typeof fromDesignation.level === 'number' &&
      typeof toDesignation.level === 'number' &&
      toDesignation.level >= fromDesignation.level
    ) {
      throw new ApiError(
        'NOT_A_PROMOTION',
        `${toDesignation.name} (level ${toDesignation.level}) is not above ${fromDesignation.name} (level ${fromDesignation.level}). Flag the move as lateral to proceed.`,
        400
      );
    }

    // Branch override beats the tenant-wide policy.
    const policy = fromDesignationId
      ? ((await collections.promotionPolicies.findOne(
          {
            tenantId: new ObjectId(tenantId),
            fromDesignationId,
            toDesignationId: new ObjectId(data.toDesignationId),
            status: 'active',
            $or: [{ branchId: new ObjectId(branchId) }, { branchId: { $exists: false } }],
          },
          { sort: { branchId: -1 } }
        )) as WithId<PromotionPolicyDocument> | null)
      : null;

    const now = new Date();
    const promotion: StaffPromotionDocument = {
      _id: new ObjectId(),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      staffId: staff._id as ObjectId,
      ...(fromDesignationId && { fromDesignationId }),
      toDesignationId: new ObjectId(data.toDesignationId),
      ...(policy && { policyId: policy._id }),
      effectiveFrom: data.effectiveFrom ?? now,
      ...(data.lateral && { lateral: true }),
      status: policy?.requiresApproval ? 'pending' : 'applied',
      requestedBy: new ObjectId(requestedBy),
      requestedAt: now,
      ...(data.remarks && { remarks: data.remarks }),
      createdAt: now,
      updatedAt: now,
    };

    await collections.staffPromotions.insertOne(promotion);

    if (!policy?.requiresApproval) {
      await this.applyPromotion(promotion as WithId<StaffPromotionDocument>, policy, requestedBy);
    }

    logger.info(
      {
        tenantId,
        promotionId: promotion._id.toString(),
        staffId,
        status: promotion.status,
      },
      'Promotion recorded'
    );

    return this.findPromotionById(tenantId, promotion._id.toString());
  }

  async approvePromotion(tenantId: string, promotionId: string, decidedBy: string) {
    const promotion = (await collections.staffPromotions.findOne({
      _id: new ObjectId(promotionId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<StaffPromotionDocument> | null;
    if (!promotion) {
      throw new ApiError('PROMOTION_NOT_FOUND', 'Promotion not found', 404);
    }
    if (promotion.status !== 'pending') {
      throw new ApiError('ALREADY_PROCESSED', `Promotion is already ${promotion.status}`, 400);
    }

    const policy = promotion.policyId
      ? ((await collections.promotionPolicies.findOne({
          _id: promotion.policyId,
        })) as WithId<PromotionPolicyDocument> | null)
      : null;

    await this.applyPromotion(promotion, policy, decidedBy);
    await collections.staffPromotions.updateOne(
      { _id: promotion._id },
      {
        $set: {
          status: 'applied',
          decidedBy: new ObjectId(decidedBy),
          decidedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    return this.findPromotionById(tenantId, promotionId);
  }

  async rejectPromotion(tenantId: string, promotionId: string, decidedBy: string, reason: string) {
    const promotion = (await collections.staffPromotions.findOne({
      _id: new ObjectId(promotionId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<StaffPromotionDocument> | null;
    if (!promotion) {
      throw new ApiError('PROMOTION_NOT_FOUND', 'Promotion not found', 404);
    }
    if (promotion.status !== 'pending') {
      throw new ApiError('ALREADY_PROCESSED', `Promotion is already ${promotion.status}`, 400);
    }

    await collections.staffPromotions.updateOne(
      { _id: promotion._id },
      {
        $set: {
          status: 'rejected',
          decidedBy: new ObjectId(decidedBy),
          decidedAt: new Date(),
          rejectionReason: reason,
          updatedAt: new Date(),
        },
      }
    );

    return this.findPromotionById(tenantId, promotionId);
  }

  async listPromotions(
    tenantId: string,
    branchId: string,
    params: { staffId?: string; status?: string } = {}
  ) {
    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };
    if (params.staffId) filter.staffId = new ObjectId(params.staffId);
    if (params.status) filter.status = params.status;

    const promotions = (await collections.staffPromotions
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray()) as WithId<StaffPromotionDocument>[];

    const staffIds = [...new Set(promotions.map((p) => p.staffId.toString()))];
    const staffDocs = staffIds.length
      ? await collections.staff
          .find({ _id: { $in: staffIds.map((id) => new ObjectId(id)) } })
          .project({ displayName: 1, employeeId: 1 })
          .toArray()
      : [];
    const staffMap = new Map(staffDocs.map((s) => [s._id.toString(), s]));
    const names = await this.designationMap(tenantId);

    return promotions.map((p) => ({
      ...this.formatPromotion(p, names),
      staffName: (staffMap.get(p.staffId.toString())?.displayName as string) ?? '',
      employeeId: (staffMap.get(p.staffId.toString())?.employeeId as string) ?? '',
    }));
  }

  async findPromotionById(tenantId: string, promotionId: string) {
    const promotion = (await collections.staffPromotions.findOne({
      _id: new ObjectId(promotionId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<StaffPromotionDocument> | null;
    if (!promotion) {
      throw new ApiError('PROMOTION_NOT_FOUND', 'Promotion not found', 404);
    }
    return this.formatPromotion(promotion, await this.designationMap(tenantId));
  }

  // ─── Application ──────────────────────────────────────────────────────────

  /**
   * Apply the designation change (with history) and, when a policy with an
   * increment matches and the staff member has an active salary assignment,
   * revise the salary through the existing payroll machinery.
   */
  private async applyPromotion(
    promotion: WithId<StaffPromotionDocument>,
    policy: WithId<PromotionPolicyDocument> | null,
    appliedBy: string
  ) {
    const tenantId = promotion.tenantId.toString();

    await collections.staff.updateOne({ _id: promotion.staffId }, {
      $set: {
        'employment.designationId': promotion.toDesignationId,
        updatedAt: new Date(),
      },
      $push: {
        designationHistory: {
          ...(promotion.fromDesignationId && {
            fromDesignationId: promotion.fromDesignationId,
          }),
          toDesignationId: promotion.toDesignationId,
          effectiveFrom: promotion.effectiveFrom,
          promotionId: promotion._id,
          appliedBy: new ObjectId(appliedBy),
          appliedAt: new Date(),
        },
      },
    } as unknown as import('mongodb').UpdateFilter<Document>);

    if (!policy) return;

    const current = await payrollService.getStaffSalaryAssignment(
      tenantId,
      promotion.staffId.toString()
    );
    if (!current) {
      logger.warn(
        { tenantId, promotionId: promotion._id.toString() },
        'Promotion applied without salary revision — no active salary assignment'
      );
      return;
    }

    const revision = await this.buildRevisedComponents(
      tenantId,
      policy,
      current as unknown as {
        earnings: SalaryComponent[];
        deductions: SalaryComponent[];
        personalAllowances: SalaryComponent[];
        salaryStructureId?: ObjectId;
        netSalary?: number;
      }
    );

    const revised = await payrollService.reviseSalary(
      tenantId,
      (current._id as ObjectId).toString(),
      {
        effectiveFrom: promotion.effectiveFrom.toISOString(),
        earnings: revision.earnings,
        deductions: revision.deductions,
        // personalAllowances carry forward untouched
        personalAllowances: (current.personalAllowances as SalaryComponent[]) ?? [],
        salaryStructureId: revision.salaryStructureId,
        revisionReason: `Promotion ${promotion._id.toString()}`,
      },
      appliedBy
    );

    await collections.staffPromotions.updateOne(
      { _id: promotion._id },
      {
        $set: {
          salaryChange: {
            previousNet: (current.netSalary as number) ?? 0,
            newNet: ((revised as { netSalary?: number }).netSalary as number) ?? 0,
          },
          updatedAt: new Date(),
        },
      }
    );
  }

  /** Compute the revised earning/deduction lines from the policy increment. */
  private async buildRevisedComponents(
    tenantId: string,
    policy: WithId<PromotionPolicyDocument>,
    current: {
      earnings: SalaryComponent[];
      deductions: SalaryComponent[];
      salaryStructureId?: ObjectId;
    }
  ): Promise<{
    earnings: SalaryComponent[];
    deductions: SalaryComponent[];
    salaryStructureId: string | undefined;
  }> {
    const increment = policy.increment;

    if (increment.type !== 'structure') {
      const raised = this.raiseLines(increment, current);
      // HRA, DA, PF etc. are defined on the structure as "X% of BASIC": once
      // BASIC moves they must move with it, or every promotion under-pays.
      return {
        ...raised,
        ...(await this.rederivePercentageLines(tenantId, current.salaryStructureId, raised)),
      };
    }
    return this.moveToStructure(tenantId, increment.structureId);
  }

  /** Re-derive percentage-of lines from the staff member's own salary structure. */
  private async rederivePercentageLines(
    tenantId: string,
    structureId: ObjectId | undefined,
    lines: { earnings: SalaryComponent[]; deductions: SalaryComponent[] }
  ): Promise<{ earnings: SalaryComponent[]; deductions: SalaryComponent[] }> {
    if (!structureId) return lines;
    const structure = await collections.salaryStructures.findOne({
      _id: new ObjectId(structureId),
      tenantId: new ObjectId(tenantId),
    });
    if (!structure) return lines;

    type Def = {
      code: string;
      type: 'fixed' | 'percentage';
      percentageOf?: string;
      defaultAmount: number;
    };
    const defs = new Map<string, Def>(
      [...((structure.earnings as Def[]) ?? []), ...((structure.deductions as Def[]) ?? [])].map(
        (d) => [d.code, d]
      )
    );
    const pool = new Map<string, number>();
    for (const line of [...lines.earnings, ...lines.deductions]) {
      if (defs.get(line.code)?.type !== 'percentage') pool.set(line.code, line.amount);
    }
    const recompute = (rows: SalaryComponent[]) =>
      rows.map((line) => {
        const def = defs.get(line.code);
        if (def?.type !== 'percentage') return line;
        const base = pool.get(def.percentageOf || 'BASIC');
        if (base === undefined) return line;
        const amount = round((base * def.defaultAmount) / 100);
        pool.set(line.code, amount);
        return { ...line, amount };
      });
    // Earnings first so a deduction defined on an earning (PF on BASIC+DA) sees the new value.
    const earnings = recompute(lines.earnings);
    return { earnings, deductions: recompute(lines.deductions) };
  }

  /** Apply a percentage or fixed increment to the current lines. */
  private raiseLines(
    increment: Exclude<PromotionPolicyDocument['increment'], { type: 'structure' }>,
    current: {
      earnings: SalaryComponent[];
      deductions: SalaryComponent[];
      salaryStructureId?: ObjectId;
    }
  ): {
    earnings: SalaryComponent[];
    deductions: SalaryComponent[];
    salaryStructureId: string | undefined;
  } {
    if (increment.type === 'percentage') {
      const factor = 1 + increment.value / 100;
      if (increment.base === 'gross') {
        return {
          earnings: current.earnings.map((e) => ({ ...e, amount: round(e.amount * factor) })),
          deductions: current.deductions,
          salaryStructureId: current.salaryStructureId?.toString(),
        };
      }
      // base === 'basic': only the BASIC line grows.
      return {
        earnings: current.earnings.map((e) =>
          e.code === 'BASIC' ? { ...e, amount: round(e.amount * factor) } : e
        ),
        deductions: current.deductions,
        salaryStructureId: current.salaryStructureId?.toString(),
      };
    }

    const hasBasic = current.earnings.some((e) => e.code === 'BASIC');
    return {
      earnings: hasBasic
        ? current.earnings.map((e) =>
            e.code === 'BASIC' ? { ...e, amount: round(e.amount + increment.value) } : e
          )
        : [...current.earnings, { code: 'BASIC', name: 'Basic', amount: round(increment.value) }],
      deductions: current.deductions,
      salaryStructureId: current.salaryStructureId?.toString(),
    };
  }

  /** Move to the named structure. Amounts resolve fixed first, then percentage-of. */
  private async moveToStructure(
    tenantId: string,
    structureId: string
  ): Promise<{
    earnings: SalaryComponent[];
    deductions: SalaryComponent[];
    salaryStructureId: string | undefined;
  }> {
    const increment = { structureId };
    const structure = await collections.salaryStructures.findOne({
      _id: new ObjectId(increment.structureId),
      tenantId: new ObjectId(tenantId),
    });
    if (!structure) {
      throw new ApiError(
        'STRUCTURE_NOT_FOUND',
        "The policy's salary structure no longer exists",
        404
      );
    }

    type StructureComponent = {
      code: string;
      name: string;
      type: 'fixed' | 'percentage';
      percentageOf?: string;
      defaultAmount: number;
    };
    const resolve = (components: StructureComponent[], resolvedPool: Map<string, number>) => {
      const out: SalaryComponent[] = [];
      for (const c of components.filter((x) => x.type !== 'percentage')) {
        out.push({ code: c.code, name: c.name, amount: round(c.defaultAmount) });
        resolvedPool.set(c.code, c.defaultAmount);
      }
      for (const c of components.filter((x) => x.type === 'percentage')) {
        const base = resolvedPool.get(c.percentageOf || 'BASIC') ?? 0;
        const amount = round((base * c.defaultAmount) / 100);
        out.push({ code: c.code, name: c.name, amount });
        resolvedPool.set(c.code, amount);
      }
      return out;
    };

    const pool = new Map<string, number>();
    const earnings = resolve((structure.earnings as StructureComponent[]) ?? [], pool);
    const deductions = resolve((structure.deductions as StructureComponent[]) ?? [], pool);

    return { earnings, deductions, salaryStructureId: increment.structureId };
  }

  // ─── Formatting ───────────────────────────────────────────────────────────

  private async designationMap(tenantId: string): Promise<Map<string, string>> {
    const designations = await collections.designations
      .find({ tenantId: new ObjectId(tenantId) })
      .project({ name: 1 })
      .toArray();
    return new Map(designations.map((d) => [d._id.toString(), d.name as string]));
  }

  private formatPolicy(p: WithId<PromotionPolicyDocument>, names: Map<string, string>) {
    return {
      _id: p._id.toString(),
      tenantId: p.tenantId.toString(),
      branchId: p.branchId?.toString(),
      fromDesignationId: p.fromDesignationId.toString(),
      fromDesignationName: names.get(p.fromDesignationId.toString()) ?? '',
      toDesignationId: p.toDesignationId.toString(),
      toDesignationName: names.get(p.toDesignationId.toString()) ?? '',
      increment: p.increment,
      requiresApproval: p.requiresApproval,
      status: p.status,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  private formatPromotion(p: WithId<StaffPromotionDocument>, names: Map<string, string>) {
    return {
      _id: p._id.toString(),
      tenantId: p.tenantId.toString(),
      branchId: p.branchId.toString(),
      staffId: p.staffId.toString(),
      fromDesignationId: p.fromDesignationId?.toString(),
      fromDesignationName: p.fromDesignationId
        ? (names.get(p.fromDesignationId.toString()) ?? '')
        : '',
      toDesignationId: p.toDesignationId.toString(),
      toDesignationName: names.get(p.toDesignationId.toString()) ?? '',
      policyId: p.policyId?.toString(),
      effectiveFrom: p.effectiveFrom,
      lateral: !!p.lateral,
      status: p.status,
      salaryChange: p.salaryChange,
      requestedBy: p.requestedBy.toString(),
      requestedAt: p.requestedAt,
      decidedBy: p.decidedBy?.toString(),
      decidedAt: p.decidedAt,
      rejectionReason: p.rejectionReason,
      remarks: p.remarks,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }
}

export const promotionService = new PromotionService();
