# Campus Verse

A multi-tenant ERP platform for educational institutions — schools, colleges, and universities.

Campus Verse runs an entire institution group from one codebase: admissions and enrollment, fees and finance, attendance, HR and payroll, teaching workflows, exams and report cards, hostel, transport, inventory, and accreditation reporting. A single deployment serves many tenants, each with multiple branches, with data isolation enforced at the query layer.

```
Monorepo  ·  pnpm + Turborepo
Backend   ·  Node.js 20 + Express + MongoDB + Redis
Web       ·  Next.js 16 + React 19 + Tailwind + shadcn/ui
Mobile    ·  Expo (React Native) — student and staff apps
```

---

## Contents

- [Quick start](#quick-start)
- [Repository layout](#repository-layout)
- [Applications](#applications)
- [Feature modules](#feature-modules)
- [Architecture](#architecture)
- [Commands](#commands)
- [Configuration](#configuration)
- [Testing](#testing)
- [Deployment](#deployment)
- [Documentation](#documentation)

---

## Quick start

**Prerequisites:** Node.js >= 20, pnpm 9.14.2, Docker (for MongoDB and Redis).

```bash
git clone https://github.com/Campus-Verse/campusverse.git
cd campusverse
pnpm install

cp .env.example .env          # then fill in the JWT secrets — see Configuration

docker compose up -d          # MongoDB (27017) + Redis (6379)
pnpm db:indexes               # create MongoDB indexes
pnpm db:seed                  # seed demo tenant + test data

pnpm dev                      # starts Redis, then API + web via Turborepo
```

| Service                         | URL                          |
| ------------------------------- | ---------------------------- |
| Web app                         | http://localhost:3000        |
| API                             | http://localhost:3001/api/v1 |
| Super-admin console             | http://localhost:3002        |
| Mongo Express (debug profile)   | http://localhost:8082        |
| Redis Commander (debug profile) | http://localhost:8081        |

Database GUIs require the debug profile: `docker compose --profile debug up -d`.

---

## Repository layout

```
apps/
  api/                  Express REST API + Socket.IO          @campus-verse/api
  web/                  Next.js tenant-facing app             @campus-verse/web
  superadmin-web/       Next.js platform console              @campus-verse/superadmin-web
  mobile-student/       Expo app for students & parents       @campus-verse/mobile-student
  mobile-staff/         Expo app for teachers & staff         @campus-verse/mobile-staff
packages/
  shared/               Types, Zod schemas, constants, utils  @campus-verse/shared
  mobile-shared/        Shared RN hooks, stores, API client   @campus-verse/mobile-shared
  eslint-config/        Shared ESLint configuration
infrastructure/
  deploy/               Server setup, deploy, and backup scripts
  nginx/                Reverse proxy + SSL configuration
  mongo/                MongoDB config and init scripts
  scripts/              Seeding, index creation, data migrations
docs/                   Architecture, schemas, API reference, guides
```

---

## Applications

### API — `apps/api`

Express server exposing everything under `/api/v1/`, with Socket.IO for real-time
updates and webhook endpoints mounted ahead of the rate limiter and body parser
(Razorpay payments, RazorpayX payouts, live-class callbacks).

Roughly 32 domain modules, each following the same shape:

```
{module}.routes.ts      Route definitions and middleware chain
{module}.controller.ts  Thin request handlers
{module}.service.ts     Business logic and database access (singleton instance)
```

### Web — `apps/web`

The main tenant application: `(auth)` for public auth pages, `(public)` for the
marketing site and careers pages, `(dashboard)` for the ~28 protected feature
areas. Server state via TanStack Query, client state via Zustand, forms via
react-hook-form with Zod resolvers.

### Super-admin console — `apps/superadmin-web`

Platform-operator surface, separate from any tenant: organization provisioning,
marketing leads, blog authoring, careers vacancies, and platform statistics.

### Mobile — `apps/mobile-student`, `apps/mobile-staff`

Expo Router apps sharing `@campus-verse/mobile-shared`. Students and parents get
feed, attendance, fees, and support, with a child selector for parents managing
multiple students. Staff get attendance marking, exams, approvals, expenses,
courses, and communications. Both use secure token storage, biometric unlock,
push notifications, and OTA updates.

---

## Feature modules

Modules are individually licensable — tenant subscriptions gate access at the
API via `requireModule()`, and the web app hides unsubscribed areas.

| Module                        | What it covers                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| **Core**                      | Branches, users, roles, permissions, academic structure                                        |
| **Admissions**                | Leads, applications, and the enrollment pipeline                                               |
| **Students**                  | Student records, profiles, promotions, bulk upload                                             |
| **Finance**                   | Fee structures, collection, concessions, financial reports                                     |
| **HR & Staff**                | Staff records, payroll, salary structures, leaves, workload                                    |
| **Attendance**                | Daily and period-wise marking, tracking, reports                                               |
| **Communications**            | SMS, announcements, academic calendar                                                          |
| **Certificates**              | Certificate templates and generation                                                           |
| **Health**                    | Health records, checkups, vaccinations, medical visits                                         |
| **Teaching**                  | Timetable, lesson plans, assignments, gradebook                                                |
| **Exams & Report Cards**      | Paper scheduling, marks entry, grading scales, PDF report cards, hall tickets, promotion       |
| **Course Registration**       | CBCS/NEP schemes, elective baskets with seat caps, credit limits, fee gating, add/drop windows |
| **OBE Attainment**            | PO/PSO/CO definitions, CO-PO mapping, direct/indirect attainment, NBA/NAAC exports             |
| **Courses & Online Teaching** | Video lessons, quizzes, enrollment, progress tracking                                          |
| **Career Connect**            | Placement drives, job board, counseling, alumni network                                        |
| **Hostel**                    | Room allocation, vacancy tracking, occupancy reports                                           |
| **Transport**                 | Fleet, Google Maps routes, stops, per-stop or flat pricing                                     |
| **Inventory**                 | Asset tracking, stock, procurement, issue and return                                           |
| **Expense Management**        | Requests, approvals, reimbursements, budget tracking                                           |
| **Concerns & Feedback**       | Grievances, ticket tracking, resolution, surveys                                               |
| **Visitor Management**        | Registration, check-in/out, digital passes, logs                                               |
| **Campus Feed**               | Campus-wide posts, media, comments, moderation                                                 |
| **AI Assistant**              | Conversational Q&A over tenant data with per-tool RBAC                                         |

Platform-level areas outside the licensing model: audit trail, dashboards,
scheduler, uploads, blog, careers, and marketing leads.

---

## Architecture

### Multi-tenancy

Tenants own branches; every document carries `tenantId`. Three scoping values
travel with each request:

- `req.tenantId` — derived from the JWT, scopes every query
- `req.branchId` — from the `X-Branch-Id` header, required for branch-scoped work
- `req.user.accessScope` — which branches and departments the user may reach

### Institution types

Above the academic structure, a tenant owns one or more **institutions** (each
tenant gets a default one that cannot be archived), and each institution owns
branches:

```
Tenant → Institution → Branch → <academic hierarchy> → Students
```

The academic hierarchy below the branch is driven by the branch's institution
type. These are the defaults, overridable per tenant or per branch via
`academicHierarchy`:

| Type       | Levels below branch         |
| ---------- | --------------------------- |
| School     | Grade → Section             |
| College    | Stream → Year → Section     |
| University | Department → Year → Section |

University tenants additionally get lab batches within sections, subject sharing
across departments, admission categories and scholarships, and promotion policies.

### Roles and permissions

A role hierarchy where a lower level means higher privilege:

| Level | Roles                                                                                                                                     |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 0–3   | `GROUP_OWNER`, `ORG_MODERATOR`, `ORG_ADMIN`, `BRANCH_ADMIN`                                                                               |
| 10–19 | Teacher, Admission Counselor, Accountant, HR Manager, Placement Officer, Career Counselor, Hostel Warden, Inventory Manager, Receptionist |
| 20+   | Student                                                                                                                                   |

Permissions are `module.action` pairs checked server-side by `requirePermission()`
and mirrored in the UI by `usePermissions()` and `<PermissionGate>`.

### Request pipeline

```typescript
router.post(
  '/endpoint',
  authenticate, // JWT validation, sets req.user
  requirePermission('module', 'action'), // RBAC check
  requireModule('moduleCode'), // subscription gate (5-min cache)
  requireBranch, // enforces X-Branch-Id
  validateBody(zodSchema), // Zod validation
  controller.handler
);
```

Every `/api` request passes through a rate limiter and a global audit-log
middleware that records activity to `audit_logs`, viewable at `/audit`.

### Data access

MongoDB via the native driver — no ODM. Collections are reached through the
`collections.{name}` getter or `getDb()`. Connection pool: min 10, max 50.
Redis backs token blacklisting, sessions, and feature caching, and connects
lazily so the app degrades gracefully when it is unavailable.

### API response format

```jsonc
// Success
{ "success": true, "data": { } }

// Paginated
{ "success": true, "data": [], "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 0, "hasMore": false } }

// Error
{ "success": false, "error": { "code": "ERROR_CODE", "message": "Human readable" } }
```

### Shared package

```typescript
import { TokenPayload, User } from '@campus-verse/shared';
import { loginSchema } from '@campus-verse/shared/schemas';
import { PERMISSIONS, LEAD_STAGES } from '@campus-verse/shared/constants';
import { formatCurrency } from '@campus-verse/shared/utils';
```

Rebuild after changing types so consumers pick them up:
`pnpm --filter @campus-verse/shared build`.

---

## Commands

```bash
# Development
pnpm dev                  # Redis + all apps via Turborepo
pnpm dev:no-docker        # all apps, assumes services already running
pnpm dev:api              # API only          (3001)
pnpm dev:web              # web only          (3000)
pnpm dev:superadmin       # super-admin only  (3002)

# Mobile
pnpm dev:student          # Expo dev server, student app
pnpm student:ios          # student app on iOS simulator
pnpm student:android      # student app on Android emulator
pnpm dev:staff            # Expo dev server, staff app
pnpm staff:ios
pnpm staff:android

# Build, lint, format
pnpm build
pnpm lint
pnpm lint:fix
pnpm format

# Tests
pnpm test
pnpm test:unit
pnpm test:e2e

# Database
pnpm db:seed              # seed demo tenant and test data
pnpm db:indexes           # create MongoDB indexes
pnpm seed:admin           # create a platform super-admin

# Type checking
pnpm --filter @campus-verse/api exec tsc --noEmit
pnpm --filter @campus-verse/web exec tsc --noEmit
```

Infrastructure scripts under `infrastructure/scripts/` cover data migrations and
backfills (department FKs, institution backfill, subject-to-section migration,
and similar). Run them with `pnpm exec tsx <path>`.

---

## Configuration

Copy `.env.example` to `.env`. Environment variables are validated at boot by a
Zod schema in `apps/api/src/config/env.ts` — the API refuses to start on an
invalid config.

**Required**

| Variable             | Notes             |
| -------------------- | ----------------- |
| `MONGODB_URI`        | Connection string |
| `JWT_ACCESS_SECRET`  | 32+ characters    |
| `JWT_REFRESH_SECRET` | 32+ characters    |

**Optional, grouped by feature** — omit a group to disable that integration:

| Group        | Variables                                                                   |
| ------------ | --------------------------------------------------------------------------- |
| Storage      | `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET` |
| SMS          | `SMS_API_KEY`, `SMS_SENDER_ID`, `SMS_DLT_TE_ID`                             |
| Email        | `SMTP_*` / `RESEND_API_KEY`, `EMAIL_FROM`                                   |
| Payments     | Razorpay and RazorpayX credentials                                          |
| AI Assistant | `OPENAI_API_KEY`                                                            |
| Encryption   | `ENCRYPTION_KEY` (64-character hex)                                         |
| Cache        | `REDIS_URL`                                                                 |

The web app needs `NEXT_PUBLIC_API_URL` (default `http://localhost:3001/api/v1`).

---

## Testing

The API uses Vitest, with coverage thresholds of 80% for lines, functions, and
statements, and 75% for branches.

```bash
pnpm --filter @campus-verse/api exec vitest run                    # all API tests
pnpm --filter @campus-verse/api exec vitest run --coverage         # with coverage
pnpm --filter @campus-verse/api exec vitest run path/to/file.test.ts
```

Husky and lint-staged run on every commit: ESLint with `--fix` plus Prettier on
`*.{ts,tsx,js,jsx}`, and Prettier on `*.{json,md}`.

---

## Deployment

Web apps deploy to Vercel; the API, MongoDB, Redis, and Nginx run as containers
on a DigitalOcean droplet.

### API — first-time server setup

```bash
ssh root@your-droplet-ip
git clone https://github.com/Campus-Verse/campusverse.git /opt/campusverse
cd /opt/campusverse
sudo ./infrastructure/deploy/setup.sh api.campusverse.app your@email.com
```

### API — subsequent deploys

Pushes to `main` that touch `apps/api/**`, `packages/shared/**`,
`docker-compose.prod.yml`, or `pnpm-lock.yaml` trigger the
`Deploy API to DigitalOcean` GitHub Actions workflow, which SSHes to the droplet
and runs the deploy script. It can also be dispatched manually.

Required repository secrets: `DROPLET_HOST`, `DROPLET_USERNAME`,
`DROPLET_SSH_KEY`, and optionally `DROPLET_SSH_PORT`.

To deploy by hand:

```bash
ssh root@your-droplet-ip
cd /opt/campusverse && ./infrastructure/deploy/deploy.sh
```

Local helpers wrapping `docker-compose.prod.yml`: `pnpm deploy:build`,
`pnpm deploy:up`, `pnpm deploy:restart`, `pnpm deploy:logs`.

### Web — Vercel

Import the repository, set the root directory to `apps/web` (or
`apps/superadmin-web` for the console), and set
`NEXT_PUBLIC_API_URL=https://api.campusverse.app/api/v1`.

### Backups

Add the backup script to cron on the droplet:

```
0 2 * * * /opt/campusverse/infrastructure/deploy/backup.sh >> /var/log/campusverse-backup.log 2>&1
```

---

## Documentation

Deeper references live in `docs/`:

| Document                                     | Contents                                  |
| -------------------------------------------- | ----------------------------------------- |
| `01-TECH-STACK.md`                           | Stack and dependency decisions            |
| `02-PROJECT-STRUCTURE.md`                    | Monorepo structure                        |
| `03-DATABASE-SCHEMAS.md`                     | MongoDB collection schemas                |
| `04-API-ENDPOINTS.md`                        | Endpoint reference                        |
| `06-DEPLOYMENT.md`                           | Infrastructure detail                     |
| `07-IMPLEMENTATION-GUIDE.md`                 | Code patterns and examples                |
| `08-TESTING-SECURITY.md`                     | Testing and security guidelines           |
| `UNIVERSITY_TIER_ARCHITECTURE.md`            | University hierarchy and tier design      |
| `OBE_ATTAINMENT_GUIDE.md`                    | Outcome-based education and accreditation |
| `PROJECT_FLOWCHARTS.md`, `state-machines.md` | Workflow and state diagrams               |
| `PAYMENT_GATEWAY_COMPARISON.md`              | Payment provider evaluation               |

---

## License

Proprietary. © Campus Verse. All rights reserved.
