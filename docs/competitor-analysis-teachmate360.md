# Competitor Analysis: TeachMate360 vs CampusVerse

> **Scope**: Hands-on exploration of a live TeachMate360 college install (`college.teachmate360.com`), logged in as super-admin, on 2026-07-02. Focus areas per product direction: **Users, Staff, Salary/Payroll, HR** — plus a module-inventory sweep. CampusVerse observations are based on the current codebase (post salary-structure ↔ role/designation linking + personal allowances work).
>
> **Not covered**: I did not run their payroll generation, submit any forms, or view generated payslip PDFs (read-only exploration of a system containing real employee data). Findings about those flows are inferred from the screens around them.

---

## 1. Executive Summary

TeachMate360 is an ASP.NET WebForms-era product (yellow-screen 404s, `.aspx` URLs, typos like "Genarate Salary" and "Parincipal" in seeded data). **Architecturally and technically, CampusVerse is a generation ahead** — better RBAC model, real statutory automation (PT slabs, TDS regimes, LOP proration), payroll run lifecycle, multi-tenancy, and a modern stack.

**But TeachMate wins on HR workflow ergonomics and India-market completeness.** Their product encodes how Indian institutions actually operate payroll day-to-day: salary attached at hiring, bulk assignment by department/designation, CTC-anchored pay bands, overtime, incentives with an approval workflow, biometric machine integration, shift/roster management, financial-year versioning, and a government-compliance suite (DigiLocker/NAD, ABC, NSP scholarships, AISHE, NAAC).

The pattern across every gap: **we built better primitives; they built better workflows.** Most of their advantages are UX/workflow layers we can add on top of primitives we already have.

**Top 5 things to steal (ranked):**

1. Salary capture inside staff creation (Salary + Leaves tabs on the create form)
2. Bulk salary assignment grid (filter by dept/designation → assign-all)
3. Overtime as a payroll input (per-head OT flag + OT days entry)
4. Incentive request/approval workflow (maps onto our `personalAllowances`)
5. Salary audit view (per-head change history — we have the data, no view)

---

## 2. Module Inventory Comparison

### Their full map (from the ERP MODULES launcher)

| TeachMate360 module                                                                  | CampusVerse equivalent        | Verdict                                                                                            |
| ------------------------------------------------------------------------------------ | ----------------------------- | -------------------------------------------------------------------------------------------------- |
| User Management                                                                      | organization.users / roles    | **We're better** (see §3)                                                                          |
| Student Management                                                                   | students                      | Comparable                                                                                         |
| Fees Management (fees, fine, concessions)                                            | finance                       | Comparable (ours deeper on wallets/approvals)                                                      |
| Attendance Management                                                                | attendance                    | Comparable for students; **they're better for staff** (biometric)                                  |
| Time Table                                                                           | teaching.timetable            | Comparable                                                                                         |
| Live Classes                                                                         | teaching.liveClasses          | Comparable                                                                                         |
| Examination                                                                          | exams                         | Comparable                                                                                         |
| **Employee Management (HRMS)**                                                       | hr                            | **They're better** — see §5                                                                        |
| Accounting (**with Tally integration**)                                              | — (expense module only)       | **Gap**: no double-entry accounting, no Tally export                                               |
| Admission Management + Lead Management                                               | admissions (unified pipeline) | **We're better** (unified 10-stage Kanban vs two separate modules)                                 |
| Library                                                                              | —                             | **Gap**: no library module                                                                         |
| Communication (notice, SMS, push to circulars)                                       | communications                | Comparable                                                                                         |
| Document Care                                                                        | upload/documents              | Comparable                                                                                         |
| ID Card Management                                                                   | certificates.idcards          | Comparable                                                                                         |
| Certificate Management                                                               | certificates                  | Comparable                                                                                         |
| Front Desk (gatepass + visitor)                                                      | visitor                       | Comparable                                                                                         |
| Purchase & Stock Mgmt                                                                | inventory                     | Comparable                                                                                         |
| Event Management                                                                     | communications.calendar       | Comparable                                                                                         |
| Hostel Management                                                                    | hostel                        | Comparable                                                                                         |
| **Mess Management**                                                                  | —                             | Gap (meal planning/hygiene; niche)                                                                 |
| Website Traffic Monitoring                                                           | —                             | Gap (low value; skip)                                                                              |
| Survey Management                                                                    | feedback                      | Comparable                                                                                         |
| Ticket Management                                                                    | feedback.tickets              | Comparable (theirs is platform-level support tickets too)                                          |
| **GovtSuite: DigiLocker/NAD, ABC, NSP/State Scholarship, AISHE, State Portal, NAAC** | —                             | **Major gap for college/university sales in India** — see §8.6                                     |
| AI Helpdesk / AI Progress 360 / AI ExamGenie                                         | ai (assistant)                | Ours is more general; theirs more targeted (exam paper generation is a concrete, sellable feature) |
| **Employee Mobile App** (appears in privileges tree)                                 | —                             | Gap: no staff-facing mobile app                                                                    |

### Modules we have that they don't (visible)

- Career Connect (placements, alumni, mentorship) — differentiator for colleges
- Campus Feed (social)
- Transport with Google Maps route building (theirs is "robust logistics" but no evidence of maps)
- Health module
- Expense approvals/reimbursements/budgets
- AI chat-over-your-data assistant with per-tool RBAC
- App-wide audit trail (`audit_logs` + `/audit` viewer)

---

## 3. Users & RBAC

### What they have

- **Role Master**: flat list of role names (Accountant, Admin, Class Advisor, Gatekeeper, Librarian, Teacher, …). Name only — no level, no hierarchy, no descriptions. Seed data contains typos ("Parincipal", "PRINCIPLE").
- **Privileges = "Assign Menu To Role"**: a checkbox tree of menus/submenus per role. Menu-visibility ACL, page-level granularity (e.g. Payroll → Salary Head / Assign Salary / …), no action-level distinction (view vs create vs edit vs delete).
- **Add User**: User-Id + **Password typed by the admin** + User Type + Role + Status. No email invitation, no forced password change visible, no linkage to an employee record on this form.
- **Logged in Users** menu item (active-session visibility) — though the page 404'd on direct navigation.
- F.Y.-scoped everything via a global financial-year switcher (2018-19 → 2025-26).

### What we have

- Roles collection per tenant with `code`, `level` hierarchy, `isSystemRole`, and a **module → actions[] permission matrix** (view/create/edit/delete/approve/…): action-level RBAC enforced server-side by `requirePermission(module, action)`.
- Role hierarchy enforcement (`canManageRole`, level > creator's level), system-role protection.
- User provisioning via temp password email + `mustChangePassword`, bidirectional staff↔user linking, access scopes (global/branch).

### Verdict: **CampusVerse clearly better.**

Their RBAC can't express "can view salary but not edit it" on the same page. Ours can. Their admin-typed passwords are a security anti-pattern.

### Worth stealing anyway

- **"Logged in Users" / active sessions view** — we track sessions in Redis (`SESSION_PREFIX`) but expose no admin UI over them. Cheap win: sessions list per user + force-logout (we already have `logoutAllDevices` / revocation).
- Their **privilege tree UX** (expandable module → submenu checkboxes) is more approachable for non-technical admins than our permission matrix. Consider a tree-style presentation of our matrix in the role editor.

---

## 4. Staff / Employee Records

### What they have (Create Employee + Master Update)

- Create Employee form with tabs: **Basic Details | Other Details | Salary | Leaves** — compensation and leave balances are captured **at hiring time in the same form**. Payable (CTC) is live-computed as you type component amounts.
- **PunchID** field — biometric machine identity, first-class on the employee record.
- Probation date + confirmation date; previous experience + "experience here"; graduate/PG/B.Ed/M.Ed/PhD subject fields (teacher-qualification-aware).
- Photo via file upload **or webcam capture** in-form.
- Inline **"+" buttons to create Category / Department / Designation without leaving the form**.
- Master Update menu: Manage Employees, **Manage Inactive Employees** (dedicated lifecycle view), Department/Designation/**Category** masters, **Update Employee ByXL** (bulk Excel update of existing records), **Add Shift**, **Add Roster**.
- Import Employees (bulk onboarding).

### What we have

- Richer document model (typed documents with verification), bank details, teaching config (subjects/classes), reporting-to, notice period, approval workflow for staff creation (pending → approve → user account), auto user provisioning with role resolution, bulk CSV upload with history.
- **But**: staff creation collects **zero salary information**; salary is a separate module, separate screen, assigned one person at a time. No shift/roster assignment per staff. No biometric identity field. No bulk _update_ (only bulk create).

### Verdict: **Split.** Our record model and lifecycle (approval flow) are deeper; their _hiring workflow_ is dramatically better.

### Worth stealing

1. **Salary tab in the staff create/edit flow** (P0 — this closes the client's actual pain): after the employment section, embed structure selection (auto-suggested via our new `suggest` endpoint) + component amounts + personal allowances. One flow, one submit.
2. **Leaves tab at creation** — assign leave balances at hiring instead of a separate trip to leave settings.
3. **Update ByXL** — bulk Excel _update_ (not just create) keyed by employeeId.
4. **Inactive employees view** — we filter by status but a dedicated lifecycle screen (with resignation linkage) is better ops UX.
5. Probation/confirmation dates — we have `confirmationDate` but no probation workflow (e.g. reminder when probation ends).

---

## 5. Salary & Payroll (the headline section)

### Their model, end to end

**Salary Head Master** (component catalog)

- Head Name, Alias, Type (Earning/Deduction), **Calculation Type: Fixed | Variable**, **OverTime Applicable: Yes/No per head**, **Display Seq** (payslip line ordering).
- Seeded: BASIC (E), HRA (E), EPF (D), ESI (D).

**Salary Class** (= our salary structure)

- Class name + **Min-Salary / Max-Salary band** + **CTC anchor**.
- Component rows: Pay Type (head), Type (Fixed/%-based), Value (Monthly), **"Of" → CTC** (percentage-of-CTC components).
- Classes are role-shaped: "Manager", "Intern", "HK" (housekeeping) with salary ranges (e.g. Manager 1000–100000, CTC 50000).
- List view with Copy/Excel/PDF/Print export.

**Assign Salary** (the killer screen)

- Filter grid by **Category / Department / Designation** → lists every matching employee with Emp Code, Dept, Designation, current CTC, a per-row Salary Class dropdown + Assign button.
- **Bulk Salary Update: checkbox rows → pick one Salary Class → "Assign-All"**.
- **Bulk Upload tab with "Download Sample File"** — Excel-driven salary assignment.

**Manage Salary**

- All-staff compensation grid: CTC, BASIC, HRA, Total Earning, EPF, ESI, Total Deduction, Payable Salary as columns; Edit/Delete per row; **"Salary Allocation Report"** button.
- Per-employee edit = modal listing each head with an editable amount (their version of our per-component override).

**Generate (Calculate) Salary**

- Run scoped by **Category / Department / Designation + Month**; "Show Previous Salary" comparison; Salary Report; Delete Selected (re-run capability).

**Salary Audit**

- Dedicated screen: filter by **salary head / employee / date range** → change history of salary values. Tabs for "Employee SalaryHead" and "Employee Salary".

**Incentive Management** (separate menu, full workflow)

- Incentive Type master → **"Incentive Assign To Designation"** (incentive name + amount assigned to department + designation) → **Apply for Incentive** (employee self-service request) → **Manage Incentive Request** (approval queue).

**Overtime**

- OverTime days Entry under Attendance + per-head "OverTime Applicable" flag → OT feeds pay computation.

### Our model (for contrast)

- `salary_structures` with typed components (fixed/percentage, `percentageOf`, taxable/statutory flags) — now with `applicableTo.{designationIds, roleCodes}` and a designation-first **suggest** endpoint.
- `staff_salary_assignments` with per-component overrides, **personalAllowances** (kept separate from structure for audit), custom deductions (loan/advance with recovery tracking), revision history (`active`/`revised` rows).
- Payroll runs with **auto LOP from attendance + approved leaves**, statutory auto-calc (**PF cap, ESI threshold, PT slabs, TDS old/new regime with cess**), payslip numbering, finalize/cancel lifecycle, **disbursement tracking** (pending/paid/hold/failed + payment mode/reference), self-service "My Payslips".

### Head-to-head

| Dimension                                                           | TeachMate360                                            | CampusVerse                                                    | Winner                              |
| ------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------- |
| Statutory automation (PT slabs, TDS regimes, ESI threshold, PF cap) | Heads exist; no visible auto-calc engine                | Full engine                                                    | **Us**                              |
| LOP / attendance-linked pay                                         | Not visible in salary screens                           | Auto LOP proration                                             | **Us**                              |
| Run lifecycle & disbursement                                        | Calculate/Delete Selected                               | processing→processed→finalized→cancelled + disbursement states | **Us**                              |
| Loans/advances                                                      | Not seen                                                | customDeductions with recovery tracking                        | **Us**                              |
| Structure→role/designation link                                     | Salary Class per role-type + incentives per designation | Just shipped `applicableTo` + suggest                          | Parity (they're more battle-tested) |
| **Bulk assignment**                                                 | Filter grid + Assign-All + Excel upload                 | One-at-a-time dialog                                           | **Them**                            |
| **Salary at hiring**                                                | Salary tab in Create Employee                           | Fully decoupled                                                | **Them**                            |
| **CTC anchor + pay bands**                                          | CTC + min/max validation per class                      | Bottom-up sum only, optional freetext `ctc`                    | **Them**                            |
| **Overtime**                                                        | Per-head OT flag + OT days entry                        | Nothing                                                        | **Them**                            |
| **Incentives workflow**                                             | Type → assign-to-designation → apply → approve          | `personalAllowances` (admin-entered only)                      | **Them**                            |
| **Salary audit view**                                               | Dedicated per-head change history screen                | Data exists (revisions + audit_logs), no view                  | **Them**                            |
| Compensation overview grid                                          | Manage Salary spreadsheet view + allocation report      | Assignments table (gross/net only)                             | **Them**                            |
| FY versioning                                                       | Global F.Y. switch scoping salary data                  | Period strings per run only                                    | **Them**                            |

### Verdict: **our engine, their cockpit.** Their compute layer is shallower than ours; their operational layer is substantially better.

---

## 6. Attendance, Leave, Shifts (staff-side)

### What they have

- **Machine Details** screen — biometric punch machines as managed entities; employees carry PunchID. Attendance flows from devices.
- Manual Upload (Excel attendance), Daily Attendance, **OverTime days Entry**.
- **Add Shift / Add Roster** — shift definitions AND roster assignment as first-class menu items.
- **Live attendance** report + Monthly/Total/Department-wise attendance reports + dedicated HR dashboard (staff present/absent, leave request KPIs, charts).
- Leave: Type → **Leave Assign** (allocate balances, incl. at-hire) → Leave Application → Manage Leave Request. Same shape as ours.
- Student side: dashboard widget **"Today Pending Attendance"** naming the teachers who haven't marked attendance yet — great accountability nudge.

### What we have

- Staff attendance marking + reports, leave types/balances/approvals, leave encashment settings, weekly-offs and shift definitions in `hr_settings` (`shifts[]`), self-attendance view.
- **No biometric integration, no OT, no roster assignment UI (shifts exist as settings but aren't assigned/enforced per staff), no live-attendance view, no pending-attendance accountability widget.**

### Verdict: **They're better on staff attendance operations.** Biometric integration in particular is table-stakes for Indian schools/colleges buying HR+payroll — "attendance drives salary" is the whole sales pitch, and ours only connects manual attendance to LOP.

---

## 7. What We Do Better (validation — don't regress these)

1. **RBAC**: action-level permissions vs their menu toggles; role hierarchy; system-role protection.
2. **Security posture**: temp-password invitations + forced change vs admin-typed passwords; JWT + refresh rotation + deny-list revocation; rate limiting; Zod validation. Their stack leaks ASP.NET yellow-screen stack pages on 404.
3. **Payroll computation**: statutory engine (PT slabs, TDS regimes), LOP proration, run lifecycle, disbursement tracking, loan recovery.
4. **Admissions**: unified lead→enrolled Kanban vs their split Lead/Admission modules.
5. **Multi-tenancy**: tenant/branch scoping vs their per-college installs (subdomain per customer).
6. **Modern UX**: their UI is dated WebForms postbacks; ours is a modern SPA.
7. **Audit trail**: app-wide `audit_logs`; they only have salary-specific audit (but see §8.4 — their _presentation_ of salary audit is better).
8. **AI**: our chat-over-data assistant with per-tool RBAC + confirm/form flows is more advanced than their AI menu items.

---

## 8. Gap Analysis → Recommendations (ranked)

### P0 — directly serves the current client ask (role ↔ salary + individual top-ups)

**8.1 Salary + Leaves tabs in staff creation** _(their best idea)_
When HR creates a staff member, add optional "Salary" step: structure pre-selected via our existing `suggest` endpoint (designation/role match), component amounts editable, personal allowances addable, live gross/CTC preview. On submit → create staff + assignment in one flow (assignment can stay a second API call). Also allow leave-balance allocation in the same flow.
_Everything needed already exists server-side (`assignSalary`, `suggestSalaryStructures`); this is a frontend workflow change in `apps/web/src/app/(dashboard)/hr/staff/page.tsx`._

**8.2 Bulk salary assignment**
On the Assignments tab: filter staff by department/designation/role → checkbox rows → pick structure → "Assign Selected". Backend: accept `staffIds[]` in a new `bulkAssignSalary` (loop of existing assignSalary logic with per-staff suggest defaults). Their Excel bulk-upload variant can follow later (we already have the bulk-upload pattern from students).

**8.3 CTC anchor + pay bands on structures**
Add optional `minSalary`/`maxSalary` + `defaultCtc` to `salary_structures`; validate assignment gross within band (warn, not block); support `percentageOf: 'CTC'` in addition to BASIC/GROSS. Small schema + UI change, big "serious payroll product" signal.

### P1 — high-value HR completeness

**8.4 Salary audit view**
We already write revisions (`status:'revised'` rows) and `audit_logs`. Build a "Salary History" tab: per-staff timeline of assignments with per-head diffs (old → new, who, when), filter by head/date. Pure read: aggregate existing collections.

**8.5 Incentive/OT workflow on top of personalAllowances**

- Incentive types master (or reuse structure components with a `kind:'incentive'` flag).
- Assign incentive to designation/role (mirrors `applicableTo` we just built).
- Staff self-service "apply for incentive" + approval queue (we already have the approval-queue pattern in expense/leaves).
- Overtime: `otApplicable` flag per component + monthly OT hours/days entry that feeds payroll as a computed earning line.

**8.6 GovtSuite equivalents (strategic, for college/university segment)**
NSP/State scholarship tracking, AISHE report generation, NAAC data management, DigiLocker/NAD certificate push, ABC credit reporting. This is a sales-blocking checklist for Indian colleges. Start with scholarship tracking (nearest to our finance module) and AISHE export (report over data we already hold).

**8.7 Biometric attendance integration**
`punchId` on staff + a device-ingest endpoint (most Indian vendors: eSSL/Realtime CSV or push API) feeding `staff_attendance`. Unlocks "attendance → LOP → payroll" as a fully automatic pipeline — which our engine already supports better than theirs.

### P2 — worthwhile polish

- **Compensation overview grid**: add component columns (BASIC/HRA/…/CTC) + Excel/PDF export to the Assignments tab; "Salary Allocation Report".
- **Pending-attendance widget** on branch dashboard: classes/teachers who haven't marked attendance today.
- **Active sessions admin view** (+ force logout) over our existing Redis sessions.
- **Shift → roster assignment**: we store `shifts[]` in hr_settings; add per-staff shift assignment and use it in attendance/LOP math.
- **Bulk Excel _update_** for staff (ByXL equivalent) keyed on employeeId.
- **Payslip head ordering** (`displaySeq` on structure components) — trivial, makes payslips configurable.
- **Inline "+ new designation/department"** in staff form dropdowns.
- **Employee mobile app** (or PWA) for self-service: payslips, leave application, attendance — they ship one; our web self-service pages are the seed.
- **Tally export** for finance (accountants ask for this by name in India).

### Explicitly do NOT copy

- Menu-level RBAC (ours is strictly superior).
- Admin-typed passwords at user creation.
- Salary Class **replacing** per-component structures — their model has no taxable/statutory metadata per head; ours feeds a real statutory engine. Keep our component model, add their CTC/band anchors on top.
- Per-customer installs; our multi-tenancy is an advantage.
- Their separation of Lead vs Admission modules.

---

## 9. Feature Scorecard (summary)

| Area                                       | Winner                                          | Margin |
| ------------------------------------------ | ----------------------------------------------- | ------ |
| RBAC & user security                       | **CampusVerse**                                 | Large  |
| Staff record model                         | CampusVerse                                     | Small  |
| Staff onboarding workflow                  | **TeachMate**                                   | Large  |
| Salary structure modeling                  | CampusVerse (metadata) / TeachMate (CTC+bands)  | Split  |
| Salary assignment operations               | **TeachMate**                                   | Large  |
| Payroll computation engine                 | **CampusVerse**                                 | Large  |
| Payroll run operations                     | CampusVerse                                     | Small  |
| Individual top-ups                         | CampusVerse (data model) / TeachMate (workflow) | Split  |
| Salary change auditability                 | **TeachMate** (view) / CampusVerse (raw data)   | Split  |
| Staff attendance ops (biometric/OT/shifts) | **TeachMate**                                   | Large  |
| Leave management                           | Parity                                          | —      |
| Govt compliance (India college segment)    | **TeachMate**                                   | Large  |
| Overall platform/tech quality              | **CampusVerse**                                 | Large  |

---

## 10. Appendix: Screens Explored

| Screen              | URL (`college.teachmate360.com/sadmin/…`)      | Key observation                                                      |
| ------------------- | ---------------------------------------------- | -------------------------------------------------------------------- |
| Admin dashboard     | `adashboard`                                   | KPI cards, pending-attendance widget, FY switcher                    |
| ERP module launcher | (modal)                                        | 27 ERP modules + 6 GovtSuite + 3 AI                                  |
| Role Master         | `RoleMst`                                      | Flat role names, no hierarchy                                        |
| Privileges          | `AssignMenu`                                   | Menu-tree ACL per role                                               |
| Add User            | `CreateUser`                                   | Admin-typed password                                                 |
| HR dashboard        | `Employeedashboard`                            | Staff/leave KPIs + charts (72 staff)                                 |
| Create Employee     | `AddEmployee`                                  | Tabs: Basic/Other/**Salary**/**Leaves**; PunchID; webcam             |
| Salary Head Master  | `SalaryHead`                                   | E/D type, Fixed/Variable, OT flag, display seq                       |
| Salary Class        | `AddSalaryClass`                               | Min/max band, CTC, % of CTC components                               |
| Assign Salary       | `AssignSalary`                                 | Filter grid, bulk Assign-All, Excel upload                           |
| Manage Salary       | `ManageSalary`                                 | Compensation spreadsheet + allocation report; head-amount edit modal |
| Calculate Salary    | `CalculateSalary`                              | Dept/designation-scoped runs; previous-salary compare                |
| Salary Audit        | `SalaryAudit`                                  | Per-head / per-employee change history                               |
| Incentive Assign    | `IncentiveAssign`                              | Incentive → designation                                              |
| Menus surveyed      | Leave Mgmt, Attendance, Master Update, Reports | Machine Details, OT entry, Shift/Roster, ByXL, Live attendance       |
| (404 page)          | `LoggedinUsers.aspx`                           | Raw ASP.NET error leak — .NET Framework 4.8                          |
