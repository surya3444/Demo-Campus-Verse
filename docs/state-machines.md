# State Machine Diagrams - Campus Verse Web App

This document contains state machine diagrams for key components in the web application.

---

## 1. Authentication Store (authStore)

```mermaid
stateDiagram-v2
    [*] --> Unauthenticated: App Load (no token)
    [*] --> Authenticated: App Load (valid token in storage)

    Unauthenticated --> Authenticated: setAuth(user, token, expiresIn)

    Authenticated --> TokenExpired: isTokenExpired() returns true
    TokenExpired --> Authenticated: setAccessToken(newToken, expiresIn)
    TokenExpired --> Unauthenticated: Refresh failed

    Authenticated --> Authenticated: updateUser(updates)
    Authenticated --> Unauthenticated: logout()

    note right of Authenticated
        Persisted to localStorage
        via zustand persist middleware
    end note

    note right of TokenExpired
        Token considered expired
        if less than 30s remaining
    end note
```

> **Note:** The `Authenticating` state (loading during login) is managed by the LoginPage component, not this store. The store only holds the final authenticated/unauthenticated state.

---

## 2. Branch Store (branchStore)

```mermaid
stateDiagram-v2
    [*] --> NoBranch: Initial state

    NoBranch --> BranchesLoaded: setAvailableBranches(branches)
    BranchesLoaded --> BranchSelected: setSelectedBranchId(id)
    BranchSelected --> BranchSelected: setSelectedBranchId(differentId)
    BranchSelected --> NoBranch: clearBranch()
    BranchesLoaded --> NoBranch: clearBranch()

    note right of BranchSelected
        selectedBranchId persisted
        to localStorage
    end note
```

---

## 3. Login Page

```mermaid
stateDiagram-v2
    [*] --> Idle

    Idle --> Submitting: Submit (react-hook-form validates)

    Submitting --> PendingApproval: roleCode is pending_approval
    Submitting --> RedirectDashboard: Login success
    Submitting --> Error: Login failed

    PendingApproval --> [*]: Redirect /pending-approval

    Error --> Idle: User modifies form

    RedirectDashboard --> [*]: Redirect /dashboard

    note right of Submitting
        On success:
        1. setAuth(user, token)
        2. setAvailableBranches()
        3. Auto-select first branch
    end note

    note right of Error
        Error codes:
        - INVALID_CREDENTIALS
        - ACCOUNT_LOCKED
        - ACCOUNT_INACTIVE
        - TENANT_SUSPENDED
    end note
```

> **Note:** Branch selection is automatic (first branch is selected). There is no manual branch selection step during login.

---

## 4. Signup Page

```mermaid
stateDiagram-v2
    [*] --> FormEntry

    state FormEntry {
        [*] --> Editing

        state PasswordState {
            [*] --> PasswordBlurred
            PasswordBlurred --> PasswordFocused: Focus
            PasswordFocused --> PasswordBlurred: Blur
        }

        state ModuleState {
            [*] --> ModulePopupClosed
            ModulePopupClosed --> ModulePopupOpen: Click trigger
            ModulePopupOpen --> ModulePopupClosed: Click Done/outside
        }
    }

    FormEntry --> Submitting: Submit (all requirements met)
    FormEntry --> FormEntry: Validation error (inline)

    Submitting --> Success: Account created
    Submitting --> Error: API error

    Error --> FormEntry: User modifies form

    state Success {
        [*] --> EmailSent
        EmailSent --> EmailSent: Resend verification
    }

    Success --> [*]: Click login link

    note right of FormEntry
        Submit disabled until:
        - All password requirements met
        - Passwords match
    end note

    note right of Error
        Error codes:
        - EMAIL_ALREADY_REGISTERED
        - VALIDATION_ERROR
    end note
```

---

## 5. Add Organization Modal (3-Step Wizard)

```mermaid
stateDiagram-v2
    [*] --> Closed

    Closed --> Step1_Info: Open modal

    state Step1_Info {
        [*] --> EnteringDetails
        EnteringDetails --> Validating: Submit
        Validating --> EnteringDetails: Invalid
        Validating --> CreatingOrder: Valid
    }

    Step1_Info --> Step2_Payment: Order created

    state Step2_Payment {
        [*] --> LoadingRazorpay
        LoadingRazorpay --> PaymentReady: Script loaded
        PaymentReady --> PaymentInProgress: User pays
        PaymentInProgress --> VerifyingPayment: Payment callback
    }

    Step2_Payment --> Step3_Success: Payment verified
    Step2_Payment --> Step1_Info: Payment failed/cancelled

    state Step3_Success {
        [*] --> ShowingDetails
        ShowingDetails --> [*]: Close (window.reload)
    }
```

---

## 6. Convert Lead Dialog (Cascading Form)

```mermaid
stateDiagram-v2
    [*] --> Closed

    Closed --> Loading: Open dialog
    Loading --> BatchSelection: Batches fetched

    state BatchSelection {
        [*] --> NoBatchSelected
        NoBatchSelected --> BatchSelected: Select batch
        BatchSelected --> LoadingClasses: Trigger fetch
    }

    BatchSelection --> ClassSelection: Classes loaded

    state ClassSelection {
        [*] --> NoClassSelected
        NoClassSelected --> ClassSelected: Select class
    }

    ClassSelection --> FormComplete: All required fields

    state FormComplete {
        [*] --> ReadyToSubmit
        ReadyToSubmit --> Submitting: Click convert
        Submitting --> ReadyToSubmit: Error
    }

    FormComplete --> Success: Conversion complete
    Success --> Closed: Close dialog

    note right of ClassSelection
        Changing batch resets
        classId to empty
    end note
```

---

## 7. Enroll Application Dialog

```mermaid
stateDiagram-v2
    [*] --> Closed

    Closed --> FetchingSections: Open dialog
    FetchingSections --> SectionSelection: Sections loaded
    FetchingSections --> Error: Fetch failed

    state SectionSelection {
        [*] --> NoSectionSelected
        NoSectionSelected --> SectionSelected: Select section
        SectionSelected --> FormReady: Form valid
    }

    FormReady --> Submitting: Submit
    Submitting --> Success: Enrollment complete
    Submitting --> Error: API error

    Error --> SectionSelection: Retry
    Success --> Closed: Close dialog

    note right of FormReady
        Optional fields:
        - admissionNumber (auto if blank)
        - rollNumber
        - admissionDate (default today)
    end note
```

---

## 8. Admissions Page (Multi-View)

```mermaid
stateDiagram-v2
    [*] --> Loading

    Loading --> DataLoaded: Fetch complete
    Loading --> Error: Fetch failed

    state DataLoaded {
        state ViewMode {
            [*] --> ListView
            ListView --> KanbanView: Switch view
            ListView --> GanttView: Switch view
            ListView --> CalendarView: Switch view
            KanbanView --> ListView: Switch view
            KanbanView --> GanttView: Switch view
            KanbanView --> CalendarView: Switch view
            GanttView --> ListView: Switch view
            GanttView --> KanbanView: Switch view
            GanttView --> CalendarView: Switch view
            CalendarView --> ListView: Switch view
            CalendarView --> KanbanView: Switch view
            CalendarView --> GanttView: Switch view
        }

        state KanbanView {
            [*] --> Browsing
            Browsing --> Dragging: Drag card
            Dragging --> Browsing: Drop card
        }
    }

    DataLoaded --> Filtering: search/source filter
    Filtering --> DataLoaded: Debounce 300ms + refetch

    state Dialogs {
        [*] --> NoDialog
        NoDialog --> AddLeadOpen: Click add lead
        NoDialog --> DetailSheetOpen: Click card
        NoDialog --> ConvertDialogOpen: Click convert
        NoDialog --> EnrollDialogOpen: Click enroll
        AddLeadOpen --> NoDialog: Close
        DetailSheetOpen --> NoDialog: Close
        ConvertDialogOpen --> NoDialog: Close
        EnrollDialogOpen --> NoDialog: Close
    }

    note right of Filtering
        States: search, source
        Debounce prevents API spam
    end note
```

---

## 9. Bulk Upload Page (5-Step Wizard)

```mermaid
stateDiagram-v2
    [*] --> Step1_Select

    state Step1_Select {
        [*] --> NoClassSelected
        NoClassSelected --> ClassSelected: Select class
        ClassSelected --> SectionSelected: Select section
    }

    Step1_Select --> Step2_Upload: Click Continue

    state Step2_Upload {
        [*] --> NoFile
        NoFile --> Dragging: Drag enter
        Dragging --> NoFile: Drag leave
        Dragging --> Step3_Validate: Drop valid file
        NoFile --> Step3_Validate: Browse & select
    }

    state Step3_Validate {
        [*] --> FileReady
        FileReady --> Validating: Click Validate Data
        Validating --> Step4_Process: 2s timeout
    }

    state Step4_Process {
        [*] --> ShowWarnings
        ShowWarnings --> Step2_Upload: Upload Different File
        ShowWarnings --> Importing: Click Start Import
        Importing --> Step5_Complete: 3s timeout
    }

    state Step5_Complete {
        [*] --> ShowingResults
        ShowingResults --> Step1_Select: Upload More
        ShowingResults --> [*]: View Students
    }

    note right of Step4_Process
        Shows validation warnings
        (rows to be skipped)
        Always proceeds regardless
        of error count
    end note
```

---

## 10. Academic Structure Page

```mermaid
stateDiagram-v2
    [*] --> Loading

    Loading --> Ready: Data fetched (batches, subjects, teachers)

    state Ready {
        state HierarchyTree {
            [*] --> TreeCollapsed
            TreeCollapsed --> BatchExpanded: Expand batch
            BatchExpanded --> ClassExpanded: Expand class
            ClassExpanded --> BatchExpanded: Collapse class
            BatchExpanded --> TreeCollapsed: Collapse batch

            note right of BatchExpanded
                Classes fetched lazily
                on first expand
            end note
        }

        state Selection {
            [*] --> NothingSelected
            NothingSelected --> BatchSelected: Click batch
            BatchSelected --> ClassSelected: Click class
            ClassSelected --> SectionSelected: Click section
            SectionSelected --> ClassSelected: Click different class
            ClassSelected --> BatchSelected: Click different batch
            BatchSelected --> NothingSelected: Deselect
        }

        state DetailPanel {
            [*] --> Empty
            Empty --> ShowingBatch: Batch selected
            Empty --> ShowingClass: Class selected
            Empty --> ShowingSection: Section selected

            state ShowingBatch {
                [*] --> ViewMode
                ViewMode --> EditMode: Click edit
                EditMode --> ViewMode: Save/Cancel
                ViewMode --> DeleteConfirm: Click delete
            }

            state ShowingClass {
                [*] --> OverviewTab
                OverviewTab --> SectionsTab: Tab change
                SectionsTab --> SubjectsTab: Tab change
                SubjectsTab --> OverviewTab: Tab change
            }

            state ShowingSection {
                [*] --> SectionView
                SectionView --> EditMode: Click edit
                SectionView --> AssignTeacher: Assign teacher
            }
        }
    }

    Ready --> DialogOpen: Add batch/class/section/subject
    DialogOpen --> Ready: Close dialog
```

---

## 11. Protected Route (Auth Guard)

```mermaid
stateDiagram-v2
    [*] --> Checking: Component mount

    state Checking {
        [*] --> HydrationWait
        HydrationWait --> AuthCheck: 100ms timeout
    }

    AuthCheck --> NotAuthenticated: !isAuthenticated
    AuthCheck --> TenantPending: tenant.status is pending
    AuthCheck --> RoleCheck: isAuthenticated

    state RoleCheck {
        [*] --> CheckingRole
        CheckingRole --> Unauthorized: role not in allowedRoles
        CheckingRole --> PermissionCheck: role allowed
    }

    state PermissionCheck {
        [*] --> CheckingPerms
        CheckingPerms --> Unauthorized: missing permissions
        CheckingPerms --> Authorized: has permissions
    }

    NotAuthenticated --> [*]: Redirect /login
    TenantPending --> [*]: Redirect /pending-approval
    Unauthorized --> [*]: Redirect /unauthorized
    Authorized --> RenderChildren: Show children

    note right of HydrationWait
        100ms delay prevents
        SSR/CSR hydration mismatch
    end note

    note right of PermissionCheck
        requireAll: true = hasAllPermissions
        requireAll: false = hasAnyPermission
    end note
```

---

## 12. Change Password Modal

```mermaid
stateDiagram-v2
    [*] --> Closed

    Closed --> Open: Show modal

    state Open {
        [*] --> FormEntry

        state FormEntry {
            [*] --> Entering
            Entering --> ShowCurrentPwd: Toggle current password
            ShowCurrentPwd --> Entering: Toggle
            Entering --> ShowNewPwd: Toggle new password
            ShowNewPwd --> Entering: Toggle
        }

        FormEntry --> Validating: Submit
        Validating --> FormEntry: Invalid (show errors)
        Validating --> Submitting: Valid

        Submitting --> FormEntry: API error
        Submitting --> Success: Password changed
    }

    Open --> Closed: Close (if not forced)
    Success --> Closed: Auto close

    note right of Open
        When isForced=true:
        - Cannot close via ESC
        - Cannot close via backdrop
        - Must complete password change
    end note
```

---

## State Management Patterns Summary

| Component          | Pattern                       | Library                      |
| ------------------ | ----------------------------- | ---------------------------- |
| authStore          | Global store with persistence | Zustand                      |
| branchStore        | Global store with persistence | Zustand                      |
| Login/Signup       | Form state + async            | react-hook-form + useState   |
| Dialogs            | Local state + async loading   | useState + useEffect         |
| Multi-step wizards | Step-based state machine      | useState                     |
| Academic Structure | Context + Refs + Events       | React Context + EventEmitter |
| Protected Route    | Auth guard with hydration     | useState + useEffect         |

---

## Rendering These Diagrams

These diagrams use [Mermaid](https://mermaid.js.org/) syntax. To render them:

1. **GitHub/GitLab**: Renders automatically in markdown preview
2. **VS Code**: Install "Markdown Preview Mermaid Support" extension
3. **Online**: Use [Mermaid Live Editor](https://mermaid.live/)
4. **Docusaurus/Storybook**: Enable mermaid plugin
