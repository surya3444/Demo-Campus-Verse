# Missing Modules Specification

This document details modules that are not included in the original 10-week plan but are essential for a complete education ERP.

---

## 1. Library Management Module

### Overview
Manage library resources, book circulation, and digital library integration.

### Priority: P2 (Medium)
### Target: Week 9-10

### Features

#### Book Catalog
| Feature | Description | Priority |
|---------|-------------|----------|
| Book Master | ISBN, title, author, publisher, category, edition | High |
| Multi-copy Support | Track multiple copies of same book | High |
| Barcode Integration | Scan books for quick operations | Medium |
| Digital Resources | E-books, journals, online subscriptions | Medium |
| Book Categories | Fiction, non-fiction, reference, textbooks | High |

#### Circulation
| Feature | Description | Priority |
|---------|-------------|----------|
| Issue Book | Issue to student/staff with due date | High |
| Return Book | Process returns with condition check | High |
| Renew Book | Extend loan period (with limits) | High |
| Reserve Book | Allow reservations for checked-out books | Medium |
| Lost Book | Mark lost, calculate replacement cost | High |

#### Fine Management
| Feature | Description | Priority |
|---------|-------------|----------|
| Auto Fine Calculation | Calculate fines based on overdue days | High |
| Fine Collection | Integrate with Finance module | High |
| Fine Waiver | Approval workflow for waivers | Medium |
| Fine Reports | Outstanding fines by student/class | High |

#### Reports
| Feature | Description | Priority |
|---------|-------------|----------|
| Issued Books Report | Currently issued books | High |
| Overdue Report | Books past due date | High |
| Popular Books | Most borrowed books | Medium |
| Student Reading History | Books borrowed by student | Medium |
| Stock Report | Total inventory with availability | High |

#### Settings
| Feature | Description | Priority |
|---------|-------------|----------|
| Loan Rules | Days allowed, renewals, max books | High |
| Fine Rules | Per day fine amount, grace period | High |
| Library Timing | Operating hours | Low |
| Accession Number | Auto-generate book IDs | High |

### API Endpoints
```
GET    /library/books
POST   /library/books
GET    /library/books/:id
PUT    /library/books/:id
DELETE /library/books/:id

POST   /library/books/:id/issue
POST   /library/books/:id/return
POST   /library/books/:id/renew
POST   /library/books/:id/reserve
POST   /library/books/:id/lost

GET    /library/circulation/issued
GET    /library/circulation/overdue
GET    /library/circulation/history/:studentId

GET    /library/reports/stock
GET    /library/reports/popular
GET    /library/reports/overdue
GET    /library/reports/fines

GET    /library/settings
PUT    /library/settings
```

### Database Collections
```javascript
// books
{
  _id: ObjectId,
  tenantId: ObjectId,
  branchId: ObjectId,
  accessionNumber: String,
  isbn: String,
  title: String,
  author: [String],
  publisher: String,
  category: String,
  edition: String,
  publishYear: Number,
  copies: [{
    copyId: String,
    status: 'available' | 'issued' | 'reserved' | 'lost' | 'damaged',
    condition: String,
    location: String
  }],
  totalCopies: Number,
  availableCopies: Number,
  createdAt: Date,
  updatedAt: Date
}

// book_transactions
{
  _id: ObjectId,
  tenantId: ObjectId,
  branchId: ObjectId,
  bookId: ObjectId,
  copyId: String,
  memberId: ObjectId,
  memberType: 'student' | 'staff',
  type: 'issue' | 'return' | 'renew' | 'reserve' | 'lost',
  issueDate: Date,
  dueDate: Date,
  returnDate: Date,
  fine: Number,
  fineStatus: 'pending' | 'paid' | 'waived',
  issuedBy: ObjectId,
  returnedTo: ObjectId,
  notes: String,
  createdAt: Date
}

// library_settings
{
  _id: ObjectId,
  tenantId: ObjectId,
  branchId: ObjectId,
  loanRules: {
    student: { maxBooks: Number, loanDays: Number, renewals: Number },
    staff: { maxBooks: Number, loanDays: Number, renewals: Number }
  },
  fineRules: {
    perDayFine: Number,
    gracePeriod: Number,
    maxFine: Number
  },
  accessionPrefix: String,
  accessionPadding: Number,
  lastAccessionNumber: Number,
  updatedAt: Date
}
```

---

## 2. Placement Cell Module (Colleges/Universities)

### Overview
Manage campus placements, company relationships, and student job tracking.

### Priority: P3 (Low - College/University specific)
### Target: Phase 3

### Features

#### Company Management
| Feature | Description | Priority |
|---------|-------------|----------|
| Company Master | Company details, HR contacts, history | High |
| Company Visits | Schedule and track campus visits | High |
| Job Postings | Jobs offered by companies | High |
| MoU Management | Track agreements with companies | Medium |

#### Student Placement
| Feature | Description | Priority |
|---------|-------------|----------|
| Eligibility Criteria | CGPA, backlogs, department filters | High |
| Student Registration | Opt-in for placement drives | High |
| Resume Builder | Create/upload resumes | Medium |
| Application Tracking | Track student applications | High |

#### Placement Drives
| Feature | Description | Priority |
|---------|-------------|----------|
| Drive Creation | Schedule drives with rounds | High |
| Round Management | Aptitude, technical, HR rounds | High |
| Result Declaration | Track selections per round | High |
| Offer Management | Track offers, acceptance | High |

#### Reports
| Feature | Description | Priority |
|---------|-------------|----------|
| Placement Statistics | Placed vs eligible students | High |
| Package Analysis | Average, highest, lowest CTC | High |
| Company-wise Report | Hiring by company | High |
| Department-wise Report | Placements by department | High |
| Year-on-year Trends | Historical placement data | Medium |

### API Endpoints
```
GET    /placement/companies
POST   /placement/companies
GET    /placement/companies/:id
PUT    /placement/companies/:id

GET    /placement/drives
POST   /placement/drives
GET    /placement/drives/:id
PUT    /placement/drives/:id

POST   /placement/drives/:id/register
GET    /placement/drives/:id/eligible-students
POST   /placement/drives/:id/rounds/:roundId/results

GET    /placement/students/:id/applications
GET    /placement/students/:id/offers

GET    /placement/reports/statistics
GET    /placement/reports/packages
GET    /placement/reports/company-wise
```

---

## 3. Parent Portal Module

### Overview
Dedicated portal for parents to access student information, communicate with teachers, and manage payments.

### Priority: P1 (High)
### Target: Week 7-8

### Features

#### Dashboard
| Feature | Description | Priority |
|---------|-------------|----------|
| Student Overview | Quick view of all linked children | High |
| Attendance Summary | Today + monthly attendance | High |
| Fee Status | Dues, recent payments | High |
| Upcoming Events | Calendar of school events | Medium |
| Announcements | Recent announcements | High |

#### Academic View
| Feature | Description | Priority |
|---------|-------------|----------|
| Timetable | Class schedule view | High |
| Diary/Homework | Daily assignments | High |
| Exam Schedule | Upcoming exams | High |
| Report Card | View results (when published) | High |
| Progress Tracker | Academic performance trends | Medium |

#### Communication
| Feature | Description | Priority |
|---------|-------------|----------|
| Teacher Messages | Direct messaging with teachers | High |
| PTM Booking | Book parent-teacher meeting slots | High |
| Leave Application | Apply for child's leave | High |
| Concern Submission | Raise concerns/feedback | Medium |

#### Finance
| Feature | Description | Priority |
|---------|-------------|----------|
| Fee Details | View fee structure, dues | High |
| Make Payment | Online fee payment | High |
| Payment History | Receipt download | High |
| Transport Fees | View transport charges | Medium |

#### Transport
| Feature | Description | Priority |
|---------|-------------|----------|
| Route Details | Child's bus route info | High |
| Live Tracking | Real-time bus location | Medium |
| Notifications | Bus arrival alerts | Medium |

### Authentication
- Login via registered mobile number
- OTP-based authentication
- Link multiple children to single account
- Separate from staff portal

### API Endpoints
```
POST   /parent/auth/send-otp
POST   /parent/auth/verify-otp
GET    /parent/auth/me

GET    /parent/children
GET    /parent/children/:id/dashboard
GET    /parent/children/:id/attendance
GET    /parent/children/:id/timetable
GET    /parent/children/:id/diary
GET    /parent/children/:id/results
GET    /parent/children/:id/fees
POST   /parent/children/:id/fees/pay

GET    /parent/messages
POST   /parent/messages
GET    /parent/messages/:id

GET    /parent/ptm/available-slots
POST   /parent/ptm/book

POST   /parent/leave-applications
GET    /parent/leave-applications

GET    /parent/transport/:childId
```

---

## 4. Scholarship Management Module

### Overview
Manage scholarship applications, eligibility, disbursement, and tracking.

### Priority: P2 (Medium)
### Target: Week 11-12

### Features

#### Scholarship Setup
| Feature | Description | Priority |
|---------|-------------|----------|
| Scholarship Types | Merit, need-based, sports, category | High |
| Eligibility Criteria | CGPA, income, category, achievements | High |
| Amount Configuration | Fixed or percentage of fees | High |
| Quota Management | Number of scholarships available | Medium |

#### Application Process
| Feature | Description | Priority |
|---------|-------------|----------|
| Online Application | Student self-application | High |
| Document Upload | Required certificates | High |
| Application Review | Admin verification | High |
| Approval Workflow | Multi-level approval | High |

#### Disbursement
| Feature | Description | Priority |
|---------|-------------|----------|
| Auto Fee Adjustment | Apply to fee dues | High |
| Bank Transfer | Direct benefit transfer | Medium |
| Disbursement Tracking | Status monitoring | High |
| Renewal Management | Year-on-year renewals | Medium |

#### Reports
| Feature | Description | Priority |
|---------|-------------|----------|
| Scholarship Summary | Total awarded, pending | High |
| Category-wise Report | By scholarship type | High |
| Student-wise Report | Individual scholarship history | Medium |
| Financial Impact | Total scholarship outflow | High |

### API Endpoints
```
GET    /scholarships/types
POST   /scholarships/types
PUT    /scholarships/types/:id

GET    /scholarships/applications
POST   /scholarships/applications
GET    /scholarships/applications/:id
PUT    /scholarships/applications/:id/status

GET    /scholarships/eligible-students/:typeId
POST   /scholarships/award
POST   /scholarships/disburse

GET    /scholarships/reports/summary
GET    /scholarships/reports/category-wise
GET    /scholarships/students/:id/history
```

---

## 5. Document Management Module

### Overview
Centralized document storage, verification, and management for students and staff.

### Priority: P1 (High)
### Target: Week 5-6

### Features

#### Document Types
| Feature | Description | Priority |
|---------|-------------|----------|
| Student Documents | Aadhar, birth certificate, TC, marksheets | High |
| Staff Documents | Resume, certificates, ID proof | High |
| Organization Documents | Licenses, approvals, registrations | Medium |
| Custom Document Types | Define additional document types | Medium |

#### Upload & Storage
| Feature | Description | Priority |
|---------|-------------|----------|
| Multi-file Upload | Batch upload documents | High |
| File Validation | Type, size validation | High |
| Secure Storage | Encrypted S3 storage | High |
| Version History | Track document updates | Medium |

#### Verification
| Feature | Description | Priority |
|---------|-------------|----------|
| Verification Workflow | Mark documents as verified | High |
| Verification Status | Pending, verified, rejected | High |
| Expiry Tracking | Alert on document expiry | Medium |
| Audit Trail | Track who verified when | High |

#### Access Control
| Feature | Description | Priority |
|---------|-------------|----------|
| Role-based Access | Who can view/download | High |
| Download Tracking | Log all downloads | Medium |
| Share Links | Generate secure share links | Low |

### API Endpoints
```
GET    /documents/types
POST   /documents/types

POST   /documents/upload
GET    /documents/:entityType/:entityId
GET    /documents/:id
DELETE /documents/:id

PUT    /documents/:id/verify
PUT    /documents/:id/reject

GET    /documents/:id/download
POST   /documents/:id/share-link

GET    /documents/expiring
GET    /documents/pending-verification
```

### Storage Structure
```
s3://campus-verse-docs/
  ├── {tenantId}/
  │   ├── students/
  │   │   └── {studentId}/
  │   │       ├── aadhar/
  │   │       ├── birth-certificate/
  │   │       └── marksheets/
  │   ├── staff/
  │   │   └── {staffId}/
  │   │       ├── resume/
  │   │       ├── certificates/
  │   │       └── id-proof/
  │   └── organization/
  │       └── {branchId}/
  │           ├── licenses/
  │           └── approvals/
```

---

## 6. Alumni Networking Module

### Overview
Engage alumni through events, donations, mentorship programs, and networking.

### Priority: P3 (Low)
### Target: Phase 3

### Features

#### Alumni Directory
| Feature | Description | Priority |
|---------|-------------|----------|
| Alumni Registration | Self-registration portal | High |
| Profile Management | Update contact, career info | High |
| Search Directory | Find classmates, batch-mates | High |
| Privacy Settings | Control visible information | Medium |

#### Events & Reunions
| Feature | Description | Priority |
|---------|-------------|----------|
| Event Creation | Alumni meets, reunions | High |
| RSVP Management | Track attendance | High |
| Event Gallery | Photos from events | Medium |
| Virtual Events | Online reunion support | Low |

#### Donations
| Feature | Description | Priority |
|---------|-------------|----------|
| Donation Campaigns | Create fundraising campaigns | High |
| Online Donations | Payment gateway integration | High |
| Donation Tracking | Track contributions | High |
| Tax Receipts | Generate 80G certificates | Medium |

#### Mentorship
| Feature | Description | Priority |
|---------|-------------|----------|
| Mentor Registration | Alumni volunteer as mentors | Medium |
| Mentee Requests | Current students request mentoring | Medium |
| Matching System | Match based on field/interest | Medium |
| Session Tracking | Track mentoring sessions | Low |

#### Communication
| Feature | Description | Priority |
|---------|-------------|----------|
| Newsletter | Bulk email to alumni | High |
| Batch Groups | Communication by graduation year | Medium |
| Job Board | Alumni job postings | Medium |

### API Endpoints
```
POST   /alumni/register
GET    /alumni/profile
PUT    /alumni/profile
GET    /alumni/directory

GET    /alumni/events
POST   /alumni/events
POST   /alumni/events/:id/rsvp

GET    /alumni/donations/campaigns
POST   /alumni/donations
GET    /alumni/donations/history

GET    /alumni/mentors
POST   /alumni/mentors/register
POST   /alumni/mentorship/request
```

---

## Module Implementation Priority

| Module | Priority | Dependencies | Estimated Effort |
|--------|----------|--------------|------------------|
| Document Management | P1 | S3 Integration | 2 weeks |
| Parent Portal | P1 | OTP Service, Finance Module | 3 weeks |
| Scholarship Management | P2 | Finance Module | 2 weeks |
| Library Management | P2 | None | 3 weeks |
| Placement Cell | P3 | Student Module | 3 weeks |
| Alumni Networking | P3 | Auth, Payments | 3 weeks |

---

## Frontend Pages Required

### Document Management
- Document Types List
- Upload Documents Page
- Document Viewer
- Verification Queue
- Expiry Alerts Dashboard

### Parent Portal
- Parent Login (OTP)
- Dashboard
- Child Selection (if multiple)
- Attendance View
- Fee Payment Page
- Message Center
- PTM Booking
- Leave Application

### Library Management
- Book Catalog
- Issue/Return Page
- My Borrowed Books
- Overdue List
- Fine Collection
- Reports Dashboard
- Settings Page

### Scholarship Management
- Scholarship Types List
- Application Form
- Application Review Queue
- Award Page
- Disbursement Tracker
- Reports

### Placement Cell (College/University)
- Company Directory
- Drive Calendar
- Job Postings
- Application Tracker
- Offer Management
- Placement Dashboard

### Alumni Portal
- Registration
- Profile
- Directory
- Events
- Donations
- Mentorship
