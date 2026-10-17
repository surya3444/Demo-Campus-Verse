# Revised Implementation Timeline

This document provides a comprehensive 14-week implementation plan that addresses all gaps identified in the analysis.

---

## Timeline Overview

| Phase | Weeks | Focus |
|-------|-------|-------|
| Phase 1: Critical Infrastructure | 1-2 | P0 items, production readiness |
| Phase 2: Phase 1 Completion | 3-4 | Complete existing modules |
| Phase 3: Core Phase 2 | 5-8 | Academics, Transport, Exams |
| Phase 4: Extended Features | 9-12 | New modules, mobile app |
| Phase 5: Polish & Launch | 13-14 | Testing, optimization, deployment |

---

## Week 1: Critical Infrastructure (P0)

### Goals
- Production-ready infrastructure
- Core integrations working

### Tasks

| Task | Owner | Priority | Effort |
|------|-------|----------|--------|
| S3 file storage integration | Backend | P0 | 2 days |
| Email service (AWS SES) | Backend | P0 | 2 days |
| API rate limiting | Backend | P0 | 1 day |
| SMS completion (MSG91) | Backend | P0 | 1 day |
| Push notification setup (FCM) | Backend | P1 | 2 days |

### Deliverables
- [ ] File uploads working (student photos, documents)
- [ ] Password reset emails working
- [ ] SMS OTP working
- [ ] Rate limiting active
- [ ] Push notification infrastructure ready

### API Endpoints
```
POST /upload/image
POST /upload/document
GET /upload/:key/signed-url
DELETE /upload/:key

POST /notifications/push/register-device
POST /notifications/push/send
```

---

## Week 2: Data Migration & Security

### Goals
- Enable client data onboarding
- Security hardening

### Tasks

| Task | Owner | Priority | Effort |
|------|-------|----------|--------|
| Data migration tool - Students | Backend | P0 | 2 days |
| Data migration tool - Staff | Backend | P0 | 1 day |
| Data migration tool - Fee history | Backend | P0 | 2 days |
| 2FA implementation | Backend | P1 | 2 days |
| Audit trail enhancement | Backend | P1 | 1 day |

### Deliverables
- [ ] CSV/Excel import for students
- [ ] CSV/Excel import for staff
- [ ] Fee transaction history import
- [ ] TOTP-based 2FA option
- [ ] Comprehensive audit logging

### API Endpoints
```
GET /migration/templates/:type
POST /migration/validate
POST /migration/preview
POST /migration/execute
GET /migration/jobs/:id/status

POST /auth/2fa/setup
POST /auth/2fa/verify
DELETE /auth/2fa/disable
```

---

## Week 3: Finance Completion

### Goals
- Complete all finance features
- Auto-reminders operational

### Tasks

| Task | Owner | Priority | Effort |
|------|-------|----------|--------|
| Auto fee reminders (scheduled) | Backend | P0 | 2 days |
| GST/Tax reports | Backend | P1 | 2 days |
| Split payment support | Backend | P1 | 1 day |
| Cheque management | Backend | P1 | 1 day |
| Fee reminder UI | Frontend | P1 | 1 day |
| GST reports UI | Frontend | P1 | 2 days |

### Deliverables
- [ ] Automated fee reminders (SMS/Email/Push)
- [ ] GST-compliant reports
- [ ] Partial payment tracking
- [ ] Cheque status management

### API Endpoints
```
GET /finance/reminders/settings
PUT /finance/reminders/settings
POST /finance/reminders/send-now
GET /finance/reminders/logs

GET /finance/reports/gst/summary
GET /finance/reports/gst/gstr1
POST /finance/reports/gst/export
```

---

## Week 4: HR & Communications Completion

### Goals
- Complete HR module
- Communications fully operational

### Tasks

| Task | Owner | Priority | Effort |
|------|-------|----------|--------|
| Payroll foundation | Backend | P1 | 3 days |
| Salary slip generation | Backend | P1 | 1 day |
| Bulk email campaigns | Backend | P1 | 1 day |
| Email templates | Backend | P1 | 1 day |
| Payroll UI | Frontend | P1 | 2 days |
| Email template editor | Frontend | P1 | 1 day |

### Deliverables
- [ ] Basic payroll processing
- [ ] PDF salary slips
- [ ] Bulk email sending
- [ ] Email template management

### API Endpoints
```
GET /payroll/structures
POST /payroll/structures
POST /payroll/process
GET /payroll/slips/:employeeId/:month/pdf

GET /communications/email/templates
POST /communications/email/templates
POST /communications/email/send-bulk
```

---

## Week 5: Academics Module (Part 1)

### Goals
- Core academics functionality
- Timetable system

### Tasks

| Task | Owner | Priority | Effort |
|------|-------|----------|--------|
| Teacher-subject-class mapping | Backend | P1 | 2 days |
| Timetable data model | Backend | P1 | 1 day |
| Timetable CRUD | Backend | P1 | 2 days |
| Timetable UI | Frontend | P1 | 3 days |
| Subject mapping UI | Frontend | P1 | 2 days |

### Deliverables
- [ ] Teacher assignment to subjects/classes
- [ ] Weekly timetable creation
- [ ] Timetable view (class-wise, teacher-wise)
- [ ] Conflict detection

### API Endpoints
```
GET /academics/teacher-mappings
POST /academics/teacher-mappings
DELETE /academics/teacher-mappings/:id

GET /academics/timetable/:classId
POST /academics/timetable
PUT /academics/timetable/:id
GET /academics/timetable/teacher/:teacherId
POST /academics/timetable/check-conflicts
```

### Database Schema
```javascript
// timetables
{
  _id: ObjectId,
  tenantId: ObjectId,
  branchId: ObjectId,
  academicBatchId: ObjectId,
  classId: ObjectId,
  sectionId: ObjectId,
  slots: [{
    day: 'monday' | 'tuesday' | ... | 'saturday',
    period: Number,
    startTime: String,
    endTime: String,
    subjectId: ObjectId,
    teacherId: ObjectId,
    room: String
  }],
  effectiveFrom: Date,
  effectiveTo: Date,
  status: 'draft' | 'active' | 'archived'
}
```

---

## Week 6: Academics Module (Part 2)

### Goals
- Diary/homework system
- PTM scheduling

### Tasks

| Task | Owner | Priority | Effort |
|------|-------|----------|--------|
| Diary module backend | Backend | P1 | 2 days |
| PTM scheduling backend | Backend | P1 | 2 days |
| Diary UI (teacher) | Frontend | P1 | 2 days |
| Diary UI (parent view) | Frontend | P1 | 1 day |
| PTM booking UI | Frontend | P1 | 2 days |

### Deliverables
- [ ] Daily homework/diary entry
- [ ] Subject-wise diary
- [ ] PTM slot creation
- [ ] Parent PTM booking

### API Endpoints
```
GET /academics/diary
POST /academics/diary
GET /academics/diary/:classId/:date
GET /academics/diary/student/:studentId

GET /academics/ptm/slots
POST /academics/ptm/slots
POST /academics/ptm/book
GET /academics/ptm/bookings
```

---

## Week 7: Transport Module

### Goals
- Complete transport management
- Route tracking

### Tasks

| Task | Owner | Priority | Effort |
|------|-------|----------|--------|
| Vehicle management | Backend | P1 | 1 day |
| Route management | Backend | P1 | 2 days |
| Student-route assignment | Backend | P1 | 1 day |
| Transport fee integration | Backend | P1 | 1 day |
| Transport UI | Frontend | P1 | 3 days |
| GPS integration foundation | Backend | P2 | 2 days |

### Deliverables
- [ ] Vehicle CRUD
- [ ] Route definition with stops
- [ ] Student transport assignment
- [ ] Transport fee calculation
- [ ] GPS data receiver (basic)

### API Endpoints
```
GET /transport/vehicles
POST /transport/vehicles
PUT /transport/vehicles/:id

GET /transport/routes
POST /transport/routes
PUT /transport/routes/:id
GET /transport/routes/:id/stops

POST /transport/assignments
GET /transport/assignments/student/:studentId
GET /transport/assignments/route/:routeId

GET /transport/tracking/:vehicleId
POST /transport/tracking/update (webhook)
```

---

## Week 8: Exams Module (Part 1)

### Goals
- Exam structure and scheduling
- Marks entry foundation

### Tasks

| Task | Owner | Priority | Effort |
|------|-------|----------|--------|
| Grade groups setup | Backend | P1 | 1 day |
| Exam structure definition | Backend | P1 | 2 days |
| Exam scheduling | Backend | P1 | 1 day |
| Marks allocation backend | Backend | P1 | 2 days |
| Exam setup UI | Frontend | P1 | 2 days |
| Marks entry UI | Frontend | P1 | 2 days |

### Deliverables
- [ ] Grade scales (A/B/C or percentage)
- [ ] Exam types (Unit test, Mid-term, Final)
- [ ] Exam schedule per class
- [ ] Subject-wise marks entry

### API Endpoints
```
GET /exams/grade-groups
POST /exams/grade-groups

GET /exams/structures
POST /exams/structures

GET /exams/schedules
POST /exams/schedules

GET /exams/marks/:examId/:classId
POST /exams/marks
PUT /exams/marks/:id
POST /exams/marks/bulk-upload
```

---

## Week 9: Exams Module (Part 2) & Report Cards

### Goals
- Complete exam workflow
- Report card generation

### Tasks

| Task | Owner | Priority | Effort |
|------|-------|----------|--------|
| Marks approval workflow | Backend | P1 | 1 day |
| Report card template | Backend | P1 | 2 days |
| Report card generation | Backend | P1 | 2 days |
| Marks approval UI | Frontend | P1 | 1 day |
| Report card designer | Frontend | P1 | 2 days |
| Report card view/print | Frontend | P1 | 2 days |

### Deliverables
- [ ] Marks approval by HOD/Principal
- [ ] Report card templates (customizable)
- [ ] PDF report card generation
- [ ] Rank calculation

### API Endpoints
```
POST /exams/marks/:id/submit-for-approval
POST /exams/marks/:id/approve
POST /exams/marks/:id/reject

GET /exams/report-cards/templates
POST /exams/report-cards/templates
GET /exams/report-cards/:studentId/:examId
POST /exams/report-cards/generate-bulk
```

---

## Week 10: Document Management & Library

### Goals
- Centralized document management
- Library module

### Tasks

| Task | Owner | Priority | Effort |
|------|-------|----------|--------|
| Document management backend | Backend | P1 | 2 days |
| Library module backend | Backend | P2 | 3 days |
| Document upload UI | Frontend | P1 | 2 days |
| Library UI | Frontend | P2 | 3 days |

### Deliverables
- [ ] Document types configuration
- [ ] Document upload with verification
- [ ] Book catalog management
- [ ] Issue/return workflow
- [ ] Fine calculation

### API Endpoints
```
GET /documents/types
POST /documents/upload
GET /documents/:entityType/:entityId
PUT /documents/:id/verify

GET /library/books
POST /library/books
POST /library/books/:id/issue
POST /library/books/:id/return
GET /library/circulation/overdue
```

---

## Week 11: Parent Portal & Mobile App Foundation

### Goals
- Parent portal MVP
- Mobile app foundation

### Tasks

| Task | Owner | Priority | Effort |
|------|-------|----------|--------|
| Parent authentication (OTP) | Backend | P1 | 2 days |
| Parent dashboard API | Backend | P1 | 2 days |
| Parent portal UI | Frontend | P1 | 3 days |
| Mobile app setup (Expo) | Mobile | P1 | 2 days |
| Mobile auth flow | Mobile | P1 | 2 days |
| Mobile dashboard | Mobile | P1 | 2 days |

### Deliverables
- [ ] Parent login via OTP
- [ ] Child selection (multiple children)
- [ ] Attendance view
- [ ] Fee summary
- [ ] Mobile app skeleton

### API Endpoints
```
POST /parent/auth/send-otp
POST /parent/auth/verify-otp
GET /parent/children
GET /parent/children/:id/dashboard
GET /parent/children/:id/attendance
GET /parent/children/:id/fees
```

---

## Week 12: Mobile App Completion

### Goals
- Complete parent/student app
- Teacher app MVP

### Tasks

| Task | Owner | Priority | Effort |
|------|-------|----------|--------|
| Mobile - Timetable view | Mobile | P1 | 1 day |
| Mobile - Diary view | Mobile | P1 | 1 day |
| Mobile - Fee payment | Mobile | P1 | 2 days |
| Mobile - Notifications | Mobile | P1 | 1 day |
| Teacher app - Attendance | Mobile | P1 | 2 days |
| Teacher app - Diary entry | Mobile | P1 | 2 days |

### Deliverables
- [ ] Complete parent app
- [ ] Online fee payment in app
- [ ] Push notifications working
- [ ] Teacher attendance marking
- [ ] Teacher diary creation

---

## Week 13: Integration Testing & Bug Fixes

### Goals
- End-to-end testing
- Bug fixes

### Tasks

| Task | Owner | Priority | Effort |
|------|-------|----------|--------|
| E2E test suite | QA | P0 | 3 days |
| Performance testing | QA | P0 | 2 days |
| Security testing | QA | P0 | 2 days |
| Bug fixes | All | P0 | 3 days |
| API documentation | Backend | P1 | 2 days |

### Deliverables
- [ ] E2E tests for critical flows
- [ ] Load test results (5000 concurrent users)
- [ ] Security audit report
- [ ] Bug fixes complete
- [ ] OpenAPI documentation

### Test Scenarios
```
Critical Flows:
1. Student enrollment → Fee assignment → Payment → Receipt
2. Attendance marking → Report generation → Parent notification
3. Exam creation → Marks entry → Approval → Report card
4. Leave application → Approval → Attendance update
5. Online payment flow (end-to-end)
```

---

## Week 14: Production Deployment

### Goals
- Production launch
- Client onboarding

### Tasks

| Task | Owner | Priority | Effort |
|------|-------|----------|--------|
| Production environment setup | DevOps | P0 | 2 days |
| Data migration (client data) | All | P0 | 2 days |
| UAT with client | All | P0 | 2 days |
| Go-live | All | P0 | 1 day |
| Monitoring setup | DevOps | P1 | 1 day |
| Documentation | All | P1 | 2 days |

### Deliverables
- [ ] Production environment running
- [ ] Client data migrated
- [ ] UAT signoff
- [ ] System live
- [ ] Monitoring dashboards
- [ ] User documentation

### Go-live Checklist
```
Pre-launch:
- [ ] SSL certificates valid
- [ ] DNS configured
- [ ] Database backups configured
- [ ] Monitoring alerts configured
- [ ] Error tracking active (Sentry)
- [ ] Rate limiting enabled
- [ ] All secrets rotated

Launch:
- [ ] Deploy to production
- [ ] Smoke test all modules
- [ ] Verify integrations (SMS, email, payment)
- [ ] Test mobile apps

Post-launch:
- [ ] Monitor error rates
- [ ] Monitor performance
- [ ] 24/7 support for first week
```

---

## Resource Allocation

### Team Structure

| Role | Count | Weeks 1-4 | Weeks 5-10 | Weeks 11-14 |
|------|-------|-----------|------------|-------------|
| Backend Developer | 2 | Both | Both | Both |
| Frontend Developer | 2 | Both | Both | 1 + Mobile |
| Mobile Developer | 1 | Setup | Support | Full-time |
| QA Engineer | 1 | Part-time | Part-time | Full-time |
| DevOps | 0.5 | Week 1 | Support | Week 14 |

### Weekly Effort Distribution

```
Week 1-2:  Backend 80%, Frontend 20%
Week 3-4:  Backend 60%, Frontend 40%
Week 5-10: Backend 50%, Frontend 50%
Week 11-12: Backend 30%, Frontend 30%, Mobile 40%
Week 13-14: QA 50%, All others 50%
```

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Integration delays | High | High | Start integrations Week 1 |
| Scope creep | High | Medium | Strict change control |
| Resource constraints | Medium | High | Prioritize P0/P1 only |
| Performance issues | Medium | Medium | Load test early (Week 10) |
| Data migration issues | Medium | High | Pilot migration Week 12 |

---

## Success Criteria

### Week 2
- [ ] All P0 infrastructure complete
- [ ] First client data imported

### Week 6
- [ ] Academics module functional
- [ ] 90% of Phase 1 features complete

### Week 10
- [ ] All core modules complete
- [ ] Mobile app in testing

### Week 14
- [ ] Production live
- [ ] First client operational
- [ ] <10 P1 bugs

---

## Post-Launch Roadmap

### Month 2
- Expense management module
- Hostel management module
- Biometric integration

### Month 3
- Inventory module
- Visitor management
- Advanced analytics

### Month 4
- Online exams
- Question bank
- Placement cell (colleges)

### Month 5+
- AI-powered insights
- Multi-language support
- WhatsApp integration
- Alumni networking
