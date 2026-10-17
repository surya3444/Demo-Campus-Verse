# Campus Verse - Comprehensive Action Plan

**Created:** February 4, 2026
**Based on:** USER_ROLES_DOCUMENTATION.md, IMPLEMENTATION_PLAN.md, TASKS_BY_STATUS.md
**Total Estimated Duration:** 12-16 weeks (6 sprints)

---

## Executive Summary

This action plan addresses all identified gaps in the Campus Verse ERP system, organized into 6 sprints covering:

1. **Sprint 1-2:** Critical fixes and UX improvements for existing roles
2. **Sprint 3-4:** Missing core features completion
3. **Sprint 5-6:** New roles and advanced features

**Key Metrics:**

- Total Tasks: 89
- Critical (P0): 12
- High Priority (P1): 28
- Medium Priority (P2): 31
- Low Priority (P3): 18

---

## Table of Contents

1. [Sprint 1: Critical UX Fixes](#sprint-1-critical-ux-fixes)
2. [Sprint 2: Role-Based Experience](#sprint-2-role-based-experience)
3. [Sprint 3: HR Module Completion](#sprint-3-hr-module-completion)
4. [Sprint 4: Admission & Finance Completion](#sprint-4-admission--finance-completion)
5. [Sprint 5: New Roles Implementation](#sprint-5-new-roles-implementation)
6. [Sprint 6: Portal & Enhancements](#sprint-6-portal--enhancements)
7. [Technical Debt & Infrastructure](#technical-debt--infrastructure)
8. [Dependencies Graph](#dependencies-graph)
9. [Risk Assessment](#risk-assessment)

---

## Sprint 1: Critical UX Fixes

**Duration:** 2 weeks
**Goal:** Fix immediate UX issues that confuse users based on their roles

### 1.1 Hide Inaccessible UI Elements ✅ COMPLETED

**Priority:** P0 (Critical)
**Effort:** Low
**Roles Affected:** ORG_ADMIN, BRANCH_ADMIN

#### Tasks

| ID    | Task                                                | File(s)             | Acceptance Criteria                               | Status            |
| ----- | --------------------------------------------------- | ------------------- | ------------------------------------------------- | ----------------- |
| S1-01 | ~~Hide organization menu for BRANCH_ADMIN~~         | `Sidebar.tsx`       | Organization section not visible for BRANCH_ADMIN | ✅                |
| S1-02 | ~~Hide branch create/delete buttons for ORG_ADMIN~~ | `branches/page.tsx` | Buttons don't render (not just disabled)          | ✅                |
| S1-03 | ~~Hide role management actions for ORG_ADMIN~~      | `roles/page.tsx`    | Create/Edit/Delete buttons hidden                 | ✅                |
| S1-04 | ~~Hide settings edit buttons for restricted roles~~ | `settings/page.tsx` | Edit buttons hidden based on permission           | ✅                |
| S1-05 | ~~Remove delete buttons for BRANCH_ADMIN~~          | Multiple files      | Delete buttons don't render for BRANCH_ADMIN      | ✅                |
| S1-06 | ~~Hide cross-branch reports for BRANCH_ADMIN~~      | `reports/*.tsx`     | Reports filtered to single branch                 | ✅ (API-enforced) |

#### Implementation Details

```typescript
// Pattern to use in components
const { hasPermission, isBranchAdmin } = usePermissions();

// Don't render button at all instead of disabling
{hasPermission('organization.branches', 'create') && (
  <Button>Create Branch</Button>
)}

// For sidebar items
const filteredMenuItems = menuItems.filter(item => {
  if (isBranchAdmin && item.section === 'organization') return false;
  return hasPermission(item.permission, 'view');
});
```

---

### 1.2 Auto Branch Selection for BRANCH_ADMIN ✅ COMPLETED

**Priority:** P0 (Critical)
**Effort:** Low
**Roles Affected:** BRANCH_ADMIN

#### Tasks

| ID    | Task                                                      | File(s)                            | Acceptance Criteria                         | Status                   |
| ----- | --------------------------------------------------------- | ---------------------------------- | ------------------------------------------- | ------------------------ |
| S1-07 | ~~Auto-select branch on login for single-branch users~~   | `branchStore.ts`, `login/page.tsx` | Branch auto-selected, no picker shown       | ✅                       |
| S1-08 | ~~Hide branch selector dropdown for single-branch users~~ | `BranchSelector.tsx`               | Dropdown not visible when user has 1 branch | ✅ (Already implemented) |
| S1-09 | ~~Remove branch filter from reports for BRANCH_ADMIN~~    | Report pages                       | Branch filter hidden, data pre-filtered     | ✅ (API-enforced)        |

#### Implementation Details

```typescript
// In branchStore.ts or auth flow
const initializeBranch = (user) => {
  if (user.accessScope.type === 'branch' && user.accessScope.branchIds.length === 1) {
    // Auto-select the only branch
    setCurrentBranch(user.accessScope.branchIds[0]);
    setShowBranchPicker(false);
  }
};
```

---

### 1.3 Approval System Fixes ✅ COMPLETED

**Priority:** P0 (Critical)
**Effort:** Medium
**Roles Affected:** GROUP_OWNER, ORG_MODERATOR

#### Tasks

| ID    | Task                                       | File(s)                                         | Acceptance Criteria                       | Status                   |
| ----- | ------------------------------------------ | ----------------------------------------------- | ----------------------------------------- | ------------------------ |
| S1-10 | ~~Add undo approval functionality~~        | `approval.service.ts`, `approval.controller.ts` | Approved items can be reverted within 24h | ✅ (Already implemented) |
| S1-11 | ~~Create approval undo API endpoint~~      | `organization.routes.ts`                        | `POST /approvals/:id/undo` endpoint works | ✅ (Already implemented) |
| S1-12 | ~~Add undo button to approval UI~~         | `approvals/page.tsx`                            | Undo button visible on recent approvals   | ✅ (Already implemented) |
| S1-13 | ~~Add approval email settings page~~       | `approvals/settings/page.tsx`                   | Settings page allows email configuration  | ✅ (Already implemented) |
| S1-14 | ~~Implement approval email notifications~~ | `approval.service.ts`, email service            | Emails sent on approval/rejection         | ✅ (Already implemented) |

#### API Design

```typescript
// POST /organization/approvals/:id/undo
interface UndoApprovalRequest {
  reason: string;
}

interface UndoApprovalResponse {
  success: boolean;
  data: {
    approvalId: string;
    previousStatus: string;
    newStatus: 'pending';
    undoneAt: Date;
    undoneBy: string;
  };
}
```

---

### 1.4 Error Message Improvements ✅ COMPLETED

**Priority:** P1 (High)
**Effort:** Low
**Roles Affected:** All

#### Tasks

| ID    | Task                                                   | File(s)              | Acceptance Criteria                      | Status                  |
| ----- | ------------------------------------------------------ | -------------------- | ---------------------------------------- | ----------------------- |
| S1-15 | ~~Add clear error messages for permission failures~~   | `rbac.ts` middleware | Error messages explain why action failed | ✅                      |
| S1-16 | ~~Show toast with action required for restricted ops~~ | `api.ts`, `utils.ts` | Toast suggests contacting admin          | ✅                      |
| S1-17 | Add "Request Access" workflow for restricted actions   | New component        | Users can request access from admin      | 📋 Deferred to Sprint 2 |

---

## Sprint 2: Role-Based Experience

**Duration:** 2 weeks
**Goal:** Customize the experience based on user role

### 2.1 Role-Based Dashboards

**Priority:** P1 (High)
**Effort:** Medium
**Roles Affected:** All

#### Tasks

| ID    | Task                                          | File(s)                         | Acceptance Criteria                             |
| ----- | --------------------------------------------- | ------------------------------- | ----------------------------------------------- |
| S2-01 | Create dashboard layout variants              | `dashboard/`                    | 4 different layouts for 4 role levels           |
| S2-02 | GROUP_OWNER dashboard - Organization overview | `dashboard/OwnerDashboard.tsx`  | Shows all branches, users, revenue, growth      |
| S2-03 | ORG_ADMIN dashboard - Operational focus       | `dashboard/AdminDashboard.tsx`  | Shows daily tasks, pending items, quick actions |
| S2-04 | BRANCH_ADMIN dashboard - Branch focus         | `dashboard/BranchDashboard.tsx` | Shows branch-only metrics, today's tasks        |
| S2-05 | Create dashboard widget system                | `components/dashboard/`         | Reusable widget components                      |
| S2-06 | Add dashboard API endpoints per role          | `dashboard.controller.ts`       | Different stats returned based on role          |

#### Dashboard Specifications

**GROUP_OWNER Dashboard:**

```
┌─────────────────────────────────────────────────────────┐
│  Organization Overview                                   │
├──────────────┬──────────────┬──────────────┬────────────┤
│ Total        │ Active       │ Total        │ Monthly    │
│ Students     │ Staff        │ Revenue      │ Collection │
├──────────────┴──────────────┴──────────────┴────────────┤
│  Branch Performance (Chart)                              │
├─────────────────────────────┬───────────────────────────┤
│  Recent Approvals           │  Pending Actions          │
├─────────────────────────────┴───────────────────────────┤
│  Activity Timeline                                       │
└─────────────────────────────────────────────────────────┘
```

**BRANCH_ADMIN Dashboard:**

```
┌─────────────────────────────────────────────────────────┐
│  Today's Tasks                              [Branch: X]  │
├──────────────┬──────────────┬──────────────┬────────────┤
│ Attendance   │ Fee          │ New          │ Pending    │
│ Pending      │ Collection   │ Admissions   │ Leaves     │
├──────────────┴──────────────┴──────────────┴────────────┤
│  Quick Actions                                           │
│  [Mark Attendance] [Collect Fee] [Add Lead] [Send SMS]   │
├─────────────────────────────────────────────────────────┤
│  Today's Fee Collections                                 │
└─────────────────────────────────────────────────────────┘
```

---

### 2.2 Onboarding Wizard for New Organizations

**Priority:** P1 (High)
**Effort:** High
**Roles Affected:** GROUP_OWNER

#### Tasks

| ID    | Task                                    | File(s)                  | Acceptance Criteria                  |
| ----- | --------------------------------------- | ------------------------ | ------------------------------------ |
| S2-07 | Create onboarding flow component        | `components/onboarding/` | Multi-step wizard UI                 |
| S2-08 | Step 1: Organization profile completion | Wizard step              | Name, logo, contact info             |
| S2-09 | Step 2: First branch setup              | Wizard step              | Create first branch with details     |
| S2-10 | Step 3: Academic structure setup        | Wizard step              | Create classes and sections          |
| S2-11 | Step 4: First user invitation           | Wizard step              | Invite admin/staff                   |
| S2-12 | Track onboarding progress               | `tenant` collection      | `onboardingCompleted` flag           |
| S2-13 | Show progress indicator on dashboard    | Dashboard                | Checklist of completed/pending steps |
| S2-14 | Allow skipping with "Complete Later"    | Wizard                   | Skip button with reminder            |

#### Onboarding Flow

```
Step 1: Welcome & Profile
├── Organization name (pre-filled)
├── Upload logo
├── Contact information
└── Timezone & currency

Step 2: Create First Branch
├── Branch name & code
├── Location details
├── Institution type confirmation
└── Contact for branch

Step 3: Academic Structure
├── Create academic batch (year)
├── Create 2-3 sample classes
├── Create sections (A, B, C)
└── Preview structure

Step 4: Invite Team
├── Invite ORG_ADMIN (optional)
├── Invite BRANCH_ADMIN (optional)
└── Skip for now option

Step 5: Ready!
├── Summary of setup
├── Quick links to common tasks
└── Video tutorial links
```

---

### 2.3 Sidebar Filtering by Role

**Priority:** P1 (High)
**Effort:** Low
**Roles Affected:** ORG_ADMIN, BRANCH_ADMIN

#### Tasks

| ID    | Task                                                | File(s)                | Acceptance Criteria                 |
| ----- | --------------------------------------------------- | ---------------------- | ----------------------------------- |
| S2-15 | Refactor sidebar to filter by permissions           | `Sidebar.tsx`          | Menu items filtered dynamically     |
| S2-16 | Create role-specific menu configurations            | `config/menuConfig.ts` | Clear menu definitions per role     |
| S2-17 | Add visual indicators for view-only sections        | `Sidebar.tsx`          | Eye icon for view-only items        |
| S2-18 | Collapse organization section by default for admins | `Sidebar.tsx`          | Org section collapsed for ORG_ADMIN |

---

### 2.4 Remember User Preferences

**Priority:** P2 (Medium)
**Effort:** Low
**Roles Affected:** All

#### Tasks

| ID    | Task                                  | File(s)                        | Acceptance Criteria             |
| ----- | ------------------------------------- | ------------------------------ | ------------------------------- |
| S2-19 | Remember last selected branch         | `branchStore.ts`, localStorage | Branch persists across sessions |
| S2-20 | Remember sidebar collapsed state      | `Sidebar.tsx`, localStorage    | Sidebar state persists          |
| S2-21 | Remember table page size preferences  | Table components               | Page size persists per table    |
| S2-22 | Remember dashboard widget arrangement | Dashboard, localStorage        | Widget positions persist        |

---

## Sprint 3: HR Module Completion

**Duration:** 2 weeks
**Goal:** Complete all HR module features

### 3.1 Shifts Management

**Priority:** P1 (High)
**Effort:** Medium

#### Tasks

| ID    | Task                        | File(s)                       | Acceptance Criteria             |
| ----- | --------------------------- | ----------------------------- | ------------------------------- |
| S3-01 | Create shifts schema        | `shared/schemas/hr.schema.ts` | Zod schema for shifts           |
| S3-02 | Create shifts service       | `hr/shifts.service.ts`        | CRUD operations for shifts      |
| S3-03 | Create shifts controller    | `hr/shifts.controller.ts`     | API endpoints                   |
| S3-04 | Add shifts routes           | `hr/hr.routes.ts`             | Routes registered               |
| S3-05 | Create shifts settings page | `hr/settings/shifts/page.tsx` | UI to manage shifts             |
| S3-06 | Assign shifts to staff      | `hr/staff/`                   | Staff can be assigned to shifts |

#### Shift Schema

```typescript
interface Shift {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  name: string; // "Morning Shift", "Evening Shift"
  code: string; // "MORN", "EVE"
  startTime: string; // "09:00"
  endTime: string; // "17:00"
  graceMinutes: number; // 15 (late arrival grace)
  workingDays: number[]; // [1,2,3,4,5] (Mon-Fri)
  isDefault: boolean;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 3.2 Weekly Offs Configuration

**Priority:** P1 (High)
**Effort:** Medium

#### Tasks

| ID    | Task                                  | File(s)                            | Acceptance Criteria                      |
| ----- | ------------------------------------- | ---------------------------------- | ---------------------------------------- |
| S3-07 | Add weekly offs to staff schema       | Staff schema                       | `weeklyOffs` field added                 |
| S3-08 | Create weekly offs settings UI        | `hr/settings/weekly-offs/page.tsx` | Configure default weekly offs            |
| S3-09 | Allow per-staff weekly off override   | Staff form                         | Individual staff can have different offs |
| S3-10 | Integrate weekly offs with attendance | Attendance marking                 | Auto-mark weekly offs                    |

---

### 3.3 Holiday Calendar

**Priority:** P1 (High)
**Effort:** Medium

#### Tasks

| ID    | Task                                               | File(s)                       | Acceptance Criteria          |
| ----- | -------------------------------------------------- | ----------------------------- | ---------------------------- |
| S3-11 | Create holidays schema                             | `shared/schemas/hr.schema.ts` | Zod schema for holidays      |
| S3-12 | Create holidays service                            | `hr/holidays.service.ts`      | CRUD for holidays            |
| S3-13 | Create holidays controller                         | `hr/holidays.controller.ts`   | API endpoints                |
| S3-14 | Create holiday calendar page                       | `hr/holidays/page.tsx`        | Calendar view of holidays    |
| S3-15 | Add holiday types (national, optional, restricted) | Schema                        | Different holiday categories |
| S3-16 | Integrate with attendance                          | Attendance service            | Auto-mark holidays           |

---

### 3.4 Leave Management Enhancements

**Priority:** P1 (High)
**Effort:** High

#### Tasks

| ID    | Task                              | File(s)                    | Acceptance Criteria            |
| ----- | --------------------------------- | -------------------------- | ------------------------------ |
| S3-17 | Create leave types configuration  | `hr/settings/leave-types/` | Define leave types with quotas |
| S3-18 | Add leave balance tracking        | `leave.service.ts`         | Track used/remaining leaves    |
| S3-19 | Implement leave approval workflow | `hr/approvals/page.tsx`    | Multi-level approval           |
| S3-20 | Add leave carry forward rules     | Settings                   | Configure carry forward limits |
| S3-21 | Add leave encashment              | Settings, service          | Calculate encashment value     |
| S3-22 | Create leave reports              | `hr/reports/`              | Leave utilization reports      |

#### Leave Type Schema

```typescript
interface LeaveType {
  _id: ObjectId;
  tenantId: ObjectId;
  name: string; // "Casual Leave", "Sick Leave"
  code: string; // "CL", "SL"
  annualQuota: number; // 12
  carryForwardLimit: number; // 5
  encashable: boolean;
  requiresApproval: boolean;
  requiresDocument: boolean; // For medical leaves
  applicableTo: 'all' | 'teaching' | 'non-teaching';
  status: 'active' | 'inactive';
}
```

---

### 3.5 HR Approval Workflow

**Priority:** P1 (High)
**Effort:** Medium

#### Tasks

| ID    | Task                                      | File(s)                 | Acceptance Criteria            |
| ----- | ----------------------------------------- | ----------------------- | ------------------------------ |
| S3-23 | Create leave approval queue page          | `hr/approvals/page.tsx` | List pending leave requests    |
| S3-24 | Add approve/reject actions                | Approval page           | Buttons with reason field      |
| S3-25 | Add bulk approval                         | Approval page           | Select multiple and approve    |
| S3-26 | Add email notifications                   | Leave service           | Email on submit/approve/reject |
| S3-27 | Create attendance regularization workflow | `hr/approvals/`         | Request to fix missed punches  |

---

## Sprint 4: Admission & Finance Completion

**Duration:** 2 weeks
**Goal:** Complete admission and finance module features

### 4.1 Admission Followups

**Priority:** P1 (High)
**Effort:** Medium

#### Tasks

| ID    | Task                        | File(s)                              | Acceptance Criteria           |
| ----- | --------------------------- | ------------------------------------ | ----------------------------- |
| S4-01 | Create followup schema      | `shared/schemas/admission.schema.ts` | Schema for followup records   |
| S4-02 | Create followup service     | `admission/followup.service.ts`      | CRUD + scheduling             |
| S4-03 | Create followup controller  | `admission/followup.controller.ts`   | API endpoints                 |
| S4-04 | Implement followup page     | `admissions/followups/page.tsx`      | List/create/edit followups    |
| S4-05 | Add followup reminders      | Scheduled job                        | Auto-remind for due followups |
| S4-06 | Add followup to lead detail | Lead detail page                     | Show followup history         |

#### Followup Schema

```typescript
interface LeadFollowup {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  leadId: ObjectId;
  scheduledDate: Date;
  completedDate?: Date;
  type: 'call' | 'email' | 'sms' | 'visit' | 'meeting';
  status: 'scheduled' | 'completed' | 'missed' | 'cancelled';
  notes: string;
  outcome?: 'interested' | 'not_interested' | 'callback' | 'converted';
  nextFollowupDate?: Date;
  assignedTo: ObjectId;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 4.2 Admission Bulk Upload

**Priority:** P2 (Medium)
**Effort:** Medium

#### Tasks

| ID    | Task                                  | File(s)                           | Acceptance Criteria             |
| ----- | ------------------------------------- | --------------------------------- | ------------------------------- |
| S4-07 | Create admission bulk upload template | Service                           | CSV/Excel template              |
| S4-08 | Create validation service             | `admission/bulkUpload.service.ts` | Validate uploaded data          |
| S4-09 | Create processing service             | Same                              | Process and create applications |
| S4-10 | Implement bulk upload page            | `admissions/bulk-upload/page.tsx` | Upload, preview, confirm flow   |
| S4-11 | Add error reporting                   | Bulk upload page                  | Show validation errors per row  |

---

### 4.3 Dynamic Admission Forms

**Priority:** P2 (Medium)
**Effort:** High

#### Tasks

| ID    | Task                            | File(s)                              | Acceptance Criteria        |
| ----- | ------------------------------- | ------------------------------------ | -------------------------- |
| S4-12 | Create form builder component   | `components/form-builder/`           | Drag-drop form builder     |
| S4-13 | Create form schema              | `shared/schemas/admission.schema.ts` | Dynamic form definition    |
| S4-14 | Create form service             | `admission/form.service.ts`          | CRUD for forms             |
| S4-15 | Implement forms management page | `admissions/forms/page.tsx`          | List/create/edit forms     |
| S4-16 | Create public form renderer     | `(public)/admission-form/`           | Public-facing form page    |
| S4-17 | Handle form submissions         | Form service                         | Save as leads/applications |

---

### 4.4 Finance Reports Completion

**Priority:** P1 (High)
**Effort:** Medium

#### Tasks

| ID    | Task                              | File(s)                    | Acceptance Criteria              |
| ----- | --------------------------------- | -------------------------- | -------------------------------- |
| S4-18 | Implement Total Paid & Due Report | `reports.service.ts`       | Aggregate totals with filters    |
| S4-19 | Add report UI                     | `finance/reports/page.tsx` | Visual report with charts        |
| S4-20 | Add Yet to Assign Fee Report      | Reports                    | Students without fee assignments |
| S4-21 | Add report export (PDF/Excel)     | Reports                    | Export functionality             |

---

### 4.5 Finance Settings Completion

**Priority:** P2 (Medium)
**Effort:** Low

#### Tasks

| ID    | Task                         | File(s)             | Acceptance Criteria            |
| ----- | ---------------------------- | ------------------- | ------------------------------ |
| S4-22 | Add Application Fee Settings | `finance/settings/` | Configure admission app fees   |
| S4-23 | Add Wallet Sequence Settings | Settings            | Configure wallet number format |
| S4-24 | Add Payment Gateway Settings | Settings            | Configure Razorpay/others      |

---

### 4.6 Student Operations

**Priority:** P2 (Medium)
**Effort:** Medium

#### Tasks

| ID    | Task                      | File(s)                      | Acceptance Criteria      |
| ----- | ------------------------- | ---------------------------- | ------------------------ |
| S4-25 | Implement Student Shuffle | `student.service.ts`         | Move between sections    |
| S4-26 | Create shuffle UI         | `students/shuffle/page.tsx`  | Select and move students |
| S4-27 | Implement Branch Transfer | `student.service.ts`         | Move between branches    |
| S4-28 | Create transfer UI        | `students/transfer/page.tsx` | Transfer workflow        |
| S4-29 | Add transfer history      | Student detail               | Show transfer history    |

---

## Sprint 5: New Roles Implementation

**Duration:** 2 weeks
**Goal:** Implement Teacher and essential new roles

### 5.1 Teacher/Faculty Role

**Priority:** P1 (High)
**Effort:** High

#### Tasks

| ID    | Task                                | File(s)                          | Acceptance Criteria            |
| ----- | ----------------------------------- | -------------------------------- | ------------------------------ |
| S5-01 | Add TEACHER role definition         | `roles.ts`                       | Level 4 role                   |
| S5-02 | Define teacher permissions          | `permissions.ts`                 | Class-level permissions        |
| S5-03 | Create teacher assignment schema    | Schema                           | Teacher-class-subject mapping  |
| S5-04 | Create teacher dashboard            | `dashboard/TeacherDashboard.tsx` | Class schedule, attendance     |
| S5-05 | Create "My Classes" page            | `teacher/classes/page.tsx`       | View assigned classes          |
| S5-06 | Filter students by assigned classes | API                              | Only show assigned students    |
| S5-07 | Add teacher attendance marking      | Attendance                       | Mark for assigned classes only |
| S5-08 | Create teacher timetable view       | `teacher/timetable/page.tsx`     | Personal schedule              |

#### Teacher Permission Set

```typescript
const TEACHER_PERMISSIONS = {
  // Own classes only
  'students.list': ['view'],
  'attendance.mark': ['view', 'create', 'edit'],
  'attendance.view': ['view'],

  // HR - own only
  'hr.leaves': ['view', 'create'], // Apply own leave

  // Communications - own classes
  'communications.announcements': ['view', 'create'],

  // Future: Academics
  'academics.grades': ['view', 'create', 'edit'],
  'academics.assignments': ['view', 'create', 'edit'],
};
```

---

### 5.2 Accountant Role

**Priority:** P2 (Medium)
**Effort:** Medium

#### Tasks

| ID    | Task                           | File(s)          | Acceptance Criteria      |
| ----- | ------------------------------ | ---------------- | ------------------------ |
| S5-09 | Add ACCOUNTANT role definition | `roles.ts`       | Level 4 role             |
| S5-10 | Define accountant permissions  | `permissions.ts` | Finance-only permissions |
| S5-11 | Create accountant dashboard    | Dashboard        | Finance-focused metrics  |
| S5-12 | Filter sidebar for accountant  | Sidebar          | Show only finance menu   |

---

### 5.3 Admission Counselor Role

**Priority:** P2 (Medium)
**Effort:** Medium

#### Tasks

| ID    | Task                               | File(s)          | Acceptance Criteria         |
| ----- | ---------------------------------- | ---------------- | --------------------------- |
| S5-13 | Add COUNSELOR role definition      | `roles.ts`       | Level 4 role                |
| S5-14 | Define counselor permissions       | `permissions.ts` | Admission-only permissions  |
| S5-15 | Create counselor dashboard         | Dashboard        | Lead/application metrics    |
| S5-16 | Add counselor performance tracking | Reports          | Conversion rates, followups |

---

### 5.4 HR Manager Role

**Priority:** P2 (Medium)
**Effort:** Medium

#### Tasks

| ID    | Task                           | File(s)          | Acceptance Criteria          |
| ----- | ------------------------------ | ---------------- | ---------------------------- |
| S5-17 | Add HR_MANAGER role definition | `roles.ts`       | Level 3 role (org-level)     |
| S5-18 | Define HR manager permissions  | `permissions.ts` | Full HR, limited other       |
| S5-19 | Create HR manager dashboard    | Dashboard        | Staff metrics, leave pending |
| S5-20 | Filter sidebar for HR manager  | Sidebar          | Show HR + basic menus        |

---

## Sprint 6: Portal & Enhancements

**Duration:** 2 weeks
**Goal:** Student/Parent portal and advanced features

### 6.1 Student/Parent Portal

**Priority:** P1 (High)
**Effort:** Very High

#### Tasks

| ID    | Task                                    | File(s)               | Acceptance Criteria         |
| ----- | --------------------------------------- | --------------------- | --------------------------- |
| S6-01 | Add STUDENT and PARENT role definitions | `roles.ts`            | Level 5 roles               |
| S6-02 | Define student/parent permissions       | `permissions.ts`      | Read-only own data          |
| S6-03 | Create student login flow               | Auth                  | Separate login or unified   |
| S6-04 | Create student portal layout            | `(portal)/layout.tsx` | Portal-specific layout      |
| S6-05 | Create student dashboard                | Portal                | Overview of own info        |
| S6-06 | Create fee payment page                 | Portal                | View dues, pay online       |
| S6-07 | Create attendance view                  | Portal                | View own attendance         |
| S6-08 | Create announcements view               | Portal                | View relevant announcements |
| S6-09 | Create certificate request              | Portal                | Request certificates        |
| S6-10 | Create parent view (multi-child)        | Portal                | View multiple children      |

#### Portal Architecture Decision

**Option A:** Separate app (`apps/portal/`)

- Pros: Clean separation, different routing
- Cons: Code duplication, separate deployment

**Option B:** Same app with role-based routing (`apps/web/src/app/(portal)/`)

- Pros: Shared components, single deployment
- Cons: More complex routing logic

**Recommendation:** Option B with clear route separation

---

### 6.2 Two-Factor Authentication

**Priority:** P2 (Medium)
**Effort:** Medium

#### Tasks

| ID    | Task                          | File(s)       | Acceptance Criteria       |
| ----- | ----------------------------- | ------------- | ------------------------- |
| S6-11 | Add 2FA setup for admin roles | Auth settings | TOTP setup flow           |
| S6-12 | Implement 2FA verification    | Login flow    | Verify code on login      |
| S6-13 | Add backup codes              | Auth          | Generate/use backup codes |
| S6-14 | Add 2FA enforcement settings  | Org settings  | Require 2FA for admins    |

---

### 6.3 Notification Center

**Priority:** P2 (Medium)
**Effort:** Medium

#### Tasks

| ID    | Task                              | File(s)          | Acceptance Criteria       |
| ----- | --------------------------------- | ---------------- | ------------------------- |
| S6-15 | Create notification schema        | Schema           | Notification data model   |
| S6-16 | Create notification service       | Service          | Generate notifications    |
| S6-17 | Create notification center UI     | Header component | Bell icon with dropdown   |
| S6-18 | Add notification preferences      | User settings    | Configure what to receive |
| S6-19 | Add push notifications (optional) | Service worker   | Browser push              |

---

### 6.4 Audit Log Export

**Priority:** P2 (Medium)
**Effort:** Low

#### Tasks

| ID    | Task                     | File(s)                     | Acceptance Criteria          |
| ----- | ------------------------ | --------------------------- | ---------------------------- |
| S6-20 | Create audit log viewer  | `admin/audit-logs/page.tsx` | View all actions             |
| S6-21 | Add audit log filters    | Viewer                      | Filter by user, action, date |
| S6-22 | Add export functionality | Viewer                      | Export as CSV/PDF            |

---

## Technical Debt & Infrastructure

### Tasks to Address Alongside Sprints

| ID    | Task                                                            | Priority | Sprint      |
| ----- | --------------------------------------------------------------- | -------- | ----------- |
| TD-01 | Update task status in project management (16 implemented tasks) | P0       | 1           |
| TD-02 | Add comprehensive error handling to all API endpoints           | P1       | 1-2         |
| TD-03 | Add request validation to all endpoints                         | P1       | 1-2         |
| TD-04 | Improve TypeScript types coverage                               | P2       | 2-3         |
| TD-05 | Add unit tests for new services (80% coverage)                  | P1       | Each sprint |
| TD-06 | Add E2E tests for critical flows                                | P2       | 4-5         |
| TD-07 | Performance optimization for large datasets                     | P2       | 5-6         |
| TD-08 | Add Redis caching for frequently accessed data                  | P2       | 5-6         |
| TD-09 | Implement rate limiting                                         | P1       | 3           |
| TD-10 | Add API documentation (Swagger/OpenAPI)                         | P2       | 4           |

---

## Dependencies Graph

```
Sprint 1 (UX Fixes)
    │
    ├── No dependencies
    │
    ▼
Sprint 2 (Role-Based Experience)
    │
    ├── Depends on: S1 completion
    │
    ▼
Sprint 3 (HR Module)          Sprint 4 (Admission/Finance)
    │                              │
    ├── Independent                ├── Independent
    │                              │
    ▼                              ▼
Sprint 5 (New Roles)
    │
    ├── Depends on: Role system from S1-S2
    ├── Depends on: HR module for Teacher role
    │
    ▼
Sprint 6 (Portal)
    │
    ├── Depends on: All role work from S5
    ├── Depends on: Finance for payments
    └── Depends on: Attendance for viewing
```

---

## Risk Assessment

### High Risks

| Risk                    | Impact                  | Mitigation                     |
| ----------------------- | ----------------------- | ------------------------------ |
| Portal scope creep      | Delays sprint 6         | Strict MVP definition          |
| Teacher role complexity | Blocks academics module | Start with basic permissions   |
| 2FA integration issues  | Security concerns       | Use proven library (speakeasy) |

### Medium Risks

| Risk                           | Impact                 | Mitigation                      |
| ------------------------------ | ---------------------- | ------------------------------- |
| Form builder complexity        | Delays admission forms | Consider existing library       |
| Performance with large schools | Poor UX                | Early optimization, pagination  |
| Migration of existing data     | Data integrity         | Thorough testing, rollback plan |

### Low Risks

| Risk                  | Impact               | Mitigation                   |
| --------------------- | -------------------- | ---------------------------- |
| UI inconsistencies    | Minor UX issues      | Design system adherence      |
| Email delivery issues | Missed notifications | Multiple providers, fallback |

---

## Success Metrics

### Sprint 1-2 Success Criteria

- [ ] Zero UI elements shown for inaccessible features
- [ ] BRANCH_ADMIN users report improved experience
- [ ] Onboarding completion rate > 80%
- [ ] Support tickets reduced by 30%

### Sprint 3-4 Success Criteria

- [ ] HR module feature parity with competitors
- [ ] Admission followup conversion rate trackable
- [ ] All finance reports functional
- [ ] Bulk operations save 50% time

### Sprint 5-6 Success Criteria

- [ ] New roles deployed without permission issues
- [ ] Portal adopted by 50% of parent users
- [ ] 2FA enabled for all admin accounts
- [ ] Audit logs capture all sensitive actions

---

## Appendix: File Creation Checklist

### New Files to Create

**Sprint 1:**

- [ ] `apps/api/src/modules/organization/approvalUndo.service.ts`
- [ ] `apps/web/src/app/(dashboard)/organization/approvals/settings/page.tsx`

**Sprint 2:**

- [ ] `apps/web/src/app/(dashboard)/dashboard/OwnerDashboard.tsx`
- [ ] `apps/web/src/app/(dashboard)/dashboard/AdminDashboard.tsx`
- [ ] `apps/web/src/app/(dashboard)/dashboard/BranchDashboard.tsx`
- [ ] `apps/web/src/components/onboarding/OnboardingWizard.tsx`
- [ ] `apps/web/src/config/menuConfig.ts`

**Sprint 3:**

- [ ] `apps/api/src/modules/hr/shifts.service.ts`
- [ ] `apps/api/src/modules/hr/shifts.controller.ts`
- [ ] `apps/api/src/modules/hr/holidays.service.ts`
- [ ] `apps/api/src/modules/hr/holidays.controller.ts`
- [ ] `apps/web/src/app/(dashboard)/hr/holidays/page.tsx`
- [ ] `apps/web/src/app/(dashboard)/hr/settings/shifts/page.tsx`
- [ ] `apps/web/src/app/(dashboard)/hr/settings/leave-types/page.tsx`

**Sprint 4:**

- [ ] `apps/api/src/modules/admission/followup.service.ts`
- [ ] `apps/api/src/modules/admission/followup.controller.ts`
- [ ] `apps/web/src/app/(dashboard)/admissions/followups/page.tsx` (complete)
- [ ] `apps/web/src/app/(dashboard)/admissions/bulk-upload/page.tsx` (complete)
- [ ] `apps/web/src/components/form-builder/FormBuilder.tsx`
- [ ] `apps/web/src/app/(dashboard)/students/shuffle/page.tsx`
- [ ] `apps/web/src/app/(dashboard)/students/transfer/page.tsx`

**Sprint 5:**

- [ ] `apps/web/src/app/(dashboard)/dashboard/TeacherDashboard.tsx`
- [ ] `apps/web/src/app/(dashboard)/teacher/classes/page.tsx`
- [ ] `apps/web/src/app/(dashboard)/teacher/timetable/page.tsx`

**Sprint 6:**

- [ ] `apps/web/src/app/(portal)/layout.tsx`
- [ ] `apps/web/src/app/(portal)/dashboard/page.tsx`
- [ ] `apps/web/src/app/(portal)/fees/page.tsx`
- [ ] `apps/web/src/app/(portal)/attendance/page.tsx`
- [ ] `apps/api/src/modules/auth/twoFactor.service.ts`
- [ ] `apps/api/src/modules/notification/notification.service.ts`

---

## Document History

| Version | Date        | Author | Changes             |
| ------- | ----------- | ------ | ------------------- |
| 1.0     | Feb 4, 2026 | Claude | Initial action plan |
