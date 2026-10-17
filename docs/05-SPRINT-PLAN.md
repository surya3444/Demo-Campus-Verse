# Campus Verse - Sprint Plan

## Overview

- **Total Duration**: 20 Sprints (40 weeks)
- **Sprint Duration**: 2 weeks each
- **Phase 1 Scope**: Organization, Students, Admissions, Finance, Attendance, HR, Communications, Dashboard

---

## Sprint 1: Project Setup (Weeks 1-2)

### Goals

- Initialize monorepo structure
- Set up development environment
- Configure CI/CD pipeline

### Tasks

```
Backend Setup:
□ Initialize Turborepo monorepo
□ Set up pnpm workspace
□ Create apps/api folder structure
□ Configure TypeScript for API
□ Set up ESLint + Prettier
□ Configure Husky git hooks
□ Create Express app scaffold
□ Set up Pino logger
□ Create environment config loader
□ Set up Docker Compose for local dev

Frontend Setup:
□ Create apps/web with Next.js 14
□ Configure Tailwind CSS
□ Install and configure shadcn/ui
□ Set up TypeScript
□ Create basic layout components

Shared:
□ Create packages/shared structure
□ Set up shared TypeScript types
□ Configure Zod schemas package

DevOps:
□ Create Dockerfiles for api and web
□ Set up GitHub Actions CI pipeline
□ Configure linting and type checking in CI
```

### Deliverables

- Working monorepo with hot reload
- CI pipeline running on PRs
- Docker development environment

---

## Sprint 2: Core Infrastructure (Weeks 3-4)

### Goals

- Set up database connections
- Create middleware foundation
- Build utility libraries

### Tasks

```
Database:
□ Set up MongoDB native driver connection
□ Create connection pool configuration
□ Implement reconnection logic
□ Create database helper utilities (db.ts)
□ Set up Redis connection (ioredis)
□ Create Redis helper utilities

Middleware:
□ Create error handling middleware
□ Implement request logging middleware
□ Create response helpers (success/error)
□ Build Zod validation middleware
□ Set up rate limiting middleware
□ Create CORS configuration

Utilities:
□ Create pagination utilities
□ Build query filter helpers
□ Create date utilities (dayjs)
□ Set up crypto utilities for encryption
□ Create ID generation (nanoid)

Frontend Foundation:
□ Set up Axios instance with interceptors
□ Create React Query provider
□ Set up Zustand stores
□ Build base layout (Sidebar, Header)
□ Create loading/error states
□ Build data table component
```

### Deliverables

- Database connection working
- Middleware pipeline functional
- Base UI components ready

---

## Sprint 3: Authentication Backend (Weeks 5-6)

### Goals

- Implement JWT authentication
- Create user management foundation

### Tasks

```
Schema & Database:
□ Create tenants collection indexes
□ Create users collection indexes
□ Create roles collection indexes
□ Implement seed script for default roles

Auth Service:
□ Implement password hashing (bcryptjs)
□ Create JWT token generation
□ Implement access token logic (15min expiry)
□ Implement refresh token logic (7d expiry)
□ Create token blacklisting in Redis
□ Build login service
□ Build logout service
□ Implement refresh token rotation

Auth Routes:
□ POST /auth/login
□ POST /auth/logout
□ POST /auth/refresh
□ POST /auth/forgot-password
□ POST /auth/reset-password
□ POST /auth/change-password
□ GET /auth/me
□ PUT /auth/me

Auth Middleware:
□ Create JWT verification middleware
□ Implement token extraction from header
□ Handle token expiry errors
□ Create request context injection

Testing:
□ Write unit tests for auth service
□ Write integration tests for auth routes
```

### Deliverables

- Complete auth API working
- Token management functional
- Password reset flow working

---

## Sprint 4: Authentication Frontend & RBAC (Weeks 7-8)

### Goals

- Build auth UI
- Implement role-based access control

### Tasks

```
Auth Frontend:
□ Create login page
□ Build forgot password page
□ Create reset password page
□ Implement auth store (Zustand)
□ Create useAuth hook
□ Build protected route wrapper
□ Handle token refresh on expiry
□ Implement logout flow

RBAC Backend:
□ Create permissions constants
□ Build permission check middleware
□ Implement role hierarchy logic
□ Create requirePermission middleware
□ Add role validation to routes

RBAC Frontend:
□ Create usePermissions hook
□ Build PermissionGate component
□ Implement conditional UI rendering
□ Add permission checks to navigation

Default Roles:
□ Seed GROUP_OWNER role
□ Seed BRANCH_ADMIN role
□ Seed ACCOUNTANT role
□ Seed TEACHER role
□ Seed HR_MANAGER role

Testing:
□ Test RBAC middleware
□ Test permission inheritance
```

### Deliverables

- Login/logout working end-to-end
- RBAC system functional
- Role-based UI rendering

---

## Sprint 5: Branch Management (Weeks 9-10)

### Goals

- Build branch CRUD
- Implement geographic hierarchy

### Tasks

```
Backend:
□ Create branches schema validation
□ Implement branch service
  - create, update, delete, list, getById
□ Create branch initialization logic
□ Handle institution type specific structure
□ Build branch statistics aggregation
□ Create branch routes

API Endpoints:
□ GET /organization/branches
□ POST /organization/branches
□ GET /organization/branches/:id
□ PUT /organization/branches/:id
□ DELETE /organization/branches/:id
□ GET /organization/branches/:id/stats

Frontend:
□ Create branch list page
□ Build branch creation form
□ Create branch details/edit page
□ Implement branch selector component
□ Add branch to global state
□ Build state/city filter UI

Business Logic:
□ Validate unique branch code per tenant
□ Handle branch status changes
□ Cascade status to related entities

Testing:
□ Unit tests for branch service
□ Integration tests for branch APIs
□ E2E test for branch CRUD flow
```

### Deliverables

- Branch management complete
- Branch selector working
- Geographic filtering

---

## Sprint 6: User Management (Weeks 11-12)

### Goals

- Complete user CRUD
- Implement bulk operations

### Tasks

```
Backend:
□ Create user service
□ Implement user CRUD operations
□ Build user search with filters
□ Create bulk user upload logic
□ Handle user status management
□ Implement password reset for users
□ Build user-role association

API Endpoints:
□ GET /organization/users
□ POST /organization/users
□ GET /organization/users/:id
□ PUT /organization/users/:id
□ DELETE /organization/users/:id
□ PUT /organization/users/:id/status
□ POST /organization/users/:id/reset-password

Frontend:
□ Create user list page with DataTable
□ Build user creation/edit form
□ Implement role selector
□ Build branch access configuration
□ Create bulk upload UI
□ Add user search and filters
□ Build user profile page

Business Logic:
□ Validate unique email per tenant
□ Handle access scope configuration
□ Prevent self-deactivation
□ Audit user changes
```

### Deliverables

- User management complete
- Bulk upload working
- Access scope configuration

---

## Sprint 7: Academic Structure (Weeks 13-14)

### Goals

- Build academic batches, classes, sections
- Handle different institution structures

### Tasks

```
Backend Services:
□ Create academic batch service
□ Create class service
□ Create section service
□ Create subject service
□ Handle institution-type-specific logic

API Endpoints:
□ Academic batch CRUD (5 endpoints)
□ Class CRUD (5 endpoints)
□ Section CRUD (4 endpoints)
□ Subject CRUD (4 endpoints)

Frontend Pages:
□ Academic batches page
□ Classes management page
□ Sections management page
□ Subjects catalog page
□ Class-subject mapping UI

Institution-Specific Logic:
□ Schools: Grade → Section structure
□ Colleges: Stream → Batch structure
□ Universities: Department → Year → Section

Business Logic:
□ Only one "current" batch active
□ Class uniqueness within batch
□ Section capacity validation
□ Subject-class mapping
```

### Deliverables

- Academic structure management complete
- Institution type handling working
- Subject catalog ready

---

## Sprint 8: Student Core (Weeks 15-16)

### Goals

- Build student master data
- Implement admission number generation

### Tasks

```
Backend:
□ Create student service
□ Implement admission number generator
□ Create enrollment code generator
□ Build student CRUD operations
□ Handle photo upload to S3
□ Implement family/sibling linking
□ Create student search (text index)

API Endpoints:
□ GET /students
□ POST /students
□ GET /students/:id
□ PUT /students/:id
□ DELETE /students/:id (soft)

Frontend:
□ Create student list page
□ Build comprehensive student form
  - Personal details tab
  - Parents details tab
  - Previous education tab
  - Documents tab
□ Implement student search
□ Create student profile page
□ Handle photo upload UI

Business Logic:
□ Unique admission number per branch
□ Auto-generate enrollment code
□ Validate required fields by institution
□ Handle sibling detection by phone
```

### Deliverables

- Student master data working
- Admission numbers generating
- Student profiles complete

---

## Sprint 9: Student Features (Weeks 17-18)

### Goals

- Implement bulk operations
- Build student reports

### Tasks

```
Backend:
□ Create student enrollment service
□ Implement bulk upload logic
  - CSV parsing
  - Validation
  - Error handling
  - Progress tracking
□ Build student export (CSV/Excel)
□ Create student reports service

API Endpoints:
□ POST /students/bulk-upload
□ GET /students/export
□ GET /students/:id/enrollments
□ POST /students/:id/enrollments
□ GET /students/reports/class-wise
□ GET /students/reports/section-wise
□ GET /students/reports/active

Frontend:
□ Create bulk upload page
  - File upload component
  - Template download
  - Progress indicator
  - Error display
□ Build export functionality
□ Create enrollment history view
□ Build student reports pages

Bulk Upload Logic:
□ Download CSV template
□ Validate headers
□ Validate each row
□ Show validation errors
□ Process valid rows
□ Report results
```

### Deliverables

- Bulk upload working
- Export functionality
- Student reports ready

---

## Sprint 10: Student Promotion & Transfer (Weeks 19-20)

### Goals

- Implement promotion system
- Build transfer workflow

### Tasks

```
Backend:
□ Create promotion service
□ Implement promotion rules engine
□ Build bulk promotion logic
□ Create transfer service
□ Handle history preservation
□ Implement section shuffle

API Endpoints:
□ POST /students/:id/promote
□ POST /students/bulk-promote
□ POST /students/:id/transfer
□ PUT /students/:id/status
□ GET /students/:id/history

Frontend:
□ Create promotion wizard
  - Select source batch/class
  - Configure destination
  - Set promotion rules
  - Preview changes
  - Execute
□ Build transfer form
□ Create section shuffle UI
□ Build promotion report

Business Logic:
□ Complete current enrollment
□ Create new enrollment
□ Update student.currentEnrollment
□ Preserve historical records
□ Handle failed students
□ Cross-branch transfers
```

### Deliverables

- Promotion system complete
- Transfer workflow working
- Section shuffle functional

---

## Sprint 11: Lead Management (Weeks 21-22)

### Goals

- Build admission leads pipeline
- Implement followup system

### Tasks

```
Backend:
□ Create lead service
□ Implement lead number generator
□ Build lead pipeline logic
□ Create followup management
□ Implement lead assignment
□ Build source tracking

API Endpoints:
□ Lead CRUD (5 endpoints)
□ PUT /admissions/leads/:id/stage
□ POST /admissions/leads/:id/followup
□ POST /admissions/leads/:id/convert

Frontend:
□ Create lead list with pipeline view
□ Build lead creation form
□ Create lead details page
□ Implement stage change UI
□ Build followup calendar
□ Create lead assignment UI

Pipeline Stages:
□ New → Contacted → Interested → Followup → Converted/Lost

Business Logic:
□ Stage history tracking
□ Followup reminders
□ Source attribution
□ Conversion tracking
```

### Deliverables

- Lead pipeline working
- Followup management complete
- Source tracking functional

---

## Sprint 12: Applications & Enrollment (Weeks 23-24)

### Goals

- Build application workflow
- Implement enrollment conversion

### Tasks

```
Backend:
□ Create application service
□ Implement application number generator
□ Build document collection logic
□ Create application workflow
□ Implement enrollment conversion
□ Build admission reports

API Endpoints:
□ Application CRUD (5 endpoints)
□ PUT /admissions/applications/:id/status
□ POST /admissions/applications/:id/enroll
□ POST /admissions/applications/bulk-upload
□ GET /admissions/reports/*

Frontend:
□ Create application list page
□ Build application form wizard
□ Create document upload UI
□ Implement workflow visualization
□ Build enrollment confirmation
□ Create admission reports

Workflow States:
□ Draft → Submitted → Under Review → Approved/Rejected → Enrolled

Business Logic:
□ Convert application to student
□ Copy all data from application
□ Create fee assignment
□ Link to lead if exists
```

### Deliverables

- Application workflow complete
- Enrollment conversion working
- Admission reports ready

---

## Sprint 13: Fee Structure & Assignment (Weeks 25-26)

### Goals

- Build fee structure management
- Implement student fee assignment

### Tasks

```
Backend:
□ Create fee structure service
□ Build component configuration
□ Implement installment setup
□ Create fine rules engine
□ Build fee assignment service
□ Implement bulk assignment

API Endpoints:
□ Fee structure CRUD (6 endpoints)
□ POST /finance/fee-structures/:id/clone
□ Fee assignment CRUD (4 endpoints)
□ POST /finance/fee-assignments/bulk

Frontend:
□ Create fee structure list
□ Build structure creation wizard
  - Basic info
  - Add components
  - Configure installments
  - Set fine rules
□ Create fee assignment UI
□ Build bulk assignment page

Business Logic:
□ Component types (mandatory/optional)
□ Installment scheduling
□ Fine calculation rules
□ Tax calculation
□ Category-based fees
```

### Deliverables

- Fee structures complete
- Assignment system working
- Installment scheduling done

---

## Sprint 14: Fee Collection (Weeks 27-28)

### Goals

- Build fee collection counter
- Implement receipt generation

### Tasks

```
Backend:
□ Create fee transaction service
□ Implement receipt number generator
□ Build payment processing logic
□ Create fine calculation
□ Implement receipt PDF generation
□ Build cancellation workflow
□ Create refund logic

API Endpoints:
□ POST /finance/transactions
□ GET /finance/transactions
□ GET /finance/transactions/:id
□ GET /finance/transactions/:id/receipt
□ POST /finance/transactions/:id/cancel
□ POST /finance/transactions/:id/refund

Frontend:
□ Create fee counter page
  - Student search
  - Fee summary display
  - Installment selection
  - Payment mode selection
  - Amount entry
  - Collect button
□ Build receipt preview
□ Create transaction history
□ Implement cancellation UI

Business Logic:
□ Update fee assignment on payment
□ Calculate and apply fines
□ Generate receipt PDF
□ Handle partial payments
□ Audit all transactions
```

### Deliverables

- Fee counter working
- Receipt generation complete
- Cancellation/refund working

---

## Sprint 15: Concessions & Finance Reports (Weeks 29-30)

### Goals

- Build concession management
- Create financial reports

### Tasks

```
Backend:
□ Create concession service
□ Build approval workflow
□ Implement concession application
□ Create due reports service
□ Build collection reports service
□ Implement day sheet logic

API Endpoints:
□ Concession CRUD (5 endpoints)
□ PUT /finance/concessions/:id/approve
□ PUT /finance/concessions/:id/reject
□ GET /finance/reports/dues/* (5 endpoints)
□ GET /finance/reports/collections/* (3 endpoints)

Frontend:
□ Create concession request form
□ Build approval queue
□ Create concession reports
□ Build due reports pages
  - Total dues
  - Branch-wise
  - Class-wise
  - Student-wise
□ Create collection reports
  - Day sheet
  - Fee type wise

Business Logic:
□ Apply concession to assignment
□ Recalculate totals
□ Approval workflow
□ Report aggregations
```

### Deliverables

- Concession system complete
- Financial reports working
- Day sheet functional

---

## Sprint 16: Student Attendance (Weeks 31-32)

### Goals

- Build attendance marking
- Create attendance reports

### Tasks

```
Backend:
□ Create student attendance service
□ Implement attendance marking logic
□ Handle multiple marking modes
□ Build attendance summary aggregation
□ Create attendance reports

API Endpoints:
□ GET /attendance/students
□ POST /attendance/students
□ PUT /attendance/students/:id
□ GET /attendance/students/:studentId/history
□ GET /attendance/reports/* (4 endpoints)

Frontend:
□ Create attendance marking page
  - Date selector
  - Class/Section selector
  - Student list with checkboxes
  - Bulk mark present/absent
  - Save attendance
□ Build attendance view page
□ Create student history view
□ Build attendance reports

Business Logic:
□ Date normalization
□ Prevent duplicate marking
□ Lock attendance after period
□ Holiday handling
□ Attendance percentage calculation
```

### Deliverables

- Attendance marking working
- History view complete
- Attendance reports ready

---

## Sprint 17: Attendance Settings & Reports (Weeks 33-34)

### Goals

- Complete attendance features
- Build comprehensive reports

### Tasks

```
Backend:
□ Create holiday management
□ Build attendance settings
□ Implement monthly summary
□ Create class-wise report
□ Build student-wise report
□ Add export functionality

API Endpoints:
□ Holiday CRUD (3 endpoints)
□ Settings endpoints
□ Enhanced report endpoints

Frontend:
□ Create holiday management page
□ Build attendance settings page
□ Create monthly summary view
□ Build exportable reports
□ Add print functionality

Reports:
□ Daily attendance summary
□ Monthly attendance summary
□ Class-wise percentage
□ Student-wise detailed
□ Absent student list
□ Low attendance alerts
```

### Deliverables

- Holiday management complete
- All attendance reports ready
- Export functionality working

---

## Sprint 18: Staff Management (Weeks 35-36)

### Goals

- Build staff master data
- Implement staff attendance

### Tasks

```
Backend:
□ Create staff service
□ Implement employee ID generator
□ Build staff attendance service
□ Create department/designation services
□ Implement workload assignment

API Endpoints:
□ Staff CRUD (6 endpoints)
□ Staff attendance endpoints (5)
□ Department/Designation endpoints (4)
□ Workload endpoints (3)

Frontend:
□ Create staff list page
□ Build staff form
  - Personal details
  - Employment details
  - Teaching assignments
  - Documents
□ Create staff attendance page
□ Build workload assignment UI

Business Logic:
□ Link staff to user account
□ Handle multi-branch staff
□ Teaching load tracking
□ Department assignment
```

### Deliverables

- Staff management complete
- Staff attendance working
- Workload assignment done

---

## Sprint 19: Leave Management (Weeks 37-38)

### Goals

- Build leave application system
- Implement approval workflow

### Tasks

```
Backend:
□ Create leave service
□ Build leave balance service
□ Implement approval workflow
□ Create leave reports
□ Build entitlement setup

API Endpoints:
□ Leave CRUD (6 endpoints)
□ Approval endpoints (2)
□ Balance endpoints (2)
□ Report endpoints

Frontend:
□ Create leave application form
□ Build approval queue
□ Create leave calendar view
□ Build balance display
□ Create leave reports

Business Logic:
□ Leave balance tracking
□ Approval hierarchy
□ Carry forward rules
□ Leave impact on attendance
□ Holiday consideration
```

### Deliverables

- Leave application working
- Approval workflow complete
- Balance tracking functional

---

## Sprint 20: Communications & Dashboard (Weeks 39-40)

### Goals

- Build communication module
- Create unified dashboards

### Tasks

```
Backend:
□ Create SMS service with gateway
□ Build announcement service
□ Create event calendar service
□ Implement owner dashboard KPIs
□ Build branch dashboard
□ Add caching for dashboards

API Endpoints:
□ SMS endpoints (5)
□ Announcement endpoints (6)
□ Event endpoints (5)
□ Dashboard endpoints (8)

Frontend:
□ Create SMS sending page
□ Build announcement management
□ Create event calendar
□ Build owner dashboard
  - KPI cards
  - Charts
  - Drill-down capability
□ Create branch dashboard

Dashboard KPIs:
□ Total students (branch/group)
□ Total staff
□ Fee collected vs dues
□ Attendance rates
□ Admission pipeline
□ Recent activity

Final Tasks:
□ Integration testing
□ Performance optimization
□ Documentation
□ Deployment preparation
```

### Deliverables

- Communication module complete
- Dashboards working
- System ready for production

---

## Post-Phase 1 (Future Sprints)

### Phase 2 Modules

- Academics (Timetable, Diary, PTM)
- Exams & Gradebooks
- Transport
- Hostel
- Inventory
- Infra Management
- Expense Management
- Visitor Management

### Phase 3 Modules

- Assessments
- Lesson Delivery
- Online Classes
- Social Post
- Advanced Analytics
- Mobile Apps

---

## Sprint Checklist Template

For each sprint, ensure:

```
□ All API endpoints implemented and tested
□ All frontend pages created
□ Unit tests written (>80% coverage)
□ Integration tests passing
□ E2E tests for critical flows
□ Code reviewed and merged
□ Documentation updated
□ Demo prepared for stakeholders
□ Technical debt addressed
□ Performance benchmarks met
```
