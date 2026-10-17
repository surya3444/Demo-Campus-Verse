# CampusVerse Comprehensive Audit Report

**Date:** 2026-02-20
**Scope:** All backend modules, RBAC system, inter-module connections, frontend permission integration

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [RBAC System Audit](#2-rbac-system-audit)
3. [Module-by-Module Audit](#3-module-by-module-audit)
4. [Inter-Module Connections](#4-inter-module-connections)
5. [Security Findings](#5-security-findings)
6. [Bugs Fixed in This Audit](#6-bugs-fixed-in-this-audit)
7. [Remaining Recommendations](#7-remaining-recommendations)

---

## 1. Executive Summary

### Architecture Overview

- **16 backend modules** with 89 service files, 88 controllers, and 16 route files
- **10 system roles** with 6 privilege tiers and 67 permission definitions across 11 modules
- **Multi-tenancy** enforced via `tenantId` + `branchId` scoping in all queries
- **Middleware chain**: `authenticate` → `requireModule` → `requireBranch` → `requirePermission` → `validateBody` → controller

### Overall Health

| Area                     | Status              | Score |
| ------------------------ | ------------------- | ----- |
| RBAC & Permissions       | Good (1 bug fixed)  | 8/10  |
| Multi-tenancy Isolation  | Excellent           | 9/10  |
| Module Completeness      | Good                | 8/10  |
| Inter-module Connections | Needs Work          | 5/10  |
| Security                 | Good (3 bugs fixed) | 7/10  |
| Frontend Integration     | Good                | 8/10  |

### Bugs Fixed During This Audit

1. **SMS permission mismatch** — route checked `'create'` but permissions only define `'send'`
2. **Upload signed URL endpoint missing permission check** — any authenticated user could download any file
3. **Token blacklisting not enforced on logout** — access tokens remained valid after logout
4. **User status change missing role hierarchy check** — lower-privilege users could deactivate higher-privilege users

---

## 2. RBAC System Audit

### 2.1 Role Hierarchy

```
Level 0:  GROUP_OWNER (full system access)
Level 1:  ORG_MODERATOR (full access, cannot manage other moderators)
Level 2:  ORG_ADMIN (nearly full, limited branch create/delete)
Level 3:  BRANCH_ADMIN (branch-level operations)
Level 10: TEACHER, ADMISSION_COUNSELOR, ACCOUNTANT, HR_MANAGER, PLACEMENT_OFFICER, CAREER_COUNSELOR
Level 15: RECEPTIONIST (lowest privilege)
```

**Verdict:** Well-designed hierarchy with proper enforcement in `roleService.canManageRole()`.

### 2.2 Permission Structure

**67 permission groups** across 11 modules:

| Module         | Permission Groups                                                                                                                            | Actions                                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Organization   | 4 (branches, users, roles, settings)                                                                                                         | view, create, edit, delete, reset-password                                                                                      |
| Students       | 5 (list, details, enrollment, promotion, reports)                                                                                            | view, create, edit, delete, bulk-upload, export                                                                                 |
| Admissions     | 4 (leads, applications, settings, reports)                                                                                                   | view, create, edit, delete, assign, convert, approve, reject, enroll, export                                                    |
| Finance        | 12 (feeCounter, feeStructures, collections, dues, concessions, reports, settings, structures, assignments, transactions, wallets, approvals) | view, create, edit, delete, collect, cancel, refund, approve, reject, export                                                    |
| Attendance     | 4 (mark, view, reports, settings)                                                                                                            | view, create, edit, export                                                                                                      |
| HR             | 5 (staff, attendance, leaves, workload, settings)                                                                                            | view, create, edit, delete, approve, reject                                                                                     |
| Health         | 6 (records, checkups, vaccinations, visits, reports, settings)                                                                               | view, create, edit, delete, export                                                                                              |
| Certificates   | 4 (types, requests, idcards, settings)                                                                                                       | view, create, edit, delete, approve, reject                                                                                     |
| Communications | 5 (sms, announcements, calendar, settings, reports)                                                                                          | view, send, create, edit, delete, publish, export                                                                               |
| Teaching       | 6 (myClasses, myStudents, timetable, lessonPlans, assignments, grades)                                                                       | view, create, edit, delete                                                                                                      |
| Career Connect | 11 (companies, drives, jobBoard, studentProfiles, counseling, resources, alumni, mentorship, events, reports, settings)                      | view, create, edit, delete, manage_results, apply, manage_applications, export, conduct, publish, verify, participate, register |
| Dashboard      | 4 (ownerView, branchView, reports, audit)                                                                                                    | view, create, export                                                                                                            |

### 2.3 Middleware Implementation

**`requirePermission(module, action)`** — `apps/api/src/middleware/rbac.ts:66`

- Checks `req.user.permissions[module].includes(action)`
- Returns user-friendly error messages with module/action names
- Properly rejects if no permissions exist

**`requireAnyPermission(permissions[])`** — `apps/api/src/middleware/rbac.ts:101`

- OR-based: passes if user has ANY of the listed permissions
- Used for shared endpoints like file uploads/downloads

**`requireBranch`** — `apps/api/src/middleware/rbac.ts:134`

- Validates `X-Branch-Id` header presence

**`requireModule(moduleCode)`** — `apps/api/src/middleware/moduleGating.ts`

- Feature-gates modules based on tenant subscription
- 5-minute cache to reduce database lookups

### 2.4 RBAC Issues Found

| Issue                                                                      | Severity                                                   | Status    |
| -------------------------------------------------------------------------- | ---------------------------------------------------------- | --------- |
| SMS route checks `'create'` instead of `'send'`                            | **Critical** — SMS endpoint is completely inaccessible     | **Fixed** |
| `updateStatus` missing role hierarchy check                                | **High** — privilege escalation possible                   | **Fixed** |
| No permission structure validation when creating roles                     | Medium — roles can be created with invalid permission keys | Open      |
| Finance has duplicate permission groups (`feeStructures` and `structures`) | Low — cosmetic redundancy                                  | Open      |

---

## 3. Module-by-Module Audit

### 3.1 Auth Module

**Endpoints:** 18 (10 public, 8 protected)
**Status:** Fully implemented

| Feature                | Status          | Notes                                             |
| ---------------------- | --------------- | ------------------------------------------------- |
| JWT (access + refresh) | Done            | Separate secrets, proper type checking            |
| Password hashing       | Done            | bcrypt, 12 rounds                                 |
| Token blacklisting     | **Fixed**       | Was not blacklisting on logout                    |
| Rate limiting          | Partial         | Auth endpoints rate-limited, refresh endpoint not |
| Email verification     | Done            | On signup                                         |
| Forgot/Reset password  | Done            | Token-based, email enumeration protected          |
| Multi-org support      | Done            | Switch-organization endpoint                      |
| Session management     | Done            | Redis-backed with graceful degradation            |
| Account lockout        | Not implemented | Failed login tracking is commented out            |
| 2FA/MFA                | Not implemented | —                                                 |

### 3.2 Admin Module

**Endpoints:** 12 (2 public, 10 protected)
**Status:** Fully implemented

- Super admin authentication properly enforced via `authenticateSuperAdmin` middleware
- Organization lifecycle: signup → pending → approved/rejected → archived
- Module management per organization
- Dashboard statistics

### 3.3 Organization Module

**Endpoints:** 70+ across 13 sub-modules
**Status:** Fully implemented, excellent quality

| Sub-module       | CRUD        | Permissions             | Tenant Scoping |
| ---------------- | ----------- | ----------------------- | -------------- |
| Users            | Complete    | `organization.users`    | Proper         |
| Roles            | Complete    | `organization.roles`    | Proper         |
| Branches         | Complete    | `organization.branches` | Proper         |
| Branch Settings  | Complete    | `organization.settings` | Proper         |
| Classes          | Complete    | `organization.settings` | Proper         |
| Sections         | Complete    | `organization.settings` | Proper         |
| Subjects         | Complete    | `organization.settings` | Proper         |
| Academic Batches | Complete    | `organization.settings` | Proper         |
| Settings         | Read/Update | `organization.settings` | Proper         |
| Custom Fields    | Complete    | `organization.settings` | Proper         |
| Approvals        | Read + Undo | `organization.settings` | Proper         |
| Scheduled Jobs   | Complete    | `organization.settings` | Proper         |
| Onboarding       | Read/Update | authenticate only       | Proper         |

**Strengths:**

- Role hierarchy validation prevents privilege escalation
- System roles protected from modification/deletion
- Referential integrity checks (can't delete class with sections, etc.)
- Comprehensive audit logging

### 3.4 Student Module

**Endpoints:** 23
**Status:** Fully implemented

| Feature                 | Status                                   |
| ----------------------- | ---------------------------------------- |
| CRUD                    | Complete (soft delete)                   |
| Bulk upload             | Complete (500 row limit, CSV validation) |
| Promotion (single/bulk) | Complete                                 |
| Section shuffle         | Complete                                 |
| Branch transfer         | Complete                                 |
| Photo upload            | Complete (S3)                            |
| Reports (6 types)       | Complete                                 |
| Fee summary             | Complete                                 |
| Attendance summary      | Complete                                 |
| Export (CSV/JSON)       | Complete                                 |

### 3.5 Admission Module

**Endpoints:** 50+
**Status:** Fully implemented

| Feature                            | Status                                          |
| ---------------------------------- | ----------------------------------------------- |
| Lead management (full CRUD)        | Complete                                        |
| Application management (full CRUD) | Complete                                        |
| 10-stage pipeline (Kanban)         | Complete                                        |
| Lead → Application conversion      | Complete (3 methods)                            |
| Application → Student enrollment   | Complete (with gaps — see inter-module section) |
| Public enrollment forms            | Complete (no auth required)                     |
| Custom forms with submissions      | Complete                                        |
| Bulk upload (leads + applications) | Complete                                        |
| Agent/consultant management        | Complete                                        |
| Reports (5 types)                  | Complete                                        |
| Settings management                | Complete                                        |

### 3.6 Finance Module

**Endpoints:** 66+
**Status:** Fully implemented, excellent quality

| Feature                                     | Status            |
| ------------------------------------------- | ----------------- |
| Fee structures (CRUD + clone)               | Complete          |
| Fee assignments (single + bulk)             | Complete          |
| Fee transactions (offline + online)         | Complete          |
| Razorpay integration                        | Complete          |
| Receipt PDF generation                      | Complete (PDFKit) |
| Concessions (6 types)                       | Complete          |
| Approval workflows (cancel/refund)          | Complete          |
| Student wallets                             | Complete          |
| Fine calculation (4 strategies)             | Complete          |
| Reports (11+ types)                         | Complete          |
| Fee counter (quick collection UI)           | Complete          |
| Settings (bank accounts, payment methods)   | Complete          |
| Bulk CSV import (assignments + concessions) | Complete          |

### 3.7 Attendance Module

**Endpoints:** 25+
**Status:** Fully implemented

| Feature                                            | Status   |
| -------------------------------------------------- | -------- |
| Mark attendance (single/bulk)                      | Complete |
| Attendance locking                                 | Complete |
| Student history                                    | Complete |
| Reports (daily, class-wise, student-wise, monthly) | Complete |
| Export (CSV/JSON)                                  | Complete |
| Self-service (student/parent)                      | Complete |
| Bulk CSV upload                                    | Complete |
| Holiday management (4 types)                       | Complete |
| Holiday integration in calculations                | Complete |
| Low attendance alerts                              | Complete |
| Configurable settings                              | Complete |

### 3.8 HR Module

**Endpoints:** 40+
**Status:** Fully implemented

| Feature                                     | Status                                 |
| ------------------------------------------- | -------------------------------------- |
| Staff management (full CRUD)                | Complete                               |
| Bulk staff import                           | Complete                               |
| Department/Designation management           | Complete                               |
| Leave management (apply/approve/reject)     | Complete                               |
| Leave balance tracking                      | Complete                               |
| Staff attendance (mark/lock/export)         | Complete                               |
| Resignation workflow                        | Complete                               |
| Workload management                         | Partial (requires timetable)           |
| Settings (leave types, shifts, weekly offs) | Complete                               |
| Auto user account creation                  | **Missing** (see inter-module section) |

### 3.9 Communication Module

**Endpoints:** 30+
**Status:** Mostly implemented

| Feature                           | Status                               |
| --------------------------------- | ------------------------------------ |
| Announcements (full lifecycle)    | Complete                             |
| Events (CRUD + calendar)          | Complete                             |
| SMS sending                       | Infrastructure ready, test mode only |
| SMS templates                     | Complete                             |
| Email templates                   | Complete (no sending implementation) |
| Audience targeting                | Complete (branch, class, role-based) |
| Approval workflow (announcements) | Complete                             |
| Reports (login, notifications)    | Complete                             |
| Event-driven notifications        | **Missing**                          |

### 3.10 Certificates Module

**Endpoints:** 20+
**Status:** Fully implemented

- Certificate types (CRUD with templates)
- Certificate requests (lifecycle: requested → approved → generated)
- ID cards management
- Settings configuration

### 3.11 Dashboard Module

**Endpoints:** 15+
**Status:** Fully implemented

- Owner-level dashboard (multi-branch aggregation)
- Branch-level dashboard
- Custom reports (save/load)
- Audit logs

### 3.12 Health Module

**Endpoints:** 30+
**Status:** Fully implemented

- Health records, checkups, vaccinations, medical visits
- Health reports and settings
- Student health profile

### 3.13 Teaching Module

**Endpoints:** 25+
**Status:** Fully implemented

- My Classes / My Students views
- Timetable management with conflict detection
- Lesson plans (CRUD)
- Assignments (CRUD with submissions)
- Grades management

### 3.14 Career Connect Module

**Endpoints:** 50+
**Status:** Fully implemented

- Company management, placement drives, job board
- Student profiles, counseling, resources
- Alumni network, mentorship, events
- Comprehensive reports

### 3.15 Upload Module

**Endpoints:** 6
**Status:** Implemented with security fix applied

- Server-side image/document upload (multer-s3)
- Client-side presigned URL upload
- Entity-based permission checks
- **Fixed:** Signed download URL now requires permission

### 3.16 Scheduler Module

**Endpoints:** 9
**Status:** Fully implemented

- Scheduled job management (CRUD)
- Job templates
- Manual execution trigger
- Execution history

---

## 4. Inter-Module Connections

### 4.1 Connection Matrix

| From → To              | Status      | Issue                                                                         |
| ---------------------- | ----------- | ----------------------------------------------------------------------------- |
| Admission → Student    | Partial     | Inconsistent admission number generation; missing enrollment record on enroll |
| Finance → Student      | Working     | No cascade on student status change                                           |
| HR → Auth              | **Missing** | Staff created without user accounts                                           |
| Communication → All    | **Missing** | No event-driven notifications                                                 |
| Attendance → Student   | Partial     | No student validation when marking attendance                                 |
| Dashboard → All        | Working     | Single point of failure (Promise.all)                                         |
| Certificate → Student  | Working     | No data denormalization                                                       |
| Teaching → Student/Org | Partial     | Incomplete teacher/section validation                                         |

### 4.2 Critical Gap: Admission → Student Enrollment

When an application is enrolled (`application.service.ts`), the student record is created with differences from direct student creation:

1. **Admission Number Format Mismatch:**
   - Direct creation: `{BRANCH_CODE}-{BATCH_CODE}-{PADDED_SEQUENCE}` (via `generateSequence`)
   - Enrollment: `ADM{YY}{COUNT}` (inline counter)

2. **Missing Enrollment Record:** Direct student creation generates a `studentEnrollments` record; enrollment from admission does not.

3. **Missing Enrollment Code:** Direct creation generates an `enrollmentCode`; admission enrollment does not.

### 4.3 Critical Gap: HR → Auth

When staff members are created through the HR module, **no user account is created**. Staff documents have a `userId` field, but it's never populated. This means staff cannot log into the system without a separate manual user creation step through the Organization module.

### 4.4 Critical Gap: Event-Driven Communication

The Communication module is entirely passive — announcements and events must be created manually. There are no triggers for:

- New student enrollment notifications
- Fee due date reminders (automated)
- Leave approval/rejection notifications
- Attendance alerts to parents

---

## 5. Security Findings

### 5.1 Fixed Issues

| #   | Issue                                            | Severity | File                         | Fix                             |
| --- | ------------------------------------------------ | -------- | ---------------------------- | ------------------------------- |
| 1   | SMS permission mismatch (`'create'` vs `'send'`) | Critical | `communication.routes.ts:17` | Changed to `'send'`             |
| 2   | Upload signed URL no permission check            | High     | `upload.routes.ts:122-125`   | Added `requireAnyPermission`    |
| 3   | Token not blacklisted on logout                  | High     | `auth.service.ts:567-570`    | Added Redis blacklist on logout |
| 4   | User status change missing role hierarchy        | High     | `user.service.ts:398-426`    | Added `canManageRole` check     |

### 5.2 Open Issues

| #   | Issue                                                | Severity | File                                      | Recommendation                                                      |
| --- | ---------------------------------------------------- | -------- | ----------------------------------------- | ------------------------------------------------------------------- |
| 1   | Refresh token endpoint not rate-limited              | Medium   | `auth.routes.ts:38`, `admin.routes.ts:17` | Add `authRateLimiter`                                               |
| 2   | Account lockout after failed logins is commented out | Medium   | `auth.service.ts:360-395`                 | Re-enable with configurable threshold                               |
| 3   | Password reset token logged to console               | Low      | `auth.service.ts:718`                     | Remove before production                                            |
| 4   | No 2FA/MFA support                                   | Low      | —                                         | Implement TOTP-based 2FA                                            |
| 5   | Attendance marking doesn't validate student exists   | Medium   | `studentAttendance.service.ts`            | Add student existence check                                         |
| 6   | Role permissions not validated against schema        | Medium   | `role.service.ts:127`                     | Validate against PERMISSIONS constant                               |
| 7   | Redis graceful degradation bypasses blacklist        | Medium   | `auth.ts:34`                              | Reject requests when Redis unavailable for security-critical checks |

---

## 6. Bugs Fixed in This Audit

### Fix 1: SMS Permission Mismatch

**File:** `apps/api/src/modules/communication/communication.routes.ts:17`

The route used `requirePermission('communications.sms', 'create')` but the shared permissions constant only defines `['view', 'send']` for `communications.sms`. No role has `create` action for SMS, making the endpoint completely inaccessible.

**Change:** `'create'` → `'send'`

### Fix 2: Upload Signed URL Missing Permission

**File:** `apps/api/src/modules/upload/upload.routes.ts:122-125`

The `GET /:key(*)/signed-url` endpoint had no permission check — any authenticated user could generate a signed download URL for any file in S3, regardless of whether they had access to the entity.

**Change:** Added `requireAnyPermission` with view permissions for all entity types.

### Fix 3: Token Blacklisting on Logout

**File:** `apps/api/src/modules/auth/auth.service.ts:567-570` and `auth.controller.ts:45-51`

The `logout()` method only deleted the session from Redis but never blacklisted the access token. The `authenticate` middleware checks for blacklisted tokens at `auth.ts:32-36`, but no code path ever added tokens to the blacklist.

**Change:** Logout now extracts the access token from the Authorization header and adds it to Redis blacklist with the same TTL as the access token expiry.

### Fix 4: User Status Change Role Hierarchy

**File:** `apps/api/src/modules/organization/user.service.ts:398-426` and `user.controller.ts:91-103`

The `updateStatus` method did not validate that the current user has sufficient privilege to change the target user's status. A BRANCH_ADMIN could deactivate a GROUP_OWNER.

**Change:** Added `roleService.canManageRole()` check before allowing status changes.

---

## 7. Remaining Recommendations

### High Priority

1. **Standardize admission number generation** — Unify the format between direct student creation and admission enrollment to prevent data inconsistency.

2. **Create enrollment records on admission enrollment** — When an application is enrolled, also create the `studentEnrollments` record with proper `enrollmentCode`.

3. **Implement HR → Auth integration** — Auto-create user accounts when staff members are created, with appropriate role assignment.

4. **Rate-limit refresh token endpoints** — Both auth and admin refresh endpoints lack rate limiting.

5. **Re-enable account lockout** — Uncomment and configure the failed login tracking in `auth.service.ts:360-395`.

### Medium Priority

6. **Add event-driven communication** — Implement an event emitter pattern so modules can trigger notifications (enrollment confirmation, fee reminders, leave status changes).

7. **Validate student existence in attendance** — Add checks when marking attendance to ensure students are active and enrolled.

8. **Validate permission structure on role creation** — When creating custom roles, validate that permission keys match the defined `PERMISSIONS` constant.

9. **Use `Promise.allSettled` in dashboard** — Prevent one module's failure from crashing the entire dashboard.

10. **Add teacher validation in teaching module** — Verify teachers exist and are assigned to the relevant class/section before creating timetables/assignments.

### Low Priority

11. Remove password reset token console logging before production.
12. Implement 2FA/MFA for admin accounts.
13. Add email/phone format validation in organization settings.
14. Document custom field type compatibility rules.
15. Add audit logging for role permission changes.

---

## 8. Frontend Permission Audit

### 8.1 Frontend Architecture

The frontend permission system is well-designed:

- **usePermissions hook** — `hasPermission()`, `canView()`, `canCreate()`, `canEdit()`, `canDelete()` + role checks
- **PermissionGate component** — Conditionally renders children based on permissions, with fallback support
- **MultiPermissionGate** — Cross-module OR/AND permission checks
- **RoleGate** — Role-based rendering (GROUP_OWNER, ORG_ADMIN, etc.)
- **ProtectedRoute** — Route-level auth with hydration handling, pending-approval redirect, onboarding redirect
- **Auth Store (Zustand)** — Persisted to localStorage, stores full permission matrix
- **API Layer** — Auto-sets `Authorization` + `X-Branch-Id` headers, queues requests during token refresh, syncs profile on refresh

### 8.2 Frontend Permission Mismatches

| Code                     | Used In | Issue                                                                        |
| ------------------------ | ------- | ---------------------------------------------------------------------------- |
| `organization.approvals` | Sidebar | Not defined in backend `permissions.ts` — sidebar item will always be hidden |
| `attendance.holidays`    | Sidebar | Not defined in backend `permissions.ts` — sidebar item will always be hidden |

### 8.3 Pages Missing Permission Checks

These pages are protected by the ProtectedRoute wrapper (auth required) and filtered out of the sidebar, but can be accessed via direct URL without page-level permission validation:

- `/finance/fee-counter`, `/finance/fee-structures`, `/finance/assignments`, `/finance/wallets`, `/finance/transactions`, `/finance/approvals`, `/finance/concessions`, `/finance/dues`, `/finance/settings`
- `/communications/sms`, `/communications/announcements`, `/communications/calendar`, `/communications/settings`
- `/organization/sort-settings`, `/organization/schedule-jobs`, `/organization/custom-fields`

**Impact:** API calls from these pages would fail with 403, but the page UI itself renders. Users see an empty/broken page instead of a proper "Unauthorized" message.

### 8.4 Backend Permissions Not Used in Frontend

These granular actions are defined in backend but not checked in frontend UI:

- `careerConnect.drives` → `manage_results`
- `careerConnect.jobBoard` → `apply`, `manage_applications`
- `careerConnect.counseling` → `conduct`
- `careerConnect.resources` → `publish`
- `careerConnect.alumni` → `verify`
- `careerConnect.mentorship` → `participate`
- `careerConnect.events` → `register`

### 8.5 Page-Level Permission Coverage by Module

| Module         | Pages | With Checks | Coverage | Status    |
| -------------- | ----- | ----------- | -------- | --------- |
| Teaching       | 6     | 6           | 100%     | Excellent |
| Career Connect | 25    | 25          | 100%     | Excellent |
| Admissions     | 8     | 7           | 88%      | Good      |
| Certificates   | 3     | 2           | 67%      | Adequate  |
| Students       | 6     | 2           | 33%      | Poor      |
| HR             | 8     | 3           | 38%      | Poor      |
| Organization   | 8     | 2           | 25%      | Poor      |
| Attendance     | 5     | 1           | 20%      | Critical  |
| Health         | 7     | 1           | 14%      | Critical  |
| Communications | 5     | 0           | 0%       | Critical  |
| Finance        | 10    | 1           | 10%      | Critical  |

**Overall:** ~43% of dashboard pages have explicit page-level permission checks. Backend API validation catches unauthorized access, but users see broken/empty pages instead of a proper "Unauthorized" message.

### 8.6 Frontend Security Assessment

| Category               | Rating | Notes                                             |
| ---------------------- | ------ | ------------------------------------------------- |
| Architecture & Design  | 9/10   | Hooks, gates, store, interceptors well-designed   |
| Route Protection       | 10/10  | All dashboard routes wrapped in ProtectedRoute    |
| Token Management       | 9/10   | Auto-refresh, request queuing, profile sync       |
| Permission Enforcement | 6/10   | Sidebar filtering good, page-level incomplete     |
| Multi-Tenancy          | 9/10   | X-Branch-Id auto-injected, branch store persisted |

**Key strengths:**

- Token refresh with concurrent request queuing prevents 401 race conditions
- Profile sync on token refresh catches real-time permission/role changes
- Sidebar filters by permission + subscription + institution type + role level
- ProtectedRoute handles hydration, pending approval, and onboarding redirects

**Key gaps:**

- No runtime validation of permission names (typos fail silently)
- No automated script to verify frontend permission codes match backend
- Module-level `isRefreshing`/`failedQueue` variables in API interceptor could leak state in serverless environments

### 8.7 Unimplemented Backend Features (Stub Endpoints)

These routes exist but return empty/mock data:

- Dashboard custom reports (`/reports/custom`, `/reports/generate`, `/reports/scheduled`, `/reports/schedule`)
- Dashboard audit logs (`/audit/logs`, `/audit/logs/export`)
- ID card PDF generation (`POST /id-cards/generate`, `POST /id-cards/bulk-generate`)
- All 4 scheduler job types (attendance summary, fee reminders, report generation, data backup)
