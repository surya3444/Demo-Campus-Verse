import { ObjectId, Document, UpdateFilter } from 'mongodb';
import { hrSettingsService } from './hrSettings.service';
import { collections } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { getPagination, buildPaginationMeta } from '../../utils/pagination';
import { generatePayslipNumber } from '../../utils/generators';
import { logger } from '../../lib/logger';
import { computePayslip, DEFAULT_PAYROLL_SETTINGS, describeRules, type PayrollSettings } from './payrollMath';

// ============ Salary Structures ============

class PayrollService {
  // --- Salary Structures CRUD ---

  async getSalaryStructures(tenantId: string, branchId: string, query: Record<string, unknown>) {
    const { page, limit, sortBy, sortOrder } = getPagination(query);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { code: { $regex: query.search, $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      collections.salaryStructures
        .find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collections.salaryStructures.countDocuments(filter),
    ]);

    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  async getSalaryStructureById(tenantId: string, id: string) {
    const structure = await collections.salaryStructures.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!structure) {
      throw new ApiError('NOT_FOUND', 'Salary structure not found', 404);
    }

    return structure;
  }

  /**
   * Suggest salary structures for a staff member based on their designation,
   * role, department, and employment type (matched against structure.applicableTo).
   * Returns all active structures sorted by match score; the best-scoring
   * targeted match (if any) is flagged as `suggested`.
   */
  async suggestSalaryStructures(tenantId: string, branchId: string, staffId: string) {
    if (!ObjectId.isValid(staffId)) {
      throw new ApiError('NOT_FOUND', 'Staff member not found', 404);
    }

    const staff = await collections.staff.findOne({
      _id: new ObjectId(staffId),
      tenantId: new ObjectId(tenantId),
    });

    if (!staff) {
      throw new ApiError('NOT_FOUND', 'Staff member not found', 404);
    }

    // Resolve the staff's role code: via linked user account, else the
    // requested role stored on pending-approval staff records.
    let roleCode: string | undefined = staff.requestedRoleCode;
    if (staff.userId) {
      const user = await collections.users.findOne({ _id: staff.userId });
      if (user?.roleId) {
        const role = await collections.roles.findOne({ _id: user.roleId });
        if (role?.code) roleCode = role.code;
      }
    }

    const designationId = staff.employment?.designationId?.toString();
    const departmentId = staff.employment?.departmentId?.toString();
    const employmentType = staff.employment?.employmentType;

    const structures = await collections.salaryStructures
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        status: 'active',
      })
      .toArray();

    const scored = structures.map((s) => {
      const a = (s.applicableTo || {}) as {
        employmentTypes?: string[];
        departmentIds?: string[];
        designationIds?: string[];
        roleCodes?: string[];
      };
      let score = 0;
      // Designation is the most specific HR-side signal, then role, then
      // department/employment type as weaker tie-breakers.
      if (designationId && a.designationIds?.includes(designationId)) score += 8;
      if (roleCode && a.roleCodes?.includes(roleCode)) score += 4;
      if (departmentId && a.departmentIds?.includes(departmentId)) score += 2;
      if (employmentType && a.employmentTypes?.includes(employmentType)) score += 1;
      return { structure: s, score };
    });

    scored.sort((x, y) => y.score - x.score);

    return {
      staff: {
        _id: staff._id.toString(),
        displayName: staff.displayName,
        designationId,
        departmentId,
        employmentType,
        roleCode,
      },
      suggestedStructureId:
        scored[0] && scored[0].score > 0 ? scored[0].structure._id.toString() : null,
      structures: scored.map(({ structure, score }) => ({
        ...structure,
        _id: structure._id.toString(),
        tenantId: structure.tenantId?.toString(),
        branchId: structure.branchId?.toString(),
        createdBy: structure.createdBy?.toString(),
        matchScore: score,
      })),
    };
  }

  async createSalaryStructure(
    tenantId: string,
    branchId: string,
    data: Record<string, unknown>,
    userId: string
  ) {
    // Check for duplicate code
    const existing = await collections.salaryStructures.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      code: data.code,
    });

    if (existing) {
      throw new ApiError('DUPLICATE_CODE', 'A salary structure with this code already exists', 409);
    }

    const now = new Date();
    const doc = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      ...data,
      createdBy: new ObjectId(userId),
      createdAt: now,
      updatedAt: now,
    };

    const result = await collections.salaryStructures.insertOne(doc);
    return { _id: result.insertedId, ...doc };
  }

  async updateSalaryStructure(tenantId: string, id: string, data: Record<string, unknown>) {
    const result = await collections.salaryStructures.findOneAndUpdate(
      {
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      },
      {
        $set: {
          ...data,
          updatedAt: new Date(),
        },
      } as unknown as UpdateFilter<Document>,
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new ApiError('NOT_FOUND', 'Salary structure not found', 404);
    }

    return result;
  }

  async deleteSalaryStructure(tenantId: string, id: string) {
    // Check if any active assignments use this structure
    const activeAssignment = await collections.staffSalaryAssignments.findOne({
      tenantId: new ObjectId(tenantId),
      salaryStructureId: new ObjectId(id),
      status: 'active',
    });

    if (activeAssignment) {
      throw new ApiError(
        'IN_USE',
        'Cannot delete salary structure that has active assignments',
        400
      );
    }

    const result = await collections.salaryStructures.findOneAndUpdate(
      {
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      },
      { $set: { status: 'inactive', updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new ApiError('NOT_FOUND', 'Salary structure not found', 404);
    }

    return result;
  }

  // --- Staff Salary Assignments ---

  async getSalaryAssignments(tenantId: string, branchId: string, query: Record<string, unknown>) {
    const { page, limit, sortBy, sortOrder } = getPagination(query);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (query.status) {
      filter.status = query.status;
    } else {
      filter.status = 'active';
    }

    if (query.staffId) {
      filter.staffId = new ObjectId(query.staffId as string);
    }

    const pipeline = [
      { $match: filter },
      {
        $lookup: {
          from: 'staff',
          localField: 'staffId',
          foreignField: '_id',
          as: 'staff',
        },
      },
      { $unwind: { path: '$staff', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'salary_structures',
          localField: 'salaryStructureId',
          foreignField: '_id',
          as: 'salaryStructure',
        },
      },
      { $unwind: { path: '$salaryStructure', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          staffName: '$staff.displayName',
          staffEmployeeId: '$staff.employeeId',
          departmentId: '$staff.employment.departmentId',
          structureName: '$salaryStructure.name',
        },
      },
      { $sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: sortOrder === 'asc' ? 1 : -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await collections.staffSalaryAssignments.aggregate(pipeline).toArray();

    const data = result?.data || [];
    const total = result?.total?.[0]?.count || 0;

    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  async getStaffSalaryAssignment(tenantId: string, staffId: string) {
    const assignment = await collections.staffSalaryAssignments.findOne({
      tenantId: new ObjectId(tenantId),
      staffId: new ObjectId(staffId),
      status: 'active',
    });

    return assignment;
  }

  /**
   * Extract salary components from assignment input and compute totals.
   * Personal-allowance codes are normalized server-side to canonical
   * UPPER_SNAKE form and de-collided against earning codes (suffix _2, _3…),
   * since payslip generation keys line items by code — clients must not be
   * trusted to send canonical or unique codes.
   */
  private prepareAssignmentComponents(data: Record<string, unknown>) {
    const earnings = data.earnings as Array<{ code: string; name: string; amount: number }>;
    const deductions = data.deductions as Array<{ code: string; name: string; amount: number }>;
    const rawAllowances = (data.personalAllowances || []) as Array<{
      code: string;
      name: string;
      amount: number;
    }>;

    const usedCodes = new Set(earnings.map((e) => e.code));
    const personalAllowances = rawAllowances.map((allowance) => {
      const base =
        (allowance.code || allowance.name || 'PERSONAL')
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '') || 'PERSONAL';
      let code = base;
      let suffix = 2;
      while (usedCodes.has(code)) {
        code = `${base}_${suffix++}`;
      }
      usedCodes.add(code);
      return { ...allowance, code };
    });

    const grossSalary =
      earnings.reduce((sum, e) => sum + e.amount, 0) +
      personalAllowances.reduce((sum, e) => sum + e.amount, 0);
    const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
    const netSalary = grossSalary - totalDeductions;

    return { earnings, deductions, personalAllowances, grossSalary, totalDeductions, netSalary };
  }

  async assignSalary(
    tenantId: string,
    branchId: string,
    data: Record<string, unknown>,
    userId: string
  ) {
    const staffId = data.staffId as string;

    // Check if staff exists
    const staff = await collections.staff.findOne({
      _id: new ObjectId(staffId),
      tenantId: new ObjectId(tenantId),
      status: 'active',
    });

    if (!staff) {
      throw new ApiError('NOT_FOUND', 'Active staff member not found', 404);
    }

    // Check for existing active assignment
    const existing = await collections.staffSalaryAssignments.findOne({
      tenantId: new ObjectId(tenantId),
      staffId: new ObjectId(staffId),
      status: 'active',
    });

    if (existing) {
      throw new ApiError(
        'ALREADY_ASSIGNED',
        'Staff already has an active salary assignment. Use revise instead.',
        409
      );
    }

    const { earnings, deductions, personalAllowances, grossSalary, totalDeductions, netSalary } =
      this.prepareAssignmentComponents(data);

    const now = new Date();
    const doc = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      staffId: new ObjectId(staffId),
      salaryStructureId: new ObjectId(data.salaryStructureId as string),
      effectiveFrom: new Date(data.effectiveFrom as string),
      earnings,
      deductions,
      personalAllowances,
      grossSalary,
      totalDeductions,
      netSalary,
      ctc: data.ctc || undefined,
      customDeductions: data.customDeductions || [],
      status: 'active',
      createdBy: new ObjectId(userId),
      createdAt: now,
      updatedAt: now,
    };

    const result = await collections.staffSalaryAssignments.insertOne(doc);
    return { _id: result.insertedId, ...doc };
  }

  async reviseSalary(tenantId: string, id: string, data: Record<string, unknown>, userId: string) {
    // Get existing assignment
    const existing = await collections.staffSalaryAssignments.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
      status: 'active',
    });

    if (!existing) {
      throw new ApiError('NOT_FOUND', 'Active salary assignment not found', 404);
    }

    // Mark existing as revised
    await collections.staffSalaryAssignments.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'revised',
          effectiveTo: new Date(data.effectiveFrom as string),
          updatedAt: new Date(),
        },
      }
    );

    const { earnings, deductions, personalAllowances, grossSalary, totalDeductions, netSalary } =
      this.prepareAssignmentComponents(data);

    const now = new Date();
    const newDoc = {
      tenantId: existing.tenantId,
      branchId: existing.branchId,
      staffId: existing.staffId,
      salaryStructureId: data.salaryStructureId
        ? new ObjectId(data.salaryStructureId as string)
        : existing.salaryStructureId,
      effectiveFrom: new Date(data.effectiveFrom as string),
      earnings,
      deductions,
      personalAllowances,
      grossSalary,
      totalDeductions,
      netSalary,
      ctc: data.ctc || undefined,
      customDeductions: data.customDeductions || existing.customDeductions || [],
      status: 'active',
      createdBy: new ObjectId(userId),
      createdAt: now,
      updatedAt: now,
    };

    const result = await collections.staffSalaryAssignments.insertOne(newDoc);
    return { _id: result.insertedId, ...newDoc };
  }

  async addCustomDeduction(tenantId: string, id: string, data: Record<string, unknown>) {
    const assignment = await collections.staffSalaryAssignments.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
      status: 'active',
    });

    if (!assignment) {
      throw new ApiError('NOT_FOUND', 'Active salary assignment not found', 404);
    }

    const result = await collections.staffSalaryAssignments.findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $push: { customDeductions: data },
        $set: { updatedAt: new Date() },
      } as unknown as UpdateFilter<Document>,
      { returnDocument: 'after' }
    );

    return result;
  }

  async updateCustomDeduction(
    tenantId: string,
    id: string,
    code: string,
    data: Record<string, unknown>
  ) {
    const result = await collections.staffSalaryAssignments.findOneAndUpdate(
      {
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
        status: 'active',
        'customDeductions.code': code,
      },
      {
        $set: {
          'customDeductions.$': { ...data, code },
          updatedAt: new Date(),
        },
      } as unknown as UpdateFilter<Document>,
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new ApiError('NOT_FOUND', 'Assignment or custom deduction not found', 404);
    }

    return result;
  }

  // --- Payroll Processing ---

  async getPayrollRuns(tenantId: string, branchId: string, query: Record<string, unknown>) {
    const { page, limit, sortBy, sortOrder } = getPagination(query);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.year) {
      filter.year = parseInt(query.year as string);
    }

    const [data, total] = await Promise.all([
      collections.payrollRuns
        .find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collections.payrollRuns.countDocuments(filter),
    ]);

    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  async getPayrollRunById(tenantId: string, id: string) {
    const run = await collections.payrollRuns.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!run) {
      throw new ApiError('NOT_FOUND', 'Payroll run not found', 404);
    }

    return run;
  }

  async processPayroll(
    tenantId: string,
    branchId: string,
    data: { month: number; year: number; staffIds?: string[]; remarks?: string },
    userId: string
  ) {
    const { month, year, remarks } = data;
    let { staffIds } = data;
    const period = `${year}-${String(month).padStart(2, '0')}`;
    let addingToExistingRun = false;
    let existingRunId: ObjectId | null = null;

    // Check if payroll already exists for this period
    const existingRun = await collections.payrollRuns.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      period,
      status: { $in: ['processed', 'finalized'] },
    });

    if (existingRun) {
      if (existingRun.status === 'finalized') {
        throw new ApiError(
          'ALREADY_FINALIZED',
          `Payroll for ${period} has been finalized and cannot be modified.`,
          409
        );
      }

      // Allow adding new staff to a processed (not finalized) run
      if (staffIds && staffIds.length > 0) {
        // Find which staff already have payslips in this run
        const existingPayslips = await collections.payslips
          .find({
            payrollRunId: existingRun._id,
            staffId: { $in: staffIds.map((id) => new ObjectId(id)) },
            status: { $ne: 'draft' },
          })
          .project({ staffId: 1 })
          .toArray();

        const alreadyProcessedIds = new Set(existingPayslips.map((p) => p.staffId.toString()));
        const newStaffIds = staffIds.filter((id) => !alreadyProcessedIds.has(id));

        if (newStaffIds.length === 0) {
          throw new ApiError(
            'ALREADY_PROCESSED',
            'All selected staff already have payslips in this payroll run.',
            409
          );
        }

        // Continue processing with only the new staff, adding to existing run
        staffIds = newStaffIds;
        addingToExistingRun = true;
        existingRunId = existingRun._id;
      } else {
        throw new ApiError(
          'ALREADY_PROCESSED',
          `Payroll for ${period} has already been processed. Cancel it first to re-process, or select specific staff to add.`,
          409
        );
      }
    }

    // Get payroll settings
    const hrSettings = await collections.hrSettings.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    });

    const payrollSettings = hrSettings?.payrollSettings || {
      pfRate: 12,
      employeePfRate: 12,
      esiEmployerRate: 3.25,
      esiEmployeeRate: 0.75,
      esiThreshold: 21000,
      ptSlabs: [],
      tdsRegime: 'new',
      payslipNumberPrefix: 'PS',
      workingDaysPerMonth: 26,
      autoCalculateLOP: true,
    };

    // Get salary assignments
    const assignmentFilter: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      status: 'active',
    };

    if (staffIds && staffIds.length > 0) {
      assignmentFilter.staffId = { $in: staffIds.map((id) => new ObjectId(id)) };
    }

    const assignments = await collections.staffSalaryAssignments.find(assignmentFilter).toArray();

    if (assignments.length === 0) {
      throw new ApiError(
        'NO_ASSIGNMENTS',
        'No active salary assignments found for the selected staff',
        400
      );
    }

    // Create or reuse payroll run
    const now = new Date();
    let payrollRunId: ObjectId;

    if (addingToExistingRun && existingRunId) {
      payrollRunId = existingRunId;
    } else {
      const runDoc = {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        month,
        year,
        period,
        staffCount: 0,
        totalGross: 0,
        totalDeductions: 0,
        totalNet: 0,
        status: 'processing',
        processedBy: new ObjectId(userId),
        processedAt: now,
        remarks: remarks || undefined,
        createdAt: now,
        updatedAt: now,
      };

      const runResult = await collections.payrollRuns.insertOne(runDoc);
      payrollRunId = runResult.insertedId;
    }

    // Get attendance data for LOP calculation
    const attendanceData = new Map<string, { present: number; absent: number; lopDays: number }>();

    if (payrollSettings.autoCalculateLOP) {
      // Get all attendance records for this month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const attendanceRecords = await collections.staffAttendance
        .find({
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
          date: { $gte: startDate, $lte: endDate },
        })
        .toArray();

      // Approved paid leave doesn't count as absence; unpaid types (isPaid false
      // in HR settings, plus the legacy 'lop' value) still do.
      const unpaidTypes = (await hrSettingsService.getSettings(tenantId, branchId)).leaveTypes
        .filter((t) => !t.isPaid)
        .map((t) => t.code);
      const approvedLeaves = await collections.leaves
        .find({
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
          status: 'approved',
          leaveType: { $nin: ['lop', ...unpaidTypes] },
          fromDate: { $lte: endDate },
          toDate: { $gte: startDate },
        })
        .toArray();

      // Build set of staff who have approved paid leaves per date
      const paidLeaveMap = new Map<string, Set<string>>();
      for (const leave of approvedLeaves) {
        const staffKey = leave.staffId.toString();
        const leaveStart = new Date(Math.max(leave.fromDate.getTime(), startDate.getTime()));
        const leaveEnd = new Date(Math.min(leave.toDate.getTime(), endDate.getTime()));

        for (let d = new Date(leaveStart); d <= leaveEnd; d.setDate(d.getDate() + 1)) {
          const dateKey = d.toISOString().split('T')[0];
          if (!paidLeaveMap.has(dateKey)) paidLeaveMap.set(dateKey, new Set());
          paidLeaveMap.get(dateKey)!.add(staffKey);
        }
      }

      // Process attendance records
      for (const record of attendanceRecords) {
        if (!record.records) continue;
        for (const entry of record.records) {
          const staffKey = entry.staffId.toString();
          if (!attendanceData.has(staffKey)) {
            attendanceData.set(staffKey, { present: 0, absent: 0, lopDays: 0 });
          }
          const data = attendanceData.get(staffKey)!;

          if (entry.status === 'present' || entry.status === 'late') {
            data.present++;
          } else if (entry.status === 'half-day') {
            data.present += 0.5;
            // Check if half-day absent is covered by paid leave
            const dateKey = new Date(record.date).toISOString().split('T')[0];
            if (!paidLeaveMap.get(dateKey)?.has(staffKey)) {
              data.lopDays += 0.5;
            }
          } else if (entry.status === 'absent') {
            data.absent++;
            const dateKey = new Date(record.date).toISOString().split('T')[0];
            if (!paidLeaveMap.get(dateKey)?.has(staffKey)) {
              data.lopDays++;
            }
          }
          // 'leave' status = on approved leave, not LOP
        }
      }
    }

    // Get staff details for snapshots
    const staffIds_ = assignments.map((a) => a.staffId);
    const staffDocs = await collections.staff.find({ _id: { $in: staffIds_ } }).toArray();
    const staffMap = new Map(staffDocs.map((s) => [s._id.toString(), s]));

    // Get department names
    const deptIds = staffDocs.map((s) => s.employment?.departmentId).filter(Boolean);
    const departments =
      deptIds.length > 0
        ? await collections.departments.find({ _id: { $in: deptIds } }).toArray()
        : [];
    const deptMap = new Map(departments.map((d) => [d._id.toString(), d.name]));

    // Get designation names
    const desigIds = staffDocs.map((s) => s.employment?.designationId).filter(Boolean);
    const designations =
      desigIds.length > 0
        ? await collections.designations.find({ _id: { $in: desigIds } }).toArray()
        : [];
    const desigMap = new Map(designations.map((d) => [d._id.toString(), d.name]));

    // Generate payslips
    const payslips: Document[] = [];
    let totalGross = 0;
    let totalDeductionsSum = 0;
    let totalNet = 0;

    for (const assignment of assignments) {
      const staffIdStr = assignment.staffId.toString();
      const staff = staffMap.get(staffIdStr);
      if (!staff) continue;

      // Staff snapshot
      const staffSnapshot = {
        employeeId: staff.employeeId,
        displayName: staff.displayName,
        departmentName: staff.employment?.departmentId
          ? deptMap.get(staff.employment.departmentId.toString())
          : undefined,
        designationName: staff.employment?.designationId
          ? desigMap.get(staff.employment.designationId.toString())
          : undefined,
        bankDetails: staff.bankDetails || undefined,
        panNumber: staff.documents?.find((d: { type: string }) => d.type === 'PAN')?.number,
      };

      // Attendance → loss of pay; then the shared payroll maths (payrollMath.ts)
      const workingDays = payrollSettings.workingDaysPerMonth;
      const attendance = attendanceData.get(staffIdStr) || {
        present: workingDays,
        absent: 0,
        lopDays: 0,
      };
      const slip = computePayslip(
        {
          earnings: assignment.earnings || [],
          personalAllowances: assignment.personalAllowances || [],
          deductions: assignment.deductions || [],
          customDeductions: assignment.customDeductions || [],
          period,
          lopDays: attendance.lopDays,
        },
        { ...DEFAULT_PAYROLL_SETTINGS, ...payrollSettings }
      );
      const {
        lopDays,
        lopDeduction,
        earnings: payslipEarnings,
        deductions: payslipDeductions,
        grossEarnings,
        totalDeductions: totalDed,
        netPayable,
      } = slip;

      const payslipNumber = await generatePayslipNumber(
        tenantId,
        branchId,
        payrollSettings.payslipNumberPrefix
      );

      payslips.push({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        payrollRunId,
        staffId: assignment.staffId,
        payslipNumber,
        month,
        year,
        period,
        staffSnapshot,
        earnings: payslipEarnings,
        deductions: payslipDeductions,
        workingDays,
        daysPresent: attendance.present,
        daysAbsent: attendance.absent,
        lopDays,
        lopDeduction,
        grossEarnings,
        totalDeductions: totalDed,
        netPayable,
        tds: slip.tds,
        employerContributions: slip.employer,
        monthlyCost: slip.monthlyCost,
        disbursement: {
          status: 'pending',
        },
        status: 'generated',
        createdAt: now,
        updatedAt: now,
      });

      totalGross += grossEarnings;
      totalDeductionsSum += totalDed;
      totalNet += netPayable;
    }

    // Batch insert payslips
    if (payslips.length > 0) {
      await collections.payslips.insertMany(payslips);
    }

    // Update payroll run
    if (addingToExistingRun) {
      await collections.payrollRuns.updateOne(
        { _id: payrollRunId },
        {
          $inc: {
            staffCount: payslips.length,
            totalGross: Math.round(totalGross * 100) / 100,
            totalDeductions: Math.round(totalDeductionsSum * 100) / 100,
            totalNet: Math.round(totalNet * 100) / 100,
          },
          $set: {
            status: 'processed',
            updatedAt: new Date(),
          },
        }
      );
    } else {
      await collections.payrollRuns.updateOne(
        { _id: payrollRunId },
        {
          $set: {
            staffCount: payslips.length,
            totalGross: Math.round(totalGross * 100) / 100,
            totalDeductions: Math.round(totalDeductionsSum * 100) / 100,
            totalNet: Math.round(totalNet * 100) / 100,
            status: 'processed',
            updatedAt: new Date(),
          },
        }
      );
    }

    // Update custom deduction recovered amounts
    for (const assignment of assignments) {
      for (const cd of assignment.customDeductions || []) {
        if (!cd.isActive) continue;
        if (cd.startMonth && period < cd.startMonth) continue;
        if (cd.endMonth && period > cd.endMonth) continue;

        const newRecovered = (cd.recoveredAmount || 0) + cd.amount;
        const newRemaining = (cd.totalAmount || 0) - newRecovered;

        await collections.staffSalaryAssignments.updateOne(
          {
            _id: assignment._id,
            'customDeductions.code': cd.code,
          },
          {
            $set: {
              'customDeductions.$.recoveredAmount': newRecovered,
              'customDeductions.$.remainingAmount': Math.max(0, newRemaining),
              'customDeductions.$.isActive': cd.frequency === 'one-time' ? false : newRemaining > 0,
              updatedAt: new Date(),
            },
          } as unknown as UpdateFilter<Document>
        );
      }
    }

    logger.info(
      { payrollRunId, period, staffCount: payslips.length, addedToExisting: addingToExistingRun },
      'Payroll processed successfully'
    );

    // Fetch the final state of the run to return accurate totals
    const finalRun = await collections.payrollRuns.findOne({ _id: payrollRunId });
    return finalRun;
  }

  async finalizePayroll(tenantId: string, id: string, userId: string) {
    const result = await collections.payrollRuns.findOneAndUpdate(
      {
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
        status: 'processed',
      },
      {
        $set: {
          status: 'finalized',
          finalizedBy: new ObjectId(userId),
          finalizedAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new ApiError('INVALID_STATE', 'Payroll run not found or not in processed state', 400);
    }

    // Mark all payslips as finalized
    await collections.payslips.updateMany(
      { payrollRunId: new ObjectId(id) },
      { $set: { status: 'finalized', updatedAt: new Date() } }
    );

    return result;
  }

  async cancelPayroll(tenantId: string, id: string, _userId: string) {
    const run = await collections.payrollRuns.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!run) {
      throw new ApiError('NOT_FOUND', 'Payroll run not found', 404);
    }

    if (run.status === 'cancelled') {
      throw new ApiError('ALREADY_CANCELLED', 'Payroll run is already cancelled', 400);
    }

    if (run.status === 'finalized') {
      throw new ApiError('CANNOT_CANCEL', 'Cannot cancel a finalized payroll run', 400);
    }

    await collections.payrollRuns.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'cancelled',
          updatedAt: new Date(),
        },
      }
    );

    // Mark all payslips as draft (cancelled)
    await collections.payslips.updateMany(
      { payrollRunId: new ObjectId(id) },
      { $set: { status: 'draft', updatedAt: new Date() } }
    );

    return { message: 'Payroll run cancelled successfully' };
  }

  // --- Payslips ---

  async getPayslips(tenantId: string, branchId: string, query: Record<string, unknown>) {
    const { page, limit, sortBy, sortOrder } = getPagination(query);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      status: { $ne: 'draft' }, // Don't show cancelled payslips
    };

    if (query.period) {
      filter.period = query.period;
    }

    if (query.month && query.year) {
      filter.month = parseInt(query.month as string);
      filter.year = parseInt(query.year as string);
    }

    if (query.payrollRunId) {
      filter.payrollRunId = new ObjectId(query.payrollRunId as string);
    }

    if (query.disbursementStatus) {
      filter['disbursement.status'] = query.disbursementStatus;
    }

    if (query.search) {
      filter.$or = [
        { payslipNumber: { $regex: query.search, $options: 'i' } },
        { 'staffSnapshot.displayName': { $regex: query.search, $options: 'i' } },
        { 'staffSnapshot.employeeId': { $regex: query.search, $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      collections.payslips
        .find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collections.payslips.countDocuments(filter),
    ]);

    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  async getMyPayslips(tenantId: string, staffId: string, query: Record<string, unknown>) {
    const { page, limit } = getPagination(query);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
      staffId: new ObjectId(staffId),
      status: { $ne: 'draft' },
    };

    if (query.year) {
      filter.year = parseInt(query.year as string);
    }

    const [data, total] = await Promise.all([
      collections.payslips
        .find(filter)
        .sort({ year: -1, month: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collections.payslips.countDocuments(filter),
    ]);

    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  async getPayslipById(tenantId: string, id: string) {
    const payslip = await collections.payslips.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!payslip) {
      throw new ApiError('NOT_FOUND', 'Payslip not found', 404);
    }

    return payslip;
  }

  async updateDisbursement(
    tenantId: string,
    id: string,
    data: Record<string, unknown>,
    userId: string
  ) {
    const update: Record<string, unknown> = {
      'disbursement.status': data.status,
      updatedAt: new Date(),
    };

    if (data.paymentMode) update['disbursement.paymentMode'] = data.paymentMode;
    if (data.paymentReference) update['disbursement.paymentReference'] = data.paymentReference;
    if (data.remarks) update['disbursement.remarks'] = data.remarks;

    if (data.status === 'paid') {
      update['disbursement.paidAt'] = new Date();
      update['disbursement.paidBy'] = new ObjectId(userId);
    }

    const result = await collections.payslips.findOneAndUpdate(
      {
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
        status: { $ne: 'draft' },
      },
      { $set: update },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new ApiError('NOT_FOUND', 'Payslip not found', 404);
    }

    return result;
  }

  async bulkUpdateDisbursement(
    tenantId: string,
    data: {
      payslipIds: string[];
      status: string;
      paymentMode?: string;
      paymentReference?: string;
      remarks?: string;
    },
    userId: string
  ) {
    const update: Record<string, unknown> = {
      'disbursement.status': data.status,
      updatedAt: new Date(),
    };

    if (data.paymentMode) update['disbursement.paymentMode'] = data.paymentMode;
    if (data.paymentReference) update['disbursement.paymentReference'] = data.paymentReference;
    if (data.remarks) update['disbursement.remarks'] = data.remarks;

    if (data.status === 'paid') {
      update['disbursement.paidAt'] = new Date();
      update['disbursement.paidBy'] = new ObjectId(userId);
    }

    const result = await collections.payslips.updateMany(
      {
        _id: { $in: data.payslipIds.map((id) => new ObjectId(id)) },
        tenantId: new ObjectId(tenantId),
        status: { $ne: 'draft' },
      },
      { $set: update }
    );

    return {
      modifiedCount: result.modifiedCount,
      message: `${result.modifiedCount} payslips updated`,
    };
  }

  // --- Payroll Settings ---

  async getPayrollSettings(tenantId: string, branchId: string) {
    const settings = await collections.hrSettings.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    });

    return (
      settings?.payrollSettings || {
        pfRate: 12,
        employeePfRate: 12,
        esiEmployerRate: 3.25,
        esiEmployeeRate: 0.75,
        esiThreshold: 21000,
        ptSlabs: [],
        tdsRegime: 'new',
        payslipNumberPrefix: 'PS',
        workingDaysPerMonth: 26,
        autoCalculateLOP: true,
      }
    );
  }

  async updatePayrollSettings(tenantId: string, branchId: string, data: Record<string, unknown>) {
    const result = await collections.hrSettings.findOneAndUpdate(
      {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      },
      {
        $set: {
          payrollSettings: data,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
          createdAt: new Date(),
        },
      } as unknown as UpdateFilter<Document>,
      { upsert: true, returnDocument: 'after' }
    );

    return result?.payrollSettings || data;
  }

  /**
   * Record every unpaid payslip of a finalized run as paid by bank transfer —
   * for campuses that pay salaries from their own bank, not through RazorpayX.
   * Moves no money; it records that the bank transfer happened.
   */
  async markRunPaid(
    tenantId: string,
    branchId: string,
    runId: string,
    data: { paymentReference: string },
    userId: string
  ) {
    const run = await collections.payrollRuns.findOne({
      _id: new ObjectId(runId),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    });
    if (!run) throw new ApiError('PAYROLL_RUN_NOT_FOUND', 'Payroll run not found', 404);
    if (run.status !== 'finalized') {
      throw new ApiError(
        'RUN_NOT_FINALIZED',
        'Finalize this payroll before recording it as paid',
        400
      );
    }
    const now = new Date();
    const result = await collections.payslips.updateMany(
      {
        tenantId: new ObjectId(tenantId),
        payrollRunId: run._id,
        status: { $ne: 'draft' },
        'disbursement.status': { $ne: 'paid' },
      },
      {
        $set: {
          'disbursement.status': 'paid',
          'disbursement.paymentMode': 'bank_transfer',
          'disbursement.paymentReference': data.paymentReference,
          'disbursement.paidAt': now,
          'disbursement.paidBy': new ObjectId(userId),
          updatedAt: now,
        },
      }
    );
    logger.info({ runId, tenantId, paid: result.modifiedCount }, 'Payroll run recorded as paid');
    return { paid: result.modifiedCount };
  }

  /**
   * Where one run's money goes: totals per pay component (Basic, HRA, PF, TDS…)
   * and per department, read straight from its payslips.
   */
  async getRunBreakdown(tenantId: string, branchId: string, runId: string) {
    const run = await collections.payrollRuns.findOne({
      _id: new ObjectId(runId),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    });
    if (!run) throw new ApiError('PAYROLL_RUN_NOT_FOUND', 'Payroll run not found', 404);
    const match = { $match: { tenantId: new ObjectId(tenantId), payrollRunId: run._id } };
    const component = (field: 'earnings' | 'deductions') => [
      match,
      { $unwind: `$${field}` },
      {
        $group: {
          _id: `$${field}.code`,
          name: { $first: `$${field}.name` },
          amount: { $sum: `$${field}.amount` },
        },
      },
      { $sort: { amount: -1 as const } },
    ];
    const [earnings, deductions, departments, paid] = await Promise.all([
      collections.payslips.aggregate(component('earnings')).toArray(),
      collections.payslips.aggregate(component('deductions')).toArray(),
      collections.payslips
        .aggregate([
          match,
          {
            $group: {
              _id: { $ifNull: ['$staffSnapshot.departmentName', 'Campus leadership & office'] },
              staff: { $sum: 1 },
              gross: { $sum: '$grossEarnings' },
              net: { $sum: '$netPayable' },
            },
          },
          { $sort: { net: -1 } },
        ])
        .toArray(),
      collections.payslips.countDocuments({ ...match.$match, 'disbursement.status': 'paid' }),
    ]);
    const round = (n: unknown) => Math.round(Number(n ?? 0));
    return {
      runId,
      month: run.month as number,
      year: run.year as number,
      status: run.status as string,
      staffCount: run.staffCount as number,
      paidCount: paid,
      earnings: earnings.map((e) => ({
        code: e._id as string,
        name: e.name as string,
        amount: round(e.amount),
      })),
      deductions: deductions.map((d) => ({
        code: d._id as string,
        name: d.name as string,
        amount: round(d.amount),
      })),
      departments: departments.map((d) => ({
        name: d._id as string,
        staff: d.staff as number,
        gross: round(d.gross),
        net: round(d.net),
      })),
    };
  }

  // --- Rules, preview and the payout sandbox ---

  /** This campus's payroll rules in plain words, with its own numbers. */
  async getRules(tenantId: string, branchId: string) {
    const settings = { ...DEFAULT_PAYROLL_SETTINGS, ...(await this.getPayrollSettings(tenantId, branchId)) } as PayrollSettings;
    return { settings, rules: describeRules(settings) };
  }

  /** A payslip for any salary, before anyone is paid it (structure editor, rules page). */
  async preview(
    tenantId: string,
    branchId: string,
    data: { earnings: Array<{ code: string; name: string; amount: number }>; deductions?: Array<{ code: string; name: string; amount: number }>; lopDays?: number; regime?: 'old' | 'new' }
  ) {
    const settings = { ...DEFAULT_PAYROLL_SETTINGS, ...(await this.getPayrollSettings(tenantId, branchId)) } as PayrollSettings;
    return computePayslip(
      { earnings: data.earnings, deductions: data.deductions, lopDays: data.lopDays },
      data.regime ? { ...settings, tdsRegime: data.regime } : settings
    );
  }

  /**
   * CampusPay sandbox: a simulated bank payout for a finalized run. No money
   * moves and no payment provider is called (RazorpayX stays untouched).
   * Each unpaid payslip is "credited" with a UTR when the person has a bank
   * account on file, and fails with a reason when they don't — so the run
   * can be retried after the account is added.
   */
  async simulatePayout(tenantId: string, branchId: string, runId: string, userId: string) {
    const run = await collections.payrollRuns.findOne({
      _id: new ObjectId(runId),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    });
    if (!run) throw new ApiError('PAYROLL_RUN_NOT_FOUND', 'Payroll run not found', 404);
    if (run.status !== 'finalized') {
      throw new ApiError('RUN_NOT_FINALIZED', 'Finalize this payroll before paying it', 400);
    }
    const slips = await collections.payslips
      .find({ payrollRunId: run._id, status: { $ne: 'draft' }, 'disbursement.status': { $ne: 'paid' } })
      .project({ staffId: 1, netPayable: 1, staffSnapshot: 1 })
      .toArray();
    if (!slips.length) throw new ApiError('NOTHING_TO_PAY', 'Everyone in this run has already been paid', 400);
    const staff = await collections.staff
      .find({ _id: { $in: slips.map((p) => p.staffId) } })
      .project({ bankDetails: 1, displayName: 1, photo: 1 })
      .toArray();
    const bankOf = new Map(staff.map((x) => [String(x._id), x]));

    const now = new Date();
    const stamp = now.toISOString().slice(2, 10).replace(/-/g, '');
    const batchRef = `CVPAY${stamp}${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`;
    const mask = (acct?: string) => (acct ? `•••• ${acct.slice(-4)}` : null);
    const items = slips.map((p, i) => {
      const st = bankOf.get(String(p.staffId));
      const bank = st?.bankDetails;
      const ok = !!bank?.accountNumber && !!bank?.ifscCode;
      return {
        payslipId: String(p._id),
        staffId: String(p.staffId),
        name: (st?.displayName as string) ?? p.staffSnapshot?.displayName,
        employeeId: p.staffSnapshot?.employeeId ?? null,
        photo: (st?.photo as string) ?? null,
        bank: bank?.bankName ?? null,
        account: mask(bank?.accountNumber),
        amount: Math.round(Number(p.netPayable) * 100) / 100,
        status: ok ? ('paid' as const) : ('failed' as const),
        utr: ok ? `${(bank!.ifscCode as string).slice(0, 4)}N${stamp}${String(100000 + i).slice(-6)}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}` : null,
        reason: ok ? null : 'No bank account on file',
      };
    });

    const paid = items.filter((x) => x.status === 'paid');
    const failed = items.filter((x) => x.status === 'failed');
    if (paid.length) {
      await collections.payslips.bulkWrite(
        paid.map((x) => ({
          updateOne: {
            filter: { _id: new ObjectId(x.payslipId) },
            update: {
              $set: {
                'disbursement.status': 'paid',
                'disbursement.paymentMode': 'bank_transfer',
                'disbursement.paymentReference': x.utr,
                'disbursement.batchReference': batchRef,
                'disbursement.remarks': 'CampusPay sandbox payout',
                'disbursement.paidAt': now,
                'disbursement.paidBy': new ObjectId(userId),
                updatedAt: now,
              },
            },
          },
        }))
      );
    }
    if (failed.length) {
      await collections.payslips.updateMany(
        { _id: { $in: failed.map((x) => new ObjectId(x.payslipId)) } },
        { $set: { 'disbursement.status': 'failed', 'disbursement.remarks': 'No bank account on file', 'disbursement.batchReference': batchRef, updatedAt: now } }
      );
    }
    const total = (xs: typeof items) => Math.round(xs.reduce((n, x) => n + x.amount, 0) * 100) / 100;
    const batch = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      payrollRunId: run._id,
      period: run.period,
      reference: batchRef,
      mode: 'sandbox',
      count: items.length,
      paidCount: paid.length,
      failedCount: failed.length,
      paidAmount: total(paid),
      failedAmount: total(failed),
      initiatedBy: new ObjectId(userId),
      createdAt: now,
    };
    await collections.payrollRuns.updateOne(
      { _id: run._id },
      { $push: { payoutBatches: batch } as never, $set: { updatedAt: now } }
    );
    logger.info({ runId, batchRef, paid: paid.length, failed: failed.length }, 'Sandbox payout completed');
    return { ...batch, payrollRunId: runId, items };
  }
}

export const payrollService = new PayrollService();
