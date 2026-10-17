# Campus Verse - Modules 1 & 2 Implementation Plan

## Overview

This document provides a detailed analysis of what has been implemented for the Organization Module (Week 1) and Finance Module Part 1 (Week 2), along with a comprehensive plan for completing the remaining features.

---

## Module 1: Organization Module

### Implementation Status Summary

| Category  | Total Features | Implemented | Remaining |
| --------- | -------------- | ----------- | --------- |
| Settings  | 12             | 9           | 3         |
| Approvals | 2              | 0           | 2         |
| **Total** | **14**         | **9**       | **5**     |

---

### Implemented Features

#### 1. Academic Batches

**Status:** Complete

**Backend:**

- `apps/api/src/modules/organization/academicBatch.controller.ts`
- `apps/api/src/modules/organization/academicBatch.service.ts`

**Frontend:**

- `apps/web/src/app/(dashboard)/organization/academic-batches/page.tsx`

**API Endpoints:**

- `GET /organization/academic-batches` - List all academic batches
- `GET /organization/academic-batches/current` - Get current active batch
- `POST /organization/academic-batches` - Create new batch
- `GET /organization/academic-batches/:id` - Get batch by ID
- `PUT /organization/academic-batches/:id` - Update batch
- `PUT /organization/academic-batches/:id/activate` - Set batch as current
- `DELETE /organization/academic-batches/:id` - Delete batch

---

#### 2. Classes

**Status:** Complete

**Backend:**

- `apps/api/src/modules/organization/class.controller.ts`
- `apps/api/src/modules/organization/class.service.ts`

**Frontend:**

- `apps/web/src/app/(dashboard)/organization/classes/page.tsx`

**API Endpoints:**

- `GET /organization/classes` - List all classes
- `POST /organization/classes` - Create new class
- `GET /organization/classes/:id` - Get class by ID
- `PUT /organization/classes/:id` - Update class
- `PUT /organization/classes/:id/status` - Update class status
- `DELETE /organization/classes/:id` - Delete class

**Notes:** Supports institution type variations (School grades, College streams, University departments)

---

#### 3. Sections

**Status:** Complete

**Backend:**

- `apps/api/src/modules/organization/section.controller.ts`
- `apps/api/src/modules/organization/section.service.ts`

**Frontend:**

- `apps/web/src/app/(dashboard)/organization/sections/page.tsx`

**API Endpoints:**

- `GET /organization/sections` - List all sections
- `GET /organization/classes/:classId/sections` - Get sections by class
- `POST /organization/classes/:classId/sections` - Create section for class
- `GET /organization/sections/:id` - Get section by ID
- `PUT /organization/sections/:id` - Update section
- `DELETE /organization/sections/:id` - Delete section
- `GET /organization/sections/:id/student-count` - Get student count

---

#### 4. Subjects

**Status:** Complete

**Backend:**

- `apps/api/src/modules/organization/subject.controller.ts`
- `apps/api/src/modules/organization/subject.service.ts`

**Frontend:**

- `apps/web/src/app/(dashboard)/organization/subjects/page.tsx`

**API Endpoints:**

- `GET /organization/subjects` - List all subjects
- `POST /organization/subjects` - Create new subject
- `GET /organization/subjects/:id` - Get subject by ID
- `PUT /organization/subjects/:id` - Update subject
- `DELETE /organization/subjects/:id` - Delete subject

---

#### 5. Branches

**Status:** Complete

**Backend:**

- `apps/api/src/modules/organization/branch.controller.ts`
- `apps/api/src/modules/organization/branch.service.ts`

**Frontend:**

- `apps/web/src/app/(dashboard)/organization/branches/page.tsx`

**API Endpoints:**

- `GET /organization/branches` - List all branches
- `POST /organization/branches` - Create new branch
- `GET /organization/branches/locations` - Get branch locations
- `GET /organization/branches/:id` - Get branch by ID
- `PUT /organization/branches/:id` - Update branch
- `DELETE /organization/branches/:id` - Delete branch
- `GET /organization/branches/:id/stats` - Get branch statistics

---

#### 6. User Management

**Status:** Complete

**Backend:**

- `apps/api/src/modules/organization/user.controller.ts`
- `apps/api/src/modules/organization/user.service.ts`

**Frontend:**

- `apps/web/src/app/(dashboard)/organization/users/page.tsx`

**API Endpoints:**

- `GET /organization/users` - List all users
- `POST /organization/users` - Create new user
- `GET /organization/users/:id` - Get user by ID
- `PUT /organization/users/:id` - Update user
- `PUT /organization/users/:id/status` - Update user status
- `POST /organization/users/:id/reset-password` - Reset user password
- `DELETE /organization/users/:id` - Delete user

---

#### 7. Role Management

**Status:** Complete

**Backend:**

- `apps/api/src/modules/organization/role.controller.ts`
- `apps/api/src/modules/organization/role.service.ts`

**Frontend:**

- `apps/web/src/app/(dashboard)/organization/roles/page.tsx`

**API Endpoints:**

- `GET /organization/roles` - List all roles
- `GET /organization/roles/assignable` - Get roles that current user can assign
- `POST /organization/roles` - Create new role
- `GET /organization/roles/:id` - Get role by ID
- `PUT /organization/roles/:id` - Update role
- `DELETE /organization/roles/:id` - Delete role

**Notes:** Full RBAC implementation with permission matrix and role hierarchy

---

#### 8. Organization/Branch Logos & Branding

**Status:** Complete

**Backend:**

- `apps/api/src/modules/organization/settings.controller.ts`
- `apps/api/src/modules/organization/settings.service.ts`

**Frontend:**

- `apps/web/src/app/(dashboard)/organization/settings/page.tsx`

**API Endpoints:**

- `GET /organization/branding` - Get branding settings
- `PUT /organization/branding` - Update branding (logo, colors)

---

#### 9. Organization Information

**Status:** Complete

**API Endpoints:**

- `GET /organization/profile` - Get organization profile
- `GET /organization/settings` - Get general settings
- `PUT /organization/settings` - Update general settings
- `GET /organization/contact` - Get contact information
- `PUT /organization/contact` - Update contact information
- `GET /organization/legal` - Get legal information
- `PUT /organization/legal` - Update legal information
- `GET /organization/modules` - Get enabled modules
- `PUT /organization/modules` - Update enabled modules

---

### Remaining Features to Implement

#### 1. Branch Level Settings

**Priority:** Medium
**Complexity:** Medium

**Description:**
Fine-tune settings at branch level that can override organization-level defaults.

**Implementation Plan:**

**Backend Tasks:**

1. Create `branchSettings.service.ts` with methods:
   - `getBranchSettings(branchId)` - Get all settings for a branch
   - `updateBranchSettings(branchId, settings)` - Update branch settings
   - `getEffectiveSettings(branchId)` - Get merged org + branch settings

2. Add new routes to `organization.routes.ts`:

   ```
   GET /branches/:branchId/settings
   PUT /branches/:branchId/settings
   ```

3. Settings to support:
   - Tax rates (GST, other applicable taxes)
   - Fee rules (late fee percentage, grace period days)
   - Communication settings (SMS provider, email templates)
   - Holidays (branch-specific holidays)
   - Weekly offs (which days are off)

**Database Schema:**

```typescript
interface BranchSettings {
  branchId: ObjectId;
  tenantId: ObjectId;
  taxSettings: {
    gstRate: number;
    igstRate?: number;
    cessRate?: number;
  };
  feeRules: {
    lateFeePercentage: number;
    gracePeriodDays: number;
    lateFeeMaxAmount?: number;
  };
  communicationSettings: {
    smsEnabled: boolean;
    emailEnabled: boolean;
    whatsappEnabled: boolean;
  };
  holidays: Array<{
    date: Date;
    name: string;
    type: 'public' | 'custom';
  }>;
  weeklyOffs: number[]; // 0=Sunday, 1=Monday, etc.
  createdAt: Date;
  updatedAt: Date;
}
```

**Frontend Tasks:**

1. Create `apps/web/src/app/(dashboard)/organization/branches/[id]/settings/page.tsx`
2. Add settings tabs: Tax, Fee Rules, Communication, Holidays, Weekly Offs
3. Add "Settings" button in branches list

**Estimated Components:** 5 new files

---

#### 2. Schedule Jobs

**Priority:** Medium
**Complexity:** High

**Description:**
Configure background jobs for automated tasks.

**Implementation Plan:**

**Backend Tasks:**

1. Create `apps/api/src/modules/scheduler/` module:
   - `scheduler.service.ts` - Job management
   - `scheduler.controller.ts` - API handlers
   - `scheduler.routes.ts` - Route definitions
   - `jobs/` directory for individual job implementations

2. Job Types to Implement:
   - `dailyAttendanceSummary` - Send daily attendance report
   - `feeReminders` - Send fee due reminders
   - `reportGeneration` - Generate scheduled reports
   - `dataBackup` - Backup tenant data

3. Use node-cron or Bull queue for job scheduling

4. API Endpoints:
   ```
   GET /scheduler/jobs - List all scheduled jobs
   POST /scheduler/jobs - Create new job
   PUT /scheduler/jobs/:id - Update job
   DELETE /scheduler/jobs/:id - Delete job
   GET /scheduler/jobs/:id/history - Get job execution history
   POST /scheduler/jobs/:id/run - Manually trigger job
   ```

**Database Schema:**

```typescript
interface ScheduledJob {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId?: ObjectId;
  name: string;
  type: 'attendance_summary' | 'fee_reminder' | 'report_generation' | 'data_backup';
  schedule: string; // cron expression
  config: Record<string, unknown>;
  status: 'active' | 'paused' | 'disabled';
  lastRun?: Date;
  nextRun: Date;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface JobExecution {
  _id: ObjectId;
  jobId: ObjectId;
  tenantId: ObjectId;
  status: 'running' | 'success' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  result?: Record<string, unknown>;
  error?: string;
}
```

**Frontend Tasks:**

1. Create `apps/web/src/app/(dashboard)/organization/schedule-jobs/page.tsx`
2. Job list with status indicators
3. Create/Edit job modal with cron builder
4. Job execution history view

**Dependencies:** node-cron or bull-mq package

**Estimated Components:** 8+ new files

---

#### 3. Custom Form Settings

**Priority:** Medium
**Complexity:** High

**Description:**
Configure custom fields and forms for various modules (admission forms, student profiles, etc.)

**Implementation Plan:**

**Backend Tasks:**

1. Create `apps/api/src/modules/customFields/` module:
   - `customField.service.ts`
   - `customField.controller.ts`
   - `customField.routes.ts`

2. API Endpoints:
   ```
   GET /custom-fields?module=admission - Get custom fields for a module
   POST /custom-fields - Create custom field
   PUT /custom-fields/:id - Update custom field
   DELETE /custom-fields/:id - Delete custom field
   PUT /custom-fields/reorder - Reorder fields
   ```

**Database Schema:**

```typescript
interface CustomField {
  _id: ObjectId;
  tenantId: ObjectId;
  module: 'admission' | 'student' | 'staff' | 'fee' | 'attendance';
  fieldName: string;
  fieldKey: string; // unique identifier
  fieldType:
    | 'text'
    | 'number'
    | 'date'
    | 'select'
    | 'multiselect'
    | 'checkbox'
    | 'file'
    | 'textarea';
  options?: string[]; // for select/multiselect
  required: boolean;
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
  };
  placeholder?: string;
  helpText?: string;
  displayOrder: number;
  showInList: boolean;
  showInFilters: boolean;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}
```

**Frontend Tasks:**

1. Create `apps/web/src/app/(dashboard)/organization/custom-fields/page.tsx`
2. Drag-and-drop field builder
3. Field type selector with preview
4. Validation rule configuration

**Estimated Components:** 6+ new files

---

#### 4. Sort Settings

**Priority:** Low
**Complexity:** Low

**Description:**
Define default sorting preferences for lists and reports across modules.

**Implementation Plan:**

**Backend Tasks:**

1. Add to `settings.service.ts`:
   - `getSortSettings()` - Get sort preferences
   - `updateSortSettings()` - Update sort preferences

2. Store in tenant settings:
   ```typescript
   sortSettings: {
     students: { field: 'displayName', order: 'asc' },
     staff: { field: 'displayName', order: 'asc' },
     transactions: { field: 'createdAt', order: 'desc' },
     // ... other modules
   }
   ```

**Frontend Tasks:**

1. Add "Sort Settings" section to Organization Settings page
2. Module-wise sort configuration dropdowns

**Estimated Components:** 2-3 file modifications

---

#### 5. Undo Approvals

**Priority:** Medium
**Complexity:** Medium

**Description:**
Ability to reverse approved actions with proper audit trail and permissions.

**Implementation Plan:**

**Backend Tasks:**

1. Create `apps/api/src/modules/approvals/` module:
   - `approval.service.ts`
   - `approval.controller.ts`
   - `approval.routes.ts`

2. API Endpoints:

   ```
   GET /approvals - List pending approvals
   GET /approvals/history - List approval history
   POST /approvals/:type/:id/undo - Undo an approval
   ```

3. Implement undo logic for:
   - Concession approvals
   - Fee cancellation approvals
   - Leave approvals (future)

**Database Schema:**

```typescript
interface ApprovalAudit {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  entityType: 'concession' | 'fee_cancellation' | 'leave' | 'certificate';
  entityId: ObjectId;
  action: 'approved' | 'rejected' | 'undone';
  performedBy: ObjectId;
  performedAt: Date;
  previousState: Record<string, unknown>;
  newState: Record<string, unknown>;
  reason?: string;
  metadata?: Record<string, unknown>;
}
```

**Frontend Tasks:**

1. Create `apps/web/src/app/(dashboard)/organization/approvals/page.tsx`
2. Approval history with undo actions
3. Approval audit trail view

**Estimated Components:** 5+ new files

---

#### 6. Approval Email Settings

**Priority:** Medium
**Complexity:** Medium

**Description:**
Configure email notifications for approval workflows.

**Implementation Plan:**

**Backend Tasks:**

1. Add to settings service:
   - `getApprovalEmailSettings()`
   - `updateApprovalEmailSettings()`

2. Email Template System:
   ```typescript
   interface ApprovalEmailSettings {
     enabled: boolean;
     templates: {
       concessionRequest: EmailTemplate;
       concessionApproved: EmailTemplate;
       concessionRejected: EmailTemplate;
       feeCancellationRequest: EmailTemplate;
       feeCancellationApproved: EmailTemplate;
       // ... other templates
     };
     triggers: {
       onRequest: boolean;
       onApproval: boolean;
       onRejection: boolean;
     };
     recipients: {
       includeRequester: boolean;
       includeApprover: boolean;
       additionalEmails: string[];
     };
   }
   ```

**Frontend Tasks:**

1. Add "Approval Notifications" section to settings
2. Template editor with variable placeholders
3. Trigger configuration checkboxes

**Estimated Components:** 3-4 file modifications + email templates

---

## Module 2: Finance Module (Part 1)

### Implementation Status Summary

| Category           | Total Features | Implemented | Remaining |
| ------------------ | -------------- | ----------- | --------- |
| Fee Counter        | 3              | 1           | 2         |
| Fee Management     | 2              | 1           | 1         |
| Due Reports        | 6              | 1           | 5         |
| Collection Reports | 6              | 3           | 3         |
| **Total**          | **17**         | **6**       | **11**    |

---

### Implemented Features

#### 1. Make Payment (Fee Counter)

**Status:** Complete

**Backend:**

- `apps/api/src/modules/finance/feeTransaction.controller.ts`
- `apps/api/src/modules/finance/feeTransaction.service.ts`

**Frontend:**

- `apps/web/src/app/(dashboard)/finance/fee-counter/page.tsx`

**API Endpoints:**

- `POST /finance/transactions/collect` - Collect fee payment

**Features:**

- Multiple payment modes: cash, card, UPI, netbanking, cheque, DD, wallet
- Payment details capture (reference numbers, bank name, etc.)
- Automatic receipt number generation
- Component-wise payment
- Fine amount collection
- Transaction cancellation and refund

---

#### 2. Assign Fee To Students

**Status:** Complete

**Backend:**

- `apps/api/src/modules/finance/feeAssignment.controller.ts`
- `apps/api/src/modules/finance/feeAssignment.service.ts`

**API Endpoints:**

- `GET /finance/assignments` - List fee assignments
- `GET /finance/assignments/student/:studentId` - Get student's fee assignments
- `GET /finance/assignments/:id` - Get assignment details
- `POST /finance/assignments` - Create fee assignment
- `POST /finance/assignments/bulk` - Bulk create assignments
- `PUT /finance/assignments/:id` - Update assignment

---

#### 3. Fee Day Sheet (Collection Reports)

**Status:** Complete

**API Endpoint:**

- `GET /finance/transactions/day-sheet?date=YYYY-MM-DD`

**Returns:**

- Collections by payment mode
- Total transactions count
- Total fee collected
- Total fine collected

---

#### 4. Collection Summary (Collection Reports)

**Status:** Complete

**API Endpoint:**

- `GET /finance/transactions/summary?fromDate=&toDate=`

**Returns:**

- Monthly breakdown of collections
- Period totals

---

#### 5. Fee Transactions List

**Status:** Complete

**Frontend:**

- `apps/web/src/app/(dashboard)/finance/transactions/page.tsx`

**API Endpoint:**

- `GET /finance/transactions` - With filters (date, student, payment mode, status)

---

#### 6. Concessions (Basic)

**Status:** Complete

**Backend:**

- `apps/api/src/modules/finance/concession.controller.ts`
- `apps/api/src/modules/finance/concession.service.ts`

**API Endpoints:**

- `GET /finance/concessions` - List concessions
- `GET /finance/concessions/stats` - Concession statistics
- `GET /finance/concessions/:id` - Get concession details
- `POST /finance/concessions` - Create concession request
- `POST /finance/concessions/:id/approve` - Approve concession
- `POST /finance/concessions/:id/reject` - Reject concession

---

### Remaining Features to Implement

#### 1. Fee Bulk Upload

**Priority:** High
**Complexity:** Medium

**Description:**
Bulk upload fee data for multiple students or academic sessions.

**Implementation Plan:**

**Backend Tasks:**

1. Create `apps/api/src/modules/finance/feeImport.controller.ts`
2. Add to `feeAssignment.service.ts`:
   - `parseFeeUpload(file)` - Parse Excel/CSV file
   - `validateFeeUpload(data)` - Validate parsed data
   - `processFeeUpload(data)` - Process and create assignments

3. API Endpoints:
   ```
   POST /finance/assignments/upload - Upload fee data file
   GET /finance/assignments/upload/template - Download template
   GET /finance/assignments/upload/:id/status - Check upload status
   ```

**Frontend Tasks:**

1. Add "Bulk Upload" tab to fee management page
2. File upload component with drag-drop
3. Preview table with validation errors
4. Upload progress indicator

**Template Columns:**

- Student Admission Number (required)
- Fee Structure Code (required)
- Academic Batch (required)
- Installment Override (optional)
- Custom Amount (optional)
- Remarks (optional)

**Estimated Components:** 4+ new files

---

#### 2. Concession Bulk Upload

**Priority:** High
**Complexity:** Medium

**Description:**
Bulk upload concession data for multiple students.

**Implementation Plan:**

**Backend Tasks:**

1. Add to concession service:
   - `parseConcessionUpload(file)`
   - `validateConcessionUpload(data)`
   - `processConcessionUpload(data)`

2. API Endpoints:
   ```
   POST /finance/concessions/upload
   GET /finance/concessions/upload/template
   ```

**Template Columns:**

- Student Admission Number (required)
- Concession Type (required)
- Concession Name (required)
- Discount Type (percentage/fixed)
- Discount Value (required)
- Applied To Components (optional, comma-separated)
- Reason (required)

**Estimated Components:** 3+ new files

---

#### 3. Yet to Assign Fee Reports

**Priority:** High
**Complexity:** Low

**Description:**
Report showing students who haven't been assigned fee structures.

**Implementation Plan:**

**Backend Tasks:**

1. Add to `feeAssignment.service.ts`:

   ```typescript
   async getUnassignedStudents(tenantId, branchId, academicBatchId, filters) {
     // Find all active students
     // Left join with fee assignments
     // Return students without assignments
   }
   ```

2. API Endpoint:
   ```
   GET /finance/assignments/unassigned?academicBatchId=&classId=&sectionId=
   ```

**Frontend Tasks:**

1. Add "Unassigned Students" tab to fee management
2. Filter by class/section
3. Quick assign action

**Estimated Components:** 2-3 file modifications

---

#### 4. Due Reports

**4.1 Total Paid and Due Report**
**Priority:** High

**API Endpoint:**

```
GET /finance/reports/dues/summary?academicBatchId=&groupBy=branch
```

**Returns:**

- Branch-wise total fee, paid, due, concession
- Group-wise totals
- Percentage collection metrics

**4.2 Class Wise Due Report**
**Priority:** High

**API Endpoint:**

```
GET /finance/reports/dues/class-wise?academicBatchId=&branchId=
```

**Returns:**

- Per class: total students, total fee, paid, due
- Section breakdown optional

**4.3 Branch Wise Due Report**
**Priority:** High

**API Endpoint:**

```
GET /finance/reports/dues/branch-wise?academicBatchId=
```

**Returns:**

- Per branch: total students, total fee, paid, due, collection %

**4.4 Student Wise Due Reports**
**Priority:** High

**API Endpoint:**

```
GET /finance/reports/dues/student-wise?academicBatchId=&classId=&sectionId=
```

**Returns:**

- Per student: name, admission no, class, total fee, paid, due

**4.5 Sibling Due Reports**
**Priority:** Medium

**API Endpoint:**

```
GET /finance/reports/dues/siblings?academicBatchId=
```

**Returns:**

- Grouped by parent/guardian
- Combined dues for all siblings

**4.6 Installment Wise Student Fee Due Reports**
**Priority:** Medium

**API Endpoint:**

```
GET /finance/reports/dues/installment-wise?academicBatchId=&installmentNumber=
```

**Returns:**

- Per student per installment: due date, amount, paid, balance

---

**Implementation Plan for Due Reports:**

**Backend Tasks:**

1. Create `apps/api/src/modules/finance/reports.controller.ts`
2. Create `apps/api/src/modules/finance/reports.service.ts`
3. Add routes to `finance.routes.ts`

**Frontend Tasks:**

1. Create `apps/web/src/app/(dashboard)/finance/dues/page.tsx` (partially exists)
2. Add report type selector
3. Filter panels for each report type
4. Data tables with export functionality

**Estimated Components:** 4+ new files

---

#### 5. Collection Reports (Remaining)

**5.1 Fee Type Report**
**Priority:** High

**API Endpoint:**

```
GET /finance/reports/collections/by-fee-type?fromDate=&toDate=&branchId=
```

**Returns:**

- Per fee type (tuition, transport, hostel, exam): count, amount

**5.2 Student Fee Statement**
**Priority:** High

**API Endpoint:**

```
GET /finance/reports/student/:studentId/statement?academicBatchId=
```

**Returns:**

- Complete fee statement for a student
- All components, payments, concessions, balance
- PDF generation capability

**5.3 Fee Type Wise Transactions**
**Priority:** High

**API Endpoint:**

```
GET /finance/reports/transactions/by-fee-type?feeType=&fromDate=&toDate=
```

**Returns:**

- All transactions for a specific fee type
- Student details, receipt details, amounts

**5.4 Class Wise Concession Report**
**Priority:** Medium

**API Endpoint:**

```
GET /finance/reports/concessions/class-wise?academicBatchId=&branchId=
```

**Returns:**

- Per class: total students with concession, total amount

**5.5 Student Wise Concession Report**
**Priority:** Medium

**API Endpoint:**

```
GET /finance/reports/concessions/student-wise?academicBatchId=&classId=
```

**Returns:**

- Per student: concession type, amount, status

---

**Implementation Plan for Collection Reports:**

**Backend Tasks:**

1. Add to `reports.service.ts`:
   - `getFeeTypeReport()`
   - `getStudentStatement()`
   - `getFeeTypeWiseTransactions()`
   - `getClassWiseConcessionReport()`
   - `getStudentWiseConcessionReport()`

2. Add PDF generation for student statements using pdfkit or puppeteer

**Frontend Tasks:**

1. Create dedicated report pages or tabs
2. Add print/export functionality

**Estimated Components:** 5+ new files

---

## Priority Implementation Order

### Phase 1: Critical Features (Week 1)

1. **Yet to Assign Fee Reports** - Essential for fee management
2. **Due Reports (Basic 4)** - Core finance reporting
3. **Fee Type Report** - Collection analysis
4. **Student Fee Statement** - Parent/student requirement

### Phase 2: Bulk Operations (Week 2)

5. **Fee Bulk Upload** - Operational efficiency
6. **Concession Bulk Upload** - Operational efficiency
7. **Branch Level Settings** - Multi-branch support

### Phase 3: Advanced Features (Week 3)

8. **Remaining Due Reports** - Sibling, Installment-wise
9. **Remaining Collection Reports** - Concession reports
10. **Schedule Jobs** - Automation
11. **Custom Form Settings** - Flexibility

### Phase 4: Approvals & Misc (Week 4)

12. **Undo Approvals** - Audit compliance
13. **Approval Email Settings** - Notifications
14. **Sort Settings** - User preference

---

## API Endpoints Summary

### New Endpoints Required

#### Organization Module

```
GET    /branches/:branchId/settings
PUT    /branches/:branchId/settings

GET    /scheduler/jobs
POST   /scheduler/jobs
PUT    /scheduler/jobs/:id
DELETE /scheduler/jobs/:id
GET    /scheduler/jobs/:id/history
POST   /scheduler/jobs/:id/run

GET    /custom-fields
POST   /custom-fields
PUT    /custom-fields/:id
DELETE /custom-fields/:id
PUT    /custom-fields/reorder

GET    /approvals
GET    /approvals/history
POST   /approvals/:type/:id/undo
```

#### Finance Module

```
POST   /finance/assignments/upload
GET    /finance/assignments/upload/template
GET    /finance/assignments/unassigned

POST   /finance/concessions/upload
GET    /finance/concessions/upload/template

GET    /finance/reports/dues/summary
GET    /finance/reports/dues/class-wise
GET    /finance/reports/dues/branch-wise
GET    /finance/reports/dues/student-wise
GET    /finance/reports/dues/siblings
GET    /finance/reports/dues/installment-wise

GET    /finance/reports/collections/by-fee-type
GET    /finance/reports/transactions/by-fee-type
GET    /finance/reports/student/:studentId/statement
GET    /finance/reports/concessions/class-wise
GET    /finance/reports/concessions/student-wise
```

---

## Database Collections to Add

1. **branchSettings** - Branch-level configuration overrides
2. **scheduledJobs** - Scheduled job definitions
3. **jobExecutions** - Job execution history
4. **customFields** - Custom field definitions
5. **approvalAudits** - Approval action audit trail

---

## Dependencies to Add

```json
{
  "node-cron": "^3.0.3",
  "xlsx": "^0.18.5",
  "pdfkit": "^0.14.0"
}
```

---

## Testing Checklist

### Organization Module

- [ ] Branch settings CRUD operations
- [ ] Settings inheritance (org → branch)
- [ ] Schedule job creation and execution
- [ ] Custom field creation and rendering
- [ ] Approval undo with state restoration
- [ ] Email notification sending

### Finance Module

- [ ] Bulk upload validation
- [ ] Bulk upload error handling
- [ ] All due reports with various filters
- [ ] All collection reports with date ranges
- [ ] Student statement PDF generation
- [ ] Report export (CSV, Excel)

---

## Notes

1. All new endpoints should follow existing authentication and RBAC patterns
2. All reports should support pagination for large datasets
3. Export functionality should be available for all reports
4. Proper error handling for bulk operations (partial success handling)
5. Audit logging for all financial operations
