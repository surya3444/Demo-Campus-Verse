# Campus Verse - System Flowcharts

## Table of Contents

1. [High-Level System Architecture](#1-high-level-system-architecture)
2. [User Authentication Flow](#2-user-authentication-flow)
3. [Organization Setup Flow](#3-organization-setup-flow)
4. [Student Lifecycle Flow](#4-student-lifecycle-flow)
5. [Admissions Pipeline Flow](#5-admissions-pipeline-flow)
6. [Finance Module Flow](#6-finance-module-flow)
7. [Fee Collection Flow](#7-fee-collection-flow)
8. [Attendance Flow](#8-attendance-flow)
9. [HR & Leave Management Flow](#9-hr--leave-management-flow)
10. [Academics & Timetable Flow](#10-academics--timetable-flow)
11. [Exams & Gradebook Flow](#11-exams--gradebook-flow)
12. [Communications Flow](#12-communications-flow)
13. [Complete Data Flow Diagram](#13-complete-data-flow-diagram)
14. [Module Interaction Map](#14-module-interaction-map)

---

## 1. High-Level System Architecture

```mermaid
flowchart TB
    subgraph Client["Client Layer"]
        WEB[Web Application<br/>Next.js 15]
        MOBILE[Mobile App<br/>Future]
        PUBLIC[Public Forms<br/>Enquiry/Application]
    end

    subgraph Gateway["API Gateway"]
        LB[Load Balancer]
        CDN[CloudFront CDN]
        RATE[Rate Limiter]
    end

    subgraph API["Application Layer"]
        AUTH[Auth Service]
        ORG[Organization Service]
        STUDENT[Student Service]
        ADMISSION[Admission Service]
        FINANCE[Finance Service]
        ATTENDANCE[Attendance Service]
        HR[HR Service]
        COMMS[Communication Service]
        ACADEMIC[Academic Service]
        EXAM[Exam Service]
        TRANSPORT[Transport Service]
        CERT[Certificate Service]
        DASHBOARD[Dashboard Service]
    end

    subgraph Data["Data Layer"]
        MONGO[(MongoDB<br/>Primary Database)]
        REDIS[(Redis<br/>Cache/Sessions)]
        S3[(AWS S3<br/>File Storage)]
    end

    subgraph External["External Services"]
        RAZORPAY[Razorpay<br/>Payments]
        MSG91[MSG91<br/>SMS Gateway]
        SMTP[SMTP<br/>Email Service]
    end

    WEB --> CDN
    MOBILE --> LB
    PUBLIC --> LB
    CDN --> LB
    LB --> RATE
    RATE --> AUTH

    AUTH --> ORG
    AUTH --> STUDENT
    AUTH --> ADMISSION
    AUTH --> FINANCE
    AUTH --> ATTENDANCE
    AUTH --> HR
    AUTH --> COMMS
    AUTH --> ACADEMIC
    AUTH --> EXAM
    AUTH --> TRANSPORT
    AUTH --> CERT
    AUTH --> DASHBOARD

    ORG --> MONGO
    STUDENT --> MONGO
    ADMISSION --> MONGO
    FINANCE --> MONGO
    ATTENDANCE --> MONGO
    HR --> MONGO
    COMMS --> MONGO
    ACADEMIC --> MONGO
    EXAM --> MONGO
    TRANSPORT --> MONGO
    CERT --> MONGO
    DASHBOARD --> MONGO

    AUTH --> REDIS
    DASHBOARD --> REDIS
    FINANCE --> RAZORPAY
    COMMS --> MSG91
    COMMS --> SMTP
    CERT --> S3
    ORG --> S3
```

---

## 2. User Authentication Flow

```mermaid
flowchart TD
    START([User Opens App]) --> LOGIN[Login Page]
    LOGIN --> ENTER[Enter Credentials<br/>Email/Phone + Password]
    ENTER --> VALIDATE{Validate<br/>Credentials}

    VALIDATE -->|Invalid| ERROR[Show Error Message]
    ERROR --> ENTER

    VALIDATE -->|Valid| CHECK_MFA{MFA<br/>Enabled?}

    CHECK_MFA -->|No| GEN_TOKEN[Generate JWT Tokens]
    CHECK_MFA -->|Yes| MFA[Enter MFA Code]
    MFA --> VERIFY_MFA{Verify<br/>MFA}
    VERIFY_MFA -->|Invalid| MFA
    VERIFY_MFA -->|Valid| GEN_TOKEN

    GEN_TOKEN --> ACCESS[Access Token<br/>15 min expiry]
    GEN_TOKEN --> REFRESH[Refresh Token<br/>7 day expiry]

    ACCESS --> STORE[Store in Memory]
    REFRESH --> COOKIE[Store in HTTP-Only Cookie]

    STORE --> FETCH_USER[Fetch User Profile]
    FETCH_USER --> FETCH_PERMS[Fetch Permissions]
    FETCH_PERMS --> FETCH_BRANCH[Fetch Branch Context]
    FETCH_BRANCH --> DASHBOARD[Redirect to Dashboard]

    subgraph Token_Refresh["Token Refresh Flow"]
        EXPIRED[Access Token Expired] --> SEND_REFRESH[Send Refresh Token]
        SEND_REFRESH --> VALID_REFRESH{Valid?}
        VALID_REFRESH -->|Yes| NEW_TOKENS[Generate New Tokens]
        VALID_REFRESH -->|No| LOGOUT[Force Logout]
        NEW_TOKENS --> CONTINUE[Continue Request]
    end

    subgraph Password_Reset["Password Reset Flow"]
        FORGOT[Forgot Password] --> EMAIL_PHONE[Enter Email/Phone]
        EMAIL_PHONE --> SEND_OTP[Send Reset OTP/Link]
        SEND_OTP --> VERIFY_OTP[Verify OTP]
        VERIFY_OTP --> NEW_PASS[Set New Password]
        NEW_PASS --> RESET_SUCCESS[Password Reset Success]
        RESET_SUCCESS --> LOGIN
    end
```

---

## 3. Organization Setup Flow

```mermaid
flowchart TD
    START([Super Admin Login]) --> CREATE_TENANT[Create Tenant/Organization]

    CREATE_TENANT --> ORG_INFO[Enter Organization Info<br/>Name, Type, Contact]
    ORG_INFO --> ORG_TYPE{Select Institution<br/>Type}

    ORG_TYPE -->|School| SCHOOL[School Setup]
    ORG_TYPE -->|College| COLLEGE[College Setup]
    ORG_TYPE -->|University| UNIVERSITY[University Setup]

    subgraph School_Setup["School Configuration"]
        SCHOOL --> S_GEO[Define States & Cities]
        S_GEO --> S_BRANCH[Create Branches]
        S_BRANCH --> S_BATCH[Create Academic Batches<br/>2024-25, 2025-26]
        S_BATCH --> S_CLASS[Create Classes/Grades<br/>1, 2, 3... 10]
        S_CLASS --> S_SECTION[Create Sections<br/>A, B, C, D]
        S_SECTION --> S_SUBJECT[Define Subjects<br/>Math, Science, English]
    end

    subgraph College_Setup["College Configuration"]
        COLLEGE --> C_GEO[Define States & Cities]
        C_GEO --> C_BRANCH[Create Branches]
        C_BRANCH --> C_BATCH[Create Academic Batches]
        C_BATCH --> C_STREAM[Create Streams<br/>MPC, BiPC, CEC]
        C_STREAM --> C_CLASS[Create Classes/Batches<br/>MPC-A, MPC-IIT]
        C_CLASS --> C_SUBJECT[Define Subjects]
    end

    subgraph University_Setup["University Configuration"]
        UNIVERSITY --> U_GEO[Define States & Cities]
        U_GEO --> U_BRANCH[Create Branches/Campuses]
        U_BRANCH --> U_DEPT[Create Departments<br/>CSE, ECE, MECH]
        U_DEPT --> U_YEAR[Create Years<br/>1st, 2nd, 3rd, 4th]
        U_YEAR --> U_SECTION[Create Sections]
        U_SECTION --> U_SUBJECT[Define Subjects]
    end

    S_SUBJECT --> ROLES[Create Roles & Permissions]
    C_SUBJECT --> ROLES
    U_SUBJECT --> ROLES

    ROLES --> USERS[Create Users<br/>Admin, Staff, Teachers]
    USERS --> ASSIGN[Assign Roles & Branches]
    ASSIGN --> SETTINGS[Configure Settings<br/>Fee Rules, Holidays, etc.]
    SETTINGS --> COMPLETE([Organization Ready])
```

---

## 4. Student Lifecycle Flow

```mermaid
flowchart TD
    START([Student Lifecycle]) --> ENQUIRY[Lead/Enquiry]

    ENQUIRY --> APPLICATION[Application Submission]
    APPLICATION --> REVIEW{Application<br/>Review}

    REVIEW -->|Rejected| REJECTED[Application Rejected]
    REVIEW -->|Approved| ADMISSION[Admission Confirmed]

    ADMISSION --> ENROLLMENT[Student Enrollment]

    subgraph Enrollment["Enrollment Process"]
        ENROLLMENT --> CREATE[Create Student Record]
        CREATE --> ASSIGN_CLASS[Assign to Class/Section]
        ASSIGN_CLASS --> ASSIGN_FEE[Assign Fee Structure]
        ASSIGN_FEE --> ASSIGN_TRANSPORT[Assign Transport<br/>Optional]
        ASSIGN_TRANSPORT --> ASSIGN_HOSTEL[Assign Hostel<br/>Optional]
        ASSIGN_HOSTEL --> GEN_ID[Generate Admission No.<br/>& ID Card]
    end

    GEN_ID --> ACTIVE[Active Student]

    subgraph Active_Operations["Active Student Operations"]
        ACTIVE --> ATTENDANCE[Daily Attendance]
        ACTIVE --> ACADEMICS[Academic Activities]
        ACTIVE --> EXAMS[Examinations]
        ACTIVE --> FEES[Fee Payments]
        ACTIVE --> TRANSPORT_USE[Transport Usage]
    end

    ACTIVE --> YEAR_END{Academic<br/>Year End}

    YEAR_END --> PROMOTION{Promotion<br/>Decision}

    PROMOTION -->|Promoted| PROMOTE[Promote to Next Class]
    PROMOTE --> NEXT_BATCH[New Academic Batch]
    NEXT_BATCH --> ACTIVE

    PROMOTION -->|Detained| DETAIN[Repeat Same Class]
    DETAIN --> NEXT_BATCH

    PROMOTION -->|Completed| GRADUATE[Graduation/TC]
    GRADUATE --> ALUMNI[Alumni Records]

    subgraph Transfers["Transfer Operations"]
        ACTIVE --> SHUFFLE[Section Shuffle<br/>Same Class]
        ACTIVE --> BRANCH_TRANSFER[Branch Transfer]
        ACTIVE --> DROPOUT[Dropout/TC]
    end

    SHUFFLE --> ACTIVE
    BRANCH_TRANSFER --> ACTIVE
    DROPOUT --> INACTIVE[Inactive Student]
```

---

## 5. Admissions Pipeline Flow

```mermaid
flowchart TD
    subgraph Lead_Sources["Lead Sources"]
        WALKIN[Walk-in Enquiry]
        WEBSITE[Website Form]
        PHONE[Phone Enquiry]
        REFERRAL[Referral]
        AGENT[Agent Referral]
        CAMPAIGN[Marketing Campaign]
    end

    WALKIN --> LEAD[Create Lead]
    WEBSITE --> LEAD
    PHONE --> LEAD
    REFERRAL --> LEAD
    AGENT --> LEAD
    CAMPAIGN --> LEAD

    LEAD --> LEAD_INFO[Capture Lead Info<br/>Name, Contact, Class Interest]
    LEAD_INFO --> ASSIGN_OWNER[Assign Lead Owner]

    subgraph Lead_Management["Lead Management"]
        ASSIGN_OWNER --> STAGE_NEW[Stage: New]
        STAGE_NEW --> FOLLOWUP1[First Follow-up]
        FOLLOWUP1 --> STAGE_CONTACTED[Stage: Contacted]
        STAGE_CONTACTED --> SCHEDULE[Schedule Visit/Meeting]
        SCHEDULE --> STAGE_VISIT[Stage: Visit Scheduled]
        STAGE_VISIT --> CAMPUS_VISIT[Campus Visit]
        CAMPUS_VISIT --> STAGE_INTERESTED[Stage: Interested]
    end

    STAGE_INTERESTED --> CONVERT{Convert to<br/>Application?}

    CONVERT -->|No| LOST[Mark as Lost<br/>Capture Reason]
    CONVERT -->|Yes| CREATE_APP[Create Application]

    subgraph Application_Process["Application Process"]
        CREATE_APP --> APP_FORM[Fill Application Form]
        APP_FORM --> UPLOAD_DOCS[Upload Documents]
        UPLOAD_DOCS --> APP_FEE{Application<br/>Fee Required?}
        APP_FEE -->|Yes| PAY_FEE[Pay Application Fee]
        APP_FEE -->|No| SUBMIT
        PAY_FEE --> SUBMIT[Submit Application]
    end

    SUBMIT --> APP_STATUS[Application Status: Submitted]

    subgraph Review_Process["Review Process"]
        APP_STATUS --> VERIFY[Document Verification]
        VERIFY --> VERIFY_STATUS{Documents<br/>Valid?}
        VERIFY_STATUS -->|No| REQUEST_DOCS[Request Additional Docs]
        REQUEST_DOCS --> UPLOAD_DOCS
        VERIFY_STATUS -->|Yes| PROCESSING[Status: Processing]
        PROCESSING --> ENTRANCE{Entrance Test<br/>Required?}
        ENTRANCE -->|Yes| SCHEDULE_TEST[Schedule Test]
        SCHEDULE_TEST --> CONDUCT_TEST[Conduct Test]
        CONDUCT_TEST --> EVALUATE[Evaluate Results]
        EVALUATE --> DECISION
        ENTRANCE -->|No| DECISION{Admission<br/>Decision}
    end

    DECISION -->|Rejected| APP_REJECTED[Status: Rejected<br/>Send Notification]
    DECISION -->|Waitlist| WAITLIST[Status: Waitlisted]
    DECISION -->|Approved| APPROVED[Status: Approved]

    APPROVED --> OFFER[Send Admission Offer]
    OFFER --> ACCEPT{Offer<br/>Accepted?}

    ACCEPT -->|No| OFFER_DECLINED[Offer Declined]
    ACCEPT -->|Yes| CONFIRM[Confirm Admission]

    CONFIRM --> ENROLL[Create Student Record]
    ENROLL --> ASSIGN[Assign Class/Section]
    ASSIGN --> ENROLLED([Student Enrolled])
```

---

## 6. Finance Module Flow

```mermaid
flowchart TD
    subgraph Fee_Setup["Fee Structure Setup"]
        START([Finance Setup]) --> FEE_TYPE[Define Fee Types<br/>Tuition, Transport, Hostel, Exam]
        FEE_TYPE --> FEE_STRUCTURE[Create Fee Structure]
        FEE_STRUCTURE --> ADD_COMPONENTS[Add Fee Components<br/>Amount per Type]
        ADD_COMPONENTS --> INSTALLMENTS[Define Installments<br/>Term 1, Term 2, Term 3]
        INSTALLMENTS --> DUE_DATES[Set Due Dates]
        DUE_DATES --> FINE_RULES[Configure Fine Rules<br/>Late Fee Calculation]
    end

    subgraph Fee_Assignment["Fee Assignment"]
        FINE_RULES --> ASSIGN_TYPE{Assignment<br/>Type}
        ASSIGN_TYPE -->|Individual| SINGLE[Select Student]
        ASSIGN_TYPE -->|Bulk| BULK[Select Class/Section]
        SINGLE --> MAP_FEE[Map Fee Structure]
        BULK --> MAP_FEE
        MAP_FEE --> CALCULATE[Calculate Total Fees]
        CALCULATE --> CREATE_DUES[Create Due Records]
    end

    subgraph Concessions["Concession Management"]
        CREATE_DUES --> CONCESSION{Concession<br/>Applicable?}
        CONCESSION -->|Yes| REQUEST_CON[Request Concession]
        REQUEST_CON --> CON_TYPE[Select Concession Type<br/>Scholarship, Sibling, Staff Ward]
        CON_TYPE --> CON_AMOUNT[Enter Amount/Percentage]
        CON_AMOUNT --> CON_APPROVE{Approval<br/>Required?}
        CON_APPROVE -->|Yes| SUBMIT_CON[Submit for Approval]
        SUBMIT_CON --> REVIEW_CON{Review<br/>Decision}
        REVIEW_CON -->|Rejected| CON_REJECTED[Concession Rejected]
        REVIEW_CON -->|Approved| APPLY_CON[Apply Concession]
        CON_APPROVE -->|No| APPLY_CON
        APPLY_CON --> ADJUST_DUES[Adjust Due Amount]
        CONCESSION -->|No| FINAL_DUES
        ADJUST_DUES --> FINAL_DUES[Final Due Amount]
    end

    subgraph Fee_Collection["Fee Collection"]
        FINAL_DUES --> COLLECT[Fee Counter]
        COLLECT --> SELECT_STUDENT[Search/Select Student]
        SELECT_STUDENT --> VIEW_DUES[View Outstanding Dues]
        VIEW_DUES --> SELECT_ITEMS[Select Items to Pay]
        SELECT_ITEMS --> PAYMENT_MODE{Payment<br/>Mode}
        PAYMENT_MODE -->|Cash| CASH[Record Cash Payment]
        PAYMENT_MODE -->|Card| CARD[Card Payment]
        PAYMENT_MODE -->|Online| ONLINE[Razorpay Gateway]
        PAYMENT_MODE -->|Cheque| CHEQUE[Record Cheque Details]
        CASH --> RECORD
        CARD --> RECORD
        ONLINE --> GATEWAY[Process Payment]
        GATEWAY -->|Success| RECORD
        GATEWAY -->|Failed| RETRY[Retry Payment]
        RETRY --> PAYMENT_MODE
        CHEQUE --> RECORD[Record Transaction]
    end

    subgraph Receipt_Generation["Receipt Generation"]
        RECORD --> GEN_RECEIPT[Generate Receipt Number]
        GEN_RECEIPT --> CREATE_PDF[Create PDF Receipt]
        CREATE_PDF --> SEND_RECEIPT{Send<br/>Receipt?}
        SEND_RECEIPT -->|SMS| SEND_SMS[Send SMS]
        SEND_RECEIPT -->|Email| SEND_EMAIL[Send Email]
        SEND_RECEIPT -->|Print| PRINT[Print Receipt]
        SEND_SMS --> COMPLETE
        SEND_EMAIL --> COMPLETE
        PRINT --> COMPLETE([Payment Complete])
    end
```

---

## 7. Fee Collection Flow

```mermaid
flowchart TD
    subgraph Fee_Counter["Fee Counter Interface"]
        START([Open Fee Counter]) --> SEARCH[Search Student<br/>Name/Admission No/Phone]
        SEARCH --> SELECT[Select Student]
        SELECT --> LOAD[Load Student Details]
    end

    LOAD --> DISPLAY[Display Fee Summary]

    subgraph Fee_Summary["Fee Summary View"]
        DISPLAY --> TOTAL[Total Fee Amount]
        DISPLAY --> PAID[Amount Paid]
        DISPLAY --> CONCESSION[Concessions Applied]
        DISPLAY --> PENDING[Pending Amount]
        DISPLAY --> OVERDUE[Overdue Amount]
        DISPLAY --> FINE[Fine Amount]
    end

    PENDING --> SELECT_PAY[Select Items to Pay]

    subgraph Payment_Selection["Payment Selection"]
        SELECT_PAY --> BY_INSTALL[By Installment<br/>Term 1, Term 2]
        SELECT_PAY --> BY_TYPE[By Fee Type<br/>Tuition, Transport]
        SELECT_PAY --> CUSTOM[Custom Amount]
        BY_INSTALL --> AMOUNT
        BY_TYPE --> AMOUNT
        CUSTOM --> AMOUNT[Calculate Amount]
    end

    AMOUNT --> FINE_CHECK{Late Fine<br/>Applicable?}
    FINE_CHECK -->|Yes| ADD_FINE[Add Late Fine]
    FINE_CHECK -->|No| FINAL
    ADD_FINE --> WAIVE{Waive<br/>Fine?}
    WAIVE -->|Yes| WAIVE_APPROVE{Has<br/>Permission?}
    WAIVE_APPROVE -->|Yes| FINAL
    WAIVE_APPROVE -->|No| ADD_FINE_AMOUNT[Include Fine]
    WAIVE -->|No| ADD_FINE_AMOUNT
    ADD_FINE_AMOUNT --> FINAL[Final Payable Amount]

    FINAL --> MODE{Select Payment<br/>Mode}

    subgraph Cash_Payment["Cash Payment"]
        MODE -->|Cash| CASH_ENTER[Enter Cash Received]
        CASH_ENTER --> CALC_CHANGE[Calculate Change]
        CALC_CHANGE --> CONFIRM_CASH[Confirm Payment]
    end

    subgraph Card_Payment["Card Payment"]
        MODE -->|Card| CARD_TYPE[Card Type<br/>Credit/Debit]
        CARD_TYPE --> CARD_REF[Enter Reference No]
        CARD_REF --> CONFIRM_CARD[Confirm Payment]
    end

    subgraph Online_Payment["Online Payment"]
        MODE -->|Online| CREATE_ORDER[Create Razorpay Order]
        CREATE_ORDER --> SHOW_QR[Show QR/Payment Link]
        SHOW_QR --> WAIT[Wait for Payment]
        WAIT --> WEBHOOK[Receive Webhook]
        WEBHOOK --> VERIFY[Verify Payment]
        VERIFY -->|Success| CONFIRM_ONLINE[Payment Confirmed]
        VERIFY -->|Failed| FAILED[Payment Failed]
        FAILED --> MODE
    end

    subgraph Cheque_Payment["Cheque Payment"]
        MODE -->|Cheque| CHEQUE_DETAILS[Enter Cheque Details<br/>No, Bank, Date]
        CHEQUE_DETAILS --> CHEQUE_STATUS[Status: Pending Clearance]
        CHEQUE_STATUS --> CONFIRM_CHEQUE[Record Cheque]
    end

    CONFIRM_CASH --> RECORD[Record Transaction]
    CONFIRM_CARD --> RECORD
    CONFIRM_ONLINE --> RECORD
    CONFIRM_CHEQUE --> RECORD

    RECORD --> UPDATE_LEDGER[Update Student Ledger]
    UPDATE_LEDGER --> GEN_RECEIPT[Generate Receipt]

    subgraph Receipt["Receipt Generation"]
        GEN_RECEIPT --> RECEIPT_NO[Auto Receipt Number]
        RECEIPT_NO --> PDF[Generate PDF]
        PDF --> ACTIONS{Receipt<br/>Actions}
        ACTIONS --> PRINT[Print]
        ACTIONS --> EMAIL[Email to Parent]
        ACTIONS --> SMS[SMS Confirmation]
        ACTIONS --> WHATSAPP[WhatsApp]
    end

    PRINT --> DONE([Transaction Complete])
    EMAIL --> DONE
    SMS --> DONE
    WHATSAPP --> DONE
```

---

## 8. Attendance Flow

```mermaid
flowchart TD
    subgraph Student_Attendance["Student Attendance Flow"]
        START([Start Attendance]) --> SELECT_DATE[Select Date]
        SELECT_DATE --> SELECT_CLASS[Select Class/Section]
        SELECT_CLASS --> LOAD_STUDENTS[Load Student List]

        LOAD_STUDENTS --> CHECK_HOLIDAY{Is Holiday?}
        CHECK_HOLIDAY -->|Yes| HOLIDAY_MSG[Cannot Mark<br/>Holiday]
        CHECK_HOLIDAY -->|No| EXISTING{Existing<br/>Record?}

        EXISTING -->|Yes| LOAD_EXISTING[Load Existing Attendance]
        EXISTING -->|No| NEW_RECORD[Create New Record]

        LOAD_EXISTING --> MARK
        NEW_RECORD --> MARK[Mark Attendance]

        subgraph Marking["Attendance Marking"]
            MARK --> FOREACH[For Each Student]
            FOREACH --> STATUS{Select<br/>Status}
            STATUS -->|Present| PRESENT[Mark Present]
            STATUS -->|Absent| ABSENT[Mark Absent]
            STATUS -->|Late| LATE[Mark Late<br/>Enter Time]
            STATUS -->|Leave| LEAVE[Mark on Leave]
            PRESENT --> NEXT
            ABSENT --> NEXT
            LATE --> NEXT
            LEAVE --> NEXT
            NEXT --> MORE{More<br/>Students?}
            MORE -->|Yes| FOREACH
            MORE -->|No| REVIEW
        end

        REVIEW[Review Attendance] --> SUBMIT[Submit Attendance]
        SUBMIT --> SAVE[Save to Database]
        SAVE --> NOTIFY{Send<br/>Notifications?}
        NOTIFY -->|Yes| ABSENT_SMS[SMS for Absentees]
        NOTIFY -->|No| COMPLETE
        ABSENT_SMS --> COMPLETE([Attendance Complete])
    end

    subgraph Staff_Attendance["Staff Attendance Flow"]
        STAFF_START([Staff Attendance]) --> STAFF_DATE[Select Date]
        STAFF_DATE --> STAFF_DEPT[Select Department<br/>Optional]
        STAFF_DEPT --> LOAD_STAFF[Load Staff List]

        LOAD_STAFF --> STAFF_CHECK{On Leave?}
        STAFF_CHECK -->|Yes| AUTO_LEAVE[Auto-mark Leave]
        STAFF_CHECK -->|No| STAFF_MARK[Mark Attendance]

        STAFF_MARK --> CHECKIN[Check-in Time]
        CHECKIN --> CHECKOUT[Check-out Time]
        CHECKOUT --> CALC_HOURS[Calculate Hours]
        CALC_HOURS --> LATE_CHECK{Late<br/>Arrival?}
        LATE_CHECK -->|Yes| MARK_LATE[Mark as Late]
        LATE_CHECK -->|No| STAFF_SAVE
        MARK_LATE --> STAFF_SAVE[Save Record]
        AUTO_LEAVE --> STAFF_SAVE
        STAFF_SAVE --> STAFF_DONE([Staff Attendance Done])
    end

    subgraph Reports["Attendance Reports"]
        REPORT_START([Generate Report]) --> REPORT_TYPE{Report<br/>Type}
        REPORT_TYPE -->|Daily| DAILY[Daily Summary<br/>Class-wise Present/Absent]
        REPORT_TYPE -->|Monthly| MONTHLY[Monthly Summary<br/>Student-wise %]
        REPORT_TYPE -->|Student| STUDENT[Student History<br/>Date-wise Record]
        REPORT_TYPE -->|Class| CLASS[Class Report<br/>Attendance Trends]

        DAILY --> EXPORT
        MONTHLY --> EXPORT
        STUDENT --> EXPORT
        CLASS --> EXPORT
        EXPORT[Export PDF/Excel] --> REPORT_DONE([Report Generated])
    end
```

---

## 9. HR & Leave Management Flow

```mermaid
flowchart TD
    subgraph Staff_Onboarding["Staff Onboarding"]
        START([HR Module]) --> CREATE_STAFF[Create Staff Record]
        CREATE_STAFF --> PERSONAL[Personal Details<br/>Name, DOB, Contact]
        PERSONAL --> EMPLOYMENT[Employment Details<br/>Join Date, Designation]
        EMPLOYMENT --> DEPARTMENT[Assign Department]
        DEPARTMENT --> BRANCH[Assign Branch]
        BRANCH --> ROLE[Assign System Role]
        ROLE --> CREDENTIALS[Generate Login Credentials]
        CREDENTIALS --> NOTIFY_STAFF[Send Welcome Email/SMS]
        NOTIFY_STAFF --> LEAVE_BALANCE[Initialize Leave Balance]
        LEAVE_BALANCE --> STAFF_ACTIVE([Staff Active])
    end

    subgraph Leave_Configuration["Leave Configuration"]
        CONFIG([Leave Setup]) --> LEAVE_TYPES[Define Leave Types]
        LEAVE_TYPES --> CASUAL[Casual Leave<br/>12 days/year]
        LEAVE_TYPES --> SICK[Sick Leave<br/>10 days/year]
        LEAVE_TYPES --> EARNED[Earned Leave<br/>15 days/year]
        LEAVE_TYPES --> MATERNITY[Maternity Leave<br/>180 days]
        LEAVE_TYPES --> OTHER[Other Types]

        CASUAL --> RULES[Configure Rules]
        SICK --> RULES
        EARNED --> RULES
        MATERNITY --> RULES
        OTHER --> RULES

        RULES --> CARRY_FWD[Carry Forward Rules]
        CARRY_FWD --> ENCASH[Encashment Rules]
        ENCASH --> CONFIG_DONE([Config Complete])
    end

    subgraph Leave_Application["Leave Application Flow"]
        APPLY([Staff Applies Leave]) --> CHECK_BALANCE{Check<br/>Balance}
        CHECK_BALANCE -->|Insufficient| REJECT_BALANCE[Cannot Apply<br/>Insufficient Balance]
        CHECK_BALANCE -->|Sufficient| SELECT_TYPE[Select Leave Type]

        SELECT_TYPE --> DATES[Select Dates<br/>From - To]
        DATES --> CALC_DAYS[Calculate Leave Days<br/>Exclude Holidays]
        CALC_DAYS --> REASON[Enter Reason]
        REASON --> ATTACHMENTS{Attachments<br/>Required?}
        ATTACHMENTS -->|Yes| UPLOAD[Upload Documents]
        ATTACHMENTS -->|No| SUBMIT
        UPLOAD --> SUBMIT[Submit Application]

        SUBMIT --> NOTIFY_APPROVER[Notify Approver]
    end

    subgraph Leave_Approval["Leave Approval Flow"]
        NOTIFY_APPROVER --> APPROVER[Approver Reviews]
        APPROVER --> VIEW_DETAILS[View Leave Details]
        VIEW_DETAILS --> CHECK_TEAM[Check Team Calendar]
        CHECK_TEAM --> DECISION{Approval<br/>Decision}

        DECISION -->|Approve| APPROVE[Approve Leave]
        DECISION -->|Reject| REJECT[Reject with Reason]
        DECISION -->|Clarify| REQUEST_INFO[Request More Info]

        REQUEST_INFO --> STAFF_RESPOND[Staff Responds]
        STAFF_RESPOND --> DECISION

        APPROVE --> DEDUCT[Deduct from Balance]
        DEDUCT --> UPDATE_CALENDAR[Update Team Calendar]
        UPDATE_CALENDAR --> NOTIFY_APPROVED[Notify Staff - Approved]

        REJECT --> NOTIFY_REJECTED[Notify Staff - Rejected]

        NOTIFY_APPROVED --> LEAVE_DONE([Leave Processed])
        NOTIFY_REJECTED --> LEAVE_DONE
    end

    subgraph Leave_Cancellation["Leave Cancellation"]
        CANCEL([Cancel Leave]) --> CHECK_STATUS{Leave<br/>Status}
        CHECK_STATUS -->|Pending| CANCEL_PENDING[Cancel Pending<br/>No Approval Needed]
        CHECK_STATUS -->|Approved| REQUEST_CANCEL[Request Cancellation]

        REQUEST_CANCEL --> CANCEL_APPROVE{Cancellation<br/>Approved?}
        CANCEL_APPROVE -->|Yes| RESTORE[Restore Balance]
        CANCEL_APPROVE -->|No| KEEP[Keep Leave]

        CANCEL_PENDING --> CANCEL_DONE
        RESTORE --> CANCEL_DONE([Cancellation Done])
        KEEP --> CANCEL_DONE
    end
```

---

## 10. Academics & Timetable Flow

```mermaid
flowchart TD
    subgraph Teacher_Allocation["Teacher-Subject Allocation"]
        START([Academics Setup]) --> SELECT_BATCH[Select Academic Batch]
        SELECT_BATCH --> SELECT_CLASS[Select Class/Section]
        SELECT_CLASS --> LIST_SUBJECTS[List Subjects]

        LIST_SUBJECTS --> FOREACH_SUBJECT[For Each Subject]
        FOREACH_SUBJECT --> ASSIGN_TEACHER[Assign Teacher]
        ASSIGN_TEACHER --> CHECK_WORKLOAD{Exceeds<br/>Workload?}
        CHECK_WORKLOAD -->|Yes| WARNING[Show Warning]
        WARNING --> CONFIRM{Confirm<br/>Anyway?}
        CONFIRM -->|No| ASSIGN_TEACHER
        CONFIRM -->|Yes| SAVE_ALLOC
        CHECK_WORKLOAD -->|No| SAVE_ALLOC[Save Allocation]
        SAVE_ALLOC --> MORE_SUBJECTS{More<br/>Subjects?}
        MORE_SUBJECTS -->|Yes| FOREACH_SUBJECT
        MORE_SUBJECTS -->|No| ALLOC_DONE([Allocation Complete])
    end

    subgraph Timetable_Creation["Timetable Creation"]
        TT_START([Create Timetable]) --> TT_CLASS[Select Class/Section]
        TT_CLASS --> TT_VIEW[Open Timetable Grid<br/>Days x Periods]

        TT_VIEW --> TT_SLOT[Select Time Slot]
        TT_SLOT --> TT_SUBJECT[Select Subject]
        TT_SUBJECT --> TT_TEACHER[Auto-fill Teacher<br/>from Allocation]
        TT_TEACHER --> TT_ROOM{Assign<br/>Room?}
        TT_ROOM -->|Yes| SELECT_ROOM[Select Room]
        TT_ROOM -->|No| CHECK_CONFLICT
        SELECT_ROOM --> CHECK_CONFLICT{Check<br/>Conflicts}

        CHECK_CONFLICT -->|Teacher Busy| CONFLICT_T[Teacher Conflict]
        CHECK_CONFLICT -->|Room Busy| CONFLICT_R[Room Conflict]
        CHECK_CONFLICT -->|No Conflict| SAVE_SLOT[Save Slot]

        CONFLICT_T --> RESOLVE[Resolve Conflict]
        CONFLICT_R --> RESOLVE
        RESOLVE --> TT_SLOT

        SAVE_SLOT --> MORE_SLOTS{More<br/>Slots?}
        MORE_SLOTS -->|Yes| TT_SLOT
        MORE_SLOTS -->|No| PUBLISH{Publish<br/>Timetable?}

        PUBLISH -->|Yes| PUBLISH_TT[Publish to Teachers/Students]
        PUBLISH -->|No| SAVE_DRAFT[Save as Draft]

        PUBLISH_TT --> TT_DONE([Timetable Ready])
        SAVE_DRAFT --> TT_DONE
    end

    subgraph PTM_Management["PTM Scheduling"]
        PTM_START([Schedule PTM]) --> PTM_DATE[Select Date]
        PTM_DATE --> PTM_CLASS[Select Classes]
        PTM_CLASS --> PTM_SLOTS[Define Time Slots<br/>Duration per Parent]
        PTM_SLOTS --> PTM_TEACHERS[Assign Teachers]
        PTM_TEACHERS --> PTM_NOTIFY[Notify Parents]
        PTM_NOTIFY --> PTM_BOOK[Parents Book Slots]
        PTM_BOOK --> PTM_CONFIRM[Confirm Schedule]
        PTM_CONFIRM --> PTM_DAY[PTM Day]
        PTM_DAY --> PTM_FEEDBACK[Record Feedback]
        PTM_FEEDBACK --> PTM_DONE([PTM Complete])
    end

    subgraph Diary_System["Diary System"]
        DIARY_START([Create Diary Entry]) --> DIARY_TYPE{Diary<br/>Type}
        DIARY_TYPE -->|Subject| SUBJECT_DIARY[Subject Diary<br/>Homework, Classwork]
        DIARY_TYPE -->|General| GENERAL_DIARY[General Diary<br/>Announcements]

        SUBJECT_DIARY --> SELECT_SUBJECT[Select Subject]
        SELECT_SUBJECT --> DIARY_CONTENT
        GENERAL_DIARY --> DIARY_CONTENT[Enter Content]

        DIARY_CONTENT --> DIARY_ATTACH[Attach Files<br/>Optional]
        DIARY_ATTACH --> DIARY_AUDIENCE[Select Audience<br/>Class/Section]
        DIARY_AUDIENCE --> DIARY_SUBMIT[Submit Diary]

        DIARY_SUBMIT --> DIARY_APPROVE{Approval<br/>Required?}
        DIARY_APPROVE -->|Yes| SEND_APPROVAL[Send for Approval]
        DIARY_APPROVE -->|No| PUBLISH_DIARY[Publish to Students]

        SEND_APPROVAL --> APPROVE_DIARY{Approved?}
        APPROVE_DIARY -->|Yes| PUBLISH_DIARY
        APPROVE_DIARY -->|No| REVISE[Revise Content]
        REVISE --> DIARY_CONTENT

        PUBLISH_DIARY --> NOTIFY_PARENTS[Notify Parents]
        NOTIFY_PARENTS --> DIARY_DONE([Diary Published])
    end
```

---

## 11. Exams & Gradebook Flow

```mermaid
flowchart TD
    subgraph Exam_Setup["Exam Structure Setup"]
        START([Exam Module]) --> GRADE_GROUP[Define Grade Groups<br/>A+, A, B+, B, C, F]
        GRADE_GROUP --> GRADE_RANGE[Set Grade Ranges<br/>90-100: A+, 80-89: A]
        GRADE_RANGE --> EXAM_TYPES[Define Exam Types<br/>Unit Test, Mid-term, Final]
        EXAM_TYPES --> EXAM_RULES[Set Exam Rules<br/>Weightage, Pass Marks]
        EXAM_RULES --> SETUP_DONE([Setup Complete])
    end

    subgraph Exam_Scheduling["Exam Scheduling"]
        SCHEDULE([Schedule Exam]) --> SELECT_TYPE[Select Exam Type]
        SELECT_TYPE --> SELECT_CLASSES[Select Classes]
        SELECT_CLASSES --> DATE_RANGE[Set Date Range]
        DATE_RANGE --> CREATE_SCHEDULE[Create Schedule]

        CREATE_SCHEDULE --> FOREACH_EXAM[For Each Subject]
        FOREACH_EXAM --> EXAM_DATE[Set Exam Date]
        EXAM_DATE --> EXAM_TIME[Set Time Slot]
        EXAM_TIME --> MAX_MARKS[Set Max Marks]
        MAX_MARKS --> ROOM_ALLOC{Room<br/>Allocation?}
        ROOM_ALLOC -->|Yes| ASSIGN_ROOMS[Assign Exam Rooms]
        ROOM_ALLOC -->|No| MORE_EXAMS
        ASSIGN_ROOMS --> MORE_EXAMS{More<br/>Subjects?}
        MORE_EXAMS -->|Yes| FOREACH_EXAM
        MORE_EXAMS -->|No| PUBLISH_SCHEDULE[Publish Schedule]

        PUBLISH_SCHEDULE --> GEN_HALL_TICKET[Generate Hall Tickets]
        GEN_HALL_TICKET --> SCHEDULE_DONE([Schedule Published])
    end

    subgraph Marks_Entry["Marks Entry & Approval"]
        MARKS([Enter Marks]) --> SELECT_EXAM[Select Exam]
        SELECT_EXAM --> SELECT_SUBJ[Select Subject]
        SELECT_SUBJ --> LOAD_STUDENTS[Load Student List]

        LOAD_STUDENTS --> ENTRY_MODE{Entry<br/>Mode}
        ENTRY_MODE -->|Manual| MANUAL_ENTRY[Enter Marks Manually]
        ENTRY_MODE -->|Bulk| UPLOAD_MARKS[Upload from Excel]

        MANUAL_ENTRY --> FOREACH_STUDENT[For Each Student]
        FOREACH_STUDENT --> ENTER_MARKS[Enter Marks]
        ENTER_MARKS --> VALIDATE{Valid<br/>Marks?}
        VALIDATE -->|No| ERROR[Show Error]
        ERROR --> ENTER_MARKS
        VALIDATE -->|Yes| CALC_GRADE[Calculate Grade]
        CALC_GRADE --> NEXT_STUDENT{More<br/>Students?}
        NEXT_STUDENT -->|Yes| FOREACH_STUDENT
        NEXT_STUDENT -->|No| SUBMIT_MARKS

        UPLOAD_MARKS --> VALIDATE_FILE[Validate File]
        VALIDATE_FILE --> SUBMIT_MARKS[Submit for Approval]

        SUBMIT_MARKS --> NOTIFY_APPROVER[Notify HOD/Principal]
        NOTIFY_APPROVER --> REVIEW_MARKS[Review Marks]
        REVIEW_MARKS --> APPROVE_DECISION{Approval<br/>Decision}

        APPROVE_DECISION -->|Approve| APPROVE_MARKS[Approve Marks]
        APPROVE_DECISION -->|Reject| REJECT_MARKS[Reject with Comments]

        REJECT_MARKS --> REVISE_MARKS[Teacher Revises]
        REVISE_MARKS --> SUBMIT_MARKS

        APPROVE_MARKS --> LOCK_MARKS[Lock Marks]
        LOCK_MARKS --> MARKS_DONE([Marks Finalized])
    end

    subgraph Report_Card["Report Card Generation"]
        RC_START([Generate Report Card]) --> RC_SELECT[Select Exam/Term]
        RC_SELECT --> RC_CLASS[Select Class/Section]
        RC_CLASS --> RC_TEMPLATE[Select Template]

        RC_TEMPLATE --> CALC_TOTALS[Calculate Totals]
        CALC_TOTALS --> CALC_PERCENTAGE[Calculate Percentage]
        CALC_PERCENTAGE --> CALC_RANK[Calculate Rank]
        CALC_RANK --> CALC_GRADE_FINAL[Assign Final Grade]

        CALC_GRADE_FINAL --> TEACHER_REMARKS{Add<br/>Remarks?}
        TEACHER_REMARKS -->|Yes| ADD_REMARKS[Add Teacher Remarks]
        TEACHER_REMARKS -->|No| GENERATE
        ADD_REMARKS --> GENERATE[Generate Report Cards]

        GENERATE --> PREVIEW[Preview Report Cards]
        PREVIEW --> APPROVE_RC{Approve<br/>Report Cards?}

        APPROVE_RC -->|Yes| PUBLISH_RC[Publish to Parents]
        APPROVE_RC -->|No| EDIT[Edit/Regenerate]
        EDIT --> CALC_TOTALS

        PUBLISH_RC --> NOTIFY_PARENTS[Notify Parents]
        NOTIFY_PARENTS --> RC_DONE([Report Cards Published])
    end
```

---

## 12. Communications Flow

```mermaid
flowchart TD
    subgraph Announcement_Flow["Announcement Flow"]
        ANN_START([Create Announcement]) --> ANN_TITLE[Enter Title]
        ANN_TITLE --> ANN_CONTENT[Enter Content]
        ANN_CONTENT --> ANN_ATTACH[Add Attachments<br/>Optional]
        ANN_ATTACH --> ANN_AUDIENCE[Select Audience]

        ANN_AUDIENCE --> AUD_TYPE{Audience<br/>Type}
        AUD_TYPE -->|All| ALL_USERS[All Users]
        AUD_TYPE -->|Branch| SELECT_BRANCH[Select Branches]
        AUD_TYPE -->|Class| SELECT_CLASS[Select Classes]
        AUD_TYPE -->|Role| SELECT_ROLE[Select Roles<br/>Teachers, Parents]

        ALL_USERS --> ANN_SCHEDULE
        SELECT_BRANCH --> ANN_SCHEDULE
        SELECT_CLASS --> ANN_SCHEDULE
        SELECT_ROLE --> ANN_SCHEDULE

        ANN_SCHEDULE[Schedule<br/>Immediate/Later] --> ANN_APPROVAL{Approval<br/>Required?}
        ANN_APPROVAL -->|Yes| SUBMIT_ANN[Submit for Approval]
        ANN_APPROVAL -->|No| PUBLISH_ANN[Publish Announcement]

        SUBMIT_ANN --> APPROVE_ANN{Approved?}
        APPROVE_ANN -->|Yes| PUBLISH_ANN
        APPROVE_ANN -->|No| REVISE_ANN[Revise Content]
        REVISE_ANN --> ANN_CONTENT

        PUBLISH_ANN --> NOTIFY_CHANNELS{Notification<br/>Channels}
        NOTIFY_CHANNELS --> IN_APP[In-App Notification]
        NOTIFY_CHANNELS --> PUSH[Push Notification]
        NOTIFY_CHANNELS --> EMAIL_ANN[Email]
        NOTIFY_CHANNELS --> SMS_ANN[SMS]

        IN_APP --> ANN_DONE
        PUSH --> ANN_DONE
        EMAIL_ANN --> ANN_DONE
        SMS_ANN --> ANN_DONE([Announcement Sent])
    end

    subgraph SMS_Flow["SMS Communication Flow"]
        SMS_START([Send SMS]) --> SMS_TYPE{SMS<br/>Type}
        SMS_TYPE -->|Individual| SINGLE_SMS[Select Recipients]
        SMS_TYPE -->|Bulk| BULK_SMS[Select Group<br/>Class/Section/All]

        SINGLE_SMS --> SMS_TEMPLATE
        BULK_SMS --> SMS_TEMPLATE[Select Template]

        SMS_TEMPLATE --> DLT_CHECK{DLT<br/>Template?}
        DLT_CHECK -->|Yes| USE_DLT[Use DLT Template]
        DLT_CHECK -->|No| CUSTOM_MSG[Custom Message]

        USE_DLT --> FILL_VARS[Fill Variables<br/>Name, Date, Amount]
        CUSTOM_MSG --> FILL_VARS

        FILL_VARS --> PREVIEW_SMS[Preview Message]
        PREVIEW_SMS --> CONFIRM_SMS{Confirm<br/>Send?}
        CONFIRM_SMS -->|No| SMS_TEMPLATE
        CONFIRM_SMS -->|Yes| QUEUE_SMS[Queue Messages]

        QUEUE_SMS --> SEND_BATCH[Send in Batches]
        SEND_BATCH --> MSG91[MSG91 Gateway]
        MSG91 --> DELIVERY[Delivery Status]
        DELIVERY --> LOG_SMS[Log to Database]
        LOG_SMS --> SMS_DONE([SMS Sent])
    end

    subgraph Event_Calendar["Event Calendar Flow"]
        EVENT_START([Create Event]) --> EVENT_TYPE[Select Event Type<br/>Academic, Cultural, Holiday]
        EVENT_TYPE --> EVENT_TITLE[Enter Title]
        EVENT_TITLE --> EVENT_DATE[Set Date & Time]
        EVENT_DATE --> EVENT_VENUE[Set Venue<br/>Optional]
        EVENT_VENUE --> EVENT_DESC[Add Description]
        EVENT_DESC --> EVENT_AUDIENCE[Select Audience]
        EVENT_AUDIENCE --> EVENT_REMINDER{Set<br/>Reminders?}
        EVENT_REMINDER -->|Yes| REMINDER_TIME[Set Reminder Times<br/>1 day, 1 hour before]
        EVENT_REMINDER -->|No| SAVE_EVENT
        REMINDER_TIME --> SAVE_EVENT[Save Event]
        SAVE_EVENT --> PUBLISH_EVENT[Publish to Calendar]
        PUBLISH_EVENT --> NOTIFY_EVENT[Send Notifications]
        NOTIFY_EVENT --> EVENT_DONE([Event Created])
    end
```

---

## 13. Complete Data Flow Diagram

```mermaid
flowchart TB
    subgraph External_Users["External Users"]
        PARENT[Parents]
        STUDENT_USER[Students]
        PUBLIC[Public/Prospects]
    end

    subgraph Internal_Users["Internal Users"]
        OWNER[Group Owner]
        PRINCIPAL[Principal/Dean]
        ADMIN[Branch Admin]
        TEACHER[Teachers]
        ACCOUNTANT[Accountant]
        HR_USER[HR Officer]
        FRONT_DESK[Front Desk]
    end

    subgraph Web_App["Web Application"]
        DASHBOARD_UI[Dashboard]
        ORG_UI[Organization Management]
        STUDENT_UI[Student Management]
        ADMISSION_UI[Admissions]
        FINANCE_UI[Finance]
        ATTENDANCE_UI[Attendance]
        HR_UI[HR Management]
        ACADEMIC_UI[Academics]
        EXAM_UI[Exams]
        COMM_UI[Communications]
    end

    subgraph API_Layer["API Services"]
        AUTH_API[Auth API]
        ORG_API[Organization API]
        STUDENT_API[Student API]
        ADMISSION_API[Admission API]
        FINANCE_API[Finance API]
        ATTENDANCE_API[Attendance API]
        HR_API[HR API]
        ACADEMIC_API[Academic API]
        EXAM_API[Exam API]
        COMM_API[Communication API]
        REPORT_API[Reports API]
    end

    subgraph Data_Stores["Data Storage"]
        MONGO_DB[(MongoDB)]
        REDIS_CACHE[(Redis Cache)]
        S3_FILES[(S3 File Storage)]
    end

    subgraph External_Services["External Services"]
        PAYMENT_GW[Payment Gateway]
        SMS_GW[SMS Gateway]
        EMAIL_SVC[Email Service]
    end

    %% User to UI connections
    OWNER --> DASHBOARD_UI
    PRINCIPAL --> DASHBOARD_UI
    ADMIN --> ORG_UI
    TEACHER --> ACADEMIC_UI
    ACCOUNTANT --> FINANCE_UI
    HR_USER --> HR_UI
    FRONT_DESK --> ADMISSION_UI

    PARENT --> FINANCE_UI
    STUDENT_USER --> ACADEMIC_UI
    PUBLIC --> ADMISSION_UI

    %% UI to API connections
    DASHBOARD_UI --> AUTH_API
    DASHBOARD_UI --> REPORT_API
    ORG_UI --> ORG_API
    STUDENT_UI --> STUDENT_API
    ADMISSION_UI --> ADMISSION_API
    FINANCE_UI --> FINANCE_API
    ATTENDANCE_UI --> ATTENDANCE_API
    HR_UI --> HR_API
    ACADEMIC_UI --> ACADEMIC_API
    EXAM_UI --> EXAM_API
    COMM_UI --> COMM_API

    %% API to Data connections
    AUTH_API --> MONGO_DB
    AUTH_API --> REDIS_CACHE
    ORG_API --> MONGO_DB
    ORG_API --> S3_FILES
    STUDENT_API --> MONGO_DB
    ADMISSION_API --> MONGO_DB
    FINANCE_API --> MONGO_DB
    ATTENDANCE_API --> MONGO_DB
    HR_API --> MONGO_DB
    ACADEMIC_API --> MONGO_DB
    EXAM_API --> MONGO_DB
    COMM_API --> MONGO_DB
    REPORT_API --> MONGO_DB
    REPORT_API --> REDIS_CACHE

    %% API to External Services
    FINANCE_API --> PAYMENT_GW
    COMM_API --> SMS_GW
    COMM_API --> EMAIL_SVC

    %% File Storage
    STUDENT_API --> S3_FILES
    EXAM_API --> S3_FILES
    COMM_API --> S3_FILES
```

---

## 14. Module Interaction Map

```mermaid
flowchart TD
    subgraph Core["Core Modules"]
        AUTH[Authentication<br/>& Authorization]
        ORG[Organization<br/>Module]
    end

    subgraph Student_Modules["Student-Centric Modules"]
        STUDENT[Student Info]
        ADMISSION[Admissions]
        ATTENDANCE[Attendance]
    end

    subgraph Academic_Modules["Academic Modules"]
        ACADEMIC[Academics<br/>Timetable, Diary]
        EXAM[Exams &<br/>Gradebook]
    end

    subgraph Finance_Modules["Finance Modules"]
        FINANCE[Fee<br/>Management]
        TRANSPORT[Transport<br/>Module]
    end

    subgraph HR_Modules["HR Modules"]
        HR[HR<br/>Management]
        PAYROLL[Payroll<br/>Module]
    end

    subgraph Support_Modules["Support Modules"]
        COMM[Communications]
        CERT[Certificates]
        DASHBOARD[Dashboard<br/>& Analytics]
    end

    %% Core dependencies
    AUTH --> ORG
    ORG --> STUDENT
    ORG --> ADMISSION
    ORG --> FINANCE
    ORG --> HR
    ORG --> ACADEMIC

    %% Student flow
    ADMISSION -->|Convert| STUDENT
    STUDENT --> ATTENDANCE
    STUDENT --> FINANCE
    STUDENT --> ACADEMIC
    STUDENT --> EXAM
    STUDENT --> TRANSPORT
    STUDENT --> CERT

    %% Academic flow
    ACADEMIC --> EXAM
    EXAM --> CERT

    %% HR flow
    HR --> PAYROLL
    HR --> ATTENDANCE

    %% Finance integrations
    FINANCE --> TRANSPORT

    %% Communication touchpoints
    COMM --> STUDENT
    COMM --> HR
    COMM --> FINANCE
    COMM --> ADMISSION
    COMM --> ATTENDANCE

    %% Dashboard aggregation
    STUDENT --> DASHBOARD
    FINANCE --> DASHBOARD
    ATTENDANCE --> DASHBOARD
    HR --> DASHBOARD
    ADMISSION --> DASHBOARD
    EXAM --> DASHBOARD

    %% Cross-module interactions
    ATTENDANCE -.->|Late Fine| FINANCE
    EXAM -.->|Results| STUDENT
    TRANSPORT -.->|Fees| FINANCE
```

---

## Legend

| Symbol     | Meaning                |
| ---------- | ---------------------- |
| `([text])` | Start/End terminal     |
| `[text]`   | Process/Action         |
| `{text}`   | Decision point         |
| `[(text)]` | Database               |
| `-->`      | Direct flow            |
| `-.->`     | Indirect/Optional flow |
| `subgraph` | Grouped processes      |

---

## How to View These Diagrams

These diagrams are written in **Mermaid** format. You can view them:

1. **GitHub**: GitHub automatically renders Mermaid diagrams in markdown files
2. **VS Code**: Install the "Markdown Preview Mermaid Support" extension
3. **Mermaid Live Editor**: https://mermaid.live
4. **Notion**: Paste code blocks with `mermaid` language
5. **Obsidian**: Native Mermaid support

---

**Document Version**: 1.0
**Created**: December 2024
