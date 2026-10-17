# Campus Verse - Database Schemas

## Collections Overview

| Collection          | Purpose                                |
| ------------------- | -------------------------------------- |
| tenants             | Owner groups (top-level multi-tenancy) |
| branches            | Individual institutions under tenant   |
| users               | System users (staff, admins)           |
| roles               | Role definitions with permissions      |
| academic_batches    | Academic years/terms                   |
| classes             | Classes/Streams/Departments            |
| sections            | Sections within classes                |
| subjects            | Subject catalog                        |
| students            | Student master records                 |
| student_enrollments | Student-class mappings per batch       |
| leads               | Admission enquiries                    |
| applications        | Admission applications                 |
| fee_structures      | Fee templates                          |
| fee_assignments     | Student fee assignments                |
| fee_transactions    | Payment records                        |
| concessions         | Fee concessions                        |
| student_attendance  | Daily student attendance               |
| staff               | Staff master records                   |
| staff_attendance    | Daily staff attendance                 |
| leaves              | Leave requests                         |
| leave_balances      | Leave entitlements                     |
| announcements       | System announcements                   |
| events              | Calendar events                        |
| sms_logs            | SMS delivery logs                      |
| audit_logs          | System audit trail                     |
| settings            | Tenant/branch settings                 |
| counters            | Sequence number generators             |

---

## 1. tenants

```javascript
{
  _id: ObjectId,
  name: String,                    // "XYZ Education Group"
  code: String,                    // "XYZEDUG" - UNIQUE
  institutionTypes: [String],      // ["school", "college", "university"]
  contact: {
    email: String,
    phone: String,
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      country: String,
      pincode: String
    }
  },
  legalInfo: {
    entityName: String,
    gstNumber: String,
    panNumber: String,
    registrationNumber: String
  },
  branding: {
    logo: String,                  // S3 URL
    primaryColor: String,
    secondaryColor: String
  },
  subscription: {
    plan: String,                  // "starter" | "professional" | "enterprise"
    maxBranches: Number,
    maxStudents: Number,
    maxStaff: Number,
    features: [String],
    validUntil: Date
  },
  settings: {
    timezone: String,              // "Asia/Kolkata"
    dateFormat: String,            // "DD/MM/YYYY"
    currency: String,              // "INR"
    fiscalYearStart: String        // "04" (April)
  },
  status: String,                  // "active" | "suspended" | "trial"
  createdAt: Date,
  updatedAt: Date
}

// INDEXES
db.tenants.createIndex({ code: 1 }, { unique: true })
db.tenants.createIndex({ status: 1 })
```

---

## 2. branches

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,              // FK -> tenants
  name: String,                    // "XYZ School - Kukatpally"
  code: String,                    // "XYZS-KP" - unique within tenant
  institutionType: String,         // "school" | "college" | "university"
  location: {
    state: String,
    city: String,
    address: {
      line1: String,
      line2: String,
      landmark: String,
      pincode: String
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  contact: {
    email: String,
    phone: String,
    alternatePhone: String,
    website: String
  },
  infrastructure: {
    hasHostel: Boolean,
    hasTransport: Boolean,
    hasCanteen: Boolean,
    hasLibrary: Boolean,
    hasLab: Boolean
  },
  branding: {
    logo: String,
    headerImage: String
  },
  affiliations: [{
    board: String,                 // "CBSE", "ICSE", "State"
    affiliationNumber: String,
    validUntil: Date
  }],
  settings: {
    weeklyOff: [String],           // ["sunday"]
    workingHours: { start: String, end: String },
    attendanceTime: { start: String, lateAfter: String, end: String }
  },
  academicStructure: {
    // Schools
    grades: [{ name: String, code: String, order: Number }],
    // Colleges
    streams: [{ name: String, code: String, subjects: [String] }],
    // Universities
    departments: [{ name: String, code: String, yearsCount: Number }]
  },
  status: String,                  // "active" | "inactive"
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}

// INDEXES
db.branches.createIndex({ tenantId: 1, code: 1 }, { unique: true })
db.branches.createIndex({ tenantId: 1, status: 1 })
db.branches.createIndex({ tenantId: 1, institutionType: 1 })
db.branches.createIndex({ tenantId: 1, "location.state": 1, "location.city": 1 })
```

---

## 3. users

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  email: String,                   // unique within tenant
  phone: String,
  password: String,                // bcrypt hashed
  profile: {
    firstName: String,
    lastName: String,
    displayName: String,
    avatar: String,
    gender: String
  },
  roleId: ObjectId,                // FK -> roles
  accessScope: {
    type: String,                  // "global" | "branch" | "department"
    branchIds: [ObjectId],
    departmentIds: [ObjectId]
  },
  staffId: ObjectId,               // FK -> staff (if applicable)
  preferences: {
    language: String,
    notifications: { email: Boolean, sms: Boolean, push: Boolean }
  },
  security: {
    mfaEnabled: Boolean,
    mfaSecret: String,
    passwordChangedAt: Date,
    loginAttempts: Number,
    lockUntil: Date
  },
  lastLogin: Date,
  status: String,                  // "active" | "inactive" | "locked"
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}

// INDEXES
db.users.createIndex({ tenantId: 1, email: 1 }, { unique: true })
db.users.createIndex({ tenantId: 1, phone: 1 })
db.users.createIndex({ tenantId: 1, roleId: 1 })
db.users.createIndex({ tenantId: 1, status: 1 })
db.users.createIndex({ tenantId: 1, "accessScope.branchIds": 1 })
```

---

## 4. roles

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  name: String,                    // "Branch Admin", "Teacher"
  code: String,                    // "BRANCH_ADMIN", "TEACHER"
  description: String,
  isSystemRole: Boolean,           // Cannot delete if true
  level: Number,                   // Hierarchy (1 = highest)
  permissions: {
    organization: {
      branches: [String],          // ["view", "create", "edit", "delete"]
      users: [String],
      roles: [String],
      settings: [String]
    },
    students: {
      list: [String],
      details: [String],
      enrollment: [String],
      promotion: [String]
    },
    admissions: {
      leads: [String],
      applications: [String],
      enrollment: [String]
    },
    finance: {
      feeCounter: [String],
      collections: [String],
      dues: [String],
      concessions: [String],
      reports: [String],
      settings: [String]
    },
    attendance: {
      mark: [String],
      view: [String],
      reports: [String]
    },
    hr: {
      staff: [String],
      attendance: [String],
      leaves: [String],
      workload: [String]
    },
    communications: {
      sms: [String],
      announcements: [String],
      calendar: [String]
    },
    reports: {
      view: [String],
      export: [String]
    },
    dashboard: {
      ownerView: [String],
      branchView: [String]
    }
  },
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}

// INDEXES
db.roles.createIndex({ tenantId: 1, code: 1 }, { unique: true })
```

---

## 5. academic_batches

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  branchId: ObjectId,              // null = tenant-wide
  name: String,                    // "2024-25"
  code: String,                    // "AY2425"
  startDate: Date,
  endDate: Date,
  isCurrent: Boolean,
  terms: [{
    name: String,                  // "Term 1", "Semester 1"
    startDate: Date,
    endDate: Date
  }],
  status: String,                  // "upcoming" | "active" | "completed"
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}

// INDEXES
db.academic_batches.createIndex({ tenantId: 1, branchId: 1, code: 1 }, { unique: true })
db.academic_batches.createIndex({ tenantId: 1, isCurrent: 1 })
db.academic_batches.createIndex({ tenantId: 1, status: 1 })
```

---

## 6. classes

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  branchId: ObjectId,
  academicBatchId: ObjectId,
  institutionType: String,         // "school" | "college" | "university"

  // For Schools
  grade: {
    name: String,                  // "Grade 5"
    code: String,                  // "G5"
    order: Number                  // 5
  },

  // For Colleges
  stream: {
    name: String,                  // "MPC"
    code: String,
    year: String                   // "11th" | "12th"
  },
  batch: {
    name: String,                  // "MPC-A", "IIT Batch"
    code: String
  },

  // For Universities
  department: {
    name: String,                  // "Computer Science"
    code: String                   // "CSE"
  },
  year: {
    name: String,                  // "1st Year"
    number: Number                 // 1
  },

  displayName: String,             // Auto: "Grade 5" / "MPC-11th-A" / "CSE-1st Year"
  capacity: Number,
  classTeacherId: ObjectId,        // FK -> staff
  subjects: [{
    subjectId: ObjectId,
    teacherId: ObjectId,
    periodsPerWeek: Number
  }],
  status: String,                  // "active" | "inactive"
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}

// INDEXES
db.classes.createIndex({ tenantId: 1, branchId: 1, academicBatchId: 1, displayName: 1 })
db.classes.createIndex({ tenantId: 1, branchId: 1, institutionType: 1 })
db.classes.createIndex({ tenantId: 1, branchId: 1, status: 1 })
```

---

## 7. sections

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  branchId: ObjectId,
  classId: ObjectId,
  name: String,                    // "A", "B", "Section 1"
  code: String,
  capacity: Number,
  sectionTeacherId: ObjectId,
  roomNumber: String,
  status: String,
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}

// INDEXES
db.sections.createIndex({ tenantId: 1, branchId: 1, classId: 1, name: 1 }, { unique: true })
db.sections.createIndex({ classId: 1, status: 1 })
```

---

## 8. subjects

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  branchId: ObjectId,              // null = tenant-wide
  name: String,                    // "Mathematics"
  code: String,                    // "MATH"
  shortName: String,               // "Math"
  type: String,                    // "core" | "elective" | "language"
  applicableTo: {
    institutionTypes: [String],
    grades: [String],
    streams: [String],
    departments: [String]
  },
  credits: Number,                 // For universities
  maxMarks: Number,
  passingMarks: Number,
  status: String,
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}

// INDEXES
db.subjects.createIndex({ tenantId: 1, code: 1 })
db.subjects.createIndex({ tenantId: 1, branchId: 1, status: 1 })
```

---

## 9. students

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  branchId: ObjectId,

  // Identification
  admissionNumber: String,         // Unique within branch
  enrollmentCode: String,          // System generated
  rollNumber: String,

  // Personal
  firstName: String,
  lastName: String,
  displayName: String,
  dateOfBirth: Date,
  gender: String,                  // "male" | "female" | "other"
  bloodGroup: String,
  nationality: String,
  religion: String,
  caste: String,
  category: String,                // "general" | "obc" | "sc" | "st"
  aadharNumber: String,
  photo: String,                   // S3 URL

  // Contact
  contact: {
    email: String,
    phone: String,
    alternatePhone: String,
    address: {
      current: { line1, line2, city, state, country, pincode },
      permanent: { line1, line2, city, state, country, pincode }
    }
  },

  // Parents
  parents: {
    father: {
      name: String,
      occupation: String,
      qualification: String,
      phone: String,
      email: String,
      annualIncome: Number
    },
    mother: {
      name: String,
      occupation: String,
      qualification: String,
      phone: String,
      email: String
    },
    guardian: {
      name: String,
      relation: String,
      phone: String,
      email: String,
      address: String
    }
  },
  primaryContactType: String,      // "father" | "mother" | "guardian"

  // Academic
  admissionDate: Date,
  admissionType: String,           // "new" | "transfer" | "lateral"
  previousSchool: {
    name: String,
    board: String,
    lastClass: String,
    percentage: Number,
    tcNumber: String
  },

  // Current Enrollment (denormalized)
  currentEnrollment: {
    academicBatchId: ObjectId,
    classId: ObjectId,
    sectionId: ObjectId,
    className: String,
    sectionName: String
  },

  // Services
  services: {
    transport: {
      isAvailing: Boolean,
      routeId: ObjectId,
      stopId: ObjectId,
      pickupTime: String,
      dropTime: String
    },
    hostel: {
      isAvailing: Boolean,
      hostelId: ObjectId,
      roomId: ObjectId,
      bedNumber: String
    }
  },

  // Medical
  medical: {
    allergies: [String],
    conditions: [String],
    medications: [String],
    emergencyContact: { name, relation, phone }
  },

  // Documents
  documents: [{
    type: String,                  // "birth_certificate", "aadhar", "tc"
    url: String,
    uploadedAt: Date,
    verified: Boolean
  }],

  // Family
  familyId: String,                // Common ID for siblings
  siblingIds: [ObjectId],

  // Status
  status: String,                  // "active" | "inactive" | "alumni" | "transferred"
  statusHistory: [{
    status: String,
    date: Date,
    reason: String,
    changedBy: ObjectId
  }],

  customFields: Object,
  tags: [String],
  notes: String,

  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}

// INDEXES
db.students.createIndex({ tenantId: 1, branchId: 1, admissionNumber: 1 }, { unique: true })
db.students.createIndex({ tenantId: 1, enrollmentCode: 1 })
db.students.createIndex({ tenantId: 1, branchId: 1, status: 1 })
db.students.createIndex({ tenantId: 1, branchId: 1, "currentEnrollment.classId": 1 })
db.students.createIndex({ tenantId: 1, branchId: 1, "currentEnrollment.sectionId": 1 })
db.students.createIndex({ tenantId: 1, familyId: 1 })
db.students.createIndex({ tenantId: 1, "contact.phone": 1 })
db.students.createIndex({ firstName: "text", lastName: "text", admissionNumber: "text" })
```

---

## 10. student_enrollments

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  branchId: ObjectId,
  studentId: ObjectId,
  academicBatchId: ObjectId,
  classId: ObjectId,
  sectionId: ObjectId,
  rollNumber: String,
  enrollmentDate: Date,
  enrollmentType: String,          // "new" | "promoted" | "transferred" | "lateral"
  previousEnrollmentId: ObjectId,
  status: String,                  // "active" | "completed" | "withdrawn"
  completedDate: Date,
  result: {
    status: String,                // "passed" | "failed" | "detained"
    percentage: Number,
    grade: String
  },
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}

// INDEXES
db.student_enrollments.createIndex({ tenantId: 1, studentId: 1, academicBatchId: 1 }, { unique: true })
db.student_enrollments.createIndex({ tenantId: 1, branchId: 1, classId: 1, sectionId: 1 })
db.student_enrollments.createIndex({ tenantId: 1, branchId: 1, academicBatchId: 1, status: 1 })
```

---

## 11. leads

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  branchId: ObjectId,
  leadNumber: String,              // Auto-generated

  studentName: String,
  dateOfBirth: Date,
  gender: String,
  currentClass: String,
  currentSchool: String,

  parentName: String,
  parentPhone: String,
  parentEmail: String,
  address: String,

  interestedIn: {
    classId: ObjectId,
    className: String,
    stream: String,
    department: String
  },
  academicBatchId: ObjectId,

  source: String,                  // "walk-in" | "website" | "social-media" | "referral" | "agent"
  sourceDetails: {
    campaign: String,
    agentId: ObjectId,
    referredBy: String
  },

  stage: String,                   // "new" | "contacted" | "interested" | "followup" | "converted" | "lost"
  stageHistory: [{
    stage: String,
    date: Date,
    notes: String,
    updatedBy: ObjectId
  }],

  assignedTo: ObjectId,
  nextFollowUp: {
    date: Date,
    type: String,                  // "call" | "visit" | "email"
    notes: String
  },

  convertedToApplicationId: ObjectId,
  lostReason: String,

  customFields: Object,
  tags: [String],
  notes: String,

  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}

// INDEXES
db.leads.createIndex({ tenantId: 1, branchId: 1, leadNumber: 1 }, { unique: true })
db.leads.createIndex({ tenantId: 1, branchId: 1, stage: 1 })
db.leads.createIndex({ tenantId: 1, branchId: 1, assignedTo: 1 })
db.leads.createIndex({ tenantId: 1, branchId: 1, source: 1 })
db.leads.createIndex({ tenantId: 1, branchId: 1, "nextFollowUp.date": 1 })
```

---

## 12. applications

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  branchId: ObjectId,
  applicationNumber: String,
  leadId: ObjectId,

  studentInfo: {
    // Same structure as students personal fields
  },
  parentsInfo: {
    // Same structure as students.parents
  },

  appliedFor: {
    academicBatchId: ObjectId,
    classId: ObjectId,
    className: String,
    sectionPreference: [String]
  },

  previousEducation: {
    schoolName: String,
    board: String,
    lastClass: String,
    percentage: Number
  },

  documents: [{
    type: String,
    url: String,
    uploadedAt: Date,
    status: String                 // "pending" | "verified" | "rejected"
  }],

  applicationFee: {
    amount: Number,
    transactionId: ObjectId,
    paidAt: Date,
    status: String                 // "pending" | "paid"
  },

  status: String,                  // "draft" | "submitted" | "under-review" | "approved" | "rejected" | "enrolled"
  workflow: [{
    status: String,
    date: Date,
    notes: String,
    processedBy: ObjectId
  }],

  offer: {
    issuedAt: Date,
    validUntil: Date,
    acceptedAt: Date,
    sectionId: ObjectId
  },

  enrolledStudentId: ObjectId,
  enrollmentDate: Date,

  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}

// INDEXES
db.applications.createIndex({ tenantId: 1, branchId: 1, applicationNumber: 1 }, { unique: true })
db.applications.createIndex({ tenantId: 1, branchId: 1, status: 1 })
db.applications.createIndex({ tenantId: 1, branchId: 1, "appliedFor.academicBatchId": 1 })
```

---

## 13. fee_structures

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  branchId: ObjectId,
  academicBatchId: ObjectId,
  name: String,                    // "Standard Fee - Grade 5"
  code: String,

  applicableTo: {
    institutionType: String,
    classIds: [ObjectId],          // Empty = all classes
    streams: [String],
    categories: [String]           // "general" | "staff-ward" | "sibling"
  },

  components: [{
    name: String,                  // "Tuition Fee", "Lab Fee"
    code: String,                  // "TUITION", "LAB"
    type: String,                  // "mandatory" | "optional" | "service-based"
    amount: Number,
    frequency: String,             // "yearly" | "term-wise" | "monthly"
    taxable: Boolean,
    taxRate: Number,
    refundable: Boolean
  }],

  installments: [{
    name: String,                  // "Installment 1"
    dueDate: Date,
    components: [{
      componentCode: String,
      amount: Number
    }],
    totalAmount: Number
  }],

  fineRules: {
    type: String,                  // "fixed" | "percentage" | "daily"
    amount: Number,
    gracePeriodDays: Number,
    maxFine: Number
  },

  totalAmount: Number,
  mandatoryTotal: Number,

  isActive: Boolean,
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}

// INDEXES
db.fee_structures.createIndex({ tenantId: 1, branchId: 1, academicBatchId: 1, code: 1 })
db.fee_structures.createIndex({ tenantId: 1, branchId: 1, isActive: 1 })
```

---

## 14. fee_assignments

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  branchId: ObjectId,
  studentId: ObjectId,
  academicBatchId: ObjectId,
  feeStructureId: ObjectId,

  components: [{
    componentCode: String,
    name: String,
    originalAmount: Number,
    discountAmount: Number,
    finalAmount: Number,
    taxAmount: Number,
    totalAmount: Number
  }],

  installments: [{
    installmentNumber: Number,
    name: String,
    dueDate: Date,
    amount: Number,
    fineAmount: Number,
    totalDue: Number,
    paidAmount: Number,
    balance: Number,
    status: String                 // "pending" | "partial" | "paid" | "overdue"
  }],

  summary: {
    totalFee: Number,
    totalDiscount: Number,
    totalTax: Number,
    netPayable: Number,
    totalPaid: Number,
    totalFine: Number,
    balance: Number
  },

  concessions: [{
    concessionId: ObjectId,
    type: String,
    amount: Number,
    appliedTo: [String]
  }],

  status: String,                  // "active" | "cleared" | "cancelled"
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}

// INDEXES
db.fee_assignments.createIndex({ tenantId: 1, studentId: 1, academicBatchId: 1 }, { unique: true })
db.fee_assignments.createIndex({ tenantId: 1, branchId: 1, academicBatchId: 1, status: 1 })
db.fee_assignments.createIndex({ tenantId: 1, branchId: 1, "summary.balance": 1 })
```

---

## 15. fee_transactions

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  branchId: ObjectId,
  studentId: ObjectId,
  feeAssignmentId: ObjectId,

  receiptNumber: String,           // UNIQUE
  receiptDate: Date,

  paymentMode: String,             // "cash" | "card" | "upi" | "netbanking" | "cheque" | "dd" | "wallet"
  paymentDetails: {
    referenceNumber: String,
    bankName: String,
    chequeNumber: String,
    chequeDate: Date,
    cardLast4: String,
    upiId: String
  },

  components: [{
    componentCode: String,
    name: String,
    amount: Number
  }],
  installmentNumbers: [Number],
  feeAmount: Number,
  fineAmount: Number,
  adjustments: Number,
  totalAmount: Number,

  onlinePayment: {
    gatewayOrderId: String,
    gatewayPaymentId: String,
    gatewaySignature: String,
    status: String
  },

  status: String,                  // "success" | "pending" | "failed" | "cancelled" | "refunded"
  remarks: String,

  refund: {
    refundId: String,
    amount: Number,
    reason: String,
    refundedAt: Date,
    refundedBy: ObjectId
  },

  cancellation: {
    reason: String,
    cancelledAt: Date,
    cancelledBy: ObjectId,
    approvedBy: ObjectId
  },

  collectedBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}

// INDEXES
db.fee_transactions.createIndex({ tenantId: 1, branchId: 1, receiptNumber: 1 }, { unique: true })
db.fee_transactions.createIndex({ tenantId: 1, studentId: 1, createdAt: -1 })
db.fee_transactions.createIndex({ tenantId: 1, branchId: 1, receiptDate: 1 })
db.fee_transactions.createIndex({ tenantId: 1, branchId: 1, status: 1, receiptDate: 1 })
db.fee_transactions.createIndex({ tenantId: 1, branchId: 1, paymentMode: 1 })
db.fee_transactions.createIndex({ tenantId: 1, branchId: 1, collectedBy: 1, receiptDate: 1 })
```

---

## 16. concessions

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  branchId: ObjectId,
  studentId: ObjectId,
  feeAssignmentId: ObjectId,
  academicBatchId: ObjectId,

  type: String,                    // "scholarship" | "staff-ward" | "sibling" | "merit" | "need-based" | "custom"
  name: String,
  reason: String,

  discountType: String,            // "percentage" | "fixed"
  discountValue: Number,
  calculatedAmount: Number,
  appliedTo: [String],             // Component codes

  status: String,                  // "pending" | "approved" | "rejected"
  requestedBy: ObjectId,
  requestedAt: Date,
  approvedBy: ObjectId,
  approvedAt: Date,
  rejectionReason: String,

  documents: [{ type: String, url: String }],
  remarks: String,

  createdAt: Date,
  updatedAt: Date
}

// INDEXES
db.concessions.createIndex({ tenantId: 1, studentId: 1, academicBatchId: 1 })
db.concessions.createIndex({ tenantId: 1, branchId: 1, status: 1 })
db.concessions.createIndex({ tenantId: 1, branchId: 1, type: 1 })
```

---

## 17. student_attendance

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  branchId: ObjectId,
  classId: ObjectId,
  sectionId: ObjectId,
  date: Date,                      // Normalized to midnight

  records: [{
    studentId: ObjectId,
    status: String,                // "present" | "absent" | "late" | "half-day" | "leave"
    inTime: String,
    outTime: String,
    leaveType: String,
    remarks: String
  }],

  summary: {
    total: Number,
    present: Number,
    absent: Number,
    late: Number,
    halfDay: Number,
    leave: Number
  },

  markedBy: ObjectId,
  markedAt: Date,
  lastModifiedBy: ObjectId,
  lastModifiedAt: Date,
  isLocked: Boolean
}

// INDEXES
db.student_attendance.createIndex({ tenantId: 1, branchId: 1, classId: 1, sectionId: 1, date: 1 }, { unique: true })
db.student_attendance.createIndex({ tenantId: 1, branchId: 1, date: 1 })
db.student_attendance.createIndex({ "records.studentId": 1, date: 1 })
```

---

## 18. staff

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  branchId: ObjectId,              // Primary branch
  additionalBranches: [ObjectId],

  employeeId: String,              // Unique within tenant
  userId: ObjectId,                // FK -> users

  firstName: String,
  lastName: String,
  displayName: String,
  dateOfBirth: Date,
  gender: String,
  bloodGroup: String,
  nationality: String,
  photo: String,

  contact: {
    email: String,
    phone: String,
    alternatePhone: String,
    emergencyContact: { name, relation, phone },
    address: { current: {...}, permanent: {...} }
  },

  employment: {
    joiningDate: Date,
    confirmationDate: Date,
    employmentType: String,        // "permanent" | "contract" | "part-time" | "visiting"
    departmentId: ObjectId,
    designationId: ObjectId,
    reportingTo: ObjectId,
    noticePeriod: Number
  },

  teaching: {
    isTeaching: Boolean,
    subjects: [{ subjectId: ObjectId, classIds: [ObjectId] }],
    classTeacherOf: ObjectId,
    periodsPerWeek: Number
  },

  qualifications: [{
    degree: String,
    specialization: String,
    institution: String,
    year: Number,
    percentage: Number
  }],

  experience: [{
    organization: String,
    designation: String,
    fromDate: Date,
    toDate: Date,
    responsibilities: String
  }],

  bankDetails: {
    accountNumber: String,         // Encrypted
    bankName: String,
    ifscCode: String,
    accountType: String
  },

  documents: [{
    type: String,
    number: String,
    url: String,
    verifiedAt: Date
  }],

  status: String,                  // "active" | "inactive" | "on-leave" | "resigned" | "terminated"
  statusHistory: [{ status, date, reason, changedBy }],
  exitDate: Date,
  exitReason: String,

  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}

// INDEXES
db.staff.createIndex({ tenantId: 1, employeeId: 1 }, { unique: true })
db.staff.createIndex({ tenantId: 1, branchId: 1, status: 1 })
db.staff.createIndex({ tenantId: 1, userId: 1 })
db.staff.createIndex({ tenantId: 1, "employment.departmentId": 1 })
db.staff.createIndex({ firstName: "text", lastName: "text", employeeId: "text" })
```

---

## 19. staff_attendance

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  branchId: ObjectId,
  date: Date,

  records: [{
    staffId: ObjectId,
    status: String,                // "present" | "absent" | "late" | "half-day" | "leave" | "wfh"
    shift: String,
    inTime: String,
    outTime: String,
    workingHours: Number,
    leaveId: ObjectId,
    remarks: String
  }],

  summary: {
    total: Number,
    present: Number,
    absent: Number,
    late: Number,
    onLeave: Number
  },

  markedBy: ObjectId,
  markedAt: Date,
  isLocked: Boolean
}

// INDEXES
db.staff_attendance.createIndex({ tenantId: 1, branchId: 1, date: 1 }, { unique: true })
db.staff_attendance.createIndex({ "records.staffId": 1, date: 1 })
```

---

## 20. leaves

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  branchId: ObjectId,
  staffId: ObjectId,

  leaveType: String,               // "casual" | "sick" | "earned" | "maternity" | "lop"
  fromDate: Date,
  toDate: Date,
  days: Number,
  isHalfDay: Boolean,
  halfDayType: String,             // "first-half" | "second-half"

  reason: String,
  documents: [{ type: String, url: String }],

  status: String,                  // "pending" | "approved" | "rejected" | "cancelled"
  approverId: ObjectId,
  approverRemarks: String,
  approvedAt: Date,

  cancellationReason: String,
  cancelledAt: Date,

  appliedAt: Date,
  createdAt: Date,
  updatedAt: Date
}

// INDEXES
db.leaves.createIndex({ tenantId: 1, staffId: 1, fromDate: 1, toDate: 1 })
db.leaves.createIndex({ tenantId: 1, branchId: 1, status: 1 })
db.leaves.createIndex({ tenantId: 1, approverId: 1, status: 1 })
```

---

## 21. leave_balances

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  branchId: ObjectId,
  staffId: ObjectId,
  academicBatchId: ObjectId,

  balances: [{
    leaveType: String,
    entitled: Number,
    taken: Number,
    pending: Number,
    balance: Number,
    carryForward: Number,
    lapsed: Number
  }],

  updatedAt: Date
}

// INDEXES
db.leave_balances.createIndex({ tenantId: 1, staffId: 1, academicBatchId: 1 }, { unique: true })
```

---

## 22. announcements

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  branchId: ObjectId,

  title: String,
  content: String,
  type: String,                    // "general" | "urgent" | "event" | "holiday"
  priority: String,                // "low" | "medium" | "high"

  audience: {
    type: String,                  // "all" | "staff" | "students" | "parents" | "specific"
    branchIds: [ObjectId],
    classIds: [ObjectId],
    roleIds: [ObjectId]
  },

  publishAt: Date,
  expiresAt: Date,
  isPinned: Boolean,

  attachments: [{ name: String, url: String, type: String }],

  status: String,                  // "draft" | "pending-approval" | "published" | "archived"
  approvalRequired: Boolean,
  approvedBy: ObjectId,
  approvedAt: Date,

  viewCount: Number,
  acknowledgedBy: [ObjectId],

  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}

// INDEXES
db.announcements.createIndex({ tenantId: 1, branchId: 1, status: 1, publishAt: -1 })
db.announcements.createIndex({ tenantId: 1, "audience.branchIds": 1 })
db.announcements.createIndex({ tenantId: 1, expiresAt: 1 })
```

---

## 23. events

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  branchId: ObjectId,

  title: String,
  description: String,
  type: String,                    // "academic" | "cultural" | "sports" | "exam" | "ptm" | "holiday"
  category: String,

  startDate: Date,
  endDate: Date,
  isAllDay: Boolean,
  startTime: String,
  endTime: String,
  timezone: String,

  location: {
    type: String,                  // "venue" | "online" | "hybrid"
    venue: String,
    address: String,
    meetingLink: String
  },

  audience: {
    type: String,
    branchIds: [ObjectId],
    classIds: [ObjectId],
    staffOnly: Boolean
  },

  isRecurring: Boolean,
  recurrence: {
    pattern: String,               // "daily" | "weekly" | "monthly" | "yearly"
    interval: Number,
    daysOfWeek: [Number],
    endDate: Date,
    occurrences: Number
  },

  reminders: [{
    type: String,                  // "email" | "sms" | "push"
    beforeMinutes: Number
  }],

  status: String,                  // "scheduled" | "ongoing" | "completed" | "cancelled"
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}

// INDEXES
db.events.createIndex({ tenantId: 1, branchId: 1, startDate: 1, endDate: 1 })
db.events.createIndex({ tenantId: 1, type: 1 })
db.events.createIndex({ tenantId: 1, status: 1 })
```

---

## 24. sms_logs

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  branchId: ObjectId,

  templateId: String,
  templateName: String,
  message: String,
  messageType: String,             // "transactional" | "promotional"

  recipients: [{
    phone: String,
    name: String,
    entityType: String,            // "student" | "parent" | "staff"
    entityId: ObjectId,
    status: String,                // "pending" | "sent" | "delivered" | "failed"
    deliveredAt: Date,
    failureReason: String
  }],

  totalRecipients: Number,
  sentCount: Number,
  deliveredCount: Number,
  failedCount: Number,

  gatewayResponse: {
    batchId: String,
    credits: Number
  },

  triggerType: String,             // "manual" | "scheduled" | "automated"
  triggeredBy: ObjectId,
  scheduledAt: Date,

  createdAt: Date,
  updatedAt: Date
}

// INDEXES
db.sms_logs.createIndex({ tenantId: 1, branchId: 1, createdAt: -1 })
db.sms_logs.createIndex({ tenantId: 1, triggerType: 1 })
db.sms_logs.createIndex({ "recipients.phone": 1 })
```

---

## 25. audit_logs

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  branchId: ObjectId,

  action: String,                  // "create" | "update" | "delete" | "approve" | "reject" | "login"
  module: String,                  // "students" | "finance" | "attendance"
  subModule: String,

  entityType: String,
  entityId: ObjectId,
  entityName: String,

  changes: {
    before: Object,
    after: Object
  },

  userId: ObjectId,
  userName: String,
  userRole: String,
  ipAddress: String,
  userAgent: String,

  timestamp: Date
}

// INDEXES
db.audit_logs.createIndex({ tenantId: 1, timestamp: -1 })
db.audit_logs.createIndex({ tenantId: 1, module: 1, action: 1 })
db.audit_logs.createIndex({ tenantId: 1, entityType: 1, entityId: 1 })
db.audit_logs.createIndex({ tenantId: 1, userId: 1, timestamp: -1 })
db.audit_logs.createIndex({ timestamp: 1 }, { expireAfterSeconds: 315360000 }) // 10 years TTL
```

---

## 26. settings

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  branchId: ObjectId,              // null = tenant-level
  module: String,
  key: String,
  value: Object,
  description: String,
  updatedBy: ObjectId,
  updatedAt: Date
}

// INDEXES
db.settings.createIndex({ tenantId: 1, branchId: 1, module: 1, key: 1 }, { unique: true })
```

---

## 27. counters

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  branchId: ObjectId,
  type: String,                    // "admissionNumber" | "receiptNumber" | "leadNumber"
  academicBatchId: ObjectId,
  prefix: String,
  sequence: Number,
  updatedAt: Date
}

// INDEXES
db.counters.createIndex({ tenantId: 1, branchId: 1, type: 1, academicBatchId: 1 }, { unique: true })
```

---

## Index Creation Script

```javascript
// scripts/create-indexes.js
const { MongoClient } = require('mongodb');

async function createIndexes() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  console.log('Creating indexes...');

  // Run all createIndex commands from above schemas
  // ... (copy each createIndex from above)

  console.log('Indexes created successfully');
  await client.close();
}

createIndexes().catch(console.error);
```
