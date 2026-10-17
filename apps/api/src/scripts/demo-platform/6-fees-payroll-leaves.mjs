// Phase 6 — fee collection at each campus accountant's counter, salary set-up
// and Aug/Sep payroll (recorded as bank transfers — never RazorpayX payouts),
// and leave applied by teachers and decided by their HODs / campus admin.
import { session, pool, loadState, saveState, log, rnd, pick, int } from './lib.mjs';
import { ORGS } from './spec.mjs';

const only = process.argv[2];
const steps = (process.argv[3] ?? 'fees,payroll,leaves').split(',');
const MODES = ['upi', 'upi', 'upi', 'card', 'netbanking', 'cash', 'cash', 'cheque'];

const SALARY = {
  Dean: 210000, HOD: 150000, Professor: 135000, 'Associate Professor': 110000, 'Assistant Professor': 78000,
  'Campus Director': 190000, Principal: 120000, 'Senior Teacher': 62000, Teacher: 45000,
  accounts: 52000, hr: 60000, admissions: 38000, frontdesk: 26000, warden: 34000, stores: 36000, placements: 58000,
  'Lab Assistant': 24000, 'Office Assistant': 21000, 'Support Staff': 18000,
};

for (const org of ORGS.filter((o) => !only || o.key === only)) {
  const st = loadState(org.key);
  const owner = await session(org.owner);
  log(`== ${org.key}`);

  for (const c of org.campuses) {
    const cs = st.campuses[c.code];
    const B = { branchId: cs.branchId };
    const find = (pred) => cs.staff.find(pred);

    // ── Fees at the accountant's counter ──────────────────────────────────
    if (steps.includes('fees')) {
      const acct = await session(find((s) => s.role === 'ACCOUNTANT').email);
      cs.feesPaid ??= {};
      const todo = (cs.students ?? []).filter((s) => !cs.feesPaid[s.id]);
      log(`  ${c.code}: collecting fees for ${todo.length} students`);
      let n = 0;
      await pool(todo, 4, async (s) => {
        const r = rnd();
        const plan = r < 0.15 ? [1, 2] : r < 0.8 ? [1] : [];
        if (plan.length) {
          const list = await acct.call('GET', `/finance/assignments/student/${s.id}`, undefined, B);
          const a = (list.assignments ?? list)[0];
          if (a) {
            for (const inst of plan) {
              const i = a.installments.find((x) => x.installmentNumber === inst);
              if (!i || i.balance <= 0) continue;
              // Components split 60/40 between the two terms, as structured.
              let comps = a.components.map((x) => {
                const first = Math.round(x.totalAmount * 0.6);
                return { componentCode: x.componentCode, name: x.name, amount: inst === 1 ? first : x.totalAmount - first };
              });
              const sum = comps.reduce((t, x) => t + x.amount, 0);
              if (sum !== i.balance) comps = comps.map((x, j) => (j === 0 ? { ...x, amount: x.amount + (i.balance - sum) } : x));
              const mode = pick(MODES);
              await acct.call(
                'POST',
                '/finance/fee-counter/collect',
                {
                  studentId: s.id,
                  assignmentId: a._id,
                  paymentMode: mode,
                  paymentDetails:
                    mode === 'upi' ? { upiId: `${s.name.split(' ')[0].toLowerCase()}${int(10, 99)}@okaxis`, referenceNumber: `UPI${int(100000000, 999999999)}` }
                    : mode === 'card' ? { cardLast4: String(int(1000, 9999)), referenceNumber: `TXN${int(10000000, 99999999)}` }
                    : mode === 'cheque' ? { chequeNumber: String(int(100000, 999999)), bankName: pick(['SBI', 'HDFC Bank', 'Canara Bank', 'ICICI Bank']), chequeDate: '2026-08-05' }
                    : mode === 'netbanking' ? { referenceNumber: `NB${int(10000000, 99999999)}`, bankName: pick(['SBI', 'HDFC Bank', 'Axis Bank']) }
                    : undefined,
                  components: comps,
                  installmentNumbers: [inst],
                  amount: i.balance,
                  remarks: inst === 1 ? 'Term 1 fee' : 'Term 2 fee (paid in advance)',
                },
                B
              );
            }
          }
        }
        cs.feesPaid[s.id] = plan.length || 'unpaid';
        if (++n % 200 === 0) {
          saveState(org.key, st);
          log(`    ${c.code}: ${n} fee accounts`);
        }
      });
      saveState(org.key, st);
    }

    // ── Payroll ───────────────────────────────────────────────────────────
    if (steps.includes('payroll')) {
      cs.salary ??= {};
      if (!cs.salary.structures) {
        const make = (code, name, roleCodes) =>
          owner.call(
            'POST',
            '/hr/salary-structures',
            {
              name,
              code,
              earnings: [
                { code: 'BASIC', name: 'Basic Pay', type: 'fixed', defaultAmount: 0, isTaxable: true },
                { code: 'HRA', name: 'House Rent Allowance', type: 'percentage', percentageOf: 'BASIC', defaultAmount: 40, isTaxable: true },
                { code: 'DA', name: 'Dearness Allowance', type: 'percentage', percentageOf: 'BASIC', defaultAmount: 12, isTaxable: true },
                { code: 'SPL', name: 'Special Allowance', type: 'fixed', defaultAmount: 0, isTaxable: true },
              ],
              deductions: [
                { code: 'PF', name: 'Provident Fund', type: 'percentage', percentageOf: 'BASIC', defaultAmount: 12, isStatutory: true },
                { code: 'PT', name: 'Professional Tax', type: 'fixed', defaultAmount: 200, isStatutory: true },
              ],
              applicableTo: { roleCodes },
            },
            B
          );
        cs.salary.structures = {
          faculty: (await make(`${c.code}-FAC`, 'Teaching Faculty', ['TEACHER', 'HOD', 'INSTITUTION_ADMIN']))._id,
          admin: (await make(`${c.code}-ADM`, 'Administration', ['BRANCH_ADMIN', 'ACCOUNTANT', 'HR_MANAGER', 'ADMISSION_COUNSELOR', 'PLACEMENT_OFFICER']))._id,
          support: (await make(`${c.code}-SUP`, 'Support Staff', ['RECEPTIONIST', 'HOSTEL_WARDEN', 'INVENTORY_MANAGER']))._id,
        };
        saveState(org.key, st);
      }
      cs.salary.assigned ??= {};
      const todo = cs.staff.filter((s) => !cs.salary.assigned[s.id]);
      await pool(todo, 4, async (s) => {
        const gross = Math.round((SALARY[s.title] ?? 30000) * (0.92 + rnd() * 0.16) / 100) * 100;
        const basic = Math.round(gross / 1.52 / 100) * 100 * 0.85;
        const hra = Math.round(basic * 0.4);
        const da = Math.round(basic * 0.12);
        const spl = Math.max(0, gross - basic - hra - da);
        const structure = s.teaching || /Dean|HOD|Professor|Teacher/.test(s.title ?? '') ? 'faculty' : ['BRANCH_ADMIN', 'ACCOUNTANT', 'HR_MANAGER', 'ADMISSION_COUNSELOR', 'PLACEMENT_OFFICER'].includes(s.role) ? 'admin' : 'support';
        await owner.call(
          'POST',
          '/hr/salary-assignments',
          {
            staffId: s.id,
            salaryStructureId: cs.salary.structures[structure],
            effectiveFrom: '2026-04-01',
            earnings: [
              { code: 'BASIC', name: 'Basic Pay', amount: basic },
              { code: 'HRA', name: 'House Rent Allowance', amount: hra },
              { code: 'DA', name: 'Dearness Allowance', amount: da },
              { code: 'SPL', name: 'Special Allowance', amount: spl },
            ],
            deductions: [
              { code: 'PF', name: 'Provident Fund', amount: Math.round(basic * 0.12) },
              { code: 'PT', name: 'Professional Tax', amount: 200 },
            ],
            ctc: gross * 12,
          },
          B
        );
        cs.salary.assigned[s.id] = gross;
      });
      saveState(org.key, st);

      // Aug + Sep runs: HR processes, owner finalises, HR records the bank transfer.
      const hr = await session(find((s) => s.role === 'HR_MANAGER').email);
      cs.salary.runs ??= {};
      for (const month of [8, 9]) {
        if (cs.salary.runs[month]?.allPaid) continue;
        const run = cs.salary.runs[month]?.id
          ? { _id: cs.salary.runs[month].id }
          : await hr.call('POST', '/hr/payroll-runs', { month, year: 2026, remarks: `Payroll for ${month === 8 ? 'August' : 'September'} 2026` }, B);
        cs.salary.runs[month] = { id: run._id };
        saveState(org.key, st);
        await owner.call('PUT', `/hr/payroll-runs/${run._id}/finalize`, {}, B).catch((e) => {
          if (!/final/i.test(e.message)) throw e;
        });
        const ids = [];
        for (let page = 1; page <= 30; page++) {
          const slips = await hr.call('GET', `/hr/payslips?payrollRunId=${run._id}&limit=100&page=${page}`, undefined, B);
          const rows = slips.payslips ?? slips;
          ids.push(...rows.filter((p) => p.disbursement?.status !== 'paid' && p.paymentStatus !== 'paid').map((p) => p._id));
          if (rows.length < 100) break;
        }
        for (let i = 0; i < ids.length; i += 100) {
          await hr.call(
            'PUT',
            '/hr/payslips/bulk-disbursement',
            { payslipIds: ids.slice(i, i + 100), status: 'paid', paymentMode: 'bank_transfer', paymentReference: `NEFT-${c.code}-2026${String(month).padStart(2, '0')}`, remarks: 'Salary credited' },
            B
          );
        }
        cs.salary.runs[month].paid = (cs.salary.runs[month].paid ?? 0) + ids.length;
        cs.salary.runs[month].allPaid = true;
        saveState(org.key, st);
      }
      log(`  ${c.code}: payroll — ${Object.keys(cs.salary.assigned).length} salaries, runs ${JSON.stringify(cs.salary.runs)}`);
    }

    // ── Leave ─────────────────────────────────────────────────────────────
    if (steps.includes('leaves')) {
      cs.leaves ??= {};
      const applicants = cs.staff.filter((s) => s.role === 'TEACHER' && !cs.leaves[s.id]).filter(() => rnd() < 0.35);
      const hodFor = new Map(cs.staff.filter((s) => s.role === 'HOD').map((h) => [h.departmentId, h]));
      const sessions = new Map();
      const sess = async (email) => {
        if (!sessions.has(email)) sessions.set(email, await session(email));
        return sessions.get(email);
      };
      const admin = await sess(find((s) => s.role === 'BRANCH_ADMIN').email);
      await pool(applicants, 3, async (t) => {
        const me = await sess(t.email);
        const mine = await me.call('GET', '/hr/leaves/my?limit=5', undefined, B);
        if ((mine.length ?? mine.leaves?.length ?? 0) > 0) {
          cs.leaves[t.id] = ['existing'];
          return;
        }
        const asks = [];
        const r = rnd();
        // a past sick leave (approved), and usually something upcoming
        asks.push({ leaveType: 'SL', fromDate: `2026-09-${String(int(1, 25)).padStart(2, '0')}`, days: int(0, 1), reason: pick(['Fever and cold', 'Viral infection', 'Medical appointment', 'Back pain']), decide: 'approve' });
        if (r < 0.7) asks.push({ leaveType: 'CL', fromDate: `2026-10-${String(int(22, 30)).padStart(2, '0')}`, days: int(0, 1), reason: pick(['Family function', 'Personal work', 'Travelling to hometown', 'Sibling’s wedding']), decide: r < 0.3 ? 'pending' : r < 0.6 ? 'approve' : 'reject' });
        if (r > 0.85) asks.push({ leaveType: 'EL', fromDate: '2026-11-23', days: int(2, 4), reason: 'Annual vacation with family', decide: 'pending' });
        const made = [];
        for (const a of asks) {
          const to = new Date(a.fromDate + 'T00:00:00Z');
          to.setUTCDate(to.getUTCDate() + a.days);
          try {
            const lv = await me.call('POST', '/hr/leaves', { leaveType: a.leaveType, fromDate: a.fromDate, toDate: to.toISOString().slice(0, 10), reason: a.reason }, B);
            made.push({ id: lv._id, ...a });
          } catch (e) {
            if (!['OVERLAPPING_LEAVE', 'NO_WORKING_DAYS', 'INSUFFICIENT_BALANCE', 'NOTICE_TOO_SHORT'].includes(e.code)) throw e;
          }
        }
        const approver = hodFor.get(t.departmentId) ? await sess(hodFor.get(t.departmentId).email) : admin;
        for (const m of made) {
          if (m.decide === 'approve') await approver.call('PUT', `/hr/leaves/${m.id}/approve`, { remarks: pick(['Approved', 'Take care', 'Approved — arrange substitution', 'OK']) }, B);
          if (m.decide === 'reject') await approver.call('PUT', `/hr/leaves/${m.id}/reject`, { remarks: pick(['Internal assessment that week', 'Exam duty assigned', 'Please reschedule after the mid-sem']) }, B);
        }
        cs.leaves[t.id] = made.map((m) => m.decide);
      });
      saveState(org.key, st);
      const all = Object.values(cs.leaves).flat();
      log(`  ${c.code}: leaves ${all.length} (${all.filter((x) => x === 'approve').length} approved, ${all.filter((x) => x === 'reject').length} rejected, ${all.filter((x) => x === 'pending').length} pending)`);
    }
  }
}
log('phase 6 done');
