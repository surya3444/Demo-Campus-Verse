# CampusVerse — Feature Checklist

> **Last Updated:** February 5, 2026
>
> **Legend:**
>
> - `[x]` Implemented — Backend endpoint exists AND frontend UI integrates with it
> - `[~]` Partially implemented — Backend exists but frontend is stub/mock, or UI exists without API integration
> - `[ ]` Not yet built — Planned but no code

---

## 1. Auth

### Core Authentication

- [x] Signup / Org Registration — POST `/auth/signup` + `/signup` page with institution type, module selection, email verification flow
- [x] Login (email + password) — POST `/auth/login` + `/login` page with error handling, password reveal
- [x] JWT access & refresh tokens — Automatic refresh via Axios interceptor with request queuing
- [x] Password reset (forgot password) — POST `/auth/forgot-password` & `/auth/reset-password` + dedicated pages
- [x] Email verification — POST `/auth/verify-email` + `/verify-email` page with token-from-URL flow
- [x] Logout — POST `/auth/logout` & `/auth/logout-all` + TopBar logout button with state cleanup
- [x] Session management — Device tracking, token rotation, httpOnly cookies, auto-refresh on 401

### Multi-Org

- [x] Organization switching — POST `/auth/switch-organization` + `OrganizationSwitcher` component
- [x] Payment flow / subscription — Razorpay integration with `/auth/organizations/create-order` & `/verify-payment` + `AddOrganizationModal` (info → payment → success)

### Profile

- [~] User personal profile page — `/profile` referenced in TopBar but page does not exist

---

## 2. Organization

### Branches

- [x] Branch CRUD — GET/POST/PUT/DELETE `/organization/branches` + `/organization/branches` page with DataTable, stats
- [x] Quick branch creation — Create from TopBar popover
- [x] Branch settings — GET/PUT `/organization/branches/:branchId/settings` + dedicated settings page

### Users & Roles

- [x] User CRUD — GET/POST/PUT/DELETE `/organization/users` + page with filters (role, branch, status), avatar, access scope config
- [x] Role CRUD — GET/POST/PUT/DELETE `/organization/roles` + page with permission matrix editor, system role indicators
- [x] Custom roles — Create roles with per-module permission sets (view/create/edit/delete)

### Academic Structure

- [x] Classes / Sections / Subjects — Full CRUD endpoints + `/organization/academic-structure` page with hierarchy tree, nested creation, teacher assignment
- [x] Academic batches — Full CRUD + set current batch, date ranges, status (active/upcoming/completed)
- [x] Subject library — Integrated in academic structure page

### Settings & Config

- [x] Organization settings — Tabbed interface: General, Contact, Legal (GST/PAN), Branding (logo/colors), Modules, Academic Hierarchy naming
- [x] Custom fields — GET/POST/PUT/DELETE `/organization/custom-fields` + page with field types (text, number, date, dropdown, checkbox, file, textarea), module scoping, reorder
- [x] Approval workflows — GET pending/history, POST undo + `/organization/approvals` page with pending & history tabs
- [~] Approval settings — GET/PUT endpoint exists; settings page minimal
- [x] Scheduled jobs — Full CRUD + `/organization/schedule-jobs` page with schedule types (once/daily/weekly/monthly/cron), manual execution, execution history

---

## 3. Admission

### Pipeline & Kanban

- [x] Pipeline / Kanban board — GET `/admissions/pipeline` + Kanban, list, Gantt, and calendar views with drag-drop stage transitions
- [x] Lead stage transitions — PUT `/admissions/leads/:id/stage` + drag-drop and stage selection in Kanban/list views
- [x] Application stage management — PUT `/admissions/applications/:id/status` + applications page with status filters

### Leads

- [x] Lead CRUD — POST/GET/PUT/DELETE `/admissions/leads` + Add Lead dialog, detail sheet
- [x] Lead followups — POST `/admissions/leads/:id/followup`, PUT `/:followupIndex/complete` + dedicated followups page with due/overdue tracking
- [x] Lead statistics — GET `/admissions/leads/stats`
- [~] Leads list page — Page exists but uses mock data instead of API integration

### Applications

- [x] Application creation — POST `/admissions/leads/:id/convert` + convert from Kanban card detail sheet
- [x] Quick enroll — POST `/admissions/applications/:id/enroll` + quick enroll dialog in applications page
- [x] Application list — GET `/admissions/applications` with status filters, pagination

### Bulk Operations

- [x] Bulk lead upload — POST `/admissions/bulk-upload/leads` + GET template + dedicated bulk upload page with validation and error reporting
- [x] Bulk application upload — POST `/admissions/bulk-upload/applications` + shared upload page with academic batch selection

### Dynamic Forms

- [x] Form builder — POST/GET/PUT/DELETE `/admissions/forms` + form builder page with field editor
- [x] Form submissions — GET/POST `/admissions/forms/:slug/submit` + submissions tracking page
- [x] Public web forms — GET/POST `/admissions/public/forms/enquiry/:branchId` & `application/:branchId`

### Settings

- [x] Lead sources — GET/POST/PUT/DELETE `/admissions/sources` + settings page with categories (organic, referral, marketing, agent, other)
- [x] Agent / counselor management — GET/POST/PUT/DELETE `/admissions/agents` + settings page with commission tracking (percentage/fixed)
- [x] Admission settings — GET/PUT `/admissions/settings` + settings page with number sequences, stages, documents, fees config
- [x] Document types — CRUD for document types (identity, academic, other) with required flag

### Reports

- [x] Lead reports — GET `/admissions/reports/leads` with grouping by source, stage, assignedTo, date
- [x] Lead conversion reports — GET `/admissions/reports/leads/conversion`
- [x] Application reports — GET `/admissions/reports/applications` with grouping by status, class, source
- [x] Processing time reports — GET `/admissions/reports/applications/processing-time`
- [x] Admission analytics — GET `/admissions/reports/analytics`
- [~] Reports UI dashboard — Backend reports exist but no dedicated frontend visualization page

---

## 4. Student

### Core

- [x] Student CRUD — POST/GET/PUT/DELETE `/students` + list page with pagination, search, filters; detail page with tabs
- [x] Student status management — PUT `/students/:id/status` (active/inactive/alumni/transferred) + status badges
- [x] Student statistics — GET `/students/stats` + stats cards on list page
- [x] Student search & filter — Name/admission number search; class, section, status, category, gender filters with URL params
- [x] Student export — GET `/students/export` + export button on list page

### Enrollment & Promotion

- [x] Enrollment history — GET `/students/:id/enrollments` + enrollment history tab on detail page
- [x] Individual promotion — POST `/students/:id/promote` + dedicated promotion page with from/to batch/class/section selection
- [x] Bulk promotion — POST `/students/bulk-promote` + promotion page with multi-student selection and progress tracking

### Transfers & Shuffle

- [~] Section shuffle — POST `/students/:id/shuffle` endpoint exists; no frontend UI
- [~] Student transfer — POST `/students/:id/transfer` endpoint exists; no frontend UI

### Bulk Upload

- [x] CSV bulk upload — GET template + POST validate + POST upload + multi-step upload page with template download, validation, error display, completion summary

### Parent / Guardian

- [x] Parent info — Father/mother details (name, phone, email, occupation) in create/update student
- [x] Parent display — Parent/Guardian tab on detail page

### Documents & Photos

- [x] Photo upload — POST `/students/:id/photo` with S3 + integrated in student forms
- [~] Student documents — Detail page has documents tab but uses mock document list

### Reports

- [x] Class-wise report — GET `/students/reports/class-wise`
- [x] Section-wise report — GET `/students/reports/section-wise`
- [x] Category-wise report — GET `/students/reports/category-wise`
- [x] Active student report — GET `/students/reports/active`
- [x] New admissions report — GET `/students/reports/new-admissions`

### Alumni

- [x] Alumni list — GET `/students/alumni`
- [x] Alumni statistics — GET `/students/alumni/stats`

---

## 5. Attendance

### Mark & View

- [x] Mark daily attendance — POST `/attendance/students` + mark attendance page with class/section/date selection, per-student status buttons
- [x] Quick mark all — Frontend "Mark All Present" / "Mark All Absent" buttons
- [x] View attendance records — GET `/attendance/students` + view page with date selection, summary cards, filterable table
- [x] Attendance locking — PUT `/attendance/students/:id/lock` + lock button with editing disabled when locked
- [x] Student attendance history — GET `/attendance/students/:studentId/history`

### Holidays

- [x] Holiday CRUD — POST/GET/PUT/DELETE `/attendance/holidays` + holiday calendar page with types (national, religious, local, vacation), applicable-for
- [x] Holiday statistics — GET `/attendance/holidays/stats` + stats cards (total, upcoming, national, vacation)

### Reports

- [x] Daily report — GET `/attendance/reports/daily` + class-wise breakdown with attendance percentages
- [x] Class-wise report — GET `/attendance/reports/class-wise` + section-wise analytics
- [x] Student-wise report — GET `/attendance/reports/student-wise` + individual metrics with low attendance alerts (<75%)
- [x] Monthly report — GET `/attendance/reports/monthly` + daily trend visualization

### Bulk Upload

- [~] Bulk attendance upload — GET/POST template, validate, upload endpoints exist; no dedicated frontend UI page

### Self-Service

- [~] Student self-service view — GET `/attendance/self/:studentId` API exists; no dedicated frontend page
- [~] Parent view child attendance — GET `/attendance/parent/children` API exists; no dedicated frontend page

### Settings

- [~] Attendance settings — GET/PUT `/attendance/settings` (working days, thresholds, auto-lock); no dedicated settings UI page
- [~] Custom attendance statuses — POST/PUT/DELETE `/attendance/settings/statuses/:code`; no UI for managing

### Other

- [x] Working days calculation — GET `/attendance/working-days` integrated with holiday management
- [ ] Attendance notifications — No dedicated notification endpoints for low attendance alerts

---

## 6. Finance

### Fee Counter

- [x] Fee counter / collection dashboard — GET `/finance/fee-counter/students` + dedicated fee counter page with student search, fee overview, and payment recording

### Fee Structures

- [x] Fee structure CRUD — POST/GET/PUT/DELETE `/finance/fee-structures` + fee structures page with categories, installment support
- [x] Fee structure templates — Installment configuration, due date management, penalty settings
- [x] Fee categories — Create/manage fee categories (tuition, transport, hostel, etc.)

### Fee Assignments

- [x] Fee assignment to students/classes — POST/GET `/finance/fee-assignments` + assignment page with class/section/student selection
- [x] Bulk fee assignment — Assign fee structures to entire classes/sections
- [x] Individual fee assignment — Assign specific structures to individual students

### Transactions

- [x] Record payments — POST `/finance/transactions` + payment recording with mode selection (cash, cheque, UPI, bank transfer, DD)
- [x] Cancel transaction — POST `/finance/transactions/:id/cancel` with reason
- [x] Refund transaction — POST `/finance/transactions/:id/refund` with reason
- [x] Transaction statistics — GET `/finance/transactions/stats` with date range filtering
- [x] Receipt generation — Receipt number auto-generation on payment

### Concessions & Discounts

- [x] Concession CRUD — POST/GET/PUT/DELETE `/finance/concessions` + concession management page
- [x] Concession types — Percentage and fixed amount concessions
- [x] Concession approval — Approval workflow for concession requests

### Wallets

- [x] Student wallet / advance payments — GET/POST `/finance/wallets` + wallet management with advance payment recording
- [x] Wallet balance tracking — View balance, transaction history

### Finance Reports

- [x] Collection summary — GET `/finance/reports/collection-summary`
- [x] Fee defaulters — GET `/finance/reports/defaulters` + defaulter tracking with amount breakdown
- [x] Due report — GET `/finance/reports/due` with class/section/date filtering
- [x] Day book — GET `/finance/reports/day-book` + daily collection summary
- [x] Mode-wise report — GET `/finance/reports/mode-wise` + collection by payment mode

### Online Payments

- [~] Razorpay integration — Backend: `initiateOnlinePayment()` and `verifyOnlinePayment()` with Razorpay order creation fully implemented; Frontend: no Razorpay API methods in frontend `api.ts`, no payment gateway UI

### Finance Settings

- [x] Finance settings — GET/PUT `/finance/settings` + settings page with number sequences, payment modes, penalty config

---

## 7. HR

### Staff Management

- [x] Staff CRUD — POST/GET/PUT/DELETE `/hr/staff` + staff list page with filters, detail page
- [x] Staff search & filter — Name search; department, designation, employment type filters
- [x] Staff profile — Detail page with personal info, employment details, documents

### Departments & Designations

- [x] Department CRUD — POST/GET/PUT/DELETE `/hr/departments` + departments page
- [x] Designation CRUD — POST/GET/PUT/DELETE `/hr/designations` + designations page

### Staff Attendance

- [x] Mark staff attendance — POST `/hr/attendance` + staff attendance page with daily marking
- [x] Staff attendance history — GET `/hr/attendance` with date filtering
- [x] Staff attendance reports — GET `/hr/attendance/report`

### Leave Management

- [x] Leave types — CRUD for leave types (casual, sick, earned, maternity, etc.)
- [x] Leave application — POST `/hr/leaves` + leave application form
- [x] Leave approval/rejection — PUT `/hr/leaves/:id/approve` & `/reject`
- [x] Leave balance tracking — GET `/hr/leaves/balance/:staffId`
- [x] Leave reports — GET `/hr/leaves/reports`

### Workload

- [x] Workload management — POST/GET/PUT/DELETE `/hr/workload` + workload assignment page
- [x] Subject-class-teacher mapping — Assign teachers to subjects and classes

### Resignations

- [x] Resignation CRUD — POST/GET/PUT `/hr/resignations` + resignation management page
- [x] Resignation approval — Approval/rejection workflow with notice period tracking

### Shifts

- [x] Shift management — POST/PUT/DELETE `/hr/settings/shifts/:code` + settings page with shift configuration (times, breaks)

### Payroll

- [~] Payroll processing — Backend payroll endpoints exist; no dedicated frontend payroll page
- [~] Salary structure — Backend salary configuration; no frontend UI

### HR Settings

- [x] HR settings — GET/PUT `/hr/settings` + comprehensive settings page with defaults, leave types, shifts, designations

### HR Reports

- [x] HR reports dashboard — Dedicated HR reports page with staff summary, department-wise, attendance, leave analytics

---

## 8. Communication

### SMS

- [x] SMS sending — POST `/communications/sms/send` + SMS page with template selection, recipient targeting, message composition with character counter
- [x] SMS logs — GET `/communications/sms/logs` + log viewing with date filters
- [x] SMS statistics — GET `/communications/sms/stats`
- [x] SMS templates — CRUD for SMS templates with DLT template ID support (India compliance)
- [x] Bulk SMS — Send to all parents, class parents, fee-pending parents, all staff, or custom recipients

### Email

- [x] Email templates — CRUD for email templates with HTML content and variables
- [x] Email settings — Provider configuration (SendGrid, SES, SMTP)

### Announcements

- [~] Announcements — Backend: full CRUD + publish/archive/acknowledge endpoints; Frontend: page exists but uses mock data, not integrated with API

### Calendar & Events

- [x] Event management — Full CRUD + cancel endpoints; interactive calendar page with month view, event creation/editing
- [x] Event types — CRUD for event types with color and icon configuration

### Settings

- [x] Communication settings — Extensive settings page with 8 tabs: SMS, SMS Templates, Email Templates, Email, WhatsApp, Event Types, Announcements, Notifications
- [x] WhatsApp settings — Provider configuration (Twilio, Meta, Gupshup)
- [x] Notification defaults — Channel selection (sms, email, push, whatsapp) with feature toggles

### Other

- [~] Push notifications — Configuration UI exists but no dedicated push endpoints
- [~] Parent communication — Possible through general SMS/email; no parent-specific portal

---

## 9. Dashboard

### KPIs & Metrics

- [x] Owner/admin dashboard — GET `/dashboard/owner/kpis` + dashboard page with total students, fee collected, attendance, pending dues
- [x] Branch-specific dashboard — GET `/dashboard/branch/kpis` & `/dashboard/branch/today` + branch context switching
- [x] Finance metrics — GET `/dashboard/owner/finance` + Collection Trend area chart
- [x] Student metrics — GET `/dashboard/owner/students` + Student Distribution pie chart
- [x] Attendance metrics — GET `/dashboard/owner/attendance` + Weekly Attendance bar chart

### Alerts & Actions

- [x] Alerts widget — GET `/dashboard/alerts` + alerts grid with severity levels (critical, warning, info)
- [x] Quick actions — Mark Attendance, Collect Fee, Add Student, Send SMS shortcuts

### Reports & Logs

- [ ] Custom reports builder — Stub endpoint returns placeholder; no frontend UI
- [ ] Audit logs — Stub endpoint returns empty; no frontend UI
- [ ] Activity feed — Not implemented

---

## 10. Certificates

### Certificate Types

- [x] Certificate type CRUD — GET/POST/PUT `/certificates/types` + Certificate Templates page with name, code, category (student/staff), approval levels

### Requests & Workflow

- [x] Certificate requests — GET/POST `/certificates/requests` + request list page with creation dialog
- [x] Certificate approval — PUT `/certificates/requests/:id/approve` & `/reject` + approve/reject buttons on request detail
- [x] Certificate issuance — PUT `/certificates/requests/:id/issue` + issue action on approved requests

### Templates

- [x] HTML templates — Template creation with HTML editor, 40+ placeholders (student/staff), preview functionality
- [x] Custom fields on templates — Field type support (text, date, number, select) with required toggle

### ID Cards

- [x] ID card templates — GET/POST `/certificates/id-cards/templates` + ID Card Templates tab with preview
- [x] Single ID card generation — POST `/certificates/id-cards/generate`
- [x] Bulk ID card generation — POST `/certificates/id-cards/bulk-generate` by class/section/department

### Settings & Reports

- [x] Certificate settings — GET/PUT `/certificates/settings` + sequence numbering, approval defaults
- [x] Certificate statistics — GET `/certificates/stats`
- [x] Certificate report — GET `/certificates/reports` with date range and status filters

---

## 11. Health

### Health Records

- [x] Health record CRUD — POST/GET/PUT/DELETE `/health/records` + health records page
- [x] Record by person — GET `/health/records/person/:personType/:personId`
- [x] Auto-sync records — POST `/health/records/sync/:personType/:personId`
- [x] Allergies tracking — Allergy management within health records (name, severity, notes)
- [x] Conditions tracking — Medical conditions with diagnosis date and status
- [x] Emergency contacts — Emergency contact management within health records

### Checkups

- [x] Checkup CRUD — POST/GET/PUT `/health/checkups` + checkups page
- [x] Complete checkup — POST `/health/checkups/:id/complete` with findings and follow-up
- [x] Checkup statistics — GET `/health/checkups/stats`

### Campaigns

- [x] Campaign CRUD — POST/GET/PUT `/health/campaigns` + campaigns page
- [x] Start campaign — POST `/health/campaigns/:id/start`
- [x] Campaign checkups — GET `/health/campaigns/:id/checkups`

### Vaccinations

- [x] Vaccination CRUD — POST/GET/PUT/DELETE `/health/vaccinations`
- [x] Administer vaccination — POST `/health/vaccinations/:id/administer`
- [x] Due vaccinations — GET `/health/vaccinations/due`
- [x] Vaccination statistics — GET `/health/vaccinations/stats`
- [x] Mark overdue — POST `/health/vaccinations/mark-overdue`

### Medical Visits

- [x] Visit CRUD — POST/GET/PUT `/health/visits` + visits page
- [x] Close visit — POST `/health/visits/:id/close` with outcome
- [x] Today's visits — GET `/health/visits/today`
- [x] Parent notification — POST `/health/visits/:id/notify-parent`

### Dashboard & Reports

- [x] Health dashboard — GET `/health/dashboard` + overview metrics
- [x] Growth chart — GET `/health/growth-chart/:personId`
- [x] Health summary — GET `/health/summary/:personId`
- [x] Health card export — GET `/health/export-card/:personId`
- [x] Compliance report — GET `/health/compliance-report`

### Settings

- [x] Health settings — GET/PUT `/health/settings` with comprehensive config (vaccination schedules, BMI thresholds, visit types, allergy severities)

---

## 12. Admin (Super Admin)

### Authentication

- [x] Super-admin login — POST `/admin/login` + `/admin/login` page with separate auth flow
- [x] Admin session management — Refresh tokens, logout, session tracking

### Organization Management

- [x] List organizations — GET `/admin/organizations` + `/admin/organizations` page with status filters, search, pagination
- [x] View organization details — GET `/admin/organizations/:id` + detail page with full org info
- [x] Approve organization — POST `/admin/organizations/:id/approve` + approve action with module selection
- [x] Reject organization — POST `/admin/organizations/:id/reject` + reject action with reason
- [x] Archive organization — POST `/admin/organizations/:id/archive` + archive action
- [x] Unarchive organization — POST `/admin/organizations/:id/unarchive`
- [x] Archived orgs list — GET `/admin/organizations/archived` + archived tab

### Admin Dashboard

- [x] Dashboard statistics — GET `/admin/dashboard` + dashboard page with pending approvals, total orgs, monthly metrics, recent signups

### Configuration

- [x] Reapply settings — PUT `/admin/organizations/:id/reapply-settings`
- [x] Module management — PUT `/admin/organizations/:id/modules` + enable/disable modules per org
- [~] Subscription / plan management — No explicit subscription tiers or billing management UI

---

## 13. Upload (File Management)

### S3 Integration

- [x] Image upload — POST `/uploads/image` with S3 integration + frontend `uploadImage()` API
- [x] Document upload — POST `/uploads/document` with S3 integration + frontend `uploadDocument()` API
- [x] Presigned URL generation — POST `/uploads/presigned-url` + frontend `getPresignedUrl()` API
- [x] Confirm upload — POST `/uploads/confirm` + frontend `confirmUpload()` API
- [x] Signed download URL — GET `/uploads/signed-url/:key` + frontend `getSignedDownloadUrl()` API
- [x] Delete file — DELETE `/uploads/:key` + frontend `deleteFile()` API
- [x] Get uploads by entity — GET `/uploads/entity/:entityType/:entityId` + frontend API method

---

## 14. Scheduler

### Job Management

- [x] Job CRUD — Backend scheduler service with job creation, scheduling, enable/disable
- [x] Schedule types — Support for once, daily, weekly, monthly, cron expressions
- [x] Manual execution — Trigger jobs manually from UI
- [x] Execution history — View past job runs with status and timing

### Frontend Integration

- [x] Schedule jobs page — `/organization/schedule-jobs` page with full management UI
- [ ] Dedicated scheduler admin panel — No separate scheduler module page (managed through organization settings)
- [ ] Failed job retry — No explicit retry mechanism in UI

---

## Summary

| Module        | Implemented | Partial | Not Built |  Total  | % Complete |
| ------------- | :---------: | :-----: | :-------: | :-----: | :--------: |
| Auth          |      9      |    1    |     0     |   10    |    95%     |
| Organization  |     12      |    1    |     0     |   13    |    96%     |
| Admission     |     20      |    2    |     0     |   22    |    95%     |
| Student       |     15      |    3    |     0     |   18    |    92%     |
| Attendance    |     11      |    5    |     1     |   17    |    79%     |
| Finance       |     19      |    1    |     0     |   20    |    98%     |
| HR            |     15      |    2    |     0     |   17    |    94%     |
| Communication |      9      |    4    |     0     |   13    |    85%     |
| Dashboard     |      7      |    0    |     3     |   10    |    70%     |
| Certificates  |     11      |    0    |     0     |   11    |    100%    |
| Health        |     20      |    0    |     0     |   20    |    100%    |
| Admin         |     10      |    1    |     0     |   11    |    95%     |
| Upload        |      7      |    0    |     0     |    7    |    100%    |
| Scheduler     |      4      |    0    |     2     |    6    |    67%     |
| **TOTAL**     |   **169**   | **20**  |   **6**   | **195** |  **92%**   |

---

_Generated from codebase analysis on February 5, 2026._
