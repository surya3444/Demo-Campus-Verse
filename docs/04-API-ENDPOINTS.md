# Campus Verse - API Endpoints Reference

## Base Configuration

```
Base URL: /api/v1
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>
X-Branch-Id: <BRANCH_ID>  (required for branch-scoped operations)
```

## Response Format

```javascript
// Success
{ success: true, data: {...}, meta: { page, limit, total, totalPages } }

// Error
{ success: false, error: { code: "ERR_CODE", message: "...", details: [] } }
```

---

## 1. Authentication

| Method | Endpoint              | Description                     |
| ------ | --------------------- | ------------------------------- |
| POST   | /auth/login           | User login                      |
| POST   | /auth/logout          | User logout                     |
| POST   | /auth/refresh         | Refresh access token            |
| POST   | /auth/forgot-password | Request password reset          |
| POST   | /auth/reset-password  | Reset password with token       |
| POST   | /auth/change-password | Change password (authenticated) |
| GET    | /auth/me              | Get current user profile        |
| PUT    | /auth/me              | Update current user profile     |

### Request/Response Examples

```javascript
// POST /auth/login
Request: { email: "admin@xyz.edu", password: "..." }
Response: {
  accessToken: "...",
  refreshToken: "...",
  user: { id, email, name, role, branches }
}

// POST /auth/refresh
Request: { refreshToken: "..." }
Response: { accessToken: "...", refreshToken: "..." }
```

---

## 2. Organization

### Branches

| Method | Endpoint                         | Description           |
| ------ | -------------------------------- | --------------------- |
| GET    | /organization/branches           | List all branches     |
| POST   | /organization/branches           | Create branch         |
| GET    | /organization/branches/:id       | Get branch details    |
| PUT    | /organization/branches/:id       | Update branch         |
| DELETE | /organization/branches/:id       | Delete branch         |
| GET    | /organization/branches/:id/stats | Get branch statistics |

### Users

| Method | Endpoint                               | Description         |
| ------ | -------------------------------------- | ------------------- |
| GET    | /organization/users                    | List users          |
| POST   | /organization/users                    | Create user         |
| GET    | /organization/users/:id                | Get user details    |
| PUT    | /organization/users/:id                | Update user         |
| DELETE | /organization/users/:id                | Delete user         |
| PUT    | /organization/users/:id/status         | Update user status  |
| POST   | /organization/users/:id/reset-password | Reset user password |

### Roles

| Method | Endpoint                | Description      |
| ------ | ----------------------- | ---------------- |
| GET    | /organization/roles     | List roles       |
| POST   | /organization/roles     | Create role      |
| GET    | /organization/roles/:id | Get role details |
| PUT    | /organization/roles/:id | Update role      |
| DELETE | /organization/roles/:id | Delete role      |

### Academic Batches

| Method | Endpoint                                    | Description       |
| ------ | ------------------------------------------- | ----------------- |
| GET    | /organization/academic-batches              | List batches      |
| POST   | /organization/academic-batches              | Create batch      |
| GET    | /organization/academic-batches/:id          | Get batch details |
| PUT    | /organization/academic-batches/:id          | Update batch      |
| DELETE | /organization/academic-batches/:id          | Delete batch      |
| PUT    | /organization/academic-batches/:id/activate | Set as current    |

### Classes

| Method | Endpoint                  | Description       |
| ------ | ------------------------- | ----------------- |
| GET    | /organization/classes     | List classes      |
| POST   | /organization/classes     | Create class      |
| GET    | /organization/classes/:id | Get class details |
| PUT    | /organization/classes/:id | Update class      |
| DELETE | /organization/classes/:id | Delete class      |

### Sections

| Method | Endpoint                                | Description    |
| ------ | --------------------------------------- | -------------- |
| GET    | /organization/classes/:classId/sections | List sections  |
| POST   | /organization/classes/:classId/sections | Create section |
| PUT    | /organization/sections/:id              | Update section |
| DELETE | /organization/sections/:id              | Delete section |

### Subjects

| Method | Endpoint                   | Description    |
| ------ | -------------------------- | -------------- |
| GET    | /organization/subjects     | List subjects  |
| POST   | /organization/subjects     | Create subject |
| PUT    | /organization/subjects/:id | Update subject |
| DELETE | /organization/subjects/:id | Delete subject |

### Settings

| Method | Endpoint                       | Description            |
| ------ | ------------------------------ | ---------------------- |
| GET    | /organization/settings         | Get all settings       |
| GET    | /organization/settings/:module | Get module settings    |
| PUT    | /organization/settings/:module | Update module settings |

---

## 3. Students

| Method | Endpoint                         | Description                |
| ------ | -------------------------------- | -------------------------- |
| GET    | /students                        | List students              |
| POST   | /students                        | Create student             |
| GET    | /students/:id                    | Get student details        |
| PUT    | /students/:id                    | Update student             |
| DELETE | /students/:id                    | Delete student (soft)      |
| PUT    | /students/:id/status             | Update status              |
| POST   | /students/:id/promote            | Promote student            |
| POST   | /students/:id/transfer           | Transfer to another branch |
| GET    | /students/:id/history            | Enrollment history         |
| GET    | /students/:id/fee-summary        | Fee summary                |
| GET    | /students/:id/attendance-summary | Attendance summary         |
| POST   | /students/bulk-upload            | Bulk upload students       |
| POST   | /students/bulk-promote           | Bulk promote               |
| GET    | /students/export                 | Export to CSV/Excel        |

### Enrollments

| Method | Endpoint                  | Description       |
| ------ | ------------------------- | ----------------- |
| GET    | /students/:id/enrollments | Get enrollments   |
| POST   | /students/:id/enrollments | Create enrollment |
| PUT    | /students/enrollments/:id | Update enrollment |

### Reports

| Method | Endpoint                       | Description         |
| ------ | ------------------------------ | ------------------- |
| GET    | /students/reports/class-wise   | Class-wise report   |
| GET    | /students/reports/section-wise | Section-wise report |
| GET    | /students/reports/active       | Active students     |

### Query Parameters

```
GET /students?page=1&limit=20&sortBy=createdAt&sortOrder=desc
  &status=active
  &classId=xxx
  &sectionId=xxx
  &search=john
  &academicBatchId=xxx
```

---

## 4. Admissions

### Leads

| Method | Endpoint                       | Description            |
| ------ | ------------------------------ | ---------------------- |
| GET    | /admissions/leads              | List leads             |
| POST   | /admissions/leads              | Create lead            |
| GET    | /admissions/leads/:id          | Get lead               |
| PUT    | /admissions/leads/:id          | Update lead            |
| DELETE | /admissions/leads/:id          | Delete lead            |
| PUT    | /admissions/leads/:id/stage    | Update stage           |
| POST   | /admissions/leads/:id/followup | Add followup           |
| POST   | /admissions/leads/:id/convert  | Convert to application |

### Applications

| Method | Endpoint                             | Description        |
| ------ | ------------------------------------ | ------------------ |
| GET    | /admissions/applications             | List applications  |
| POST   | /admissions/applications             | Create application |
| GET    | /admissions/applications/:id         | Get application    |
| PUT    | /admissions/applications/:id         | Update application |
| PUT    | /admissions/applications/:id/status  | Update status      |
| POST   | /admissions/applications/:id/enroll  | Enroll as student  |
| POST   | /admissions/applications/bulk-upload | Bulk upload        |

### Settings & Reports

| Method | Endpoint                         | Description          |
| ------ | -------------------------------- | -------------------- |
| GET    | /admissions/settings             | Get settings         |
| PUT    | /admissions/settings             | Update settings      |
| GET    | /admissions/reports/leads        | Leads report         |
| GET    | /admissions/reports/applications | Applications report  |
| GET    | /admissions/reports/conversion   | Conversion analytics |

---

## 5. Finance

### Fee Structures

| Method | Endpoint                          | Description      |
| ------ | --------------------------------- | ---------------- |
| GET    | /finance/fee-structures           | List structures  |
| POST   | /finance/fee-structures           | Create structure |
| GET    | /finance/fee-structures/:id       | Get structure    |
| PUT    | /finance/fee-structures/:id       | Update structure |
| DELETE | /finance/fee-structures/:id       | Delete structure |
| POST   | /finance/fee-structures/:id/clone | Clone structure  |

### Fee Assignments

| Method | Endpoint                      | Description           |
| ------ | ----------------------------- | --------------------- |
| GET    | /finance/fee-assignments      | List assignments      |
| POST   | /finance/fee-assignments      | Assign fee to student |
| GET    | /finance/fee-assignments/:id  | Get assignment        |
| PUT    | /finance/fee-assignments/:id  | Update assignment     |
| POST   | /finance/fee-assignments/bulk | Bulk assign           |

### Transactions (Fee Collection)

| Method | Endpoint                          | Description          |
| ------ | --------------------------------- | -------------------- |
| POST   | /finance/transactions             | Collect fee          |
| GET    | /finance/transactions             | List transactions    |
| GET    | /finance/transactions/:id         | Get transaction      |
| GET    | /finance/transactions/:id/receipt | Generate receipt PDF |
| POST   | /finance/transactions/:id/cancel  | Cancel transaction   |
| POST   | /finance/transactions/:id/refund  | Refund               |

### Concessions

| Method | Endpoint                         | Description        |
| ------ | -------------------------------- | ------------------ |
| GET    | /finance/concessions             | List concessions   |
| POST   | /finance/concessions             | Request concession |
| GET    | /finance/concessions/:id         | Get concession     |
| PUT    | /finance/concessions/:id/approve | Approve            |
| PUT    | /finance/concessions/:id/reject  | Reject             |

### Due Reports

| Method | Endpoint                               | Description       |
| ------ | -------------------------------------- | ----------------- |
| GET    | /finance/reports/dues/total            | Total dues        |
| GET    | /finance/reports/dues/branch-wise      | Branch-wise dues  |
| GET    | /finance/reports/dues/class-wise       | Class-wise dues   |
| GET    | /finance/reports/dues/student-wise     | Student-wise dues |
| GET    | /finance/reports/dues/installment-wise | Installment-wise  |

### Collection Reports

| Method | Endpoint                               | Description |
| ------ | -------------------------------------- | ----------- |
| GET    | /finance/reports/collections/day-sheet | Daily sheet |
| GET    | /finance/reports/collections/fee-type  | By fee type |
| GET    | /finance/reports/collections/summary   | Summary     |

### Settings

| Method | Endpoint                | Description     |
| ------ | ----------------------- | --------------- |
| GET    | /finance/settings       | Get settings    |
| PUT    | /finance/settings       | Update settings |
| GET    | /finance/settings/banks | Bank settings   |
| PUT    | /finance/settings/banks | Update banks    |

---

## 6. Attendance

### Student Attendance

| Method | Endpoint                                | Description                   |
| ------ | --------------------------------------- | ----------------------------- |
| GET    | /attendance/students                    | Get attendance for date/class |
| POST   | /attendance/students                    | Mark attendance               |
| PUT    | /attendance/students/:id                | Update record                 |
| GET    | /attendance/students/:studentId/history | Student history               |

### Reports

| Method | Endpoint                         | Description     |
| ------ | -------------------------------- | --------------- |
| GET    | /attendance/reports/daily        | Daily report    |
| GET    | /attendance/reports/class-wise   | Class-wise      |
| GET    | /attendance/reports/student-wise | Student-wise    |
| GET    | /attendance/reports/monthly      | Monthly summary |

### Settings

| Method | Endpoint                 | Description     |
| ------ | ------------------------ | --------------- |
| GET    | /attendance/settings     | Get settings    |
| PUT    | /attendance/settings     | Update settings |
| GET    | /attendance/holidays     | List holidays   |
| POST   | /attendance/holidays     | Add holiday     |
| DELETE | /attendance/holidays/:id | Delete holiday  |

---

## 7. HR

### Staff

| Method | Endpoint              | Description   |
| ------ | --------------------- | ------------- |
| GET    | /hr/staff             | List staff    |
| POST   | /hr/staff             | Create staff  |
| GET    | /hr/staff/:id         | Get staff     |
| PUT    | /hr/staff/:id         | Update staff  |
| DELETE | /hr/staff/:id         | Delete staff  |
| PUT    | /hr/staff/:id/status  | Update status |
| POST   | /hr/staff/bulk-upload | Bulk upload   |

### Staff Attendance

| Method | Endpoint                       | Description             |
| ------ | ------------------------------ | ----------------------- |
| GET    | /hr/attendance                 | Get attendance for date |
| POST   | /hr/attendance                 | Mark attendance         |
| PUT    | /hr/attendance/:id             | Update                  |
| GET    | /hr/attendance/my              | My attendance           |
| GET    | /hr/attendance/reports/daily   | Daily report            |
| GET    | /hr/attendance/reports/monthly | Monthly report          |

### Leaves

| Method | Endpoint               | Description   |
| ------ | ---------------------- | ------------- |
| GET    | /hr/leaves             | List requests |
| POST   | /hr/leaves             | Apply leave   |
| GET    | /hr/leaves/:id         | Get leave     |
| PUT    | /hr/leaves/:id/approve | Approve       |
| PUT    | /hr/leaves/:id/reject  | Reject        |
| DELETE | /hr/leaves/:id         | Cancel        |
| GET    | /hr/leaves/my          | My leaves     |
| GET    | /hr/leaves/balance     | Balances      |
| GET    | /hr/leaves/reports     | Reports       |

### Departments & Designations

| Method | Endpoint         | Description        |
| ------ | ---------------- | ------------------ |
| GET    | /hr/departments  | List departments   |
| POST   | /hr/departments  | Create department  |
| GET    | /hr/designations | List designations  |
| POST   | /hr/designations | Create designation |

### Workload

| Method | Endpoint         | Description     |
| ------ | ---------------- | --------------- |
| GET    | /hr/workload     | Get assignments |
| POST   | /hr/workload     | Assign workload |
| PUT    | /hr/workload/:id | Update          |

### Settings

| Method | Endpoint     | Description     |
| ------ | ------------ | --------------- |
| GET    | /hr/settings | Get settings    |
| PUT    | /hr/settings | Update settings |

---

## 8. Communications

### SMS

| Method | Endpoint                      | Description     |
| ------ | ----------------------------- | --------------- |
| POST   | /communications/sms/send      | Send SMS        |
| GET    | /communications/sms/logs      | SMS logs        |
| GET    | /communications/sms/templates | List templates  |
| POST   | /communications/sms/templates | Create template |
| GET    | /communications/sms/balance   | Check balance   |

### Announcements

| Method | Endpoint                                  | Description |
| ------ | ----------------------------------------- | ----------- |
| GET    | /communications/announcements             | List        |
| POST   | /communications/announcements             | Create      |
| GET    | /communications/announcements/:id         | Get         |
| PUT    | /communications/announcements/:id         | Update      |
| DELETE | /communications/announcements/:id         | Delete      |
| PUT    | /communications/announcements/:id/publish | Publish     |

### Events

| Method | Endpoint                   | Description |
| ------ | -------------------------- | ----------- |
| GET    | /communications/events     | List        |
| POST   | /communications/events     | Create      |
| GET    | /communications/events/:id | Get         |
| PUT    | /communications/events/:id | Update      |
| DELETE | /communications/events/:id | Delete      |

### Settings

| Method | Endpoint                 | Description |
| ------ | ------------------------ | ----------- |
| GET    | /communications/settings | Get         |
| PUT    | /communications/settings | Update      |

---

## 9. Dashboard & Reports

### Owner Dashboard

| Method | Endpoint                    | Description        |
| ------ | --------------------------- | ------------------ |
| GET    | /dashboard/owner/kpis       | All KPIs           |
| GET    | /dashboard/owner/students   | Student metrics    |
| GET    | /dashboard/owner/finance    | Finance metrics    |
| GET    | /dashboard/owner/attendance | Attendance metrics |
| GET    | /dashboard/owner/staff      | Staff metrics      |
| GET    | /dashboard/owner/admissions | Admission metrics  |

### Branch Dashboard

| Method | Endpoint                | Description     |
| ------ | ----------------------- | --------------- |
| GET    | /dashboard/branch/kpis  | Branch KPIs     |
| GET    | /dashboard/branch/today | Today's summary |

### Reports

| Method | Endpoint           | Description           |
| ------ | ------------------ | --------------------- |
| GET    | /reports/custom    | Custom report builder |
| POST   | /reports/generate  | Generate report       |
| GET    | /reports/scheduled | Scheduled reports     |
| POST   | /reports/schedule  | Schedule report       |

### Audit

| Method | Endpoint           | Description |
| ------ | ------------------ | ----------- |
| GET    | /audit/logs        | Audit logs  |
| GET    | /audit/logs/export | Export logs |

---

## Query Parameter Reference

### Pagination

```
page=1          # Page number (default: 1)
limit=20        # Items per page (default: 20, max: 100)
```

### Sorting

```
sortBy=createdAt     # Field to sort by
sortOrder=desc       # asc or desc
```

### Filtering

```
status=active              # Status filter
branchId=xxx               # Branch filter
classId=xxx                # Class filter
sectionId=xxx              # Section filter
academicBatchId=xxx        # Academic batch filter
fromDate=2024-01-01        # Date range start
toDate=2024-12-31          # Date range end
search=keyword             # Text search
```

### Field Selection

```
fields=id,name,email       # Only return specified fields
```

---

## Error Codes

| Code                     | HTTP Status | Description                    |
| ------------------------ | ----------- | ------------------------------ |
| AUTH_INVALID_CREDENTIALS | 401         | Invalid email or password      |
| AUTH_TOKEN_EXPIRED       | 401         | Access token expired           |
| AUTH_UNAUTHORIZED        | 403         | Not authorized for this action |
| VALIDATION_ERROR         | 400         | Request validation failed      |
| NOT_FOUND                | 404         | Resource not found             |
| DUPLICATE_ENTRY          | 409         | Duplicate entry                |
| RATE_LIMIT_EXCEEDED      | 429         | Too many requests              |
| INTERNAL_ERROR           | 500         | Internal server error          |
