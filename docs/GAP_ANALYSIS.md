# CampusVerse — Gap Analysis: Planned vs. Actual

**Date:** 2026-07-08
**Method:** All planning documents in `docs/` were audited (both 10-week plans, the 40-week sprint plan, `IMPLEMENTATION_PLAN.md`, API/schema/security/deployment specs, `CLIENT_OVERVIEW.md`), then diffed against a full inventory of the actual codebase: 30 mounted API modules (~984 registered routes), ~140 MongoDB collections, the `web` and `superadmin-web` frontends, shared package, and infrastructure. Every P0 claim below was verified by reading the cited source, not inferred from docs.

---

## 1. Executive Summary

**The good news: delivered scope far exceeds every plan.** The plans committed to 8–9 Phase-1 modules (or 23 modules in the client deliverable plan). The codebase actually contains all Phase-1 modules **plus** most of Phase 2/3 **plus** modules never planned at all: Exams, Transport, Hostel, Inventory, Expenses, Visitors, Feedback, Health, LMS Courses, Live Classes (LiveKit), AI Assistant, Campus Feed, Career Connect (entirely unplanned), Blog/Careers/Marketing backend, a super-admin console, and two started mobile apps. `IMPLEMENTATION_PLAN.md`'s claim that "Phase 2/3 = 0%" is badly stale.

**The bad news: five promised things are silently broken or stubbed (P0), and the quality/security envelope around the product is well behind the promises.**

| #   | P0 Gap                                                                                                                            | Evidence                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | **SMS gateway is a stub** — messages are logged as "sent" with no real gateway call; MSG91 + DLT was promised                     | `apps/api/src/modules/communication/sms.service.ts` (balance placeholder at ~`:301`) |
| 2   | **Scheduler job executors are fake** — all 4 return canned success without doing work                                             | `apps/api/src/modules/scheduler/scheduler.service.ts:412-480`                        |
| 3   | **Field-level encryption never applied** — `utils/crypto.ts` exists but is imported nowhere; bank details/Aadhar stored plaintext | `apps/api/src/utils/crypto.ts` (zero imports)                                        |
| 4   | **Account lockout commented out** — brute-force protection disabled                                                               | `apps/api/src/modules/auth/auth.service.ts:445-470`                                  |
| 5   | **Fee-reminder email/WhatsApp channels unimplemented** (and the SMS channel is stub #1)                                           | `apps/api/src/modules/finance/reports.controller.ts:541-546`                         |

Beyond P0: test coverage is a fraction of the 80% target (6 of ~29 services tested, zero integration/E2E tests), deploys go to production with no CI test gate, there is no monitoring, backups are 7-day local-only against a promised 10-year financial retention, and the promised load test / OWASP audit / UAT were never performed.

---

## 2. Planning Document Landscape (read before trusting any single doc)

Four competing master plans exist and disagree with each other:

| Document                         | Nature                  | Key claim                                                               |
| -------------------------------- | ----------------------- | ----------------------------------------------------------------------- |
| `05-SPRINT-PLAN.md`              | 20 sprints / 40 weeks   | Phase 1 = 8 modules                                                     |
| `10_WEEK_IMPLEMENTATION_PLAN.md` | 10 weeks, 7-person team | Tier 1/2/3 module split                                                 |
| `10-week-deliverable-plan.md`    | Client-facing           | **23 modules / 237 features** in 10 weeks                               |
| `IMPLEMENTATION_PLAN.md`         | Status report           | Phase 1 ~93% done, Phase 2/3 = 0% (**stale — Phase 2/3 largely built**) |

Major conflicts between docs (details in Appendix A): hosting (AWS ECS/Terraform vs. actual DigitalOcean droplet), Next.js 14 vs 15, test coverage 70% vs 80%, endpoint path drift, Razorpay "prep" vs "done", MSG91 named vs generic DLT provider.

---

## 3. Module Matrix: Planned vs. Actual

Status legend: ✅ Done · 🟡 Partial · 🔴 Stub (UI/routes exist, doesn't work) · ❌ Missing · ⭐ Built but never planned

| Module                | Planned in                         | Actual status              | Notes / evidence                                                                                                                                                                                              |
| --------------------- | ---------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth & RBAC           | All plans, Wk 1                    | ✅ (🟡 security)           | Full JWT/refresh/blacklist/RBAC + org self-signup w/ Razorpay. **Lockout disabled** (P0-4); 2FA schema-only (as promised)                                                                                     |
| Organization          | All plans, Wk 1–2                  | ✅                         | Branches, users, roles, batches, classes/sections/subjects, settings, custom fields, approvals, infrastructure, onboarding                                                                                    |
| Student Info          | Wk 3 / Sprints 8–10                | ✅                         | CRUD, promote/shuffle/transfer, bulk upload (incl. AI-parse), exports, reports, alumni                                                                                                                        |
| Admissions            | Wk 3–4 / Sprints 11–12             | ✅                         | Full pipeline, leads, applications, public forms + builder, agents, sources, reports                                                                                                                          |
| Finance               | Wk 4–5 / Sprints 13–15             | ✅ (🟡 reminders)          | Structures, assignments, counter, transactions, Razorpay online payments + Route, concessions, wallets, all due/collection reports. **Reminder channels stubbed** (P0-5)                                      |
| Attendance (student)  | Wk 5 / Sprints 16–17               | ✅                         | Mark/view/lock, reports, exports, holidays, low-attendance, bulk upload. Frontend `/attendance/reports` is a redirect to `/attendance/view`                                                                   |
| HR                    | Wk 5–6 / Sprints 18–19             | 🟡                         | Staff, leaves, departments/designations, workload, resignations, shifts done. **Biometric, bulk staff attendance, shift-wise reports missing** (were PENDING, still are). Some HR reports "coming soon" in UI |
| HR Payroll            | Deliverable plan Wk 5 (Tier 3)     | ✅ ⭐                      | Salary structures, assignments, runs, payslips, disbursement — beyond plan                                                                                                                                    |
| Communications        | Wk 6 / Sprint 20                   | 🔴 SMS / ✅ rest           | Announcements, events, templates, reports done. **SMS is a stub** (P0-1). Email = Resend (plans said MSG91+Nodemailer)                                                                                        |
| Dashboard             | Wk 7 / Sprint 20                   | ✅ (🔴 scheduling)         | Role-based dashboards, owner KPIs, alerts. **Report scheduling endpoints backed by fake scheduler** (P0-2)                                                                                                    |
| Certificates          | Wk 9 / CLIENT_OVERVIEW core        | ✅ (🟡)                    | Types, requests, approvals, ID cards. ID-card template _update_ flow is a frontend TODO                                                                                                                       |
| Academics (diary/PTM) | Wk 7–8 (deliverable + 10-wk plans) | ❌ **diary/PTM** / ✅ rest | Timetable, lesson plans, assignments, grades, questionnaires all built (as "teaching"). **Student diary, general diary, diary approvals, PTM scheduling, activities — absent**                                |
| Exams & Gradebooks    | Wk 8–9                             | ✅ (🟡 QR)                 | Exams, schedules, marks, results, report cards (PDF), hall tickets (PDF), promotions. **Hall-ticket QR is a drawn placeholder** — `exams/hallTicket.pdf.ts:237-250`                                           |
| Transport             | Wk 9                               | 🟡                         | Buses, routes (frontend Google Maps builder), enrollments, pricing. **Missing: trips, GPS tracking, transport reports, notification settings, bulk upload** — no backend Maps integration                     |
| Hostel                | Deliverable Wk 9 (Tier 3)          | 🟡                         | Hostels, rooms, allocations, reports, settings. **Missing: kitchen inventory, purchase/usage, meal plans**                                                                                                    |
| Inventory             | Deliverable Wk 9 (Tier 3)          | ✅ ⭐                      | Assets, categories, procurement, issues — beyond plan tier                                                                                                                                                    |
| Expense Mgmt          | Deliverable Wk 9 (Tier 3)          | ✅ ⭐                      | Expenses, budgets, reimbursements — beyond plan tier                                                                                                                                                          |
| Visitor Mgmt          | Deliverable Wk 9 (Tier 3)          | ✅ ⭐                      | Logs, passes, check-in/out, settings                                                                                                                                                                          |
| Concerns & Feedback   | Deliverable Wk 6 (Tier 3)          | ✅ ⭐                      | Tickets, assignment, escalation, satisfaction                                                                                                                                                                 |
| Health                | Deliverable Wk 10 (not in PRD)     | ✅ ⭐                      | Records, checkups + campaigns, vaccinations, visits, reports — fully built                                                                                                                                    |
| Online Class          | Deliverable Wk 7 (Zoom/Meet)       | ✅ ⭐                      | Delivered better than planned: LiveKit live classes with chat, polls, whiteboard, recording to S3                                                                                                             |
| Assessments           | Deliverable Wk 8                   | 🟡                         | Questionnaires + course quizzes exist. **Taxonomy, difficulty levels, question bank, assessment library — missing**                                                                                           |
| Lesson Delivery       | Deliverable Wk 7                   | 🟡                         | Lesson plans + LMS course lessons cover most of it; part/term settings not present as spec'd                                                                                                                  |
| Social Post           | Deliverable Wk 6                   | ✅ ⭐                      | Campus Feed (posts, likes, comments, moderation) covers this                                                                                                                                                  |
| Career Connect        | **Never planned**                  | ⭐                         | Largest module in the app: companies, drives, job board, counseling, alumni, mentorship, 9 report types                                                                                                       |
| LMS Courses           | Never planned                      | ⭐                         | Courses, lessons, quizzes, enrollments, progress                                                                                                                                                              |
| AI Assistant          | Never planned                      | ⭐                         | OpenAI chat-over-data with per-tool RBAC, SSE streaming                                                                                                                                                       |
| Super-admin console   | Never planned                      | ⭐                         | Org approval, statistics, CRM leads, blog CMS, careers ATS                                                                                                                                                    |
| Mobile apps           | Deliverable plan (from Wk 5)       | ❓                         | `apps/mobile-staff`, `apps/mobile-student` exist (Expo) — **completeness not assessed; needs its own review**                                                                                                 |

---

## 4. Gap Details by Severity

### P0 — Promised, silently broken or stubbed

These are the dangerous ones: the UI and API accept the operation and report success, but nothing (or nothing safe) happens.

**P0-1 · SMS gateway stub.**
`apps/api/src/modules/communication/sms.service.ts` writes to `sms_logs` and marks messages "sent" without any real gateway HTTP call; `getSMSBalance` (~line 301) returns a `not_configured` placeholder. Plans (`01-TECH-STACK.md`, `06-DEPLOYMENT.md`, `CLIENT_OVERVIEW.md`) promised **MSG91 with DLT compliance**. Impact: every SMS-dependent feature — fee-due reminders, credential delivery, notices, admission communications — silently no-ops in production while appearing to work.

**P0-2 · Scheduler executors are fake.**
`apps/api/src/modules/scheduler/scheduler.service.ts:412-480` — all four executors (`runAttendanceSummaryJob`, `runFeeReminderJob`, `runReportGenerationJob`, `runDataBackupJob`) return `{ success: true, message: '… executed successfully' }` without doing any work. Related: cron next-run calculation is a placeholder in `apps/api/src/modules/organization/scheduledJob.service.ts:382`. Impact: the entire scheduled-jobs UI (`/organization/schedule-jobs`) and the dashboard report-scheduling endpoints are theater — including **"data backup" jobs a school admin would reasonably believe are protecting their data**.

**P0-3 · Field-level encryption never applied.**
`apps/api/src/utils/crypto.ts` implements AES encryption and `ENCRYPTION_KEY` is in the env schema, but the module is **imported nowhere**. Staff bank account numbers and Aadhar/PII are stored plaintext. `08-TESTING-SECURITY.md` and `03-DATABASE-SCHEMAS.md` promised AES-256-GCM for exactly these fields. Payroll (bank details, disbursement) is live, which raises the stakes.

**P0-4 · Account lockout disabled.**
`apps/api/src/modules/auth/auth.service.ts:445-470` — the `lockUntil` check and failed-attempt tracking are commented out ("disabled for development") and shipped that way. The security checklist promised lockout after failed attempts. Combined with the auth rate limiter being disabled in development (commit `4fa448c`), verify the production path actually rate-limits + locks.

**P0-5 · Fee-reminder channels unimplemented.**
`apps/api/src/modules/finance/reports.controller.ts:541-546` — `email` and `whatsapp` channels return "not yet implemented; use 'sms' or 'all'", and the SMS path is P0-1. Net effect: **no dues-reminder channel actually reaches a parent.**

### P1 — Promised features missing

| #    | Gap                                                                             | Promised in                             | What exists today                                                                                                                                                                                                                                                                    |
| ---- | ------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1-1 | Student/general **diary**, diary approvals, **PTM scheduling**, activities      | 10-wk plans Wk 7–8, deliverable plan    | Nothing — teaching module has no diary/PTM concepts                                                                                                                                                                                                                                  |
| P1-2 | Transport **trips, GPS tracking, reports, notification settings, bulk upload**  | Deliverable plan Wk 9 (Google Maps GPS) | Buses/routes/enrollments only; Maps is frontend route-drawing, no backend tracking                                                                                                                                                                                                   |
| P1-3 | Hostel **kitchen inventory, purchase/usage, meal plans**                        | Deliverable plan Wk 9                   | Hostels/rooms/allocations only                                                                                                                                                                                                                                                       |
| P1-4 | Assessments: **taxonomy, difficulty levels, question bank, assessment library** | Deliverable plan Wk 8                   | Questionnaires + course quizzes (no reusable bank)                                                                                                                                                                                                                                   |
| P1-5 | Hall-ticket **QR code**                                                         | Exams spec                              | Drawn placeholder box — `apps/api/src/modules/exams/hallTicket.pdf.ts:237-250`; needs `qrcode` package                                                                                                                                                                               |
| P1-6 | HR: **biometric attendance, bulk staff attendance, shift-wise reports**         | IMPLEMENTATION_PLAN (PENDING)           | Still absent                                                                                                                                                                                                                                                                         |
| P1-7 | Frontend stubs                                                                  | —                                       | Public-form file upload "coming soon"; form-builder payment field "Coming Soon"; some HR reports `toast.info('coming soon')`; certificates ID-card template update TODO; career-connect settings page (backend missing — TODO in `career-connect/page.tsx` and `layout/Sidebar.tsx`) |

### P2 — Quality / security / infra debt vs. promises

| #     | Gap                                                     | Promised                                                                                | Actual                                                                                                                                                                                                                                |
| ----- | ------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2-1  | **Test coverage**                                       | 80% lines/functions (vitest config + sprint checklist), pyramid 70/25/5, Playwright E2E | 6 of ~29 services unit-tested (auth, lead, student, feeTransaction, application, ai.tools + 3 utils). **Zero integration tests, zero E2E.** Finance (beyond feeTx), HR/payroll, exams, teaching, health, career-connect etc. untested |
| P2-2  | **CI test gate**                                        | `ci.yml` (lint → test → build) before deploy                                            | Only `.github/workflows/deploy-api.yml` — SSH-deploys to the droplet on every push to `main` with **no lint/test job**                                                                                                                |
| P2-3  | **Redis-backed rate limiting**                          | Redis-backed, per-tenant (08-TESTING-SECURITY)                                          | `express-rate-limit` in-memory; `rate-limit-redis` is a dependency but unused. Breaks the moment the API scales past one instance                                                                                                     |
| P2-4  | **Monitoring/alerting**                                 | CloudWatch, health checks, alerts                                                       | Nothing beyond a deploy-time `curl /health`. No uptime monitoring, error tracking, or log aggregation                                                                                                                                 |
| P2-5  | **Backups**                                             | 10-year financial data retention; automated backups                                     | `backup.sh` nightly mongodump, **7-day retention, local disk only** — same droplet as the DB. No offsite copy                                                                                                                         |
| P2-6  | **API documentation**                                   | Swagger/OpenAPI (Wk 10)                                                                 | None                                                                                                                                                                                                                                  |
| P2-7  | **Load test (5,000+ users), OWASP security audit, UAT** | Wk 10 in both 10-week plans                                                             | Never performed                                                                                                                                                                                                                       |
| P2-8  | **Audit log fidelity**                                  | Before/after change diffs (03-DATABASE-SCHEMAS)                                         | Request-level capture only (method/path/body redacted) — adequate for "who did what", not for "what changed"                                                                                                                          |
| P2-9  | **Helmet hardening**                                    | Explicit CSP, HSTS, COOP/COEP config                                                    | `app.use(helmet())` defaults only (`apps/api/src/app.ts:49`)                                                                                                                                                                          |
| P2-10 | **Unused/dead dependencies**                            | —                                                                                       | `nodemailer`, `rate-limit-redis` in deps with zero source usage; BullMQ/SQS planned but never used (fine — but remove or use)                                                                                                         |

### P3 — Documentation hygiene

The docs folder no longer describes the product. Specific problems:

1. `IMPLEMENTATION_PLAN.md` — claims Phase 2/3 at 0% though ~14 of those modules are built. Most misleading doc in the repo.
2. `06-DEPLOYMENT.md` + `01-TECH-STACK.md` — describe an AWS ECS/Terraform/Atlas/ElastiCache stack that was never built; actual production is a DigitalOcean droplet with Docker Compose + nginx (which `CLAUDE.md` and `infrastructure/` correctly reflect).
3. `04-API-ENDPOINTS.md` — canonical paths drift from real ones (e.g. `/finance/transactions` vs actual `/finance/transactions/collect`, `/finance/fee-assignments` vs `/finance/assignments`), and covers ~9 modules of the 30 that exist.
4. `03-DATABASE-SCHEMAS.md` — 27 collections documented vs ~140 real ones.
5. Version conflicts: Next.js 14/React 18 vs actual Next.js 15/React 19; coverage 70% vs 80%; MSG91 vs generic SMS provider.

---

## 5. What Needs To Be Done — Prioritized Action Plan

Effort: **S** ≤ 1 day · **M** = 2–5 days · **L** = 1–3 weeks

### Now (P0 — before onboarding paying tenants)

| #   | Action                                                                                                                                                                                                                                                      | Effort |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | Wire a real SMS provider (MSG91 or equivalent DLT-compliant) into `sms.service.ts`; real balance query; delivery-status callbacks. Until then, make unsent SMS **visibly fail** instead of logging "sent"                                                   | M      |
| 2   | Implement the 4 scheduler executors (attendance summary, fee reminder, report generation, backup) + real cron parsing (`cron-parser`). Or: **remove/disable the scheduled-jobs UI** until real — the fake "backup succeeded" is the single worst trust risk | M–L    |
| 3   | Apply `utils/crypto.ts` (AES-256-GCM) to staff bank details + Aadhar/ID numbers, with a migration for existing plaintext rows and decrypt-on-read in payroll/staff services                                                                                 | M      |
| 4   | Re-enable account lockout + failed-attempt tracking in `auth.service.ts` (env-gate it for dev instead of commenting out); confirm auth rate limiter is active in production                                                                                 | S      |
| 5   | Implement email channel for fee reminders (Resend is already wired) so at least one reminder channel genuinely works                                                                                                                                        | S–M    |

### Next (P1/P2 — production hardening)

| #   | Action                                                                                                                                                                                                                             | Effort |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 6   | Add a CI workflow: lint + typecheck + tests must pass before `deploy-api.yml` runs (make deploy depend on CI, or merge into one workflow)                                                                                          | S      |
| 7   | Offsite backups: push nightly dumps to S3 (bucket + lifecycle policy for long retention); restore drill once                                                                                                                       | S–M    |
| 8   | Monitoring: uptime check + error tracking (e.g. Sentry) + basic droplet alerts                                                                                                                                                     | S–M    |
| 9   | Switch rate limiters to the Redis store (`rate-limit-redis` already in deps)                                                                                                                                                       | S      |
| 10  | Hall-ticket QR: add `qrcode` package, replace placeholder in `hallTicket.pdf.ts`                                                                                                                                                   | S      |
| 11  | Testing baseline: integration tests (supertest) for auth, finance collect/cancel/refund, payroll run, exams marks→report-card; unit tests for the highest-risk untested services; then one Playwright E2E for login→fee collection | L      |
| 12  | Run the promised security pass: OWASP checklist review + basic load test; fix findings                                                                                                                                             | M      |
| 13  | Close small frontend stubs: public-form file upload, certificates template update, HR "coming soon" reports (or remove the menu entries)                                                                                           | M      |

### Later (scope decisions — confirm whether still wanted)

| #   | Action                                                                                                                                                                                                         | Effort |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 14  | **Decide:** diary/PTM/activities module (promised, absent). If yes → design as part of teaching module                                                                                                         | L      |
| 15  | **Decide:** transport trips + GPS tracking + reports. If GPS is out, descope it explicitly in client docs                                                                                                      | L      |
| 16  | **Decide:** hostel meal plans/kitchen inventory; assessments question bank                                                                                                                                     | L each |
| 17  | Audit-log before/after diffs for high-value collections (fees, payroll, roles)                                                                                                                                 | M      |
| 18  | OpenAPI docs (generate from Zod schemas, e.g. `zod-to-openapi`)                                                                                                                                                | M      |
| 19  | Assess `mobile-staff` / `mobile-student` apps against the "mobile app from Week 5" commitment — separate gap review                                                                                            | M      |
| 20  | Docs cleanup: mark `06-DEPLOYMENT.md` AWS content and `IMPLEMENTATION_PLAN.md` as superseded (banner at top), regenerate module/endpoint inventory from code, keep `CLAUDE.md` + this file as sources of truth | S–M    |

---

## Appendix A — Cross-document conflicts

| Topic           | Doc A says                                              | Doc B says                                           | Reality                                                          |
| --------------- | ------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------- |
| Timeline        | 40 weeks (`05-SPRINT-PLAN`)                             | 10 weeks (3 other plans)                             | —                                                                |
| Scope           | 8–9 Phase-1 modules                                     | 23 modules / 237 features (deliverable plan)         | ~30 modules built                                                |
| Hosting         | AWS ECS/Terraform/Atlas (`01`, `06`, `CLIENT_OVERVIEW`) | DigitalOcean (deliverable plan)                      | **DigitalOcean droplet + Docker Compose**                        |
| Frontend        | Next.js 14 / React 18 (`01`, `05`)                      | Next.js 15 / React 19 (`CLIENT_OVERVIEW`, `10_WEEK`) | **Next.js 15 / React 19**                                        |
| Coverage target | >80% (vitest config, sprint checklist)                  | >70% (`10_WEEK` success criteria)                    | Config says 80; actual far below on most modules                 |
| SMS             | MSG91 + DLT named                                       | generic "DLT-compliant provider"                     | **Stub — no provider**                                           |
| Email           | Nodemailer/SMTP                                         | —                                                    | **Resend**                                                       |
| Online class    | Zoom/Google Meet                                        | —                                                    | **LiveKit** (better than planned)                                |
| Payments        | "Razorpay prep" (`10_WEEK`)                             | Razorpay DONE (`IMPLEMENTATION_PLAN`)                | **Done** — orders, verify, webhooks, Route transfers             |
| Job queue       | BullMQ (`01`) / SQS prod (`06`)                         | node-cron (`module_1and2`)                           | **None** (scheduler stubbed)                                     |
| Endpoint paths  | `04-API-ENDPOINTS.md` canonical                         | `module_1and2.md` variants                           | Code follows the variants (e.g. `/finance/transactions/collect`) |

## Appendix B — Stale docs & recommended disposition

| Doc                                                                                  | Disposition                                                                        |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `IMPLEMENTATION_PLAN.md`                                                             | Add "SUPERSEDED — see GAP_ANALYSIS.md" banner; status columns are wrong            |
| `06-DEPLOYMENT.md`                                                                   | Mark AWS sections as "not built — see CLAUDE.md Deployment (DigitalOcean)"         |
| `01-TECH-STACK.md`                                                                   | Update Next/React versions, email provider, remove SQS/BullMQ or mark aspirational |
| `04-API-ENDPOINTS.md`                                                                | Regenerate from route files (30 modules), or mark as "original design, see code"   |
| `03-DATABASE-SCHEMAS.md`                                                             | Mark as "core 27 of ~140 collections — original design doc"                        |
| `10-week-deliverable-plan.md`, `10_WEEK_IMPLEMENTATION_PLAN.md`, `05-SPRINT-PLAN.md` | Keep as historical planning records (no action)                                    |

## Appendix C — Open questions

1. Is **diary/PTM** still a client commitment, or was it dropped when scope pivoted to Career Connect / Health / LMS?
2. Is **GPS vehicle tracking** still expected? It's the biggest remaining unbuilt client-visible promise.
3. What is the actual state of **mobile-staff / mobile-student**? (Not assessed here.)
4. Which SMS provider/DLT account will be used? (Blocks P0-1.)
5. Is the 10-year financial retention promise contractual? (Drives backup design in action #7.)
