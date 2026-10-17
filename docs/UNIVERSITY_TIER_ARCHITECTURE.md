# University Tier Architecture Proposal (v2)

**Status:** Proposal (not implemented)
**Date:** 2026-08-14
**Changelog:** v1 (2026-08-13) recommended modeling a constituent institution as a relabeled Branch; rejected in stakeholder review. v2 adopts a **first-class Institution entity as a grouping tier**, after a code-grounded comparison of four options (Section 2).

**Scope:** Evolve CampusVerse to support universities with multiple constituent institutions, while keeping schools and standalone colleges exactly as simple as they are today.

This document is grounded in a code audit of the current system. Where a claim references existing behavior, the file path is cited.

---

## 1. Design Goals

1. Support the full university shape the client specified: University → Constituent Institutions → Departments → Programs → Years/Semesters → Sections → Lab Batches. The client's required hierarchy names **Constituent Institution as its own level** — it must be a real entity with identity, settings, and its own switcher, not a relabeled branch.
2. Centralized administration (admissions, fees always; HR and payroll configurably — the client says these "may be" central) with decentralized academics per institution.
3. Zero migration risk and zero added complexity for existing school/college tenants.
4. Prefer wiring up what already exists over inventing new machinery. The audit found a repeated pattern — _the field exists, the enforcement doesn't_ — and this proposal exploits it:
   - `Subject.ownerDepartmentId` + `applicableTo.departments` — stored, never filtered (`subject.service.ts:157-168`)
   - `accessScope.type: 'department'` + `departmentIds` — in the JWT, never enforced (`middleware/auth.ts:61-66`)
   - `FeeStructure.applicableTo.categories` — persisted, excluded from the matcher (`feeStructure.service.ts:596-648`)
   - `Designation.level` — encodes a ladder no code reads (`types/hr.ts:154-160`)

---

## 2. The Central Decision: How to Model a Constituent Institution

### 2.1 The implementation facts that frame the decision

- The **entire backend scope enforcement is ~10 lines in one file**: `middleware/auth.ts:58-68` validates `X-Branch-Id` against `accessScope.branchIds`. Everything downstream trusts `req.tenantId` + `req.branchId`.
- The codebase uses the **native MongoDB driver with hand-written filters** — there is no ORM hook to add a scope globally. `branchId` appears **3,359 times across 300 files**, with ~**995 `tenantId + branchId` filter lines**, over **153 collections**.
- A JWT carries exactly **one `tenantId`** (`auth.ts:55`); nothing in the codebase queries across tenants. Tenant is the bedrock isolation boundary.
- Org switching (`auth.service.ts:747-865`) rotates tokens and does a **full page reload**; branch switching is a store update + query invalidation, no reload (`TopBar.tsx:53-59`, `branchStore.ts`).

Consequence: any design that works _with_ the existing tenant and branch boundaries costs ~20 files; any design that adds or moves a boundary costs hundreds of files of manual edits plus full-collection migrations.

### 2.2 The four options, evaluated on one scenario

Scenario: Anurag University. Priya, a _central_ admissions officer, admits Ravi (EAMCET/convener) into B.Tech CSE at Anurag Engineering College (AEC). The Dean of Engineering must see only AEC. The Vice-Chancellor wants university-wide fee collections. The registrar switches from Engineering to MBA.

**Option A — Institution as a relabeled Branch (v1 recommendation; REJECTED).** Mechanically everything works, but AEC gets no identity of its own (settings, letterhead, admission prefix as an entity), a multi-campus institution becomes unrepresentable forever, and the client's hierarchy explicitly draws Constituent Institution as its own level. Works mechanically, lies semantically.

**Option B — Institution as a child Tenant (REJECTED).** Superficially attractive (org switching "already exists"), but fails twice on the implementation: (1) Priya cannot exist — her JWT carries one `tenantId`, so a central officer spanning five institution-tenants needs five accounts, and the VC's university-wide report would require cross-tenant queries, which appear nowhere in the codebase and would break its core isolation guarantee; (2) org switching does a full page reload with token rotation — unacceptable as a many-times-a-day institution switcher.

**Option C — Full scoping tier: `institutionId` stamped on every document (REJECTED).** New `X-Institution-Id` header, extended middleware, and a third key on ~995 filter lines across 300 files, compound-index rebuilds on 153 collections, JWT shape change, frontend API layer, seeds, tests, plus an `institutionId` backfill over every collection of every tenant. Run the scenario: **nothing anyone observes is different from Option D** — separation, confinement, aggregation, and switching all resolve through the branch→institution mapping. The only case Option C uniquely solves is a document belonging to an institution but no branch (e.g., a fee structure spanning a multi-campus institution) — a corner of a corner with an existing fallback pattern (tenant-level records with applicability lists, already used by fee structures). All cost, no observable benefit; violates the client's explicit simplicity constraint.

**Option D — Institution as a first-class grouping tier (CHOSEN).** New `institutions` collection carrying identity and settings; every Branch gains `institutionId`; documents stay `tenantId + branchId` scoped. An institution's data is its branches' data. Access control gains an institution scope resolved to branch sets inside the existing ten-line gate.

|                                        | A: as-branch   | B: child tenant       | C: full scope  | **D: grouping** |
| -------------------------------------- | -------------- | --------------------- | -------------- | --------------- |
| Client: first-class institution level  | ✗              | ✓                     | ✓              | ✓               |
| Client: central admin (Priya, VC)      | ✓              | **✗ impossible**      | ✓              | ✓               |
| Client: per-institution separation     | ✓              | ✓                     | ✓              | ✓               |
| Client: simplicity constraint          | ✓              | ✗                     | **✗ violated** | ✓               |
| Impl: preserves the 10-line scope gate | ✓              | ✓                     | ✗              | ✓               |
| Impl: avoids touching 995 filter sites | ✓              | ✓                     | ✗              | ✓               |
| Impl: no-reload switching UX           | ✓              | ✗                     | ✓              | ✓               |
| Future multi-campus institutions       | **✗ dead end** | ✓                     | ✓              | ✓               |
| Blast radius                           | ~5 files       | ~40 + isolation break | ~300+ files    | **~20 files**   |

### 2.3 Revisit triggers

This decision should be revisited if: (1) per-institution **billing/subscriptions** becomes a product requirement (Option C's enforced scope starts paying for itself); (2) multi-campus constituent institutions become common _and_ institution-wide documents proliferate (bridge via denormalized `institutionId` stamping — metadata-only, adopted collection-by-collection); (3) institutions must become independently sellable/spin-off-able entities (Option B territory, with real cross-tenant infrastructure).

---

## 3. The Institution Entity

### 3.1 Spec

```ts
// NEW collection: institutions
interface Institution {
  _id: ObjectId;
  tenantId: string;
  name: string; // "Anurag Engineering College"
  code: string; // "AEC" — feeds admission-number prefix
  kind?: string; // 'engineering' | 'management' | 'design' | 'pharmacy' | ... (tenant-configurable)
  settings: {
    admissionPrefix?: string; // consumed by generateAdmissionNumber (already branch-keyed)
    logo?: string;
    letterhead?: string;
  };
  status: 'active' | 'archived';
}

// Branch gains ONE field
institutionId: string; // required after migration; FK → institutions
```

Worked example:

```js
// institutions
{ _id: "inst_aec", tenantId: "T1", name: "Anurag Engineering College", code: "AEC",
  kind: "engineering", settings: { admissionPrefix: "AEC" }, status: "active" }

// branches
{ _id: "br_aec", tenantId: "T1", institutionId: "inst_aec", name: "AEC Campus", ... }

// a student — shape UNCHANGED from today
{ _id: "stu_1", tenantId: "T1", branchId: "br_aec", admissionNumber: "AEC-2026-0421",
  admissionCategory: "convener", currentEnrollment: { classId, sectionId, labBatchId } }
```

### 3.2 Uniform model

Every tenant auto-gets one **default institution** (hidden in the UI for schools/colleges); a university is simply a tenant with more than one. No `if (hasInstitutions)` conditionals spread through either codebase. Creating an institution auto-creates its single campus branch. `branchStore.initializeBranchSelection` already auto-selects single branches (`branchStore.ts:55-57`), so the phantom branch is auto-selected by shipped code.

**One campus per institution at launch.** The client's hierarchy never mentions campuses under institutions. The model supports multi-campus (institution → many branches; scope = `branchId $in`); the UI for it is deferred until a real tenant needs it.

### 3.3 Institution-level RBAC

`accessScope` gains an institution type, resolved inside the existing gate:

```ts
accessScope: {
  type: 'global' | 'institution' | 'branch' | 'department';
  institutionIds?: string[];   // NEW — for type: 'institution'
  branchIds: string[];
  departmentIds?: string[];
}
```

Resolution (~15 lines added to `middleware/auth.ts:58-68`, one cached lookup): `type: 'institution'` → allowed branch set = branches whose `institutionId ∈ institutionIds`. This gives institution-scoped roles (Dean, institution admin) that **survive an institution adding a campus later with zero user edits** — unlike raw `branchIds` lists.

### 3.4 Known limitations (accepted deliberately)

- **The phantom branch.** Each institution auto-creates a branch users never see; developers must learn "institution = identity, branch = scope container." Accepted as the price of not moving the scoping boundary; hidden by UI.
- **No per-institution module gating.** `requireModule` subscriptions stay tenant-level; you cannot enable a module for Engineering but not Design. Institution-settings overrides are a possible future, not in scope.
- **Institution-only documents** (spanning a multi-campus institution) have no first-class home; handled via tenant-level records with applicability lists — an existing pattern (fee structures).

---

## 4. Entity Model: From String Paths to Foreign Keys

### 4.1 The problem being fixed

Today academic structure is a configurable **string path** on the Class document: `Class.path: ClassPathEntry[]` of `{levelKey, name, code, order}` (`types/organization.ts:210-227`). Departments have no identity in academics; the HR `departments` collection is joined by **case-insensitive name matching** on `path[0]` (`departmentOverview.service.ts:4-10, 57-68`). Four call sites re-parse the path at runtime:

1. `registration.service.ts:155-171` — derives `departmentCode` from `path[0]`
2. `departmentOverview.service.ts:57-68` — name-match join
3. OBE — `ObeProgram.departmentCode` / `ProgramScheme.departmentCode` are raw strings (`types/obe.ts:52`, `types/registration.ts:50-63`)
4. `packages/shared/src/utils/academic.ts` — `gradeCodeFor` fee-code derivation

Programs/degrees and lab batches do not exist at all.

### 4.2 New/promoted entities

```
Tenant (university)
└── Institution (constituent institution)          [NEW — Section 3]
    └── Branch (campus; usually one, auto-created)  [existing — scoping unit, unchanged]
        └── Department                              [PROMOTED — the existing HR `departments` collection becomes canonical]
            └── Program                             [NEW collection]
                └── AcademicBatch (admission year)  [existing: academic_batches]
                    └── AcademicTerm (semester)     [existing: embedded in AcademicBatch.terms — keep embedded]
                        └── Class (program-year)    [existing — gains FKs]
                            └── Section             [existing]
                                └── Lab Batch       [NEW — embedded on Section]
```

**Department (promoted).** The HR `departments` collection (`types/hr.ts`, `department.service.ts:14`) already has `code`, `name`, `branchId`, `type: 'academic' | 'administrative' | 'support'`. It becomes the single canonical department entity for both HR and academics. No new collection.

**Program (new `programs` collection).**

```ts
interface Program {
  _id: ObjectId;
  tenantId: string;
  branchId: string; // resolves to institution via branch.institutionId
  departmentId: string; // FK → departments
  name: string; // "B.Tech Computer Science (AI & ML)"
  code: string; // "BTECH-CSE-AIML"
  degreeType: 'ug' | 'pg' | 'diploma' | 'phd' | 'certificate';
  durationYears: number;
  totalSemesters: number; // 8, or 2×durationYears, or = durationYears for annual systems
  termPattern: 'semester' | 'annual' | 'trimester';
  specialization?: string;
  status: 'active' | 'archived';
}
```

Semester-pattern flexibility (1-1/1-2 vs Sem 1/2 vs annual) is already handled by `AcademicTerm { half: 'odd'|'even', semesterNumber }` embedded in AcademicBatch (`types/organization.ts:176-195`); `termPattern` on Program just declares which shape applies.

**Class (existing, gains FKs).** Add `departmentId?` and `programId?` alongside `path`. `path` remains for display and for school/college tenants (which never set the FKs). New writes dual-write both; the FKs become the queryable truth for universities.

**Lab Batch (new, embedded).**

```ts
// on Section
batches?: Array<{ _id: ObjectId; name: string }>;   // "Batch 1", "Batch 2"
// on Student
currentEnrollment.labBatchId?: string;              // membership lives on the student, matching the existing sectionId pattern
```

Membership on the student (not an array on the section) avoids unbounded arrays and follows the existing enrollment pattern. Consumers: `TimetableEntry` gains optional `batchId` (lab slots for a subset), attendance records gain optional `batchId`. Sections without batches behave exactly as today.

### 4.3 What stays untouched

- School/college tenants: hierarchy config, classes, and paths are unchanged. Departments/Programs are simply absent. Every FK is optional.
- `AcademicTerm` stays embedded — no evidence it needs its own collection.
- The OBE engine's internals: only its `departmentCode` key gets an FK sibling (Section 10).

---

## 5. Subject Catalog: Wire Global / Core / Shared

The schema is ~80% there (`types/organization.ts:307-333`): `ownerDepartmentId?`, `applicableTo?: { institutionTypes, grades, streams, departments }`, UGC categories (DSC/DSE/GE/AECC/SEC/VAC — GE is even documented as "offered to other departments"), and branch-optional subjects meaning global (`subject.service.ts:157-161`).

### 5.1 Model

Add one explicit field rather than deriving it:

```ts
sharing: 'global' | 'core' | 'shared';   // default 'core'
ownerDepartmentId?: string;              // required when sharing !== 'global'; FK → departments
offeredToDepartmentIds?: string[];       // required when sharing === 'shared'; replaces inert applicableTo.departments
```

| Type     | Owner                         | Consumers                        | Example                                        |
| -------- | ----------------------------- | -------------------------------- | ---------------------------------------------- |
| `global` | Service department (optional) | All departments                  | Mathematics, English                           |
| `core`   | One department                | Owner only                       | Operating Systems (CSE)                        |
| `shared` | One department                | Owner + `offeredToDepartmentIds` | Basic Electrical Engg (EEE → Mech, Civil, ECE) |

### 5.2 Enforcement points (the part that's missing today)

1. **Curriculum attach** — a subject may be attached to a class/scheme only if `class.departmentId ∈ ({ownerDepartmentId} ∪ offeredToDepartmentIds)` or `sharing === 'global'`.
2. **Subject pickers** — filter by the department context of the class being edited (extend the existing filter at `subject.service.ts:168`, which today only applies `institutionTypes`).
3. **Teaching assignment validation** — Section 6.

School/college tenants: `sharing` defaults to `'core'` with no owner set → validation is skipped when the class has no `departmentId`. Nothing changes for them.

---

## 6. Faculty Assignment and Scoping

### 6.1 The problem being fixed

Assignments live on the staff record at **class** granularity — `staff.teaching.subjects?: Array<{subjectId, classIds}>` (`types/hr.ts:37-45`) — so a teacher assigned to a class implicitly gets _every_ section. "EEE faculty teaches BEE to Mechanical sections A and B only" cannot be expressed. Cross-department teaching works today only because nothing validates anything. Ownership is enforced only on lesson plans and assignments (`assignment.service.ts:301,...`, `lessonPlan.service.ts:262,...`); the section-roster endpoint has **no ownership check at all** (`myClasses.controller.ts:38-60`, `myClasses.service.ts:429-434`) — any `teaching.myClasses:view` holder can read any section roster in the branch. That is a security bug to fix regardless of this proposal.

### 6.2 New `teaching_assignments` collection

```ts
interface TeachingAssignment {
  _id: ObjectId;
  tenantId: string;
  branchId: string; // branch of the SECTION being taught (may differ from the teacher's home branch/department)
  academicBatchId: string;
  termId?: string;
  staffId: string;
  subjectId: string;
  sectionId: string; // one section per doc — queryable both directions
  batchIds?: string[]; // optional lab-batch restriction
  role: 'primary' | 'assistant' | 'lab';
  status: 'active' | 'ended';
}
// indexes: {tenantId, branchId, staffId, termId}, {tenantId, branchId, sectionId, subjectId}
```

- Cross-department teaching becomes **explicit and validated**: creating an assignment checks the subject's sharing rules (Section 5) against the section's class department. The EEE→Mechanical case is now expressible _and_ bounded.
- `staff.teaching.subjects` is kept as a denormalized summary during migration, then deprecated. "My Classes" (`myClasses.service.ts:27-184`) swaps its `teaching_assignment` discovery source to this collection; the `class_teacher` and `timetable` sources stay.

### 6.3 One enforcement helper, used everywhere

```ts
// teaching/scope.ts
assertTeachingScope(req, { sectionId, subjectId? })
// roleLevel <= 3 → pass (admin bypass, matches existing convention e.g. obe.utils.ts:69-80)
// else: require an active TeachingAssignment for (staffId, sectionId [, subjectId])
```

Applied to: section rosters (fixes the security hole), attendance entry, marks/grades entry, My Students. This gives the client's requirement exactly: faculty see only assigned sections, enter attendance and marks only there, nothing else.

---

## 7. RBAC: Scope Levels

Today exactly one scope is enforced: **branch** (`middleware/auth.ts:61-66`). `accessScope.departmentIds` rides in the JWT and filters nothing; `type: 'department'` behaves identically to `'branch'`.

### 7.1 Mapping the client's levels onto the model

| Client's level               | Realization                                | Work needed                                                                |
| ---------------------------- | ------------------------------------------ | -------------------------------------------------------------------------- |
| University-wide              | `accessScope.type: 'global'` (exists)      | None                                                                       |
| Constituent-institution-wide | `type: 'institution'` (NEW — Section 3.3)  | Auth-gate resolution, ~15 lines                                            |
| Campus-level                 | `type: 'branch'` (exists, enforced)        | None                                                                       |
| Department-wide              | `type: 'department'` (exists, **unwired**) | Wire it (below)                                                            |
| Program-wide                 | —                                          | **Defer** — department scope covers the realistic cases; revisit on demand |
| Guest / temporary            | New `validUntil` on the user               | Small addition                                                             |

### 7.2 Wiring department scope

1. Auth middleware continues validating the branch header; additionally exposes `req.scopeDepartmentIds` when `type === 'department'`.
2. A shared helper `applyAccessScope(filter, req)` injects `departmentId: { $in: scopeDepartmentIds }` into class/section/student/staff queries. Services adopt it module by module (academics first: classes, sections, students, teaching, exams, OBE offerings).
3. The user-admin UI (`organization/users/page.tsx:1075-1078`, which today offers only Global and Branch) gains Institution and Department options — the backend schema already accepts department (`organization.schema.ts:59`).

This is only possible after Section 4 gives sections/students a resolvable `departmentId` — scope enforcement by string-matching class paths would be both slow and fragile, which is presumably why it was never wired.

### 7.3 Guest / temporary access

Add `validUntil?: string` to the user document (precedent: `affiliations[].validUntil`, `types/organization.ts:119`). `authenticate` rejects expired users; the users list surfaces expiry. No new role machinery.

---

## 8. Student Categories, Scholarships, and Reimbursement

### 8.1 Admission category (new field — currently absent entirely)

`Student.category` is **social reservation** (general/OBC/SC/ST, `types/student.ts:17`) — not admission route. Add:

```ts
admissionCategory?: string;   // tenant-configurable list; seeded: 'management', 'convener' (EAMCET/CET counselling), 'spot', 'nri', 'lateral_entry'
```

Tenant-configurable (like designations) rather than a hard enum — states differ (EAMCET, KCET, MHT-CET…).

### 8.2 Make fee targeting by category real

`FeeStructure.applicableTo.categories` is persisted but excluded from `autoAssignFeeStructures()` (`feeStructure.service.ts:596-648` builds its `$or` from grades/classes/sections only). Add `admissionCategories` to `applicableTo` and include it in the matcher. This alone yields "management students get fee structure X, convener students get Y."

### 8.3 Scholarship as a receivable, not a discount

`Concession` (`types/finance.ts:139-159`) is a **discount** — approved means the payable shrinks and nobody owes anything. Government fee reimbursement is different: the fee stays whole, the **payer** changes, and the institution carries a receivable against the government. New finance submodule:

```ts
interface Scholarship {
  _id: ObjectId;
  tenantId: string;
  branchId: string;
  studentId: string;
  academicBatchId: string; // per academic year
  scheme: string; // tenant-configurable: 'govt_fee_reimbursement', 'post_matric', 'merit', 'private'
  sponsor: 'government' | 'private' | 'institution';
  sanctionedAmount: number;
  applicationRef?: string; // ePASS / portal application number
  status: 'applied' | 'approved' | 'rejected' | 'partially_disbursed' | 'disbursed' | 'lapsed';
  disbursements: Array<{ amount: number; receivedAt: string; utrRef?: string; recordedBy: string }>;
  // approval trail mirrors Concession: approvedBy / approvedAt / rejectionReason
}
```

Integration with fees: an approved scholarship splits the student's `FeeAssignment` payable into **self-pay** vs **sponsored** portions. The student's dues/gating logic (e.g. registration `feeClearance()`, `registration.service.ts:228-256`) counts only the self-pay portion as the student's liability; the sponsored portion tracks against `Scholarship.disbursements`.

This directly provides the client's six tracked states: management student (admissionCategory), government student (admissionCategory), scholarship approved/pending (status), reimbursement received/pending (disbursements vs sanctionedAmount). Reports: outstanding receivables by scheme/sponsor, per institution and university-wide.

`Concession` stays as-is for genuine discounts (sibling, staff-ward, merit waivers).

---

## 9. Centralized Administration vs Decentralized Academics

### 9.1 The module ownership matrix

| Centralized (university level)                                                                                             | Decentralized (per institution)                                                                  |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Admissions pipeline oversight, fee collection & receivables, HR (hiring, staff registry), payroll, scholarships, reporting | Classes/sections, timetable, attendance, teaching, exams, OBE, course registration, lesson plans |

Nothing about _storage_ changes — admissions/fee/HR data stays branch-scoped under each institution (each institution runs its own admissions, as the client requires: "Admissions occur separately"). "Centralized" means **central staff can see and operate across all institutions** — a view/scope problem, not a data-model problem. HR/payroll centralization is configurable per university via who holds which scope (matching the client's "HR **may** be managed centrally").

### 9.2 Mechanism: the "All institutions" mode

- Central university staff are users with `accessScope.type: 'global'` (exists today).
- The institution switcher gains an **"All institutions"** entry, visible only to global-scope users and only on centralized modules.
- Backend: designated aggregate endpoints accept `X-Branch-Id: __all__` (or omit the `requireBranch` middleware) and fan out across the tenant's branches, **grouping results by institution** via `branch.institutionId`. Precedent exists — the owner dashboard already aggregates cross-branch. Start with: finance summaries/receivables, admissions funnel, HR staff registry, payroll runs.
- Institution- and branch-scoped users never see the option; nothing changes for them.

This is deliberately incremental: each centralized module opts into cross-institution views one endpoint at a time, rather than a big-bang scoping rewrite.

---

## 10. HR: Designation Ladder, Promotions, Configurable Increments

Current state: `Designation.level` is stored, never read; **zero** promotion/appraisal/increment code across 76 HR routes; designation change is a silent field write (`staff.service.ts:688-690`); the only HR↔payroll link is the advisory `suggestSalaryStructures()` (`payroll.service.ts:65-140`).

### 10.1 Promotion policies (new, in HR settings)

```ts
interface PromotionPolicy {
  _id: ObjectId;
  tenantId: string;
  branchId?: string; // branch-level override optional
  fromDesignationId: string;
  toDesignationId: string;
  increment:
    | { type: 'percentage'; value: number; base: 'basic' | 'gross' } // "+10% on basic"
    | { type: 'fixed'; value: number }
    | { type: 'structure'; structureId: string }; // move to a named salary structure
  requiresApproval: boolean;
  status: 'active' | 'inactive';
}
```

### 10.2 Promotion workflow

`POST /hr/staff/:id/promote { toDesignationId, effectiveFrom, policyOverride? }`:

1. Validate against `Designation.level` — the ladder finally gets read: target level must be numerically lower (1 = highest) unless flagged lateral.
2. Optional approval step when `requiresApproval` (pending → approved → applied), mirroring the Concession approval trail.
3. On apply: write the designation change **with history** — new `designationHistory[]` on Staff (the existing `statusHistory` pattern) — and compute the new salary from the matched policy.
4. Payroll update reuses the **existing revision machinery**: create a new `StaffSalaryAssignment`, mark the prior one `status: 'revised'` with `effectiveTo` set (`payroll.service.ts:420-426`). `personalAllowances` carry forward untouched.

No hardcoded percentages anywhere — the client's "10% vs 20%, configurable" lives entirely in `PromotionPolicy`.

---

## 11. OBE and Registration: Re-keying Only

The OBE engine needs **no functional changes** — the audit confirmed all attainment machinery (CO/PO/PSO, direct 20/80, indirect surveys, 90/10 weights, articulation matrix, reports) is complete and already integrates with exams and elective rosters correctly.

Required work is limited to identity:

- `ObeProgram` gains `programId?` / `departmentId?` FKs beside the legacy `departmentCode` string (`types/obe.ts:52`).
- `ProgramScheme` likewise (`types/registration.ts:50-63`); `registration.service.ts:155-171` reads `class.departmentId` when present, falling back to the path parse.
- Cohort resolution (`obe.utils.ts:20-62`) is untouched; it already works off sections + elective rosters.

---

## 12. Switching UX Summary

| Context                                                | Switcher shown                                                                                                                                                                                                                                      | Backed by                                                                                                  |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Multi-org user (Krishna School / College / University) | Organization switcher                                                                                                                                                                                                                               | Existing — separate tenants per email (`OrganizationSwitcher.tsx`, `auth.service.ts:747-865`)              |
| Inside a university tenant                             | **Institution switcher** — lists institutions (name, logo, code) from the `institutions` collection; selecting one activates its campus branch via the existing no-reload branch mechanism; "All institutions" entry for global-scope central staff | New component + `branchStore` extension; `AuthUser` gains the institutions list (same pattern as branches) |
| Inside a school/college tenant                         | Branch switcher, exactly as today (the default institution is hidden)                                                                                                                                                                               | Existing                                                                                                   |
| Multi-campus institution (future)                      | Campus picker appears _within_ the selected institution                                                                                                                                                                                             | Model supports it now; UI deferred                                                                         |

One deliberate simplification: no department-level session switcher. Department context is a _filter_ within pages (as HR pages already do — `hr/staff/page.tsx:242`), not a session-level switch. Session-level context stays two-dimensional (org, institution→branch).

Cleanup: delete the dead `BranchSelector.tsx` duplicate.

---

## 13. Migration Plan

Each phase ships independently and is backward compatible; school/college tenants require no data migration beyond an invisible default-institution insert.

**Phase 0 — Immediate fixes (independent of everything else)**

- Fix the section-roster authorization hole: add teacher-scope check to `GET /teaching/my-classes/:sectionId/students` (mirror `getSectionLessonPlans`, which does it correctly).
- Delete dead `BranchSelector.tsx`.

**Phase 1 — Entities**

- Create `institutions` collection + CRUD in the organization module; backfill **one default institution per existing tenant** and `Branch.institutionId` (metadata-only migration, trivial).
- Promote `departments` to canonical; backfill `Class.departmentId` with a one-time script reusing the exact name-match logic from `departmentOverview.service.ts:57-68` (the runtime join becomes the migration, then dies). Flag unmatched classes for manual resolution.
- Create `programs` collection; backfill from class paths/streams for university/college tenants that opt in.
- Dual-write `Class.path` + FKs on all class writes.

**Phase 2 — Wiring existing stubs**

- Subject sharing: add `sharing`/`offeredToDepartmentIds`, enforce at curriculum-attach and pickers.
- `teaching_assignments` collection + `assertTeachingScope` helper; migrate `staff.teaching.subjects` (class-level → one row per section); apply the helper to rosters, attendance, marks.
- RBAC: `accessScope.type: 'institution'` resolution in the auth gate; wire department scope via `applyAccessScope` helper in academic modules; expose Institution + Department options in user-admin UI.
- Lab batches on Section + `labBatchId` on enrollment + optional `batchId` on timetable/attendance.

**Phase 3 — University features**

- Institution switcher (frontend) + `AuthUser.institutions`; university onboarding creates institutions; "All institutions" mode + first cross-institution views (finance, admissions, HR).
- `admissionCategory` on Student + wire fee-structure category matching; institution-sourced admission prefixes.
- Scholarship/receivable module with fee-assignment split.

**Phase 4 — HR**

- Designation-ladder validation, `PromotionPolicy`, promotion workflow + `designationHistory`, payroll auto-revision on promotion.

**Phase 5 — Deprecation**

- Re-key OBE/registration to FKs with string fallback; retire the four runtime path re-parsers; retire `staff.teaching.subjects` writes.

### Risk notes

- **Backfill quality** is the main risk: name-match on `path[0]` will not resolve 100% of classes. The migration script must produce an unmatched report, and the FK columns must remain optional until a tenant is fully resolved.
- **Dual-write drift**: keep the dual-write window short per tenant; add a consistency check script (path top entry vs department FK) runnable in CI/cron.
- **Scope-enforcement rollout**: turning on department scoping for an existing department-scoped user (there may be users with `type: 'department'` stored today that currently behave as branch-scoped) will _narrow_ their access. Ship behind a tenant-level flag and communicate.

---

## 14. What This Proposal Deliberately Does NOT Do

- No `institutionId` enforcement on documents — scoping stays `tenantId + branchId`; denormalized `institutionId` stamping is reserved as a later reporting optimization (Section 2.3).
- No institution-as-child-tenant — centralized administration would require cross-tenant queries, breaking the tenant isolation boundary (Section 2.2, Option B).
- No department- or program-level session switcher — filters, not switchers.
- No program-level access scope in v1 — department scope covers realistic cases; the `accessScope` shape leaves room.
- No per-institution module subscriptions — `requireModule` stays tenant-level (Section 3.4).
- No multi-campus institution UI in v1 — the model supports it; the UI is deferred.
- No changes to the OBE engine's computation, the admission pipeline stages, or the multi-org (multi-tenant-per-email) model.
- No Mongoose/ORM introduction, no collection renames — additive fields and new collections only.
