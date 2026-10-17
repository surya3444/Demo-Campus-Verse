# Campus Verse - Project Structure

## Monorepo Layout

```
campus-verse/
├── apps/
│   ├── api/                          # Backend API
│   └── web/                          # Frontend Next.js
├── packages/
│   ├── shared/                       # Shared types, schemas, utils
│   └── eslint-config/                # Shared ESLint config
├── infrastructure/
│   ├── docker/                       # Docker configs
│   ├── terraform/                    # AWS IaC
│   └── scripts/                      # Utility scripts
├── docs/                             # Documentation
├── turbo.json                        # Turborepo config
├── pnpm-workspace.yaml               # pnpm workspace
└── package.json                      # Root package.json
```

---

## Backend (apps/api)

```
apps/api/
├── src/
│   ├── index.ts                      # Entry point
│   ├── app.ts                        # Express app setup
│   │
│   ├── config/
│   │   ├── index.ts                  # Config exports
│   │   ├── env.ts                    # Environment validation
│   │   ├── database.ts               # MongoDB connection
│   │   └── redis.ts                  # Redis connection
│   │
│   ├── middleware/
│   │   ├── auth.ts                   # JWT authentication
│   │   ├── rbac.ts                   # Permission checking
│   │   ├── tenant.ts                 # Tenant context
│   │   ├── branch.ts                 # Branch context
│   │   ├── validate.ts               # Zod validation
│   │   ├── rateLimit.ts              # Rate limiting
│   │   ├── errorHandler.ts           # Error handling
│   │   └── requestLogger.ts          # Request logging
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.schema.ts        # Zod schemas
│   │   │   └── auth.types.ts
│   │   │
│   │   ├── organization/
│   │   │   ├── organization.routes.ts
│   │   │   ├── branches/
│   │   │   │   ├── branch.controller.ts
│   │   │   │   ├── branch.service.ts
│   │   │   │   ├── branch.schema.ts
│   │   │   │   └── branch.types.ts
│   │   │   ├── users/
│   │   │   │   ├── user.controller.ts
│   │   │   │   ├── user.service.ts
│   │   │   │   ├── user.schema.ts
│   │   │   │   └── user.types.ts
│   │   │   ├── roles/
│   │   │   ├── academic-batches/
│   │   │   ├── classes/
│   │   │   ├── sections/
│   │   │   ├── subjects/
│   │   │   └── settings/
│   │   │
│   │   ├── student/
│   │   │   ├── student.routes.ts
│   │   │   ├── student.controller.ts
│   │   │   ├── student.service.ts
│   │   │   ├── student.schema.ts
│   │   │   ├── student.types.ts
│   │   │   └── enrollment/
│   │   │       ├── enrollment.service.ts
│   │   │       └── enrollment.types.ts
│   │   │
│   │   ├── admission/
│   │   │   ├── admission.routes.ts
│   │   │   ├── leads/
│   │   │   │   ├── lead.controller.ts
│   │   │   │   ├── lead.service.ts
│   │   │   │   └── lead.schema.ts
│   │   │   └── applications/
│   │   │       ├── application.controller.ts
│   │   │       ├── application.service.ts
│   │   │       └── application.schema.ts
│   │   │
│   │   ├── finance/
│   │   │   ├── finance.routes.ts
│   │   │   ├── fee-structures/
│   │   │   ├── fee-assignments/
│   │   │   ├── transactions/
│   │   │   ├── concessions/
│   │   │   └── reports/
│   │   │
│   │   ├── attendance/
│   │   │   ├── attendance.routes.ts
│   │   │   ├── student-attendance/
│   │   │   ├── reports/
│   │   │   └── settings/
│   │   │
│   │   ├── hr/
│   │   │   ├── hr.routes.ts
│   │   │   ├── staff/
│   │   │   ├── staff-attendance/
│   │   │   ├── leaves/
│   │   │   ├── departments/
│   │   │   └── workload/
│   │   │
│   │   ├── communication/
│   │   │   ├── communication.routes.ts
│   │   │   ├── sms/
│   │   │   ├── announcements/
│   │   │   └── events/
│   │   │
│   │   ├── dashboard/
│   │   │   ├── dashboard.routes.ts
│   │   │   ├── owner-dashboard.service.ts
│   │   │   └── branch-dashboard.service.ts
│   │   │
│   │   └── reports/
│   │       ├── reports.routes.ts
│   │       └── reports.service.ts
│   │
│   ├── lib/
│   │   ├── db.ts                     # MongoDB helpers
│   │   ├── cache.ts                  # Redis caching
│   │   ├── queue.ts                  # BullMQ setup
│   │   ├── s3.ts                     # S3 file ops
│   │   ├── sms.ts                    # SMS gateway
│   │   ├── email.ts                  # Email service
│   │   ├── pdf.ts                    # PDF generation
│   │   ├── excel.ts                  # Excel import/export
│   │   └── logger.ts                 # Pino logger
│   │
│   ├── jobs/
│   │   ├── index.ts                  # Job registration
│   │   ├── feeReminder.job.ts
│   │   ├── attendanceSummary.job.ts
│   │   ├── reportGeneration.job.ts
│   │   └── bulkUpload.job.ts
│   │
│   ├── utils/
│   │   ├── response.ts               # API response helpers
│   │   ├── pagination.ts             # Pagination utils
│   │   ├── filters.ts                # Query builders
│   │   ├── dates.ts                  # Date utilities
│   │   ├── crypto.ts                 # Encryption
│   │   └── generators.ts             # ID generators
│   │
│   └── types/
│       ├── express.d.ts              # Express extensions
│       └── global.d.ts               # Global types
│
├── __tests__/
│   ├── unit/
│   ├── integration/
│   └── helpers/
│
├── package.json
├── tsconfig.json
└── Dockerfile
```

---

## Frontend (apps/web)

```
apps/web/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── forgot-password/
│   │   │   │   └── page.tsx
│   │   │   ├── reset-password/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   │
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx            # Dashboard layout with sidebar
│   │   │   ├── page.tsx              # Main dashboard
│   │   │   │
│   │   │   ├── organization/
│   │   │   │   ├── branches/
│   │   │   │   │   ├── page.tsx      # Branch list
│   │   │   │   │   ├── new/page.tsx  # Create branch
│   │   │   │   │   └── [id]/
│   │   │   │   │       ├── page.tsx  # Branch details
│   │   │   │   │       └── edit/page.tsx
│   │   │   │   ├── users/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── new/page.tsx
│   │   │   │   │   └── [id]/page.tsx
│   │   │   │   ├── roles/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── academic-batches/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── classes/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── settings/
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   ├── students/
│   │   │   │   ├── page.tsx          # Student list
│   │   │   │   ├── new/page.tsx      # Add student
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── page.tsx      # Student profile
│   │   │   │   │   └── edit/page.tsx
│   │   │   │   ├── bulk-upload/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── promote/
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   ├── admissions/
│   │   │   │   ├── leads/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── [id]/page.tsx
│   │   │   │   ├── applications/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── [id]/page.tsx
│   │   │   │   ├── enrolled/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── settings/
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   ├── finance/
│   │   │   │   ├── fee-counter/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── fee-structures/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── [id]/page.tsx
│   │   │   │   ├── collections/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── dues/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── concessions/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── reports/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── settings/
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   ├── attendance/
│   │   │   │   ├── mark/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── view/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── reports/
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   ├── hr/
│   │   │   │   ├── staff/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── [id]/page.tsx
│   │   │   │   ├── attendance/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── leaves/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── workload/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── settings/
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   ├── communications/
│   │   │   │   ├── sms/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── announcements/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── calendar/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── settings/
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   └── reports/
│   │   │       └── page.tsx
│   │   │
│   │   ├── layout.tsx                # Root layout
│   │   ├── loading.tsx               # Global loading
│   │   ├── error.tsx                 # Error boundary
│   │   └── not-found.tsx             # 404 page
│   │
│   ├── components/
│   │   ├── ui/                       # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── table.tsx
│   │   │   ├── card.tsx
│   │   │   ├── form.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── badge.tsx
│   │   │   └── ...
│   │   │
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── BranchSelector.tsx
│   │   │   ├── UserMenu.tsx
│   │   │   └── Navigation.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   ├── KPICard.tsx
│   │   │   ├── ChartCard.tsx
│   │   │   ├── RecentActivity.tsx
│   │   │   └── QuickActions.tsx
│   │   │
│   │   ├── data-table/
│   │   │   ├── DataTable.tsx
│   │   │   ├── DataTablePagination.tsx
│   │   │   ├── DataTableFilters.tsx
│   │   │   ├── DataTableToolbar.tsx
│   │   │   └── columns/
│   │   │       ├── studentColumns.tsx
│   │   │       ├── staffColumns.tsx
│   │   │       └── ...
│   │   │
│   │   ├── forms/
│   │   │   ├── StudentForm.tsx
│   │   │   ├── StaffForm.tsx
│   │   │   ├── BranchForm.tsx
│   │   │   ├── FeeCollectionForm.tsx
│   │   │   ├── LeadForm.tsx
│   │   │   └── ...
│   │   │
│   │   └── shared/
│   │       ├── PageHeader.tsx
│   │       ├── EmptyState.tsx
│   │       ├── LoadingState.tsx
│   │       ├── ErrorBoundary.tsx
│   │       ├── ConfirmDialog.tsx
│   │       ├── FileUpload.tsx
│   │       ├── DatePicker.tsx
│   │       ├── SearchInput.tsx
│   │       └── PermissionGate.tsx
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useBranch.ts
│   │   ├── usePermissions.ts
│   │   ├── usePagination.ts
│   │   ├── useDebounce.ts
│   │   ├── useMediaQuery.ts
│   │   └── useLocalStorage.ts
│   │
│   ├── lib/
│   │   ├── api.ts                    # Axios instance
│   │   ├── auth.ts                   # Auth utilities
│   │   ├── utils.ts                  # General utils (cn, etc.)
│   │   └── constants.ts              # App constants
│   │
│   ├── store/
│   │   ├── authStore.ts              # Auth state
│   │   ├── branchStore.ts            # Selected branch
│   │   └── uiStore.ts                # UI state (sidebar, etc.)
│   │
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── organization.service.ts
│   │   ├── student.service.ts
│   │   ├── admission.service.ts
│   │   ├── finance.service.ts
│   │   ├── attendance.service.ts
│   │   ├── hr.service.ts
│   │   ├── communication.service.ts
│   │   └── reports.service.ts
│   │
│   ├── types/
│   │   ├── api.types.ts
│   │   ├── organization.types.ts
│   │   ├── student.types.ts
│   │   ├── finance.types.ts
│   │   └── ...
│   │
│   └── styles/
│       └── globals.css
│
├── public/
│   ├── logo.svg
│   └── ...
│
├── e2e/
│   ├── auth.spec.ts
│   ├── students.spec.ts
│   └── ...
│
├── package.json
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── playwright.config.ts
└── Dockerfile
```

---

## Shared Package (packages/shared)

```
packages/shared/
├── src/
│   ├── types/
│   │   ├── organization.ts
│   │   ├── student.ts
│   │   ├── finance.ts
│   │   ├── attendance.ts
│   │   ├── hr.ts
│   │   ├── communication.ts
│   │   └── index.ts
│   │
│   ├── schemas/
│   │   ├── organization.schema.ts
│   │   ├── student.schema.ts
│   │   ├── finance.schema.ts
│   │   └── index.ts
│   │
│   ├── constants/
│   │   ├── roles.ts
│   │   ├── permissions.ts
│   │   ├── institutionTypes.ts
│   │   ├── status.ts
│   │   └── index.ts
│   │
│   └── utils/
│       ├── dates.ts
│       ├── formatters.ts
│       ├── validators.ts
│       └── index.ts
│
├── package.json
└── tsconfig.json
```

---

## Infrastructure

```
infrastructure/
├── docker/
│   ├── docker-compose.yml            # Development
│   ├── docker-compose.prod.yml       # Production
│   └── Dockerfile.base               # Base image
│
├── terraform/
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── modules/
│   │   ├── vpc/
│   │   ├── ecs/
│   │   ├── elasticache/
│   │   └── s3/
│   └── environments/
│       ├── dev/
│       ├── staging/
│       └── prod/
│
└── scripts/
    ├── setup.sh
    ├── deploy.sh
    ├── seed-db.ts
    └── create-indexes.ts
```
