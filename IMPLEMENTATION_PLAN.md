# Campus Verse - Remaining Implementation Plan

This document outlines the remaining features to be implemented, organized by module and priority.

## Overview

- **Total Remaining Tasks:** ~150+ (from TO DO column)
- **Already Implemented but marked TO DO:** ~20 tasks (update ClickUp status)
- **Genuinely Remaining:** ~130+ tasks

---

## Phase 1: Organization Module (Foundation)

### 1.1 Approval Workflows (Priority: HIGH)

**Location:** `apps/api/src/modules/organization/approval.service.ts`, `apps/web/src/app/(dashboard)/organization/approvals/`

- [ ] **Undo Approvals** - Add ability to undo/reverse approved requests
- [ ] **Approval Email Settings** - Configure email notifications for approval workflows

**Implementation Notes:**

- Extend existing approval.service.ts with undo functionality
- Add email notification triggers using existing communication module

---

## Phase 2: Finance Module (Core Business)

### 2.1 Reports - Already Implemented (Move to COMPLETE in ClickUp)

The following are ALREADY implemented and should be moved from TO DO to COMPLETE:

- Branch Wise Due Report
- Fee Day Sheet
- Fee Type Report
- Student Fee Statement
- Fee Type Wise Transactions
- Class Wise Concession Report
- Student Wise Concession Report
- Fee Bulk Upload
- Concession Bulk Upload

### 2.2 Remaining Finance Tasks (Priority: HIGH)

#### Yet to Assign Fee Reports

**Location:** `apps/api/src/modules/finance/reports.service.ts`

```
- [ ] Create API endpoint for unassigned students report (partially exists)
- [ ] Add UI component in finance/reports page
```

#### Total Paid and Due Report

**Location:** `apps/api/src/modules/finance/reports.service.ts`

```
- [ ] Aggregate total paid vs due across all students/classes
- [ ] Add summary statistics and charts
```

#### Application Fee Settings

**Location:** `apps/api/src/modules/finance/financeSettings.service.ts`

```
- [ ] Add application fee configuration (for admissions)
- [ ] Link to admission module
```

#### Wallet Sequence Settings

**Location:** `apps/api/src/modules/finance/financeSettings.service.ts`

```
- [ ] Configure wallet number sequence/prefix
- [ ] Add to finance settings UI
```

#### Fee Cancellation Request

**Location:** `apps/api/src/modules/finance/approvalRequest.service.ts`

```
- [ ] Enhance cancellation workflow with student/parent request initiation
- [ ] Add request tracking UI
```

---

## Phase 3: Admission Module

### 3.1 Settings (Priority: HIGH)

**Location:** `apps/web/src/app/(dashboard)/admissions/settings/`

- [ ] **Admission Fields Setting** - Configure custom fields for admission forms
- [ ] **Organization Sources** - Manage lead sources (referral, website, walk-in, etc.)
- [ ] **Organization Streams** - Academic streams/programs configuration

### 3.2 Bulk Operations (Priority: MEDIUM)

**Location:** `apps/api/src/modules/admission/`

- [ ] **Bulk Admissions** - Import multiple admissions from Excel/CSV
  - Create `admissionImport.controller.ts` and `admissionImport.service.ts`
  - Add validation and error handling
  - Add UI at `apps/web/src/app/(dashboard)/admissions/bulk-upload/`

### 3.3 Followups (Priority: MEDIUM)

**Location:** `apps/api/src/modules/admission/`

- [ ] **Leads Followup** - Track and manage lead follow-up activities
  - Add followup scheduling
  - Add reminder notifications
  - Create followup history tracking

### 3.4 Web Forms (Priority: MEDIUM)

- [ ] **Dynamic Forms** - Create customizable admission web forms
  - Public-facing admission inquiry forms
  - Form builder UI
  - Form submission handling

### 3.5 Reports (Priority: LOW)

- [ ] **Application Report** - Admission application statistics and reports

### 3.6 Agent Tracking (Priority: LOW)

- [ ] **Live Tracking** - Track admission agents/counselors
  - Agent performance metrics
  - Commission tracking

---

## Phase 4: Student Module

### 4.1 Operations (Priority: MEDIUM)

- [ ] **Shuffle Student** - Move students between classes/sections
  - Bulk transfer functionality
  - Academic record preservation

- [ ] **Branch Shifts** - Transfer students between branches
  - Inter-branch transfer workflow
  - Document transfer

### 4.2 Reports (Priority: MEDIUM)

- [ ] **Student Reports** - Various student-related reports
  - Enrollment reports
  - Demographic reports
  - Academic progress reports

---

## Phase 5: HR Module

### 5.1 Staff Management (Priority: HIGH)

**Location:** `apps/api/src/modules/hr/`

- [ ] **Inactive Staff Details** - View and manage inactive/resigned staff
- [ ] **Assign To Branches** - Multi-branch staff assignment

### 5.2 Attendance (Priority: HIGH)

**Location:** `apps/web/src/app/(dashboard)/hr/attendance/`

- [ ] **Daily Attendance Report** - Daily staff attendance summary
- [ ] **Staff Attendance Report** - Detailed attendance reports
- [ ] **Shifts** - Define and manage work shifts
- [ ] **Weekly Offs** - Configure weekly off days per staff/department

### 5.3 Leave Management (Priority: HIGH)

**Location:** `apps/api/src/modules/hr/leave.service.ts`

- [ ] **Leave Management** - Enhanced leave management
  - Leave balance tracking
  - Leave encashment
  - Carry forward rules

- [ ] **Staff Leave Approval** - Leave approval workflows
- [ ] **Staff Leaves Report** - Leave utilization reports
- [ ] **Holidays** - Holiday calendar management

### 5.4 Reports (Priority: MEDIUM)

- [ ] **Staff Details Report** - Comprehensive staff information report

### 5.5 Payroll (Priority: LOW)

**Location:** `apps/api/src/modules/hr/` (new subdirectory)

- [ ] **Payroll Setup** - Salary structure configuration
  - Pay components (basic, HRA, allowances, deductions)
  - Tax configuration
  - Payslip generation

---

## Phase 6: Communications Module

### 6.1 SMS (Priority: HIGH)

**Location:** `apps/api/src/modules/communication/sms.service.ts`

- [ ] **Send SMS** - Bulk SMS sending functionality
  - Template-based messaging
  - Recipient filtering
  - Delivery tracking

### 6.2 Announcements (Priority: HIGH)

**Location:** `apps/api/src/modules/communication/announcement.service.ts`

- [ ] **Approve Announcements** - Announcement approval workflow
- [ ] **Announcement Approvals** - Approval queue management
- [ ] **Announcement Settings** - Configure announcement categories and permissions

### 6.3 Events (Priority: MEDIUM)

**Location:** `apps/api/src/modules/communication/event.service.ts`

- [ ] **Event Types Create/View** - Manage event categories
- [ ] **Event Create/View** - Enhanced event management

### 6.4 Templates (Priority: MEDIUM)

- [ ] **Communication Templates** - Reusable message templates
  - SMS templates
  - Email templates
  - WhatsApp templates

### 6.5 Settings (Priority: LOW)

- [ ] **Com/Settings** - Communication module settings
  - SMS gateway configuration
  - Email SMTP settings
  - Notification preferences

---

## Phase 7: Attendance Module (Student)

### 7.1 Core Features (Priority: MEDIUM)

**Location:** `apps/api/src/modules/attendance/`

Most attendance features appear to be implemented. Verify and complete:

- [ ] Biometric integration (if required)
- [ ] Parent notification on absence
- [ ] Attendance percentage reports

---

## Implementation Guidelines for Claude Code

### File Structure Pattern

```
apps/api/src/modules/{module}/
  ├── {feature}.controller.ts   # Request handlers
  ├── {feature}.service.ts      # Business logic
  ├── {module}.routes.ts        # Route definitions
  └── __tests__/                # Unit tests

apps/web/src/app/(dashboard)/{module}/
  ├── {feature}/
  │   └── page.tsx              # Page component
  └── components/               # Shared components
```

### API Response Format

```typescript
// Success
{ success: true, data: { ... } }

// Error
{ success: false, error: { code: 'ERROR_CODE', message: 'Human readable' } }
```

### Permission Pattern

```typescript
router.post(
  '/endpoint',
  authenticate,
  requirePermission('module', 'action'),
  requireBranch,
  validateBody(zodSchema),
  controller.handler
);
```

### Testing Requirements

- Write unit tests for all new services
- Coverage threshold: 80% lines/functions

---

## Priority Order for Implementation

1. **Immediate (This Sprint)**
   - Update ClickUp: Move implemented tasks to COMPLETE
   - Undo Approvals
   - Approval Email Settings

2. **High Priority (Next 2 Weeks)**
   - HR: Shifts, Weekly Offs, Leave Management
   - Finance: Total Paid and Due Report
   - Admission: Bulk Admissions

3. **Medium Priority (Next Month)**
   - Communications: Send SMS, Templates
   - Student: Shuffle Student, Branch Shifts
   - Admission: Followups, Web Forms

4. **Low Priority (Backlog)**
   - Payroll Setup
   - Agent Tracking
   - Advanced Reports

---

## Commands Reference

```bash
# Start development
pnpm dev

# Run specific module tests
pnpm --filter @campus-verse/api exec vitest run src/modules/{module}

# Type checking
pnpm --filter @campus-verse/api exec tsc --noEmit

# Lint
pnpm lint:fix
```
