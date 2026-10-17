# Compliance & Regulatory Reporting

This document outlines compliance requirements and regulatory reports for Indian educational institutions.

---

## 1. Government Reporting (India)

### UDISE+ (Schools)

**Unified District Information System for Education Plus**

Required for all schools recognized by state/central government.

#### Data Points Required

```
School Profile:
- UDISE Code
- School name, address, location
- Management type (Govt/Private/Aided)
- Medium of instruction
- Classes offered
- Board affiliation

Infrastructure:
- Building status (pucca/kaccha)
- Number of classrooms
- Availability of facilities (library, lab, playground)
- Toilets (boys/girls/CWSN)
- Drinking water
- Electricity
- Computer/Internet
- Ramp for disabled

Enrollment:
- Class-wise enrollment (boys/girls)
- Social category (SC/ST/OBC/General)
- Minority status
- CWSN (Children with Special Needs)
- Repeaters
- RTE admissions

Teachers:
- Total teachers (male/female)
- Qualification-wise distribution
- Subject-wise distribution
- Training status
- Age distribution

Results:
- Class-wise pass percentage
- Grade distribution
```

#### API Endpoints for UDISE Export

```
GET /reports/udise/school-profile
GET /reports/udise/infrastructure
GET /reports/udise/enrollment
GET /reports/udise/teachers
GET /reports/udise/results

POST /reports/udise/generate
GET /reports/udise/:id/download
```

#### Data Mapping

```typescript
interface UDISEEnrollmentData {
  classId: string;
  className: string;
  boys: {
    general: number;
    sc: number;
    st: number;
    obc: number;
    minority: number;
    cwsn: number;
  };
  girls: {
    general: number;
    sc: number;
    st: number;
    obc: number;
    minority: number;
    cwsn: number;
  };
  rteAdmissions: number;
  repeaters: number;
}
```

**Priority**: P1 (High for schools)
**Effort**: 2 weeks

---

### AISHE (Higher Education)

**All India Survey on Higher Education**

Required for colleges and universities.

#### Data Points Required

```
Institution Profile:
- AISHE Code
- Name, address, type
- Affiliating university
- Autonomous status
- NAAC grade
- Year of establishment

Programs:
- Programs offered
- Intake capacity
- Actual enrollment

Enrollment:
- Program-wise enrollment
- Gender distribution
- Category distribution
- State-wise (domicile)
- Foreign students

Faculty:
- Teaching staff count
- Qualification (PhD/M.Phil/PG)
- Designation-wise
- Reserved category

Results:
- Pass percentage
- Placement statistics

Infrastructure:
- Campus area
- Building area
- Hostels
- Library books
- Computers
```

#### API Endpoints for AISHE Export

```
GET /reports/aishe/institution-profile
GET /reports/aishe/programs
GET /reports/aishe/enrollment
GET /reports/aishe/faculty
GET /reports/aishe/results
GET /reports/aishe/infrastructure

POST /reports/aishe/generate
GET /reports/aishe/:id/download
```

**Priority**: P1 (High for colleges/universities)
**Effort**: 2 weeks

---

### NAAC/NBA Data Collection

**National Assessment and Accreditation Council / National Board of Accreditation**

#### Key Metrics

```
Academic Metrics:
- Student-teacher ratio
- Pass percentage trends
- Placement percentage
- Research publications
- Faculty with PhD

Infrastructure:
- Library resources per student
- Computer-student ratio
- Lab equipment value
- Campus area per student

Student Support:
- Scholarship beneficiaries
- Grievance redressal time
- Extra-curricular activities

Quality Initiatives:
- Faculty development programs
- Industry collaborations
- International linkages
```

#### Dashboard for NAAC Data

```
Features:
- Real-time metric calculation
- Trend analysis (5 years)
- Gap analysis vs benchmark
- Document repository
- Auto-generated reports
```

**Priority**: P2 (Medium)
**Effort**: 3 weeks

---

### RTE Compliance (Schools)

**Right to Education Act**

#### Requirements

```
Admission:
- 25% seats for EWS/disadvantaged
- No admission test for Class 1-8
- Age-appropriate admission
- No detention policy (with caveats)

Infrastructure:
- Minimum classroom size
- Pupil-teacher ratio
- Playground
- Library
- Toilets

Teachers:
- Qualified teachers
- No part-time teachers for core subjects
- Maximum teaching hours

Documentation:
- RTE admission records
- Reimbursement claims
- Compliance certificates
```

#### RTE Reports

```
GET /reports/rte/admissions
GET /reports/rte/compliance-status
GET /reports/rte/reimbursement-claims

POST /reports/rte/generate-claim
```

**Priority**: P1 (High for schools)
**Effort**: 1 week

---

## 2. Financial Compliance

### GST Reporting

```
Reports Required:
- GSTR-1 (Outward supplies)
- GSTR-3B (Summary return)
- HSN Summary
- B2B/B2C breakup
```

#### GST Data Structure

```typescript
interface GSTInvoice {
  invoiceNumber: string;
  invoiceDate: Date;
  customerGSTIN?: string;
  customerName: string;
  placeOfSupply: string;
  items: Array<{
    description: string;
    hsnCode: string;
    quantity: number;
    rate: number;
    taxableValue: number;
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
  }>;
  totalTaxableValue: number;
  totalTax: number;
  totalAmount: number;
}
```

#### API Endpoints

```
GET /finance/gst/summary?from=&to=
GET /finance/gst/gstr1?month=&year=
GET /finance/gst/hsn-summary?from=&to=
GET /finance/gst/b2b?month=&year=
GET /finance/gst/b2c?month=&year=

POST /finance/gst/export-json (for GST portal upload)
POST /finance/gst/export-excel
```

**Priority**: P1 (High)
**Effort**: 1 week

---

### TDS Compliance (Payroll)

```
Deductions:
- TDS on salary (Section 192)
- Professional tax

Reports:
- Form 16 (Annual)
- Form 24Q (Quarterly TDS return)
- Form 12BA (Statement of perquisites)
```

#### Tax Calculation

```typescript
// Income tax slabs (New regime FY 2024-25)
const taxSlabs = [
  { min: 0, max: 300000, rate: 0 },
  { min: 300000, max: 700000, rate: 0.05 },
  { min: 700000, max: 1000000, rate: 0.10 },
  { min: 1000000, max: 1200000, rate: 0.15 },
  { min: 1200000, max: 1500000, rate: 0.20 },
  { min: 1500000, max: Infinity, rate: 0.30 },
];

function calculateTax(annualIncome: number): number {
  let tax = 0;
  let remaining = annualIncome;

  for (const slab of taxSlabs) {
    if (remaining <= 0) break;

    const taxableInSlab = Math.min(remaining, slab.max - slab.min);
    tax += taxableInSlab * slab.rate;
    remaining -= taxableInSlab;
  }

  // Add cess (4%)
  tax += tax * 0.04;

  return Math.round(tax);
}
```

**Priority**: P2 (Medium - with payroll)
**Effort**: 2 weeks

---

### PF/ESI Compliance

```
Provident Fund:
- Employee contribution: 12% of basic
- Employer contribution: 12% of basic
- Admin charges: 0.5%
- EDLI: 0.5%

ESI (if gross < ₹21,000/month):
- Employee: 0.75%
- Employer: 3.25%

Reports:
- Monthly PF return (ECR)
- Monthly ESI return
- Annual PF statement
```

**Priority**: P2 (Medium - with payroll)
**Effort**: 1 week

---

## 3. Data Privacy (GDPR/DPDP)

### Digital Personal Data Protection Act 2023 (India)

#### Requirements

```
Consent:
- Clear consent for data collection
- Purpose limitation
- Data minimization

Data Subject Rights:
- Right to access
- Right to correction
- Right to erasure
- Right to portability
- Right to grievance redressal

Data Protection:
- Encryption at rest and transit
- Access controls
- Audit logging
- Breach notification (72 hours)

Children's Data:
- Verifiable parental consent
- Age verification
- Limited data collection
```

#### Implementation

```typescript
// Consent management
interface DataConsent {
  userId: ObjectId;
  tenantId: ObjectId;
  consents: Array<{
    purpose: 'academic' | 'communication' | 'marketing' | 'analytics';
    granted: boolean;
    timestamp: Date;
    ipAddress: string;
  }>;
  parentalConsent?: {
    granted: boolean;
    parentName: string;
    relationship: string;
    timestamp: Date;
    verificationMethod: string;
  };
}

// Data export for portability
GET /privacy/my-data/export
DELETE /privacy/my-data/delete

// Consent management
GET /privacy/consents
PUT /privacy/consents
```

#### Data Retention Policy

| Data Type | Retention Period | After Retention |
|-----------|-----------------|-----------------|
| Student records | 10 years after leaving | Archive |
| Fee transactions | 8 years (as per IT Act) | Archive |
| Attendance | 5 years | Delete |
| Communication logs | 2 years | Delete |
| Login history | 1 year | Delete |
| Temporary files | 30 days | Delete |

**Priority**: P1 (High)
**Effort**: 2 weeks

---

## 4. Academic Reports

### Transfer Certificate (TC)

```
Required Fields:
- Student details
- Date of admission
- Date of leaving
- Class last attended
- Subjects studied
- Conduct and character
- Fee dues status
- Reason for leaving
- Board affiliation number
```

#### TC Template

```typescript
interface TransferCertificate {
  certificateNumber: string;
  dateOfIssue: Date;

  student: {
    name: string;
    fatherName: string;
    motherName: string;
    dateOfBirth: Date;
    dateOfBirthInWords: string;
    nationality: string;
    religion: string;
    caste: string;
    aadhaarNumber?: string;
  };

  academic: {
    admissionNumber: string;
    dateOfAdmission: Date;
    classAdmittedTo: string;
    dateOfLeaving: Date;
    classLastAttended: string;
    mediumOfInstruction: string;
    subjects: string[];
    boardAffiliation?: string;
  };

  conduct: {
    character: string;
    feeDueStatus: 'No dues' | 'Dues pending';
    reasonForLeaving: string;
  };

  verification: {
    principalName: string;
    principalSignature: string;
    schoolSeal: string;
    remarks?: string;
  };
}
```

**Priority**: P1 (Already implemented, ensure compliance)

---

### Bonafide Certificate

```
Purpose-based templates:
- General bonafide
- Bank account opening
- Passport application
- Scholarship application
- Hostel admission
```

---

### Character Certificate

```
Required for:
- Job applications
- Higher education
- Government schemes
```

---

## 5. Report Generation Framework

### Report Builder

```typescript
// Generic report generation
interface ReportConfig {
  name: string;
  type: 'pdf' | 'excel' | 'csv' | 'json';
  template?: string; // For PDF
  dataSource: {
    collection: string;
    pipeline: any[]; // MongoDB aggregation
  };
  columns?: Array<{
    field: string;
    header: string;
    width?: number;
    format?: 'date' | 'currency' | 'number' | 'text';
  }>;
  filters: Array<{
    field: string;
    type: 'select' | 'date-range' | 'text';
    required: boolean;
  }>;
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    recipients: string[];
    time: string;
  };
}

// Report generation service
class ReportService {
  async generate(config: ReportConfig, params: any): Promise<Buffer> {
    const data = await this.fetchData(config.dataSource, params);

    switch (config.type) {
      case 'pdf':
        return this.generatePDF(config, data);
      case 'excel':
        return this.generateExcel(config, data);
      case 'csv':
        return this.generateCSV(config, data);
      case 'json':
        return Buffer.from(JSON.stringify(data));
    }
  }

  private async generatePDF(config: ReportConfig, data: any[]): Promise<Buffer> {
    // Use puppeteer or pdfmake
  }

  private async generateExcel(config: ReportConfig, data: any[]): Promise<Buffer> {
    // Use exceljs
  }
}
```

### Pre-built Reports

| Report | Format | Scheduled |
|--------|--------|-----------|
| Daily Fee Collection | PDF, Excel | Daily 6 PM |
| Monthly Attendance | PDF | 1st of month |
| Outstanding Dues | Excel | Weekly |
| Staff Attendance | PDF | Monthly |
| UDISE Data | JSON | On demand |
| AISHE Data | JSON | On demand |
| GST Summary | Excel | Monthly |

---

## 6. Audit Trail

### Comprehensive Logging

```typescript
interface AuditLog {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId?: ObjectId;

  // What happened
  action: 'create' | 'update' | 'delete' | 'view' | 'export';
  module: string;
  entityType: string;
  entityId: ObjectId;

  // Who did it
  userId: ObjectId;
  userName: string;
  userRole: string;
  ipAddress: string;
  userAgent: string;

  // Change details
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];

  // When
  timestamp: Date;

  // Additional context
  metadata?: Record<string, any>;
}
```

### Audit Dashboard

```
Features:
- Filter by module, user, date range
- Search by entity
- Export audit logs
- Compliance reports
- Anomaly detection (unusual patterns)
```

### Required Audit Events

| Module | Events to Log |
|--------|---------------|
| Auth | Login, logout, password change, 2FA enable/disable |
| Students | Create, update, delete, promote, transfer |
| Finance | Payment, cancellation, refund, concession |
| Attendance | Mark, modify, lock/unlock |
| HR | Staff add/update, leave approve/reject |
| Settings | Any configuration change |
| Reports | Generate, export, schedule |

**Priority**: P1 (High)
**Effort**: 2 weeks

---

## 7. Compliance Checklist

### Pre-launch Compliance

- [ ] Data encryption (at rest and in transit)
- [ ] Secure authentication
- [ ] Role-based access control
- [ ] Audit logging enabled
- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] Cookie consent (web)
- [ ] Data backup verified
- [ ] Disaster recovery tested

### Ongoing Compliance

- [ ] Monthly security review
- [ ] Quarterly access audit
- [ ] Annual data retention cleanup
- [ ] Regular backup verification
- [ ] Penetration testing (annual)
- [ ] Compliance training for staff

---

## Implementation Priority

| Requirement | Priority | Target |
|-------------|----------|--------|
| Audit Trail | P1 | Week 3-4 |
| GDPR/DPDP Compliance | P1 | Week 3-4 |
| GST Reports | P1 | Week 2 |
| UDISE Export | P1 | Week 5-6 |
| AISHE Export | P1 | Week 5-6 |
| RTE Reports | P1 | Week 5-6 |
| NAAC Dashboard | P2 | Week 9-10 |
| TDS/PF Reports | P2 | With Payroll |
