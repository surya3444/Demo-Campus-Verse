/**
 * Demo platform, phase 25: payroll that holds up to scrutiny for one tenant.
 * - Bank accounts for active staff (Kerala banks, valid-format IFSC), leaving
 *   three without one so the payout simulation shows real failures.
 * - Recalculates the latest finalized-but-unpaid payroll run with the shared
 *   payroll maths (correct FY 2025-26 TDS, PF on Basic + DA, employer cost).
 *   Paid months are history and stay as they are. Safe to re-run.
 *
 * Run (from apps/api): npx tsx src/scripts/demo-platform/25-payroll-demo.ts <tenantId>
 */
import 'dotenv/config';
import { ObjectId, type AnyBulkWriteOperation, type Document } from 'mongodb';
import { connectDatabase, closeDatabase, collections } from '../../config/database';
import { computePayslip, DEFAULT_PAYROLL_SETTINGS } from '../../modules/hr/payrollMath';

const BANKS: Array<[string, string]> = [
  ['State Bank of India', 'SBIN'],
  ['Federal Bank', 'FDRL'],
  ['South Indian Bank', 'SIBL'],
  ['HDFC Bank', 'HDFC'],
  ['Canara Bank', 'CNRB'],
  ['ICICI Bank', 'ICIC'],
  ['Kerala Gramin Bank', 'KLGB'],
];
let seed = 25;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const digits = (n: number) => Array.from({ length: n }, () => Math.floor(rnd() * 10)).join('');

(async () => {
  const id = process.argv[2];
  if (!id || !ObjectId.isValid(id)) throw new Error('Pass the tenant id');
  await connectDatabase();
  const tenantId = new ObjectId(id);

  // 1 · Bank accounts
  const staff = await collections.staff.find({ tenantId, status: 'active' }).sort({ _id: 1 }).toArray();
  const ops: AnyBulkWriteOperation<Document>[] = [];
  staff.forEach((s, i) => {
    if (s.bankDetails?.accountNumber) return;
    if (i % 80 === 7) return; // a few without accounts → visible payout failures
    const [bankName, code] = BANKS[i % BANKS.length];
    ops.push({
      updateOne: {
        filter: { _id: s._id },
        update: {
          $set: {
            bankDetails: {
              accountHolderName: (s.displayName as string) || `${s.firstName} ${s.lastName}`,
              accountNumber: `${code === 'SBIN' ? '3' : '1'}${digits(code === 'SBIN' ? 10 : 13)}`,
              ifscCode: `${code}0${digits(6)}`,
              bankName,
            },
          },
        },
      },
    });
  });
  if (ops.length) await collections.staff.bulkWrite(ops);
  console.log(`bank accounts added: ${ops.length} of ${staff.length} staff`);

  // 2 · Recalculate the latest unpaid finalized run
  const runs = await collections.payrollRuns.find({ tenantId, status: { $in: ['processed', 'finalized'] } }).sort({ period: -1 }).toArray();
  for (const run of runs) {
    const paid = await collections.payslips.countDocuments({ payrollRunId: run._id, 'disbursement.status': 'paid' });
    if (paid) continue;
    const hr = await collections.hrSettings.findOne({ tenantId, branchId: run.branchId });
    const settings = { ...DEFAULT_PAYROLL_SETTINGS, ...(hr?.payrollSettings ?? {}) };
    const slips = await collections.payslips.find({ payrollRunId: run._id }).toArray();
    const assignments = await collections.staffSalaryAssignments
      .find({ tenantId, staffId: { $in: slips.map((p) => p.staffId) }, status: 'active' })
      .toArray();
    const byStaff = new Map(assignments.map((a) => [String(a.staffId), a]));
    const staffById = new Map(staff.map((s) => [String(s._id), s]));
    const updates: AnyBulkWriteOperation<Document>[] = [];
    let gross = 0;
    let ded = 0;
    let net = 0;
    for (const p of slips) {
      const a = byStaff.get(String(p.staffId));
      if (!a) continue;
      const r = computePayslip(
        {
          earnings: a.earnings ?? [],
          personalAllowances: a.personalAllowances ?? [],
          deductions: a.deductions ?? [],
          customDeductions: a.customDeductions ?? [],
          period: run.period,
          lopDays: p.lopDays ?? 0,
        },
        settings
      );
      const fresh = await collections.staff.findOne({ _id: p.staffId }, { projection: { bankDetails: 1 } });
      updates.push({
        updateOne: {
          filter: { _id: p._id },
          update: {
            $set: {
              earnings: r.earnings,
              deductions: r.deductions,
              grossEarnings: r.grossEarnings,
              totalDeductions: r.totalDeductions,
              netPayable: r.netPayable,
              lopDeduction: r.lopDeduction,
              tds: r.tds,
              employerContributions: r.employer,
              monthlyCost: r.monthlyCost,
              'staffSnapshot.bankDetails': fresh?.bankDetails ?? staffById.get(String(p.staffId))?.bankDetails ?? null,
              updatedAt: new Date(),
            },
          },
        },
      });
      gross += r.grossEarnings;
      ded += r.totalDeductions;
      net += r.netPayable;
    }
    if (updates.length) await collections.payslips.bulkWrite(updates);
    const round = (n: number) => Math.round(n * 100) / 100;
    await collections.payrollRuns.updateOne(
      { _id: run._id },
      { $set: { totalGross: round(gross), totalDeductions: round(ded), totalNet: round(net), recalculatedAt: new Date(), updatedAt: new Date() } }
    );
    console.log(`run ${run.period}: ${updates.length} payslips recalculated — gross ₹${round(gross)}, deductions ₹${round(ded)} (was ₹${run.totalDeductions}), net ₹${round(net)}`);
    break;
  }

  await closeDatabase();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
