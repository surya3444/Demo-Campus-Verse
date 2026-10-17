# Campus Verse - 10 Week Deliverable Plan

## Project Overview

Campus Verse is an advanced, multi-institution ERP platform designed to digitize and centralize operations for schools, colleges, and universities. This plan covers the complete development of 23 modules over 10 weeks.

---

## Week 1: Foundation - Organization Module

### Organization Module

#### Settings

| Feature                   | Description                                                                                           | Priority |
| ------------------------- | ----------------------------------------------------------------------------------------------------- | -------- |
| Academic Batches          | Create and manage academic years/terms (e.g., 2024-25) with start and end dates                       | High     |
| Classes                   | Define class structures for schools (grades), colleges (stream-specific), universities (year/section) | High     |
| Subjects                  | Create subject catalogs per institution type and map to classes/streams/departments                   | High     |
| Branches                  | Manage branch metadata (location, contact, institution type, infrastructure tags)                     | High     |
| User Management           | Create, edit, and deactivate users (staff, admins, owner delegates)                                   | High     |
| Role Management           | Define roles (Group Admin, Branch Admin, Accountant, HOD, Teacher) with RBAC permissions per module   | High     |
| Organization/Branch Logos | Upload and manage branding used in portals, receipts, ID cards, and reports                           | Medium   |
| Branch Level Settings     | Fine-tune tax rates, fee rules, communication settings, holidays, weekly offs at branch level         | Medium   |
| Organization Information  | Group-level information: legal entity name, address, contact, regulatory identifiers                  | Medium   |
| Schedule Jobs             | Configure background jobs (daily attendance summaries, fee reminders, report generation)              | Medium   |
| Custom Form Settings      | Configure custom fields and forms for various modules                                                  | Medium   |
| Sort Settings             | Define default sorting preferences for lists and reports across modules                                | Low      |

#### Approvals

| Feature                 | Description                                                                     | Priority |
| ----------------------- | ------------------------------------------------------------------------------- | -------- |
| Undo Approvals          | Ability to reverse approved actions with proper audit trail and permissions     | Medium   |
| Approval Email Settings | Configure email notifications for approval workflows (triggers, templates, etc) | Medium   |

#### Deliverables

* [ ] Database schema for multi-tenant architecture
* [ ] API endpoints for all Organization settings
* [ ] Admin UI for managing organizational hierarchy
* [ ] RBAC implementation with permission matrix
* [ ] Branch-level configuration override system
* [ ] Custom form builder infrastructure
* [ ] Approval workflow email notification system

---

## Week 2: Finance Module (Part 1)

### Finance Module - Fee Collection & Management

#### Fee Counter

| Feature                | Description                                                      | Priority |
| ---------------------- | ---------------------------------------------------------------- | -------- |
| Make Payment           | Record student fee payments (cash, card, online, cheque, wallet) | High     |
| Fee Bulk Upload        | Bulk upload fee data for multiple students or academic sessions  | High     |
| Concession Bulk Upload | Bulk upload concession data for multiple students                | High     |

#### Fee Management

| Feature                   | Description                                                                                                 | Priority |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- | -------- |
| Assign Fee To Students    | Map fee structures to students based on class, stream, department, transport/hostel usage, and scholarships | High     |
| Yet to Assign Fee Reports | Report showing students who haven't been assigned fee structures                                            | High     |

#### Due Reports

| Feature                                  | Description                                                          | Priority |
| ---------------------------------------- | -------------------------------------------------------------------- | -------- |
| Total Paid and Due Report                | Branch-wise and group-wise overview of fees collected vs outstanding | High     |
| Class Wise Due Report                    | Dues per class/section                                               | High     |
| Branch Wise Due Report                   | Compare performance across branches                                  | High     |
| Student Wise Due Reports                 | Individual student-level due amount details                          | High     |
| Sibling Due Reports                      | Consolidated dues for siblings enrolled in the institution           | Medium   |
| Installment Wise Student Fee Due Reports | Due amounts broken down by installment schedule                      | Medium   |

#### Collection Reports

| Feature                        | Description                                                      | Priority |
| ------------------------------ | ---------------------------------------------------------------- | -------- |
| Fee Day Sheet                  | Daily summary of collections by mode and collector               | High     |
| Fee Type Report                | Collections by fee type (tuition, transport, hostel, exam, etc.) | High     |
| Student Fee Statement          | Complete fee statement for individual students                   | High     |
| Fee Type Wise Transactions     | Detailed transactions filtered by fee type                       | High     |
| Class Wise Concession Report   | Concessions granted aggregated by class                          | Medium   |
| Student Wise Concession Report | Individual student concession details                            | Medium   |

#### Deliverables

* [ ] Fee structure configuration system
* [ ] Payment processing with multiple payment modes
* [ ] Receipt generation with customizable templates
* [ ] Due reports with filters and export options
* [ ] Collection reports dashboard
* [ ] Concession reporting system
* [ ] Student fee statement generation

---

## Week 3: Finance Module (Part 2)

### Finance Module - Settings & Approvals

#### Settings

| Feature                          | Description                                             | Priority |
| -------------------------------- | ------------------------------------------------------- | -------- |
| Org Fee Settings                 | Global rules: due dates, penalties, automatic reminders | High     |
| Concession Settings              | Eligibility criteria, approval workflows, limits        | High     |
| Fine Settings                    | Late fee calculations (fixed/percentage, grace periods) | High     |
| Branch Payment Methods           | Define allowed payment methods per branch               | High     |
| Cancellation Settings            | Rules and workflows for fee cancellation                | High     |
| Application Fee Settings         | Configure application/registration fee rules            | High     |
| Wallet Categories                | Define wallet/prepaid account categories                | Medium   |
| Wallet Sequence Settings         | Wallet ID numbering patterns and sequences              | Medium   |
| Payment Mandatory Field Settings | Configure required fields during payment collection     | Medium   |
| Bank Settings                    | Configure bank accounts and reconciliation fields       | Medium   |
| Fee Receipt Number Settings      | Pattern and sequencing per branch or institution        | Medium   |

#### Approval Workflows

| Feature                     | Description                                    | Priority |
| --------------------------- | ---------------------------------------------- | -------- |
| Fee Cancellation Request    | Workflow for approving fee cancellations       | High     |
| Student Fee Refund Requests | Track and approve refunds with audit logs      | High     |
| Concession Requests         | Approval flows for new or adjusted concessions | High     |

#### Deliverables

* [ ] Fee settings configuration UI
* [ ] Approval workflow engine
* [ ] Audit logging for all financial transactions
* [ ] Concession management system
* [ ] Fine calculation automation
* [ ] Wallet/prepaid account management
* [ ] Fee cancellation workflow

---

## Week 4: Admissions & Student Info Modules

### Admissions Module

#### Enrollments

| Feature           | Description                                                             | Priority |
| ----------------- | ----------------------------------------------------------------------- | -------- |
| Applications      | Capture and manage student applications per branch and institution type | High     |
| Admissions        | Convert applications to confirmed admissions with fee linkage           | High     |
| Leads             | Capture and manage prospective student leads from various sources       | High     |
| Alumni Enrollment | Enroll and manage alumni records for engagement and tracking            | Medium   |

#### Settings

| Feature                     | Description                                                    | Priority |
| --------------------------- | -------------------------------------------------------------- | -------- |
| Application Number Settings | Patterns, prefixes, per branch or per institution              | High     |
| Admission Number Settings   | Unique admission number sequences                              | High     |
| Enrollment Code Settings    | Enrollment codes for internal reference                        | Medium   |
| Admission Fields Setting    | Customizable fields for admission forms                        | Medium   |
| Enquiry Stages              | Custom lead stage pipeline (New, In Progress, Converted, Lost) | Medium   |
| Organization Sources        | Source taxonomy (Agents, Social Media, Website, Walk-in)       | Medium   |
| Leads Code Settings         | Lead ID/code numbering patterns                                | Medium   |
| Task Number Settings        | Task ID sequences for follow-up activities                     | Medium   |
| Organization Streams        | Define academic streams available across the organization      | Medium   |

#### Bulk Upload

| Feature         | Description                                                           | Priority |
| --------------- | --------------------------------------------------------------------- | -------- |
| Bulk Admissions | Upload confirmed admission data from external systems or spreadsheets | High     |

#### Followups

| Feature        | Description                                                        | Priority |
| -------------- | ------------------------------------------------------------------ | -------- |
| Leads Followup | Schedule and track follow-up activities for leads and applications | High     |

#### Web Forms

| Feature       | Description                                                          | Priority |
| ------------- | -------------------------------------------------------------------- | -------- |
| Dynamic Forms | Create and publish dynamic web forms for admissions and lead capture | High     |

#### Reports

| Feature            | Description                                               | Priority |
| ------------------ | --------------------------------------------------------- | -------- |
| Leads Report       | Analytics and status reports for leads pipeline           | High     |
| Application Report | Application statistics, conversion rates, source analysis | High     |

#### Agent Tracking

| Feature       | Description                                               | Priority |
| ------------- | --------------------------------------------------------- | -------- |
| Live Tracking | Real-time tracking of admission agents and their activity | Medium   |

### Student Info Module

#### Student Information

| Feature                      | Description                                                      | Priority |
| ---------------------------- | ---------------------------------------------------------------- | -------- |
| Student Details              | Full profile including academic and personal details             | High     |
| Student Information Updation | Controlled updates of critical data with audit logging           | High     |
| Shuffle Student              | Move students between sections/classes/streams as allowed        | Medium   |
| Promote Student              | Perform academic promotions at batch-end with configurable rules | Medium   |
| Branch Shifts                | Transfer students between branches with data migration           | Medium   |

#### Reports

| Feature         | Description                                            | Priority |
| --------------- | ------------------------------------------------------ | -------- |
| Student Reports | Comprehensive student data reports with custom filters | High     |
| Active Student  | Report of currently active/enrolled students           | High     |

#### Deliverables

* [ ] Application form builder
* [ ] Application to admission conversion workflow
* [ ] Student profile management
* [ ] Bulk upload with validation
* [ ] Student promotion engine
* [ ] Lead management system
* [ ] Lead follow-up tracking
* [ ] Dynamic form builder for web
* [ ] Agent tracking dashboard
* [ ] Alumni management
* [ ] Branch transfer workflow
* [ ] Student reporting system

---

## Week 5: HR & Payroll Module

### HR Module

#### Staff Enrollment

| Feature                    | Description                                           | Priority |
| -------------------------- | ----------------------------------------------------- | -------- |
| Enroll Staff               | Add new staff with roles, branches, and departments   | High     |
| Staff Bulk Enroll          | Import staff lists in bulk                            | High     |
| Staff Information Updation | Update profile, contact, role, and employment details | High     |

#### Staff Attendance

| Feature                 | Description                                         | Priority |
| ----------------------- | --------------------------------------------------- | -------- |
| Daily Attendance        | Mark presence/absence at branch or department level | High     |
| Daily Attendance Report | Day-wise attendance summary                         | High     |
| My Attendance           | Self-view for staff members                         | Medium   |
| Mark Staff Attendance   | Manual marking for authorized users                 | Medium   |
| Attendance Summary      | Monthly/period attendance metrics                   | Medium   |

#### Staff Leave

| Feature             | Description                         | Priority |
| ------------------- | ----------------------------------- | -------- |
| Apply Leave         | Staff can submit leave requests     | High     |
| Staff Leave History | Personal leave history and balances | High     |

#### Reports

| Feature                 | Description                                            | Priority |
| ----------------------- | ------------------------------------------------------ | -------- |
| Staff Attendance Report | Filterable by branch, department, role, and date range | High     |
| Staff Details Report    | Active and historical staff information                | Medium   |
| Staff Leaves Report     | Summaries of leaves by type and duration               | Medium   |
| Inactive Staff Details  | Records of resigned or terminated staff                | Low      |

#### Settings

| Feature                                   | Description                                           | Priority |
| ----------------------------------------- | ----------------------------------------------------- | -------- |
| Staff Enrollment Sequence Number Settings | ID/employee number formats                            | High     |
| Shifts                                    | Configure working shifts and timings                  | Medium   |
| Leave Management                          | Leave types, entitlements, carry-forward rules        | High     |
| Holidays                                  | Define organization-wide and branch-specific holidays | High     |
| Weekly Offs                               | Configure weekly off days per branch/department       | High     |
| Assign To Branches                        | Configure staff assignment rules across branches      | Medium   |

#### Departments & Designations

| Feature                  | Description                                 | Priority |
| ------------------------ | ------------------------------------------- | -------- |
| Create/View Departments  | Academic and non-academic departments       | High     |
| Create/View Designations | Positions and roles within the organization | High     |

#### Staff Workload

| Feature           | Description                                 | Priority |
| ----------------- | ------------------------------------------- | -------- |
| Allocate Workload | Assign teaching loads, subjects, and duties | Medium   |
| Teacher Workload  | Track teaching hours and responsibilities   | Medium   |

#### Approvals

| Feature                    | Description                                     | Priority |
| -------------------------- | ----------------------------------------------- | -------- |
| Staff Leave Approval       | Approve/reject staff leave requests             | High     |
| Staff Resignation Approval | Manage exit approvals and termination workflows | Medium   |

### HR Payroll Module

#### Payroll Setup

| Feature             | Description                                                    | Priority |
| ------------------- | -------------------------------------------------------------- | -------- |
| Payroll             | Configure and process staff payroll with salary components     | High     |
| Penalization Policy | Define penalty rules for late attendance, absences, violations | High     |

#### Deliverables

* [ ] Staff onboarding workflow
* [ ] Attendance tracking system (biometric integration ready)
* [ ] Leave management with balance tracking
* [ ] Department and designation hierarchy
* [ ] Workload allocation dashboard
* [ ] Holiday and weekly off management
* [ ] Multi-branch staff assignment
* [ ] Payroll processing system
* [ ] Penalty calculation engine

---

## Week 6: Communications, Attendance & Feedback Modules

### Communications Module

#### SMS

| Feature  | Description                                                         | Priority |
| -------- | ------------------------------------------------------------------- | -------- |
| Send SMS | Send bulk or targeted SMS to students, parents, staff, and contacts | High     |

#### Approvals

| Feature                | Description                                | Priority |
| ---------------------- | ------------------------------------------ | -------- |
| Approve Announcements  | Workflow for approving major announcements | Medium   |
| Announcement Approvals | Track approval status and history          | Medium   |

#### Event Calendar

| Feature                 | Description                                             | Priority |
| ----------------------- | ------------------------------------------------------- | -------- |
| Event Types Create/View | Define event categories (Academic, Cultural, Exam, PTM) | Medium   |
| Event Create/View       | Create events with date, time, audience, and reminders  | Medium   |

#### Announcements

| Feature               | Description                             | Priority |
| --------------------- | --------------------------------------- | -------- |
| Announcements         | Publish texts/notices to target groups  | High     |
| Announcement Settings | Configure visibility rules and channels | Medium   |

#### Settings

| Feature                 | Description                                                        | Priority |
| ----------------------- | ------------------------------------------------------------------ | -------- |
| Communication Templates | Template library for recurring messages                            | High     |
| DLT Template            | Manage DLT-approved templates and IDs                              | High     |
| Credentials             | Configure password policies and communication for user credentials | Medium   |

#### Reports

| Feature              | Description                                            | Priority |
| -------------------- | ------------------------------------------------------ | -------- |
| Sent SMS             | Log and reports of all SMS sent with delivery status   | High     |
| Login Reports        | User login activity and session tracking               | High     |
| Announcement Reports | Analytics on announcement reach and engagement         | Medium   |
| Notification Reports | Track all system notifications sent (push, email, SMS) | Medium   |
| Never Logged Reports | Users who have never logged into the system            | Medium   |

### Attendance Module

#### Daily Attendance

| Feature            | Description                                    | Priority |
| ------------------ | ---------------------------------------------- | -------- |
| View Attendance    | Class-wise and student-wise attendance views   | High     |
| Attendance Summary | Monthly/period attendance summary for students | High     |

#### Reports

| Feature           | Description                                                 | Priority |
| ----------------- | ----------------------------------------------------------- | -------- |
| Attendance Report | Detailed attendance reports with filters (class, date, etc) | High     |

#### Settings

| Feature  | Description                                  | Priority |
| -------- | -------------------------------------------- | -------- |
| Holidays | Define holidays affecting student attendance | High     |

### Concerns and Feedbacks Module

#### Concerns

| Feature       | Description                                                      | Priority |
| ------------- | ---------------------------------------------------------------- | -------- |
| Concern Types | Define categories of concerns (Academic, Infrastructure, Safety) | High     |
| Concern Form  | Submit and track concerns from students, parents, and staff      | High     |

### Social Post Module

#### Media Setup

| Feature           | Description                                               | Priority |
| ----------------- | --------------------------------------------------------- | -------- |
| Social Media Link | Configure social media account links for the organization | Medium   |
| Post              | Create and schedule posts for social media platforms      | Medium   |

#### Deliverables

* [ ] SMS gateway integration with DLT compliance
* [ ] Event calendar with notifications
* [ ] Announcement management system
* [ ] Student attendance tracking interface
* [ ] Communication template builder
* [ ] Communication reports dashboard
* [ ] Login and activity tracking
* [ ] Student attendance reports
* [ ] Concerns and feedback system
* [ ] Social media integration

---

## Week 7: Certificates, Academics & Online Learning Modules

### Certificates Module

#### Student Certificates

| Feature           | Description                                                      | Priority |
| ----------------- | ---------------------------------------------------------------- | -------- |
| Issue Certificate | Issue student-related certificates (bonafide, TC, conduct, etc.) | High     |

#### Staff Certificates

| Feature           | Description                                                   | Priority |
| ----------------- | ------------------------------------------------------------- | -------- |
| Issue Certificate | Issue staff-related certificates (experience, relieving, etc) | High     |
| Reports           | Track issued staff certificates with filters                  | Medium   |

#### Reports

| Feature             | Description                                   | Priority |
| ------------------- | --------------------------------------------- | -------- |
| Certificate Reports | Track issued student certificates with filters | Medium   |

#### Settings

| Feature                              | Description                                  | Priority |
| ------------------------------------ | -------------------------------------------- | -------- |
| Certificate Sequence Number Settings | Certificate numbering patterns               | Medium   |
| Certificate Approval Settings        | Approval workflow configuration              | Medium   |
| ID Card Template Settings            | Design and configure ID card templates       | Medium   |

#### Approvals

| Feature                    | Description                                  | Priority |
| -------------------------- | -------------------------------------------- | -------- |
| Certificate Approvals      | Approve student certificate issuance requests | Medium   |
| Staff Certificate Approvals | Approve staff certificate issuance requests  | Medium   |

#### ID Cards

| Feature          | Description                                      | Priority |
| ---------------- | ------------------------------------------------ | -------- |
| Student ID Cards | Generate Student ID Cards using custom templates | High     |
| Staff ID Cards   | Generate Staff ID Cards using custom templates   | High     |

### Academics Module

#### Class Management

| Feature                      | Description                                           | Priority |
| ---------------------------- | ----------------------------------------------------- | -------- |
| Class Management             | Manage class structures and configurations            | High     |
| Teacher Management           | Teacher allocation and subject mapping                | High     |
| Student Wise Subject Mapping | Map specific subjects to individual students          | Medium   |

#### Time Table

| Feature                | Description                                                 | Priority |
| ---------------------- | ----------------------------------------------------------- | -------- |
| Create/View Time Table | Create Time Table for classes, streams, years, and sections | High     |

#### Diary

| Feature              | Description                                        | Priority |
| -------------------- | -------------------------------------------------- | -------- |
| Student Diary        | Track daily academic and communication notes       | Medium   |
| General Diary        | General announcements and notes for all students   | Medium   |
| Subject Diary Report | Report on subject-wise diary entries               | Medium   |
| General Diary Report | Report on general diary entries and acknowledgments | Medium   |

#### PTM (Parent-Teacher Meeting)

| Feature             | Description                                        | Priority |
| ------------------- | -------------------------------------------------- | -------- |
| PTM Schedule        | Schedule parent-teacher meetings per class/section | High     |
| PTM Schedule Report | Reports on PTM attendance and feedback             | Medium   |

#### Activities

| Feature           | Description                                              | Priority |
| ----------------- | -------------------------------------------------------- | -------- |
| Activity Creation | Create and manage extracurricular activities and events  | Medium   |

#### Reports

| Feature                         | Description                                     | Priority |
| ------------------------------- | ----------------------------------------------- | -------- |
| Subject Diary Submission Report | Track diary submission status by subject/class  | Medium   |

#### Approvals

| Feature           | Description                                              | Priority |
| ----------------- | -------------------------------------------------------- | -------- |
| Diary Approvals   | Approve diary entries for content quality and compliance | Medium   |
| Activity Approvals | Approve activity creation and scheduling                | Medium   |

#### Settings

| Feature                 | Description                                    | Priority |
| ----------------------- | ---------------------------------------------- | -------- |
| Diary Approval Settings | Configure diary approval workflows             | Medium   |
| Activity Settings       | Configure activity types and rules             | Medium   |
| Diary Creation Settings | Settings for diary entry creation and defaults | Medium   |

### Online Class Module

#### Online Classes

| Feature               | Description                                                   | Priority |
| --------------------- | ------------------------------------------------------------- | -------- |
| Schedule Online Class | Schedule virtual classes with video conferencing integration  | High     |

#### Reports

| Feature                       | Description                                | Priority |
| ----------------------------- | ------------------------------------------ | -------- |
| Online Class Attendance Report | Track student attendance in online classes | High     |

### Lesson Delivery Module

#### Lesson Setup

| Feature            | Description                                         | Priority |
| ------------------ | --------------------------------------------------- | -------- |
| Lesson Creation    | Create lessons with content, objectives, and materials | High   |
| Part/Term Settings | Configure lesson parts and term-wise organization   | Medium   |

#### Lesson Planning

| Feature         | Description                                       | Priority |
| --------------- | ------------------------------------------------- | -------- |
| Lesson Delivery | Track and manage lesson delivery progress         | High     |

#### Deliverables

* [ ] Certificate generation with templates
* [ ] ID card designer and generator
* [ ] Timetable builder with conflict detection
* [ ] Digital diary system with multiple types
* [ ] Teacher-subject-class mapping
* [ ] Student-wise subject mapping
* [ ] PTM scheduling and tracking
* [ ] Activity management system
* [ ] Online class integration
* [ ] Lesson planning and delivery tracking

---

## Week 8: Exams, Gradebooks & Assessments Module

### Exams and Grade Book Module

#### Grade Book

| Feature          | Description                       | Priority |
| ---------------- | --------------------------------- | -------- |
| Grade Groups     | Define grading scales and groups  | High     |
| Marks Allocation | Enter and manage student marks    | High     |
| Marks Approval   | Approval workflow for marks entry | High     |
| Report Card      | Generate student report cards     | High     |

#### Report Card

| Feature                        | Description                         | Priority |
| ------------------------------ | ----------------------------------- | -------- |
| Report Card Template           | Design report card layouts          | High     |
| Attributes Allocation          | Allocate non-academic attributes    | Medium   |
| Health and Hygienic Allocation | Track health and hygiene parameters | Medium   |

#### Exams

| Feature                     | Description                         | Priority |
| --------------------------- | ----------------------------------- | -------- |
| Exam Structure              | Define exam patterns and weightages | High     |
| Sub Skills                  | Configure sub-skills for assessment | Medium   |
| Exam Rule Setup             | Set passing criteria and rules      | High     |
| Schedule Exam               | Create exam schedules               | High     |
| Attributes                  | Manage exam attributes              | Medium   |
| Health and Hygienic Details | Record health details during exams  | Low      |

#### Settings

| Feature                 | Description                      | Priority |
| ----------------------- | -------------------------------- | -------- |
| Hall Ticket Settings    | Configure hall ticket generation | Medium   |
| Marks Approval Settings | Configure approval workflows     | Medium   |

#### General Exams

| Feature        | Description                   | Priority |
| -------------- | ----------------------------- | -------- |
| Schedule Exam  | Schedule general/common exams | High     |
| Marks Entry    | Enter marks for general exams | High     |
| Marks Approval | Approve general exam marks    | High     |
| View Marks     | View and analyze marks        | High     |

#### Bulk Upload

| Feature                | Description                         | Priority |
| ---------------------- | ----------------------------------- | -------- |
| Attendance Bulk Upload | Bulk upload exam attendance records | Medium   |

### Assessments Module

#### Assessment Setup

| Feature            | Description                                            | Priority |
| ------------------ | ------------------------------------------------------ | -------- |
| Taxonomy           | Define assessment taxonomies (Bloom's levels, etc)     | High     |
| Difficulty Level   | Configure difficulty levels for questions/assessments  | High     |
| My Assessment      | Teacher's personal assessment workspace                | High     |
| Assessment Library | Shared repository of assessments across the institution | High    |

#### Question Setup

| Feature       | Description                                              | Priority |
| ------------- | -------------------------------------------------------- | -------- |
| Question Bank | Create and manage question bank with categories and tags | High     |

#### Deliverables

* [ ] Exam scheduling system
* [ ] Marks entry with validation
* [ ] Report card generation
* [ ] Hall ticket generation
* [ ] Grade calculation engine
* [ ] Assessment creation tools
* [ ] Question bank management
* [ ] Assessment library

---

## Week 9: Expense, Inventory, Transport, Infra & Hostel Modules

### Expense Management Module

#### Expense Tracking

| Feature              | Description                   | Priority |
| -------------------- | ----------------------------- | -------- |
| All Expenses         | View and manage all expenses  | High     |
| Ledger Book          | Maintain expense ledger       | High     |
| Expense Transactions | Track individual transactions | High     |

#### Settings

| Feature                  | Description               | Priority |
| ------------------------ | ------------------------- | -------- |
| Expense Categories       | Define expense categories | High     |
| Expense Voucher Settings | Configure voucher formats | Medium   |

### Inventory Module

#### Inventory Creation

| Feature           | Description                 | Priority |
| ----------------- | --------------------------- | -------- |
| Category Creation | Create inventory categories | High     |
| Item Creation     | Add inventory items         | High     |
| Stores            | Manage store locations      | Medium   |

#### Stock Management

| Feature                      | Description                                  | Priority |
| ---------------------------- | -------------------------------------------- | -------- |
| Kits                         | Manage item kits/bundles                     | Medium   |
| Stock Addition               | Add stock to inventory                       | High     |
| Item Sale                    | Process item sales                           | High     |
| Item Sale Report             | View sales reports                           | High     |
| Return/Cancellation Requests | Handle item returns and cancellation requests | Medium   |

#### Settings

| Feature                          | Description                              | Priority |
| -------------------------------- | ---------------------------------------- | -------- |
| Inventory Receipt Number Settings | Configure inventory receipt numbering   | Medium   |
| Inventory Discount Settings      | Configure discount rules for inventory   | Medium   |

#### Reports

| Feature                      | Description                             | Priority |
| ---------------------------- | --------------------------------------- | -------- |
| Class Wise Item Sale Report  | Item sales aggregated by class          | Medium   |
| Purchase Report              | Detailed purchase transaction reports   | High     |
| Student Wise Item Sale Report | Individual student purchase history    | Medium   |

#### Approvals

| Feature             | Description                    | Priority |
| ------------------- | ------------------------------ | -------- |
| Inventory Approvals | Approve inventory transactions | Medium   |

### Transport Module

#### Transport Management

| Feature                  | Description                                    | Priority |
| ------------------------ | ---------------------------------------------- | -------- |
| Vehicle Details          | Manage vehicle information                     | High     |
| Vehicle Routes           | Define transport routes                        | High     |
| Route Fee Creation       | Set route-based fees                           | High     |
| Assign Vehicle Routes    | Map students to routes                         | High     |
| Trips                    | Manage daily trips and schedules               | High     |
| Vehicle Tracking         | Real-time GPS tracking of vehicles             | Medium   |
| Transport Fee Bulk Upload | Bulk upload transport fee assignments         | Medium   |

#### Reports

| Feature               | Description                             | Priority |
| --------------------- | --------------------------------------- | -------- |
| Assigned Routes Report | Report on student-route assignments    | High     |

#### Settings

| Feature                   | Description                                  | Priority |
| ------------------------- | -------------------------------------------- | -------- |
| Trip Notification Settings | Configure notifications for trip status     | Medium   |

### Infra Management Module

#### Building Details

| Feature                     | Description                     | Priority |
| --------------------------- | ------------------------------- | -------- |
| Add Building Details        | Manage building information     | Medium   |
| Add Room Management General | Room allocation for general use | Medium   |
| Add Room Management Exams   | Room allocation for exams       | Medium   |

### Visitor Management Module

#### Visitor Management

| Feature              | Description                                     | Priority |
| -------------------- | ----------------------------------------------- | -------- |
| Visitor Details Setup | Configure visitor types and required information | High    |
| Visitors Record      | Log and manage visitor entries and exits        | High     |

#### Visitor Pass

| Feature      | Description                              | Priority |
| ------------ | ---------------------------------------- | -------- |
| Staff Pass   | Generate visitor passes for staff guests | Medium   |
| Student Pass | Generate visitor passes for student guests | Medium  |

#### Reports

| Feature         | Description                                 | Priority |
| --------------- | ------------------------------------------- | -------- |
| Visitors Report | Analytics on visitor frequency and patterns | Medium   |

#### Approvals

| Feature          | Description                              | Priority |
| ---------------- | ---------------------------------------- | -------- |
| Visitor Approval | Approve visitor access requests          | Medium   |

#### Settings

| Feature                   | Description                           | Priority |
| ------------------------- | ------------------------------------- | -------- |
| Visitor Approval Settings | Configure visitor approval workflows  | Medium   |

### Hostel Management Module

#### Hostel Setup

| Feature                  | Description                                    | Priority |
| ------------------------ | ---------------------------------------------- | -------- |
| Hostel Creation          | Create and configure hostels                   | High     |
| Building Details         | Manage hostel building information             | High     |
| Assign Hostels to Branch | Map hostels to branches                        | High     |
| Room Management          | Manage rooms, beds, and occupancy              | High     |

#### Kitchen Inventory

| Feature        | Description                                 | Priority |
| -------------- | ------------------------------------------- | -------- |
| Item Creation  | Create kitchen inventory items              | High     |
| Purchase Entry | Record kitchen purchases                    | High     |
| Usage Entry    | Track daily kitchen item usage              | High     |
| Meal Plan      | Configure meal plans and schedules          | Medium   |

#### Reports

| Feature               | Description                                  | Priority |
| --------------------- | -------------------------------------------- | -------- |
| Purchase & Usage Report | Kitchen inventory purchase and usage analytics | High   |

#### Deliverables

* [ ] Expense tracking dashboard
* [ ] Inventory management system
* [ ] Transport route management
* [ ] Building and room management
* [ ] Stock tracking with alerts
* [ ] Vehicle tracking integration
* [ ] Visitor management system
* [ ] Hostel management system
* [ ] Kitchen inventory tracking

---

## Week 10: Health Module & Integration Testing

### Health Module

#### Student Health Records

| Feature                | Description                                                       | Priority |
| ---------------------- | ----------------------------------------------------------------- | -------- |
| Health Profile         | Medical history, allergies, blood group, chronic conditions       | High     |
| Emergency Contacts     | Medical emergency contact details                                 | High     |
| Health Checkup Records | Periodic health checkup tracking (height, weight, vision, dental) | High     |
| Vaccination Records    | Immunization tracking and due date alerts                         | Medium   |

#### Health Incidents

| Feature                | Description                                                  | Priority |
| ---------------------- | ------------------------------------------------------------ | -------- |
| Incident Recording     | Record injuries, illnesses, first-aid administered on campus | High     |
| Incident Reports       | Generate incident reports for parents/authorities            | High     |
| Medical Leave Tracking | Link health incidents with attendance                        | Medium   |

#### Medical Documents

| Feature              | Description                              | Priority |
| -------------------- | ---------------------------------------- | -------- |
| Medical Certificates | Upload and manage medical certificates   | Medium   |
| Prescription Records | Store prescription details from checkups | Low      |

#### Reports

| Feature                      | Description                                            | Priority |
| ---------------------------- | ------------------------------------------------------ | -------- |
| Class-wise Health Summary    | Overview of health status by class                     | Medium   |
| Students Requiring Attention | List students with pending checkups or health concerns | Medium   |
| Vaccination Due Report       | Students with pending vaccinations                     | Medium   |

#### Settings

| Feature                   | Description                            | Priority |
| ------------------------- | -------------------------------------- | -------- |
| Health Parameters         | Configure health metrics to track      | High     |
| Checkup Schedule Settings | Define checkup frequency and types     | Medium   |
| Vaccination Master        | Manage vaccination types and schedules | Medium   |

### Integration & Testing

#### Final Integration Tasks

| Task                     | Description                                  | Priority |
| ------------------------ | -------------------------------------------- | -------- |
| Cross-module Integration | Ensure all modules work together seamlessly  | High     |
| Unified Dashboard        | Complete owner dashboard with all KPIs       | High     |
| Performance Testing      | Load testing for 5,000+ concurrent users     | High     |
| Security Audit           | RBAC verification and data isolation testing | High     |
| UAT Preparation          | Prepare user acceptance testing environment  | High     |

#### Deliverables

* [ ] Complete Health module
* [ ] Unified owner dashboard
* [ ] Cross-module data flow verification
* [ ] Performance optimization
* [ ] Documentation and training materials

---

## Module Summary

| Week      | Modules                                           | Features Count |
| --------- | ------------------------------------------------- | -------------- |
| 1         | Organization                                      | 14             |
| 2         | Finance (Part 1)                                  | 16             |
| 3         | Finance (Part 2)                                  | 14             |
| 4         | Admissions, Student Info                          | 27 (+5)        |
| 5         | HR, HR Payroll                                    | 27 (+2)        |
| 6         | Communications, Attendance, Concerns, Social Post | 26 (+6)        |
| 7         | Certificates, Academics, Online Class, Lesson     | 35 (+24)       |
| 8         | Exams, Gradebooks, Assessments                    | 23 (+6)        |
| 9         | Expense, Inventory, Transport, Infra, Visitor, Hostel | 41 (+26)   |
| 10        | Health, Integration                               | 14             |
| **Total** | **23 Modules**                                    | **237 Features** |

---

## New Modules Added

| Module                   | Week | Description                                        |
| ------------------------ | ---- | -------------------------------------------------- |
| HR Payroll               | 5    | Payroll processing and penalization policies       |
| Concerns and Feedbacks   | 6    | Concern submission and tracking system             |
| Social Post              | 6    | Social media integration and posting               |
| Online Class             | 7    | Virtual classroom scheduling and attendance        |
| Lesson Delivery          | 7    | Lesson planning and delivery tracking              |
| Assessments              | 8    | Question banks and assessment management           |
| Visitor Management       | 9    | Visitor logging and pass generation                |
| Hostel Management        | 9    | Hostel, room, and kitchen inventory management     |

---

## Changes Summary (This Update)

### Week 4 - Student Info (+5)
- Branch Shifts
- Student Reports (new section)
- Active Student

### Week 5 - HR Payroll (+2)
- Payroll
- Penalization Policy

### Week 6 (+6)
- Concerns and Feedbacks Module (Concern Types, Concern Form)
- Social Post Module (Social Media Link, Post)

### Week 7 - Certificates (+4)
- ID Card Template Settings
- Staff Certificate Approvals
- Staff Certificates section (Issue Certificate, Reports)

### Week 7 - Academics (+13)
- Student Wise Subject Mapping
- General Diary, Subject Diary Report, General Diary Report
- Activity Approvals
- Diary Approval Settings, Activity Settings, Diary Creation Settings
- PTM Schedule, PTM Schedule Report
- Activity Creation
- Subject Diary Submission Report

### Week 7 - Online Class Module (+2)
- Schedule Online Class
- Online Class Attendance Report

### Week 7 - Lesson Delivery Module (+3)
- Lesson Creation
- Part/Term Settings
- Lesson Delivery

### Week 8 - Grade Book (+1)
- Report Card (in Grade Book section)

### Week 8 - Assessments Module (+5)
- Taxonomy
- Difficulty Level
- My Assessment
- Assessment Library
- Question Bank

### Week 9 - Inventory (+6)
- Return/Cancellation Requests
- Inventory Receipt Number Settings
- Inventory Discount Settings
- Class Wise Item Sale Report
- Purchase Report
- Student Wise Item Sale Report

### Week 9 - Transport (+5)
- Trips
- Vehicle Tracking
- Transport Fee Bulk Upload
- Assigned Routes Report
- Trip Notification Settings

### Week 9 - Visitor Management Module (+7)
- Visitor Details Setup
- Visitors Record
- Staff Pass
- Student Pass
- Visitors Report
- Visitor Approval
- Visitor Approval Settings

### Week 9 - Hostel Management Module (+9)
- Hostel Creation
- Building Details
- Assign Hostels to Branch
- Room Management
- Item Creation (Kitchen)
- Purchase Entry
- Usage Entry
- Meal Plan
- Purchase & Usage Report

---

## Duplicates Identified (Not Added Twice)

| Feature              | Location                              | Notes                                    |
| -------------------- | ------------------------------------- | ---------------------------------------- |
| Certificate Approvals | Week 7 - Certificates Approvals      | Already existed, added Staff variant     |
| Report Card          | Week 8 - Report Card section          | Already had Report Card Template section |

---

## Technical Stack (Recommended)

* **Backend:** Node.js with Express.js
* **Database:** MongoDB with native driver
* **Frontend:** Next.js (Admin), React Native/Expo (Mobile)
* **Authentication:** JWT with role-based access
* **File Storage:** AWS S3
* **SMS Gateway:** DLT-compliant provider
* **Payment Gateway:** Razorpay/PayU
* **Video Conferencing:** Zoom/Google Meet API integration
* **GPS Tracking:** Google Maps API
* **Hosting:** Digital Ocean

---

## Success Metrics

* 40% reduction in manual administrative workload within 6 months
* 95% data completeness for student, staff, and financial records
* Real-time KPIs loading in under 10 seconds
* 99% fee collection tracking accuracy
* 80% monthly active usage among staff for core modules
* Support for 5,000+ concurrent users per owner group

---

## Risk Mitigation

| Risk               | Mitigation Strategy                                      |
| ------------------ | -------------------------------------------------------- |
| Scope Creep        | Strict adherence to feature list, change request process |
| Integration Issues | Weekly integration testing from Week 4                   |
| Performance        | Early load testing, database indexing strategy           |
| Data Migration     | Parallel running period, rollback procedures             |
| User Adoption      | Training sessions, documentation, gradual rollout        |

---

## Notes

1. Each week includes buffer time for bug fixes and refinements
2. Code reviews and testing are continuous throughout development
3. API documentation to be maintained alongside development
4. Mobile app development can run parallel from Week 5 onwards
5. Health module is a new addition not in original PRD
6. Total modules increased from 15 to 23 with the new additions
7. Video conferencing integration required for Online Class module
8. GPS integration required for Vehicle Tracking feature
