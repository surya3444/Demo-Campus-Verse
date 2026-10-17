# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository..

## Project Overview

Campus Verse is a multi-tenant ERP platform for educational institutions (schools, colleges, universities). It's a pnpm monorepo using Turborepo for orchestration.

## Commands

```bash
# Development
pnpm install              # Install all dependencies
pnpm dev                  # Start all services (API + Web)
pnpm dev:api              # Start API only (port 3001)
pnpm dev:web              # Start frontend only (port 3000)

# Build & Test
pnpm build                # Build all packages
pnpm test                 # Run all tests
pnpm test:unit            # Run unit tests
pnpm lint                 # Run linting
pnpm lint:fix             # Auto-fix lint issues

# Run single test file (API)
pnpm --filter @campus-verse/api exec vitest run path/to/file.test.ts

# Type checking
pnpm --filter @campus-verse/api exec tsc --noEmit
pnpm --filter @campus-verse/web exec tsc --noEmit

# Database
pnpm db:seed              # Seed test data
pnpm db:indexes           # Create MongoDB indexes

# Docker (local infrastructure)
docker-compose up -d      # Start MongoDB + Redis
docker-compose --profile debug up -d  # Include Mongo Express + Redis Commander
```

## Repository Structure

```
apps/
  api/                    # Express.js backend (@campus-verse/api)
  web/                    # Next.js 15 frontend (@campus-verse/web)
packages/
  shared/                 # Shared types, schemas, constants (@campus-verse/shared)
  eslint-config/          # Shared ESLint configuration
infrastructure/
  scripts/                # Database seeding and index creation
```

## Architecture

### Backend (apps/api)

**Module Pattern**: Each domain module follows this structure:

- `{module}.routes.ts` - Express routes with middleware chain
- `{module}.controller.ts` - Request handlers (thin layer, delegates to service)
- `{module}.service.ts` - Business logic, database operations
- Services are singleton classes exported as instances (e.g., `export const leadService = new LeadService()`)

**Modules**: auth, organization, student, admission, finance, attendance, hr, communication, dashboard, certificates, health, upload

**Key Middleware Chain**:

```typescript
router.post(
  '/endpoint',
  authenticate, // JWT validation, sets req.user
  requirePermission('module', 'action'), // RBAC check
  requireBranch, // Ensures X-Branch-Id header
  validateBody(zodSchema), // Zod schema validation
  controller.handler
);
```

Additional middleware:

- `requireModule('moduleCode')` - Feature gating based on tenant subscription (5-min cache)
- `validateQuery(schema)`, `validateParams(schema)` - For query/path parameter validation
- Rate limiters: `apiRateLimiter` (100/min), `authRateLimiter` (10/15min), `bulkOperationLimiter` (10/hr)

**Multi-tenancy**:

- `req.tenantId` - extracted from JWT, scopes all queries
- `req.branchId` - from `X-Branch-Id` header, required for branch-specific operations
- `req.user.accessScope` - determines what branches/departments user can access

**Database**: MongoDB with native driver (not Mongoose). Collections accessed via `collections.{name}` getter or `getDb()` from `config/database.ts`. Connection: maxPoolSize=50, minPoolSize=10.

**Response Helpers** (`utils/response.ts`):

```typescript
success(res, data, meta?, message?, extra?)  // 200
created(res, data, message?)                  // 201
noContent(res)                                // 204
// Meta for pagination: { page, limit, total, totalPages, hasMore }
```

**Pagination** (`utils/pagination.ts`):

```typescript
const { skip, limit, sortBy, sortOrder } = getPagination(req.query);
// Defaults: page=1, limit=20, sortBy='createdAt', sortOrder='desc', max limit=100
const meta = buildPaginationMeta(page, limit, total);
```

**Error Handling**: `ApiError` class in `middleware/errorHandler.ts`:

```typescript
throw new ApiError('ERROR_CODE', 'message', 400, details?);
// Auto-handles MongoDB duplicate key (11000) and Zod validation errors
```

**Sequence Generators** (`utils/generators.ts`) - Atomic counters using MongoDB upsert:

- `generateLeadNumber()` → `LD{YY}{00000}`
- `generateApplicationNumber()` → `APP{YY}{00000}`
- `generateReceiptNumber()` → `{PREFIX}{YY}{000000}`
- `generateAdmissionNumber()` → `{BRANCH}-{BATCH}-{0000}`
- `generateEmployeeId()` → `{PREFIX}{00000}`

**Date Utils** (`utils/dates.ts`): Uses dayjs with default timezone 'Asia/Kolkata'. Academic year starts in April.

**Environment**: Validated with Zod schema in `config/env.ts`. Required: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (32+ chars), `MONGODB_URI`. Optional groups: S3 (AWS\_\*), SMS, Email (RESEND_API_KEY), Razorpay, Encryption (ENCRYPTION_KEY, 64-char hex).

**Redis**: Lazy connect, graceful degradation (app continues without Redis). Used for token blacklisting, session management, feature caching.

**TypeScript Path Alias**: `@/*` → `src/*`

### Frontend (apps/web)

**State Management**:

- Zustand stores in `src/store/` (authStore, branchStore, uiStore) with persistence
- TanStack Query for server state (staleTime: 1min, retry: 1)

**API Layer** (`src/lib/api.ts`):

- Axios instance with `Authorization: Bearer <token>` and `X-Branch-Id` headers
- Automatic token refresh on 401 with request queuing (concurrent requests wait for refresh)
- 403 responses show toast with permission error

**Auth Hooks**:

- `useAuth()` - auto-refreshes token, provides login/logout/refreshProfile
- `usePermissions()` - `hasPermission(module, action)`, `canView()`, `canCreate()`, `canEdit()`, `canDelete()`

**Permission Components**:

- `<PermissionGate module="..." action="...">` - conditionally renders children
- `<ProtectedRoute requiredPermissions={[...]}>` - route-level auth

**Routing**: Next.js App Router

- `(auth)/` - Public auth pages (login, forgot-password)
- `(dashboard)/` - Protected routes wrapped in `ProtectedRoute`

**UI Components**: shadcn/ui components in `src/components/ui/`. Forms use react-hook-form with `zodResolver`.

**TypeScript Path Alias**: `@/*` → `./src/*`

### Shared Package (packages/shared)

```typescript
import { TokenPayload, User } from '@campus-verse/shared'; // Types
import { loginSchema } from '@campus-verse/shared/schemas'; // Zod schemas
import { PERMISSIONS, LEAD_STAGES } from '@campus-verse/shared/constants'; // Constants
import { formatCurrency } from '@campus-verse/shared/utils'; // Utils
```

Key constants in `constants/status.ts`: STUDENT_STATUS, STAFF_STATUS, LEAD_STAGES, APPLICATION_STATUS, TRANSACTION_STATUS, LEAVE_STATUS, ATTENDANCE_STATUS.

Key formatters: `formatCurrency(amount, 'INR')` → ₹ format, `formatPhone()` → +91 format, `formatCompactNumber()` → Cr/L/K (Indian number system).

## Multi-tenant Data Model

Tenants own branches. Each document includes `tenantId` for isolation.

**Institution Types** determine academic structure:

- School: Branch → Class (Grade) → Section → Students
- College: Branch → Class (Stream + Batch) → Section → Students
- University: Branch → Class (Department + Year) → Section → Students

## API Response Format

```typescript
// Success
{ success: true, data: { ... } }

// Paginated
{ success: true, data: [...], meta: { page, limit, total, totalPages, hasMore } }

// Error
{ success: false, error: { code: 'ERROR_CODE', message: 'Human readable' } }
```

All routes are under `/api/v1/` prefix. Request body limit: 10mb.

## TypeScript Patterns

Common type assertions needed in this codebase:

```typescript
// Express params need casting
const id = req.params.id as string;

// MongoDB $push with $set needs double cast
await collection.updateOne(filter, update as unknown as UpdateFilter<Document>);

// ObjectId fields must be stringified for API responses
_id: doc._id.toString();
```

## Admission Pipeline

The admission module has a unified 10-stage pipeline displayed in a Kanban board:

```
Lead stages:        new → contacted → interested → followup → visit_scheduled → visited
                                                                                    ↓ (conversion)
Application stages:                                                    applied → docs_verified → fee_paid → enrolled
```

- Lead-to-application conversion happens at the `visited → applied` boundary
- Application status changes (rejected → lost) sync back to linked leads
- Followup entries have `_id: ObjectId` for individual tracking

## Pre-commit Hooks

Husky + lint-staged runs on commit:

- `*.{ts,tsx,js,jsx}` → eslint --fix, prettier --write
- `*.{json,md}` → prettier --write

## Testing

API uses Vitest. Coverage thresholds: 80% lines/functions/statements, 75% branches.

```bash
# Run with coverage
pnpm --filter @campus-verse/api exec vitest run --coverage
```

## Deployment

**Architecture**: Vercel (web) + Digital Ocean Droplet (API + MongoDB + Redis)

### Droplet Setup (One-time)

```bash
ssh root@your-droplet-ip
git clone <your-repo-url> /opt/campusverse
cd /opt/campusverse
sudo ./infrastructure/deploy/setup.sh api.campusverse.app your@email.com
```

### Deploy Updates

```bash
ssh root@your-droplet-ip
cd /opt/campusverse
./infrastructure/deploy/deploy.sh
```

### Vercel Setup

1. Import the repo in Vercel
2. Set root directory to `apps/web`
3. Add environment variable: `NEXT_PUBLIC_API_URL=https://api.campusverse.app/api/v1`
4. Deploy

### Production Files

```
docker-compose.prod.yml          # Production compose (API + Mongo + Redis + Nginx)
.env.production.example          # Environment template
infrastructure/
  deploy/
    setup.sh                     # Initial server setup
    deploy.sh                    # Deploy updates
    backup.sh                    # Database backup (add to cron)
  nginx/
    nginx.conf                   # Main nginx config
    conf.d/api.conf              # API reverse proxy with SSL
  mongo/
    mongod.conf                  # MongoDB configuration
```

### Backup (Cron)

```bash
0 2 * * * /opt/campusverse/infrastructure/deploy/backup.sh >> /var/log/campusverse-backup.log 2>&1
```
