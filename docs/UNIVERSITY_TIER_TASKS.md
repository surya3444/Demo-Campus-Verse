# University Tier — Implementation Task List

**Date:** 2026-08-16 (Phases 0–5), 2026-08-22 (Phase 6)
**Basis:** `UNIVERSITY_TIER_ARCHITECTURE.md` (v2, Option D) + a fresh code inventory verifying what exists vs. what's proposal.
**Rule of engagement:** we evolve the existing app — no greenfield rebuild, no collection renames, additive fields only. One phase = one branch = one PR, shipped independently. School/college tenants must be byte-for-byte unaffected at every phase.

## Verified current state (2026-08-16 inventory)

> Historical — this table records what the code looked like _before_ Phase 1.
> Every ❌ and 🟡 below is addressed by Phases 1–6; see each phase for what
> shipped and what is still only deployed-on-paper.

| Requirement from client brief                       | Status     | Evidence                                                                                                                                                                        |
| --------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OBE engine (CO/PO/PSO, attainment, matrix, reports) | ✅ EXISTS  | `apps/api/src/modules/obe/` (~4.1k LOC) + full frontend under `(dashboard)/obe/`; NBA presets, direct/indirect, articulation. CSV export only — no NAAC/NBA formatted documents |
| Semester structures (incl. flexible patterns)       | ✅ EXISTS  | `AcademicTerm` embedded in academic batches, absolute `semesterNumber` 1–12; registration schemes per dept × semester                                                           |
| Course registration / electives with seat caps      | ✅ EXISTS  | `apps/api/src/modules/registration/`                                                                                                                                            |
| Department entity                                   | 🟡 PARTIAL | First-class `departments` collection (HR-owned) but `Class` links to it by **case-insensitive name match on `path[0]`**, not FK                                                 |
| Subject Global/Core/Shared                          | 🟡 PARTIAL | `ownerDepartmentId` + `applicableTo.departments` stored, **never filtered**; no `sharing` field                                                                                 |
| Faculty section-level scoping                       | 🟡 PARTIAL | Enforced on lesson plans/assignments/my-classes; **NOT enforced** on section rosters, attendance entry, or grades                                                               |
| RBAC department scope                               | 🟡 PARTIAL | In JWT + user-admin schema; **enforced nowhere** (behaves as branch scope)                                                                                                      |
| Constituent Institution tier                        | ❌ MISSING | Zero code; docs-only proposal                                                                                                                                                   |
| Program entity                                      | ❌ MISSING | Only OBE-internal `obePrograms`; no curriculum Program                                                                                                                          |
| Lab batches inside sections                         | ❌ MISSING | Zero matches repo-wide                                                                                                                                                          |
| Admission category (management/convener/quota)      | ❌ MISSING | `Student.category` is social reservation (GEN/OBC/SC/ST); no quota field                                                                                                        |
| Scholarship / govt fee reimbursement                | ❌ MISSING | Only `concessions` (discounts); staff expense reimbursements are unrelated                                                                                                      |
| Staff promotion → payroll                           | ❌ MISSING | No designation history, no promotion workflow; payroll `applicableTo.designationIds` matcher exists as the hook                                                                 |

---

## Phase 0 — Housekeeping + security fixes (DONE 2026-08-16)

- [x] Commit the pending student portal password-reset work (already complete in working tree) as its own commit — unrelated to this effort, don't mix it in.
- [x] Commit `UNIVERSITY_TIER_ARCHITECTURE.md`, `CLIENT_UNIVERSITY_DECISION_BRIEF.md`, and this file.
- [x] **Security:** teacher-scope check on `GET /teaching/my-classes/:sectionId/students` — implemented via new `teaching/scope.ts` (`assertTeachingScope`), which discovers teaching links from today's three sources (section teacher / section subjects, `staff.teaching.subjects`, timetable entries). Phase 2 re-points its internals at `teaching_assignments` without changing callers.
- [x] **Security (wider than the doc noted):** guards added to attendance register read (`GET /attendance/students`), marking (`POST`), per-record edit, and lock — with `allowNonTeachingStaff` so office accounts keep working branch-wide while teachers are confined to their sections; and to gradebook writes + section/assignment reads via `assertAssignmentOwnership` (assignment.teacherId) and `assertTeachingScope`. Students are rejected from all section-level registers/rosters/reports.
- [x] Delete dead `BranchSelector.tsx` — plus `Header.tsx` and `TopNav.tsx`, which were its only importers and themselves imported by nothing (live layout uses `TopBar`).

**Found during Phase 0, deferred to Phase 2 (needs user→student linkage — `TokenPayload` carries no `studentId`):** student self-view endpoints accept arbitrary student IDs from any student-role user: `GET /teaching/grades/student/:studentId`, `GET /attendance/students/:studentId/history`, `GET /attendance/self/:studentId`. Fix alongside `assertTeachingScope` adoption: student callers must resolve to their own student record.

## Phase 1 — Entities (CODE DONE 2026-08-16, branch `feat/university-phase1-entities`; deploy steps pending)

- [x] `institutions` collection + CRUD (`institution.service/controller`, routes under `/organization/institutions`, gated by `organization.branches`). `ensureDefaultInstitution` is lazy + self-healing: called from reads/writes, it creates the default institution and stamps unstamped branches, so any signup path converges without a migration dependency. Enforced by a partial unique index on `{tenantId, isDefault: true}`.
- [x] `Branch.institutionId` (ObjectId FK): set on create (validated or default), changeable on update, exposed in API responses.
- [x] `Class.departmentId` FK + dual-write: derived on every class write from `path[0]` via shared `matchDepartmentForPathTop` (same convention as the Departments overview), **gated on `path[0].levelKey ∈ {department, stream}`** so a school's "Grade 5" never matches an organizational department like "Primary" (real case found in live data: schools are seeded with academic Primary/Secondary departments).
- [x] `programs` collection + CRUD (routes under `/organization/programs`, `organization.settings` permission) + `Class.programId` (explicit, validated, never derived).
- [x] Scripts (both follow `migrate-class-path.ts` conventions):
  - `backfill-institutions.ts` — default institution per tenant + branch stamping; idempotent.
  - `backfill-class-departments.ts` — dry-run by default, `--apply` writes, `--check` is the CI/cron consistency mode (exit 1 on FK-vs-path mismatch). Dry-run validated against the live DB: **68 classes matchable, 14 unmatched groups** (Test Uni / Rise University classes naming departments absent from their registries — needs manual department creation/rename, see report output).
- [x] Indexes added to `create-indexes.ts` (institutions, programs, branch/class FKs).
- [x] Unit tests: `institution.service.test.ts` (7) + `classDepartmentDualWrite.test.ts` (12).

**Deploy steps when this ships:** run `db:indexes`, then `backfill-institutions.ts`, then `backfill-class-departments.ts --apply`; wire `--check` into cron/CI. **Deferred decision:** institution create does NOT auto-create its campus branch yet (branch creation needs location data the API caller doesn't have) — the Phase 3 onboarding UI collects it and creates both.

## Phase 2 — Wire the existing stubs (CODE DONE 2026-08-16, branch `feat/university-phase2-wiring`; deploy steps pending)

- [x] Subject sharing: `sharing: 'global'|'core'|'shared'` + `offeredToDepartmentIds` on Subject; shared pure rule `isSubjectUsableByDepartment` enforced at section attach (`assignSubject`) and teaching-assignment create; picker filter via `?usableByDepartmentId=` on subject list. Legacy subjects (no sharing/owner) stay unrestricted; classes without `departmentId` skip validation → schools unaffected.
- [x] `teaching_assignments` collection: section-granular, cross-department validated against sharing rules, CRUD at `/teaching/teaching-assignments` (timetable permission: admins manage, teachers view). Migration script `migrate-teaching-assignments.ts` expands `staff.teaching.subjects` (class→sections) + `sections.subjects[].teacherId`; dry-run default.
- [x] `assertTeachingScope` re-pointed: teaching_assignments is the canonical source (checked first); the three legacy sources remain as fallbacks until Phase 5. My Classes gained teaching_assignments as a discovery source.
- [x] Student self-view guard (the Phase 0 deferral): `assertStudentSelfScope` via `users.studentId` on `GET /teaching/grades/student/:id`, `/attendance/students/:id/history`, `/attendance/self/:id`.
- [x] RBAC institution scope, end to end: `accessScope.type: 'institution'` + `institutionIds` in shared types/schemas; auth gate resolves allowed branches via a cached branch→institution map (grant survives new campuses); login/refresh/org-switch resolve accessible branches by institution; persistence in user admin.
- [x] RBAC department scope, behind tenant flag `settings.enforceDepartmentScope` (default OFF — turning it on narrows existing department-scoped users): `middleware/scope.ts` resolves department→classIds; adopted in classes/sections/students list endpoints (scope intersects explicit filters — out-of-scope classId yields empty, not everything). Remaining modules (teaching lists, exams, OBE) adopt incrementally.
- [x] User-admin UI: Institution and Department scope options with pickers (institution option hidden for single-institution tenants).
- [x] Lab batches: `Section.batches[]` + `PUT /sections/:id/batches` (+ `/batches/assign`); `currentEnrollment.labBatchId`; `batchId` on timetable entries; per-batch attendance registers (register key gains batchId; roster narrows to batch members).
- [x] **Bug found & fixed in passing:** `markAttendanceSchema` lacked `subjectId`/`period`, and `validateBody` replaces req.body with the stripped parse — every lecture-wise mark silently landed on the daily register. Schema now carries both (+ `batchId`).

**Deploy steps when this ships:** run `db:indexes` (teaching_assignments indexes), then `migrate-teaching-assignments.ts --apply`. **Deferred:** guest/temporary access (`validUntil`) → Phase 3; sharing enforcement in registration schemes (they key on departmentCode strings) → Phase 5 re-key; department-scope adoption in exams/OBE/teaching lists → incremental.

## Phase 3 — University-facing features (CODE DONE 2026-08-16 on `feat/university-tier`; two items deferred)

- [x] `AuthUser.institutions` + `branches[].institutionId` (ensured/stamped lazily at login so first login post-deploy is correct); **institution switcher** in TopBar — shown only when the user spans >1 institution, selecting an institution activates its campus branch through the existing no-reload mechanism; multi-campus institutions render as grouped branch rows.
- [x] Institutions management page (`/organization/institutions`): create/edit/archive/delete with kind + admission prefix; sidebar entry; TopBar create-branch dialog gained an institution picker. _Full onboarding-wizard integration deferred — the page + branch picker cover institution creation._
- [x] `Student.admissionCategory` end to end: shared `DEFAULT_ADMISSION_CATEGORIES` constants (management/convener/spot/nri/lateral_entry — free string for state-specific systems), student create/update/filter, enroll dialog select, students page form + "Admission Route" filter.
- [x] Fee targeting: `applicableTo.admissionCategories` on FeeStructure, **matched in `autoAssignForStudent`** as an AND-dimension (targeted structures apply only to listed routes; untargeted apply to all). Fee-structures UI carries the field in BOTH save payloads — critical, since the update path `$set`-replaces the whole `applicableTo` and would have wiped it.
- [x] Scholarship/receivable submodule at `/finance/scholarships` (+ page + sidebar): applied → approved/rejected → disbursements with UTR refs → partially_disbursed/disbursed; per-sponsor receivables stats. **Design decision:** unlike a Concession (which destructively shrinks the payable at approval — survey confirmed), approval only `$inc`s `summary.sponsoredAmount` on the fee assignment (capped at balance, reversible); balances stay whole and sponsor money is posted through the normal fee counter. Registration `feeClearance` subtracts the sponsored portion so sanctioned-but-undisbursed students aren't blocked.
- [x] Institution-sourced admission numbers: when the branch's institution has an `admissionPrefix`, enroll generates `AEC-2026-0421` from the atomic counter; branches without a prefix keep the legacy `ADM{yy}{#####}` format untouched (no mid-year format switch for schools).
- [x] **Bugs fixed in passing:** `student.getFeeSummary` read non-existent flat fields (student fee tab always showed zeros) and filtered transactions on `'completed'` instead of `'success'` — now reads `summary.*`; concession approve/reject routes required the undeclared `'edit'` action (no role map grants it) — now use `'approve'`/`'reject'`.
- [ ] **Deferred:** "All institutions" mode (global-scope cross-institution aggregates for finance/admissions/HR — the owner dashboard's cross-branch aggregation is the precedent to extend).
- [ ] **Deferred:** guest/temporary access (`validUntil` on user).

## Phase 4 — HR: promotions → payroll (CODE DONE 2026-08-16 on `feat/university-tier`)

- [x] `PromotionPolicy` CRUD (`/hr/promotion-policies`, `hr.settings` permission): % on basic/gross, fixed amount, or structure move; branch override beats tenant-wide; optional `requiresApproval`. No hardcoded percentages anywhere.
- [x] Promotion workflow (`POST /hr/staff/:id/promote`, new `hr.promotions` permission granted to admin + HR-manager maps): `Designation.level` ladder finally read — target must be numerically lower (1 = highest) unless flagged `lateral`; matched policy decides approval; pending → approve/reject with reason (Concession-style trail) in `staff_promotions`.
- [x] On apply: `employment.designationId` updated **with** a `designationHistory[]` entry (statusHistory pattern); salary revision reuses `payrollService.reviseSalary` (new assignment, prior marked `revised` with `effectiveTo`), `personalAllowances` carry forward untouched; `salaryChange {previousNet → newNet}` recorded on the promotion. Structure-move increments resolve components two-pass (fixed, then percentage-of). No policy / no active assignment ⇒ designation-only change, logged.
- [x] UI: `/hr/promotions` page — promotion history with approve/reject, promote dialog (staff search, ladder-aware designation picker, lateral toggle), and policy management. Sidebar entry + `hrApi` helpers.
- [x] Indexes + 5 unit tests (ladder rejection, immediate vs pending, +10%-on-basic math through the revision machinery, allowance carry-forward, no-assignment path).

## Phase 5 — Re-keying + deprecation (CODE DONE 2026-08-16 on `feat/university-tier`)

- [x] `resolveDepartmentIdByCode` helper (case-insensitive code/name match, same convention as the path match); `ObeProgram.departmentId` and `ProgramScheme.departmentId` FKs stamped at create beside the canonical `departmentCode` string; `backfill-department-fks.ts` converges existing docs (dry-run default, unmatched-codes report).
- [x] FK-first reads with string fallback:
  - `registration.resolveStudentAcademics` prefers `class.departmentId` → department code; scheme lookup accepts **both** the FK-resolved and legacy path codes (`findPublished` alternates) so a "CSE"-vs-"CS" code mismatch can't silently unmatch existing schemes during transition.
  - Departments overview buckets classes by `Class.departmentId` when present, name-match fallback otherwise.
  - (`gradeCodeFor` fee-code derivation deliberately stays — grade codes are stable whole-path identifiers for fee matching, not a department join.)
- [x] `staff.teaching.subjects` deprecation bridge: every HR save additively syncs into section-granular `teaching_assignments` (`origin: staff_teaching_sync`; never auto-ends; failures never break the staff save). Full removal of the legacy field is a future cleanup once all tenants are migrated and the HR form reads assignments directly.
- [x] Guest/temporary access (the Phase-3 deferral): `User.validUntil` — login rejected and sessions ended at refresh after expiry; date field in user admin ("Access expires on", for external examiners/auditors).

## Phase 6 — Closing the brief (CODE DONE 2026-08-22 on `feat/university-tier`)

Four workstreams, one commit each. Every phase before this shipped the
plumbing; this one makes the remaining brief items real.

### 6.1 Program becomes load-bearing

- [x] Programs management page + sidebar entry (the CRUD existed, the UI didn't).
- [x] Optional program picker on class creation (dialog + class library sheet); hidden when the branch has no programs, so schools see no new field.
- [x] `ProgramScheme.programId` + `programName`. Uniqueness is per program, so a department's four B.Tech programs each own a Semester 3 curriculum. `findPublished` matches most-specific-first (program → department-wide) and **never** hands a program-keyed scheme to a student from another program or from none — the fallback query pins `programId: null`.
- [x] `resolveStudentAcademics` carries `Class.programId`; publish-time section sync narrows to the program's classes.
- [x] **Subject sharing enforced at scheme authoring** — the Phase-5 deferral. Skipped when the department FK is unresolved, so legacy code-only schemes keep saving.
- [x] `ObeProgram.curriculumProgramId`: PSOs are program-specific, so a department needs one PO/PSO set per program. The old unique index on `{tenantId, branchId, departmentCode}` blocked exactly that — `create-indexes` drops it and rebuilds with `curriculumProgramId` in the key (missing === null preserves one-per-department for unlinked sets).
- [x] 10 unit tests (`schemeProgramKeying.test.ts`).

### 6.2 RBAC: program scope + department-scope hardening

- [x] New `accessScope.type: 'program'` + `programIds`, resolved via `Class.programId`. Enforced unconditionally (the type is new — nobody can be silently narrowed) and **fails closed**: an empty grant denies, it does not widen to the branch. Department scope keeps its opt-in tenant flag and its legacy fail-open on an empty list.
- [x] `getScopedClassIds` (department OR program), `getScopedSectionIds`, `getScopedDepartmentIds`, and `intersectScope` — an explicit filter outside the grant resolves to an impossible match rather than falling back to the unfiltered branch query.
- [x] `assertSectionInScope` binds **even admins**: an HOD scoped to CSE no longer gets Mechanical's registers by virtue of role level. Wired into `assertTeachingScope`, so every section-level guard inherits it.
- [x] Adopted in teaching (lesson plans, assignments), exams (list, on the `classIds` array), OBE (offerings by section, programs by department), HR (staff registry). Finance stays branch-wide by design — §9.1 treats fee collection and payroll as centralized.
- [x] `enforceDepartmentScope` gets a UI switch in Organization → Settings; flipping it busts the 5-minute flag cache (it previously read as a no-op for the rest of the window).
- [x] **Bug fixed:** `formatUser` never returned `institutionIds`, so an institution-scoped user's grants came back empty and the edit form couldn't display them. The users table also described every grant as a branch count, which read "0 branches" for institution scope.
- [x] 17 unit tests (`accessScope.test.ts`).

### 6.3 "All institutions" mode — the last known follow-up

- [x] New `/api/v1/central` module, branch-less by design: each endpoint resolves its branch set from the caller's access scope (global → all active branches, institution → the granted institutions', branch → the granted ones) and folds branch-keyed aggregates into per-institution buckets via `branch.institutionId`. Department/program scopes are rejected — narrower than a branch, so a rollup would over-report.
- [x] `/scope`, `/overview`, `/finance`, `/admissions`, `/hr`, `/academics`. Permissions reuse each view's own module, so a finance head gets the finance rollup without the HR one.
- [x] `/central` console (five tabs) + "All institutions" entry in the institution switcher + sidebar item, all hidden below two institutions. Rows drill in: select a campus branch, invalidate branch-scoped queries, open the module.
- [x] Multi-campus institutions sum into one row; branches predating the institutions backfill land in an "Unassigned campuses" group instead of vanishing from the totals.
- [x] **Bugs fixed in passing — the owner dashboard's fee numbers were all zero:** `feeTransactions` were matched on `status: 'completed'` (the real statuses are success/pending/failed/cancelled/refunded), and fee aggregates read flat `$totalAmount`/`$paidAmount` while assignments keep money under `summary.*` (same class of bug Phase 3 fixed in `student.getFeeSummary`). Dues, alerts and per-batch stats read `summary.*` now, and cancelled assignments no longer inflate billed totals.
- [x] 8 unit tests (`central.service.test.ts`).

### 6.4 Accreditation reports (NBA / NAAC / NIRF)

- [x] `accreditation.service` builds three documents from computed attainment: **NBA SAR Criterion 3** in SAR numbering (3.1.1 COs, 3.1.2 per-course articulation, 3.1.3 program matrix, 3.2.2 CO attainment, 3.3.2 PO/PSO attainment, 3.4 gap analysis + action taken), **NAAC SSR KI 2.6** (2.6.1/2.6.2/2.6.3), and the **NIRF** data points this ERP can evidence.
- [x] Two rules run through it. Averages count only _mapped_ cells — a PO with one mapped CO averages that CO rather than dividing by every CO. And nothing is invented: provisional (computed-but-unfinalized) courses are named, a program with no external exam gets "cannot be derived" instead of 0%, and NIRF lists the parameters it has no source for.
- [x] PDF rendering (pdfkit, house style); portrait for prose, landscape for the articulation matrix, which does not fit 12 POs + PSOs portrait. Two rendering bugs found by reading the rendered output: standard-14 Helvetica has no U+2265 (`≥` → mojibake, now `>=`), and fixed-height rows drew long corrective-action prose over the rule below (rows measure and grow now).
- [x] `/obe/reports` previews the same sections it downloads; sidebar entry under OBE.
- [x] 9 unit tests (`accreditation.service.test.ts`).

## Remaining

- [ ] **Deploy steps (all phases).** Nothing has been run against a live database yet. In order: `db:indexes` (institutions, programs, teaching assignments, scholarships, promotions, the program-keyed scheme index, and the obe_programs index rebuild) → `backfill-institutions.ts` → `backfill-class-departments.ts --apply` → `migrate-teaching-assignments.ts --apply` → `backfill-department-fks.ts --apply`. Wire `backfill-class-departments.ts --check` into cron/CI.
  - The Phase-1 dry run found **14 class groups unmatched** (Test Uni / Rise University name departments absent from their registries). Create or rename those departments first, or those classes stay invisible to department-scoped users once the flag is on.
- [ ] Retire `staff.teaching.subjects` once every tenant is migrated and the HR form reads `teaching_assignments` directly (the additive sync bridge covers the transition today).
