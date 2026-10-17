# Campus Verse - User Roles & Flows Documentation

**Last Updated:** February 4, 2026
**Version:** 1.0

This document outlines the current user role flows, identified gaps, and recommended changes for the Campus Verse ERP system.

---

## Table of Contents

1. [Role Hierarchy Overview](#1-role-hierarchy-overview)
2. [Super Admin](#2-super-admin)
3. [Group Owner](#3-group-owner)
4. [Org Moderator](#4-org-moderator)
5. [Org Admin](#5-org-admin)
6. [Branch Admin](#6-branch-admin)
7. [Future Roles (To Be Added)](#7-future-roles-to-be-added)
8. [Cross-Role Features](#8-cross-role-features)
9. [Implementation Priority](#9-implementation-priority)

---

## 1. Role Hierarchy Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      SUPER ADMIN                                │
│              (Platform-level, separate auth)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TENANT ORGANIZATION                          │
├─────────────────────────────────────────────────────────────────┤
│  Level 0: GROUP_OWNER      → Full control over organization     │
│      │                                                          │
│      ▼                                                          │
│  Level 1: ORG_MODERATOR    → Same as owner, limited role mgmt   │
│      │                                                          │
│      ▼                                                          │
│  Level 2: ORG_ADMIN        → Full operational, no org settings  │
│      │                                                          │
│      ▼                                                          │
│  Level 3: BRANCH_ADMIN     → Single branch operations only      │
└─────────────────────────────────────────────────────────────────┘
```

### Role Scope Summary

| Role          | Scope                 | Can Create Users        | Can Delete | Settings Access   |
| ------------- | --------------------- | ----------------------- | ---------- | ----------------- |
| Super Admin   | Platform              | N/A                     | N/A        | Platform settings |
| Group Owner   | Global (all branches) | All roles               | Yes        | Full              |
| Org Moderator | Global                | ORG_ADMIN, BRANCH_ADMIN | Yes        | Full              |
| Org Admin     | Global                | BRANCH_ADMIN only       | Limited    | View only         |
| Branch Admin  | Single branch         | None                    | No         | View only         |

---

## 2. Super Admin

### Current Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  /admin/     │────▶│   Review     │────▶│   Approve/   │
│   login      │     │   Signups    │     │   Reject     │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   Manage     │
                     │   Modules    │
                     └──────────────┘
```

### Current Capabilities

| Feature               | Status      | Notes                         |
| --------------------- | ----------- | ----------------------------- |
| Login (separate auth) | ✅ Complete | `/admin/login`                |
| View pending signups  | ✅ Complete | `/admin/organizations`        |
| Approve organizations | ✅ Complete | Creates tenant + user + roles |
| Reject organizations  | ✅ Complete | With rejection reason         |
| Update org modules    | ✅ Complete | Enable/disable features       |
| View approved orgs    | ✅ Complete | Filter by status              |
| Archive signups       | ✅ Complete | Soft delete                   |

### What Needs to Be Added

| Feature                 | Priority | Description                           |
| ----------------------- | -------- | ------------------------------------- |
| Subscription management | HIGH     | Manage plans (starter/pro/enterprise) |
| Tenant suspension       | HIGH     | Suspend/reactivate organizations      |
| Usage analytics         | MEDIUM   | View tenant usage statistics          |
| Bulk operations         | MEDIUM   | Approve/reject multiple at once       |
| Audit logs              | MEDIUM   | Track all admin actions               |
| System settings         | LOW      | Platform-wide configurations          |
| Support ticket view     | LOW      | View tenant support requests          |

### What Needs to Be Changed

| Current                       | Change To                | Reason                       |
| ----------------------------- | ------------------------ | ---------------------------- |
| Manual module selection       | Module packages/bundles  | Simplify approval process    |
| No subscription expiry alerts | Add expiry notifications | Prevent service interruption |

### What Should Be Removed

- None identified

---

## 3. Group Owner

### Current Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Signup     │────▶│   Verify     │────▶│   Wait for   │
│   /signup    │     │   Email      │     │   Approval   │
└──────────────┘     └──────────────┘     └──────────────┘
                                                │
                                                ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Daily      │◀────│   Setup      │◀────│   First      │
│   Operations │     │   Org        │     │   Login      │
└──────────────┘     └──────────────┘     └──────────────┘
```

### Current Capabilities

#### Organization Management

| Feature                | Status      | Location                            |
| ---------------------- | ----------- | ----------------------------------- |
| View/Edit org settings | ✅ Complete | `/organization/settings`            |
| Manage branches        | ✅ Complete | `/organization/branches`            |
| Manage users           | ✅ Complete | `/organization/users`               |
| Manage roles           | ✅ Complete | `/organization/roles`               |
| Academic structure     | ✅ Complete | `/organization/academic-structure`  |
| Custom fields          | ✅ Complete | `/organization/custom-fields`       |
| Schedule jobs          | ✅ Complete | `/organization/schedule-jobs`       |
| Sort settings          | ✅ Complete | `/organization/sort-settings`       |
| Approvals              | ⚠️ Partial  | `/organization/approvals` (no undo) |

#### Students Module

| Feature           | Status      | Location                  |
| ----------------- | ----------- | ------------------------- |
| View all students | ✅ Complete | `/students`               |
| Add students      | ✅ Complete | Via enrollment            |
| Edit students     | ✅ Complete | Student details page      |
| Bulk upload       | ✅ Complete | `/students/bulk-upload`   |
| Promote students  | ✅ Complete | `/students/promote`       |
| Shuffle students  | ❌ Missing  | Transfer between classes  |
| Branch shifts     | ❌ Missing  | Transfer between branches |

#### Admissions Module

| Feature          | Status      | Location                         |
| ---------------- | ----------- | -------------------------------- |
| Leads management | ✅ Complete | `/admissions/leads`              |
| Pipeline view    | ✅ Complete | `/admissions`                    |
| Applications     | ✅ Complete | `/admissions/applications`       |
| Settings         | ⚠️ Partial  | `/admissions/settings`           |
| Followups        | ❌ Missing  | `/admissions/followups` (stub)   |
| Bulk upload      | ❌ Missing  | `/admissions/bulk-upload` (stub) |
| Dynamic forms    | ❌ Missing  | `/admissions/forms` (stub)       |

#### Finance Module

| Feature        | Status      | Location                       |
| -------------- | ----------- | ------------------------------ |
| Fee counter    | ✅ Complete | `/finance/fee-counter`         |
| Fee structures | ✅ Complete | `/finance/fee-structures`      |
| Assignments    | ✅ Complete | `/finance/assignments`         |
| Concessions    | ✅ Complete | `/finance/concessions`         |
| Wallets        | ✅ Complete | `/finance/wallets`             |
| Approvals      | ⚠️ Partial  | `/finance/approvals` (no undo) |
| Reports        | ⚠️ Partial  | `/finance/reports`             |
| Settings       | ⚠️ Partial  | `/finance/settings`            |

#### HR Module

| Feature          | Status      | Location               |
| ---------------- | ----------- | ---------------------- |
| Staff management | ✅ Complete | `/hr/staff`            |
| Departments      | ✅ Complete | `/hr/departments`      |
| Staff attendance | ⚠️ Partial  | `/hr/attendance`       |
| Leaves           | ⚠️ Partial  | `/hr/leaves`           |
| Workload         | ✅ Complete | `/hr/workload`         |
| Reports          | ✅ Complete | `/hr/reports`          |
| Settings         | ⚠️ Partial  | `/hr/settings`         |
| Leave approval   | ❌ Missing  | `/hr/approvals` (stub) |
| Shifts           | ❌ Missing  | Not implemented        |
| Weekly offs      | ❌ Missing  | Not implemented        |
| Holidays         | ❌ Missing  | Not implemented        |

#### Communications Module

| Feature           | Status      | Location                        |
| ----------------- | ----------- | ------------------------------- |
| SMS sending       | ✅ Complete | `/communications/sms`           |
| Announcements     | ✅ Complete | `/communications/announcements` |
| Event calendar    | ✅ Complete | `/communications/calendar`      |
| Settings          | ⚠️ Partial  | `/communications/settings`      |
| Templates         | ❌ Missing  | Not implemented                 |
| Approval workflow | ❌ Missing  | Not implemented                 |

#### Certificates Module

| Feature              | Status      | Location                  |
| -------------------- | ----------- | ------------------------- |
| Certificate requests | ✅ Complete | `/certificates`           |
| ID cards             | ✅ Complete | `/certificates` (tab)     |
| Templates            | ⚠️ Partial  | `/certificates/templates` |
| Issue certificates   | ❌ Missing  | Not implemented           |

### What Needs to Be Added

| Feature                  | Priority | Description                       |
| ------------------------ | -------- | --------------------------------- |
| Onboarding wizard        | HIGH     | Guided first-time setup flow      |
| Setup progress indicator | HIGH     | Show what's configured vs pending |
| Dashboard customization  | MEDIUM   | Drag-and-drop widgets             |
| Organization analytics   | MEDIUM   | Cross-branch performance metrics  |
| Notification center      | MEDIUM   | Centralized notifications         |
| Activity timeline        | LOW      | Recent actions across org         |
| Data export (GDPR)       | LOW      | Export all organization data      |

### What Needs to Be Changed

| Current                 | Change To                | Reason                |
| ----------------------- | ------------------------ | --------------------- |
| No setup guidance       | Add onboarding checklist | Reduce support burden |
| Generic dashboard       | Role-specific dashboard  | Better UX             |
| Manual branch selection | Remember last branch     | Convenience           |
| No bulk user creation   | Add bulk user import     | Efficiency            |

### What Should Be Removed

- None identified (all features valuable for this role)

---

## 4. Org Moderator

### Current Flow

Same as Group Owner, but with restrictions on role management.

### Current Capabilities

**Same as Group Owner EXCEPT:**

| Restriction                     | Description                |
| ------------------------------- | -------------------------- |
| Cannot create GROUP_OWNER       | Cannot assign highest role |
| Cannot create ORG_MODERATOR     | Cannot create peers        |
| Cannot edit GROUP_OWNER users   | Cannot modify owner        |
| Cannot delete GROUP_OWNER users | Cannot remove owner        |

### What Needs to Be Added

| Feature                  | Priority | Description                                 |
| ------------------------ | -------- | ------------------------------------------- |
| Clear role limitation UI | HIGH     | Show why certain actions disabled           |
| Delegation workflow      | MEDIUM   | Request owner to perform restricted actions |

### What Needs to Be Changed

| Current                               | Change To                  | Reason                |
| ------------------------------------- | -------------------------- | --------------------- |
| Same dashboard as owner               | Slightly different metrics | Reflect actual access |
| Silent failures on restricted actions | Clear error messages       | Better UX             |

### What Should Be Removed

- None identified

---

## 5. Org Admin

### Current Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    Login     │────▶│   Select     │────▶│   Daily      │
│              │     │   Branch     │     │   Operations │
└──────────────┘     └──────────────┘     └──────────────┘
```

### Current Capabilities

#### Full Access

| Module         | Capabilities                            |
| -------------- | --------------------------------------- |
| Students       | View, Create, Edit, Bulk upload, Export |
| Admissions     | All lead and application operations     |
| Finance        | Fee collection, reports, concessions    |
| HR             | Staff management, attendance, leaves    |
| Attendance     | Mark, view, reports                     |
| Communications | SMS, announcements, calendar            |
| Certificates   | Requests, templates                     |

#### Restricted Access

| Feature               | Access Level | Notes                     |
| --------------------- | ------------ | ------------------------- |
| Branches              | View only    | Cannot create/edit/delete |
| Organization settings | View only    | Cannot modify             |
| Roles                 | View only    | Cannot create/edit/delete |
| User deletion         | Not allowed  | Can only create/edit      |

### What Needs to Be Added

| Feature               | Priority | Description                            |
| --------------------- | -------- | -------------------------------------- |
| Request workflow      | HIGH     | Request branch creation from owner     |
| Operational dashboard | HIGH     | Focus on daily tasks, not org settings |
| Quick actions         | MEDIUM   | Common tasks on dashboard              |
| Team management       | MEDIUM   | Manage users under their supervision   |

### What Needs to Be Changed

| Current                       | Change To                     | Reason           |
| ----------------------------- | ----------------------------- | ---------------- |
| Shows organization menu items | Hide or gray out              | Reduce confusion |
| Same dashboard as owner       | Operational-focused dashboard | Role clarity     |
| Full sidebar visibility       | Filter by permissions         | Cleaner UX       |

### What Should Be Removed

| Feature                            | Reason                   |
| ---------------------------------- | ------------------------ |
| Organization settings edit buttons | Role doesn't have access |
| Branch create/delete buttons       | Should not appear at all |
| Role management actions            | View only appropriate    |

---

## 6. Branch Admin

### Current Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    Login     │────▶│   Auto-set   │────▶│   Branch     │
│              │     │   Branch     │     │   Operations │
└──────────────┘     └──────────────┘     └──────────────┘
```

### Current Capabilities

#### Allowed Operations

| Module         | Capabilities                                     |
| -------------- | ------------------------------------------------ |
| Students       | View, Create, Edit (no delete)                   |
| Admissions     | View, Create, Edit, Assign, Convert (no delete)  |
| Finance        | View, Collect fees (no refund/cancel)            |
| HR             | View, Create, Edit staff (no delete)             |
| Attendance     | Mark, View                                       |
| Communications | View, Send SMS, Create announcements (no delete) |

#### Not Allowed

| Feature               | Restriction                 |
| --------------------- | --------------------------- |
| Delete operations     | Any module                  |
| Refunds/Cancellations | Finance module              |
| Leave approvals       | Can only apply, not approve |
| Settings changes      | Any module                  |
| Other branches        | Access blocked              |

### What Needs to Be Added

| Feature                  | Priority | Description                           |
| ------------------------ | -------- | ------------------------------------- |
| Branch-focused dashboard | HIGH     | Only branch metrics                   |
| Request escalation       | HIGH     | Request deletions, refunds from admin |
| Auto branch selection    | HIGH     | Don't show branch picker              |
| Daily task checklist     | MEDIUM   | Mark attendance, collect fees, etc.   |
| Quick reports            | MEDIUM   | Branch-specific quick stats           |

### What Needs to Be Changed

| Current                         | Change To                 | Reason                     |
| ------------------------------- | ------------------------- | -------------------------- |
| Shows branch picker             | Auto-select only branch   | Single branch access       |
| Full sidebar                    | Heavily filtered sidebar  | Only show accessible items |
| Organization menu visible       | Hide completely           | No access anyway           |
| Generic dashboard               | Branch-specific dashboard | Relevance                  |
| Shows delete buttons (disabled) | Don't render at all       | Cleaner UI                 |

### What Should Be Removed

| Feature                         | Reason                      |
| ------------------------------- | --------------------------- |
| Organization section in sidebar | No access                   |
| Branch selection dropdown       | Only one branch             |
| Delete buttons everywhere       | Cannot delete anything      |
| Settings links                  | View-only not useful        |
| Cross-branch reports            | No access to other branches |

---

## 7. Future Roles (To Be Added)

### 7.1 Teacher/Faculty Role

**Priority:** HIGH (Required for academics module)

```
Scope: Department/Subject level
Level: 4 (below BRANCH_ADMIN)
```

| Capability     | Access                             |
| -------------- | ---------------------------------- |
| Own classes    | View students, mark attendance     |
| Grades         | Enter grades for assigned subjects |
| Timetable      | View own schedule                  |
| Assignments    | Create, grade assignments          |
| Communications | Send to own class students         |
| Leave          | Apply for own leave                |

### 7.2 Accountant Role

**Priority:** MEDIUM

```
Scope: Branch level (finance only)
Level: 4
```

| Capability     | Access                        |
| -------------- | ----------------------------- |
| Fee collection | Full access                   |
| Reports        | Financial reports only        |
| Concessions    | Create requests (not approve) |
| Wallets        | View, manage                  |
| Refunds        | Create requests               |

### 7.3 HR Manager Role

**Priority:** MEDIUM

```
Scope: Organization level (HR only)
Level: 3
```

| Capability       | Access              |
| ---------------- | ------------------- |
| Staff management | Full CRUD           |
| Leave approvals  | Full access         |
| Attendance       | Mark, view, reports |
| Payroll          | When implemented    |
| Settings         | HR settings only    |

### 7.4 Student/Parent Role

**Priority:** HIGH (for portal)

```
Scope: Own data only
Level: 5 (lowest)
```

| Capability     | Access                   |
| -------------- | ------------------------ |
| Profile        | View own details         |
| Fees           | View dues, make payments |
| Attendance     | View own attendance      |
| Grades         | View own grades          |
| Communications | Receive announcements    |
| Certificates   | Request certificates     |

### 7.5 Admission Counselor Role

**Priority:** MEDIUM

```
Scope: Admission module only
Level: 4
```

| Capability   | Access                 |
| ------------ | ---------------------- |
| Leads        | Full management        |
| Applications | Create, edit, process  |
| Followups    | Full access            |
| Reports      | Admission reports only |
| Enrollment   | Initiate enrollment    |

---

## 8. Cross-Role Features

### 8.1 Authentication & Session

| Feature             | Current Status | Needs Change        |
| ------------------- | -------------- | ------------------- |
| JWT tokens          | ✅ Working     | No                  |
| Refresh tokens      | ✅ Working     | No                  |
| Session management  | ✅ Working     | Add device tracking |
| Multi-org switching | ✅ Working     | No                  |
| Password reset      | ✅ Working     | No                  |
| 2FA                 | ❌ Missing     | Add for admins      |

### 8.2 Permissions Enforcement

| Layer                 | Current Status | Needs Change                     |
| --------------------- | -------------- | -------------------------------- |
| Backend middleware    | ✅ Working     | No                               |
| Frontend route guards | ✅ Working     | No                               |
| UI button visibility  | ⚠️ Partial     | Some buttons shown when disabled |
| API validation        | ✅ Working     | No                               |

### 8.3 Audit & Logging

| Feature             | Current Status | Needs Change           |
| ------------------- | -------------- | ---------------------- |
| Login logs          | ✅ Working     | No                     |
| Action audit        | ⚠️ Partial     | Expand coverage        |
| Data change history | ❌ Missing     | Add for sensitive data |
| Export logs         | ❌ Missing     | Add for compliance     |

---

## 9. Implementation Priority

### Phase 1: Critical Fixes (Sprint 1)

| Task                                   | Role Affected              | Effort |
| -------------------------------------- | -------------------------- | ------ |
| Role-based dashboards                  | All                        | Medium |
| Hide inaccessible UI elements          | ORG_ADMIN, BRANCH_ADMIN    | Low    |
| Undo approvals                         | GROUP_OWNER, ORG_MODERATOR | Medium |
| Approval email settings                | GROUP_OWNER                | Medium |
| Auto branch selection for BRANCH_ADMIN | BRANCH_ADMIN               | Low    |

### Phase 2: Missing Features (Sprint 2-3)

| Task                              | Role Affected | Effort |
| --------------------------------- | ------------- | ------ |
| HR: Shifts, Weekly offs, Holidays | All           | High   |
| Leave approval workflow           | All           | Medium |
| Admission: Followups              | All           | Medium |
| Finance: Total paid/due report    | All           | Medium |
| Onboarding wizard                 | GROUP_OWNER   | High   |

### Phase 3: New Roles (Sprint 4-5)

| Task                     | Priority | Effort    |
| ------------------------ | -------- | --------- |
| Teacher role             | HIGH     | High      |
| Student/Parent portal    | HIGH     | Very High |
| Accountant role          | MEDIUM   | Medium    |
| HR Manager role          | MEDIUM   | Medium    |
| Admission Counselor role | MEDIUM   | Medium    |

### Phase 4: Enhancements (Backlog)

| Task                    | Role Affected | Effort |
| ----------------------- | ------------- | ------ |
| 2FA for admins          | Admin roles   | Medium |
| Audit log export        | All           | Medium |
| Dashboard customization | All           | High   |
| Notification center     | All           | Medium |
| Activity timeline       | All           | Low    |

---

## Appendix A: Permission Matrix

### Organization Module

| Permission      | GROUP_OWNER | ORG_MODERATOR | ORG_ADMIN | BRANCH_ADMIN |
| --------------- | ----------- | ------------- | --------- | ------------ |
| branches:view   | ✅          | ✅            | ✅        | ✅           |
| branches:create | ✅          | ✅            | ❌        | ❌           |
| branches:edit   | ✅          | ✅            | ❌        | ❌           |
| branches:delete | ✅          | ✅            | ❌        | ❌           |
| users:view      | ✅          | ✅            | ✅        | ✅           |
| users:create    | ✅          | ✅            | ✅        | ❌           |
| users:edit      | ✅          | ✅            | ✅        | ✅           |
| users:delete    | ✅          | ✅            | ❌        | ❌           |
| roles:view      | ✅          | ✅            | ✅        | ✅           |
| roles:create    | ✅          | ✅            | ❌        | ❌           |
| roles:edit      | ✅          | ✅            | ❌        | ❌           |
| roles:delete    | ✅          | ✅            | ❌        | ❌           |
| settings:view   | ✅          | ✅            | ✅        | ✅           |
| settings:edit   | ✅          | ✅            | ❌        | ❌           |

### Students Module

| Permission       | GROUP_OWNER | ORG_MODERATOR | ORG_ADMIN | BRANCH_ADMIN |
| ---------------- | ----------- | ------------- | --------- | ------------ |
| list:view        | ✅          | ✅            | ✅        | ✅           |
| list:create      | ✅          | ✅            | ✅        | ✅           |
| list:edit        | ✅          | ✅            | ✅        | ✅           |
| list:delete      | ✅          | ✅            | ✅        | ❌           |
| list:bulk-upload | ✅          | ✅            | ✅        | ✅           |
| list:export      | ✅          | ✅            | ✅        | ✅           |

### Finance Module

| Permission          | GROUP_OWNER | ORG_MODERATOR | ORG_ADMIN | BRANCH_ADMIN |
| ------------------- | ----------- | ------------- | --------- | ------------ |
| feeCounter:view     | ✅          | ✅            | ✅        | ✅           |
| feeCounter:collect  | ✅          | ✅            | ✅        | ✅           |
| feeCounter:cancel   | ✅          | ✅            | ✅        | ❌           |
| feeCounter:refund   | ✅          | ✅            | ✅        | ❌           |
| concessions:approve | ✅          | ✅            | ✅        | ❌           |
| concessions:reject  | ✅          | ✅            | ✅        | ❌           |
| settings:edit       | ✅          | ✅            | ✅        | ❌           |

### HR Module

| Permission     | GROUP_OWNER | ORG_MODERATOR | ORG_ADMIN | BRANCH_ADMIN |
| -------------- | ----------- | ------------- | --------- | ------------ |
| staff:view     | ✅          | ✅            | ✅        | ✅           |
| staff:create   | ✅          | ✅            | ✅        | ✅           |
| staff:edit     | ✅          | ✅            | ✅        | ✅           |
| staff:delete   | ✅          | ✅            | ✅        | ❌           |
| leaves:approve | ✅          | ✅            | ✅        | ❌           |
| leaves:reject  | ✅          | ✅            | ✅        | ❌           |
| settings:edit  | ✅          | ✅            | ✅        | ❌           |

---

## Appendix B: API Endpoints by Role Access

### Public Endpoints (No Auth)

- `POST /auth/login`
- `POST /auth/signup`
- `POST /auth/verify-email`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/refresh-token`

### Authenticated (All Roles)

- `GET /auth/me`
- `POST /auth/logout`
- `GET /dashboard/stats`
- `GET /students` (filtered by branch access)
- `GET /attendance/*` (filtered by branch access)

### Admin Only (GROUP_OWNER, ORG_MODERATOR)

- `POST /organization/branches`
- `PUT /organization/branches/:id`
- `DELETE /organization/branches/:id`
- `POST /organization/roles`
- `PUT /organization/roles/:id`
- `DELETE /organization/roles/:id`
- `PUT /organization/settings`

### Super Admin Only

- `GET /admin/organizations`
- `POST /admin/organizations/:id/approve`
- `POST /admin/organizations/:id/reject`
- `PUT /admin/organizations/:id/modules`

---

## Appendix C: File References

| Purpose            | Location                                          |
| ------------------ | ------------------------------------------------- |
| Role definitions   | `packages/shared/src/constants/roles.ts`          |
| Permission matrix  | `packages/shared/src/constants/permissions.ts`    |
| User types         | `packages/shared/src/types/organization.ts`       |
| Auth middleware    | `apps/api/src/middleware/auth.ts`                 |
| RBAC middleware    | `apps/api/src/middleware/rbac.ts`                 |
| Permission hook    | `apps/web/src/hooks/usePermissions.ts`            |
| Sidebar navigation | `apps/web/src/components/layout/Sidebar.tsx`      |
| Protected routes   | `apps/web/src/components/auth/ProtectedRoute.tsx` |

---

## Document History

| Version | Date        | Changes               |
| ------- | ----------- | --------------------- |
| 1.0     | Feb 4, 2026 | Initial documentation |
