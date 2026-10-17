# Campus Verse — Deployment to Client Environment

**Purpose:** everything required to move Campus Verse from our infrastructure into the client's own cloud account.
**Model:** client owns the cloud account and all third-party service accounts; we deploy and release, client IT monitors and owns hardware/network/backup verification.
**Status:** requirements document — nothing is provisioned until the items in §3 are supplied.

---

## 1. What actually gets deployed

Campus Verse is a pnpm monorepo. Five deployable artifacts:

| #   | Component                                                            | Package                                        | Runtime                    | Where it runs            |
| --- | -------------------------------------------------------------------- | ---------------------------------------------- | -------------------------- | ------------------------ |
| 1   | **API** (REST + WebSocket)                                           | `@campus-verse/api`                            | Node 20, Docker            | Client VM                |
| 2   | **Redis** (sessions, token blacklist, socket adapter, feature cache) | —                                              | `redis:7.2-alpine`, Docker | Same VM, private network |
| 3   | **Tenant web app**                                                   | `@campus-verse/web`                            | Next.js 15 (standalone)    | Vercel _or_ same VM      |
| 4   | **Super-admin console**                                              | `@campus-verse/superadmin-web`                 | Next.js 15                 | Vercel _or_ same VM      |
| 5   | **Mobile apps** (student + staff)                                    | `@campus-verse/mobile-student`, `mobile-staff` | Expo / React Native        | App Store + Play Store   |

Plus one managed dependency: **MongoDB Atlas** (the database is _not_ self-hosted — it runs in Atlas and the API connects over TLS).

### Traffic path

```
                       ┌──────────────────────── Client cloud account ────────────────────────┐
Browser / Mobile  ──►  │  nginx (TLS, Let's Encrypt)  ──►  API container :3001  ──►  Redis    │
                       └───────────────────────────────────┬─────────────────────────────────┘
                                                           │ TLS, IP-allowlisted
                                                           ▼
                                                  MongoDB Atlas cluster
```

The API serves both HTTP (`/api/v1/*`) and Socket.IO on the **same port (3001)** — live classes and realtime attendance need WebSocket upgrade to pass through the reverse proxy. This is already handled in `infrastructure/nginx/conf.d/api.conf`.

---

## 2. Infrastructure to provision (client cloud account)

Works identically on AWS, Azure, GCP or DigitalOcean. Recommendation: whichever the client's IT team already operates.

### 2.1 Compute

| Environment                     | vCPU | RAM  | Disk       | OS                       | Notes                                                   |
| ------------------------------- | ---- | ---- | ---------- | ------------------------ | ------------------------------------------------------- |
| **Production**                  | 4    | 8 GB | 100 GB SSD | Ubuntu 22.04 / 24.04 LTS | API + Redis + nginx on one VM                           |
| **Staging / UAT** (recommended) | 2    | 4 GB | 50 GB SSD  | same                     | Lets us validate a release before it touches production |

- **Static / reserved public IP is mandatory** — MongoDB Atlas allowlists by IP, and a changing IP means an outage.
- Root or full `sudo` access via SSH key. Password SSH should be disabled.
- Docker + Docker Compose are installed by our setup script; no other software required on the box.

### 2.2 Database — MongoDB Atlas

| Environment | Tier                         | Why                                                      |
| ----------- | ---------------------------- | -------------------------------------------------------- |
| Production  | **M10 or above** (dedicated) | Backups, point-in-time restore, no shared-CPU throttling |
| Staging     | M0 (free) or M2              | Adequate for UAT                                         |

- Cluster region should be **close to the VM** (e.g. both in Mumbai / `ap-south-1`) — cross-region adds latency to every query.
- Atlas project must allowlist the VM's static IP.
- A database user scoped to the `campus_verse` database (`readWrite`), not an org-wide admin.
- **If the institution requires data residency in India, choose an Indian Atlas region.** Confirm this before the cluster is created — moving it later means a migration window.

### 2.3 Networking, DNS and TLS

Three hostnames are needed (names are examples — client picks them):

| Hostname                | Points to               | Purpose             |
| ----------------------- | ----------------------- | ------------------- |
| `api.<client-domain>`   | VM static IP (A record) | API + WebSocket     |
| `erp.<client-domain>`   | Vercel CNAME _or_ VM IP | Tenant web app      |
| `admin.<client-domain>` | Vercel CNAME _or_ VM IP | Super-admin console |

Required from the client:

- **DNS management access** (or a named person who can create records within the same working day — DNS delays are the single most common cause of a slipped go-live).
- An email address for Let's Encrypt certificate expiry notices.
- Firewall: inbound **443** and **80** (80 is required for certificate renewal) from the internet; inbound **22** from the client's admin IP range only. All other inbound ports closed. Outbound HTTPS must be open — the API calls Atlas, S3, Resend, and the payment gateway.

> If the client wants the ERP reachable only from inside the campus network, say so now — that changes the design to VPN-or-allowlist-only and affects mobile app usage off-campus.

---

## 3. What we need from the client

This is the blocking list. Everything below is an account the **client should own**, so that access survives any change in vendor relationship.

### 3.1 Accounts and access

| #   | Item                                                       | Owner  | Lead time | Notes                                                              |
| --- | ---------------------------------------------------------- | ------ | --------- | ------------------------------------------------------------------ |
| 1   | Cloud account (AWS / Azure / GCP / DO) with billing active | Client | 1–2 days  | Give us an IAM user or project role scoped to compute + networking |
| 2   | SSH access to the VM (our public key added)                | Client | same day  | Required for deploys                                               |
| 3   | Domain name + DNS management access                        | Client | 1–3 days  | See §2.3                                                           |
| 4   | MongoDB Atlas organisation + billing                       | Client | 1 day     | Add us as Project Owner on the Campus Verse project only           |
| 5   | Vercel account (if frontends stay on Vercel)               | Client | same day  | Free/Pro tier; alternative is self-hosting on the VM — see §5      |

### 3.2 Third-party services

Which of these are needed depends on the modules the client turns on. **Bold = the app cannot go live without it.**

| Service                               | Used for                                                                   | Required?                   | What the client must do                                                                                                  | Lead time       |
| ------------------------------------- | -------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------- |
| **MongoDB Atlas**                     | Primary database                                                           | **Yes**                     | Create cluster, DB user, IP allowlist                                                                                    | 1 day           |
| **AWS S3** (or Cloudflare R2 / MinIO) | Document uploads, certificates, bulk-upload files, ID photos               | **Yes**                     | Create bucket + IAM user with put/get/delete on that bucket only                                                         | 1 day           |
| **Resend**                            | Transactional email — password reset, exam notifications, admission emails | **Yes**                     | Sign up, verify sending domain (SPF + DKIM DNS records), get API key                                                     | 1–2 days        |
| MSG91 (or equivalent)                 | SMS to parents/students                                                    | If SMS is used              | Account + **TRAI DLT registration**: entity registration, sender header, template approval                               | **1–3 weeks** ⚠ |
| Razorpay                              | Online fee collection                                                      | If online payments are used | Merchant account + KYC; provide Key ID, Key Secret, Webhook Secret                                                       | 3–10 days (KYC) |
| Google Maps Platform                  | Transport module (routes/stops) + address autocomplete                     | If transport module is used | GCP project, enable Maps JavaScript + Places API, billing enabled, browser-restricted key                                | 1 day           |
| OpenAI                                | AI assistant + AI-assisted bulk-upload column mapping                      | Optional                    | API key with a spend cap                                                                                                 | same day        |
| LiveKit Cloud                         | Live online classes + recording                                            | If live classes are used    | Own LiveKit Cloud project (URL, API key, secret), webhook pointed at their API, + an S3 bucket for recordings — see §5.1 | 1 day           |

**The DLT registration is the long pole.** In India, transactional SMS cannot be sent without a registered entity ID, header and pre-approved templates. If SMS matters for go-live, start this in week 1 regardless of where deployment stands. Without it, the platform still works — SMS notifications simply do not send.

Optional services degrade cleanly: with no OpenAI key the AI endpoints return `503` and everything else is unaffected; with no LiveKit config, recordings are rejected with `RECORDING_NOT_CONFIGURED`.

### 3.3 Content and configuration

| Item                                             | Why it's needed                                                                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Institution name, logo, favicon, brand colours   | Login page, certificates, PDF receipts, email templates                                                                        |
| Institution type — school / college / university | Determines the academic hierarchy (Grade→Section vs Stream+Batch vs Department+Year). **Hard to change after data is loaded.** |
| Branch list with addresses and codes             | Branch codes feed admission number generation                                                                                  |
| Academic year convention                         | Defaults to April start, Asia/Kolkata timezone — confirm this matches                                                          |
| Receipt/admission/employee-ID prefixes           | Used by the sequence generators; changing them mid-year creates gaps in numbering                                              |
| Named super-admin email                          | The first account created; owns everything else                                                                                |
| Existing student/staff data (Excel/CSV)          | For bulk import — see §7                                                                                                       |

### 3.4 How to hand over credentials

Every secret in §3.2 must reach us through a **shared password manager vault** (1Password / Bitwarden / Keeper) that the client owns. Not email, not WhatsApp, not a spreadsheet. Each credential should be revocable by the client independently.

We generate on the server and never share by hand: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`.

---

## 4. Environment variables

The API reads a single `.env.production` file on the VM. Full schema: `apps/api/src/config/env.ts`.

| Variable                                                                              | Source                                                                                  | Required                 |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------ |
| `NODE_ENV`, `PORT`                                                                    | fixed (`production`, `3001`)                                                            | yes                      |
| `APP_URL`                                                                             | comma-separated allowed origins, e.g. `https://erp.client.edu,https://admin.client.edu` | yes — CORS depends on it |
| `API_URL`                                                                             | `https://api.client.edu`                                                                | yes                      |
| `MONGODB_URI`                                                                         | Atlas                                                                                   | yes                      |
| `REDIS_URL`                                                                           | fixed (`redis://redis:6379`, internal Docker network)                                   | yes                      |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`                                             | generated at setup (32+ chars)                                                          | yes                      |
| `JWT_ACCESS_EXPIRY` / `JWT_REFRESH_EXPIRY`                                            | defaults `15m` / `90d` (sliding inactivity window)                                      | no                       |
| `ENCRYPTION_KEY`                                                                      | generated at setup (64-char hex)                                                        | yes                      |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`           | client                                                                                  | yes                      |
| `AWS_S3_ENDPOINT`, `AWS_S3_FORCE_PATH_STYLE`                                          | only for R2 / MinIO                                                                     | no                       |
| `RESEND_API_KEY`, `EMAIL_FROM`, `SUPER_ADMIN_EMAIL`                                   | client                                                                                  | yes                      |
| `SMS_API_KEY`, `SMS_SENDER_ID`                                                        | MSG91                                                                                   | if SMS                   |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`                   | client                                                                                  | if payments              |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_RECORDING_S3_BUCKET` | client                                                                                  | if live classes          |
| `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL`                                                 | client                                                                                  | if AI assistant          |
| `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`, `LOG_LEVEL`                        | defaults fine                                                                           | no                       |

Frontend build-time variables (set in Vercel, or as Docker build args if self-hosted):

| Variable                            | Value                                     |
| ----------------------------------- | ----------------------------------------- |
| `NEXT_PUBLIC_API_URL`               | `https://api.<client-domain>/api/v1`      |
| `NEXT_PUBLIC_SOCKET_URL`            | `https://api.<client-domain>`             |
| `NEXT_PUBLIC_SITE_URL`              | the app's own public URL                  |
| `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` | if transport/address autocomplete is used |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID`       | if payments are used                      |

Mobile apps read `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_SOCKET_URL` — these are **baked in at build time**, so pointing the apps at the client's API requires a new build and store submission.

---

## 5. Frontend hosting — decision needed

| Option                                           | Pros                                                            | Cons                                                                                                                                                  |
| ------------------------------------------------ | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Client's own Vercel account** (recommended) | Zero server work, global CDN, automatic previews, free/low tier | Static assets served from Vercel's edge, i.e. outside client infrastructure                                                                           |
| **B. Self-host both apps on the client VM**      | Everything inside client infrastructure                         | Bigger VM (8 GB minimum), nginx config for three vhosts, we must **write a Dockerfile for `superadmin-web`** (it does not have one — `apps/web` does) |

Recommendation: **A**, unless a policy prohibits it. Option B is roughly a day of extra work plus ongoing ops load.

---

## 6. Work required on our side before the client deploy

Honest inventory of what does not currently match the target setup. None are large, but they should be fixed before touching the client's environment rather than during:

1. **`infrastructure/deploy/setup.sh` is stale** — it expects `nginx`, `certbot` and `mongo` services inside `docker-compose.prod.yml`, but that file now contains only `api` and `redis` (Mongo moved to Atlas; nginx runs on the host). The script will fail partway on a fresh server. Needs reconciling.
2. **`infrastructure/deploy/backup.sh` is stale** — it dumps from a local `campusverse-mongo` container that no longer exists. Needs rewriting against Atlas (Atlas automated backups + a `mongodump` copy to S3).
3. **`.env.production.example` carries dead `SMTP_*` keys** — email actually goes through Resend. Confuses anyone configuring the file.
4. **`deploy.sh` hardcodes `/opt/campusverse`** — fine, as long as we use the same path on the client VM.
5. **No `Dockerfile` for `superadmin-web`** — only needed under option B in §5.
6. **Staging environment** — we currently deploy straight to production. Worth adding a staging VM as part of this move, since we no longer own the box.

---

## 7. Data migration

Two paths, and the client must pick one:

**Fresh start** — new database, data loaded via the bulk-upload module (students, staff, classes). Cleanest. Requires the client's data as Excel/CSV in the templates the module expects.

**Migrate existing data** — `mongodump` from the current Atlas cluster, `mongorestore` into the client's. Requires a freeze window (no writes while the dump runs), plus copying S3 objects to the client's bucket and rewriting stored file URLs. Plan a weekend slot.

Either way, the S3 bucket contents (uploaded documents, certificates, photos) migrate separately from the database.

---

## 8. Deployment procedure (what we run)

One-time, on the client VM:

```bash
ssh <user>@<client-vm-ip>
git clone <repo-url> /opt/campusverse
cd /opt/campusverse
sudo ./infrastructure/deploy/setup.sh api.<client-domain> <client-ssl-email>
# then populate /opt/campusverse/.env.production from the vault
docker compose -f docker-compose.prod.yml restart api
pnpm db:indexes      # idempotent
pnpm seed:admin      # creates the first super-admin
```

Per release:

```bash
ssh <user>@<client-vm-ip>
cd /opt/campusverse && ./infrastructure/deploy/deploy.sh
```

`deploy.sh` pulls, rebuilds the API image, restarts, re-applies indexes, prunes old images and health-checks `/health`. Typical downtime: **under 60 seconds**, during container restart.

Frontends (option A): `git push` → Vercel builds and deploys automatically.

---

## 9. Responsibility split

Shared model — we deploy, client IT monitors.

| Area                                                | Us      | Client IT           |
| --------------------------------------------------- | ------- | ------------------- |
| Application code and releases                       | ✅ Own  | Informed            |
| Deployment execution                                | ✅ Own  | Read access to logs |
| VM provisioning, OS patching, reboots               | Advise  | ✅ Own              |
| Firewall, DNS, TLS renewal monitoring               | Advise  | ✅ Own              |
| MongoDB Atlas cluster, scaling, backup verification | Advise  | ✅ Own              |
| Third-party accounts and billing                    | Advise  | ✅ Own              |
| Uptime monitoring + first-line alerting             | Advise  | ✅ Own              |
| Incident triage: app-level bugs                     | ✅ Own  | Escalate to us      |
| Incident triage: infrastructure/network             | Support | ✅ Own              |
| Restore drill (quarterly)                           | Support | ✅ Own              |
| End-user support and training                       | Support | ✅ Own              |

Agree before go-live: support hours, response-time targets by severity, and the escalation contact on each side.

---

## 10. Backup and recovery

| What                  | Mechanism                                                                                      | Owner                         | Frequency              |
| --------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------- | ---------------------- |
| MongoDB               | Atlas continuous backup + point-in-time restore (M10+)                                         | Client                        | Continuous             |
| MongoDB (second copy) | `mongodump` → client's S3 bucket, cron 02:00                                                   | Us (script) / Client (verify) | Daily, 7-day retention |
| Uploaded files        | S3 bucket versioning + lifecycle policy                                                        | Client                        | Continuous             |
| Redis                 | Not backed up by design — it holds sessions and cache only. Loss logs users out; no data loss. | —                             | —                      |
| `.env.production`     | Copy in the password vault                                                                     | Both                          | On every change        |

**A backup that has never been restored is not a backup.** Schedule a restore drill into staging within the first month, then quarterly.

Targets to agree with the client: RPO (how much data loss is acceptable — Atlas PITR makes minutes achievable) and RTO (how long a full rebuild may take — realistically 2–4 hours from a clean VM).

---

## 11. Monitoring

Minimum viable set for client IT to configure:

- **Uptime check** on `https://api.<client-domain>/health` — every minute, alert after two failures (UptimeRobot, Better Stack, or the cloud provider's native check).
- **TLS expiry alert** — 14 days before expiry. Certbot auto-renews, but silent renewal failure is a classic outage.
- **Disk usage alert** at 80% — Docker images and logs grow.
- **Atlas alerts** — connection count, disk, slow queries (built into Atlas, just needs an email/Slack destination).
- **Application logs** — structured JSON via pino; `docker compose logs -f api`. Optional: ship to the cloud provider's log service.

---

## 12. Security posture

Already implemented: helmet security headers, per-origin CORS allowlist, JWT with rotating refresh tokens and Redis-backed blacklisting, RBAC on every route, rate limiting (100 req/min general, 10 per 15 min on auth, 10/hr on bulk operations), encrypted-at-rest sensitive fields, 10 MB body cap, non-root container user, TLS 1.2/1.3 with HSTS.

Client-side obligations: SSH keys only (no passwords), port 22 restricted to admin IPs, OS security updates applied, credential rotation policy (recommend annual, and immediately on any staff change with access), and a named data protection owner if the institution is subject to India's DPDP Act.

---

## 13. Indicative timeline

Assumes the client responds within a working day at each step.

| Week | Milestone                                                                                     |
| ---- | --------------------------------------------------------------------------------------------- |
| 0    | Client provides cloud account, domain, Atlas org. **DLT + Razorpay KYC started in parallel.** |
| 1    | We fix the deploy scripts (§6); VM provisioned; DNS records created                           |
| 1    | Staging deployed end-to-end; smoke-tested                                                     |
| 2    | Production deployed; branding, branches, academic structure configured                        |
| 2–3  | Data migration or bulk import; UAT with client stakeholders                                   |
| 3    | Mobile apps rebuilt against the client API, submitted to stores (add 1–2 weeks for review)    |
| 4    | Go-live; monitoring and backup drills handed to client IT                                     |

The two items outside our control — **DLT approval and app store review** — are the realistic risks to this schedule.

---

## 14. Indicative running cost

Rough monthly estimates for a single-institution production deployment. Actual figures depend on the provider, region and usage — treat as planning numbers only.

| Item                       | Estimate (USD/month)       |
| -------------------------- | -------------------------- |
| VM (4 vCPU / 8 GB)         | 40–60                      |
| Staging VM (2 vCPU / 4 GB) | 20–30                      |
| MongoDB Atlas M10          | ~60                        |
| S3 storage + transfer      | 5–20                       |
| Resend (email)             | 0–20                       |
| Vercel (both frontends)    | 0–40                       |
| SMS                        | per-message, DLT-dependent |
| Razorpay                   | per-transaction (~2%)      |
| OpenAI / LiveKit           | usage-based, optional      |
| **Baseline total**         | **~150–250**               |

---

## 15. Open decisions — need answers to proceed

1. Cloud provider — AWS, Azure, GCP or DigitalOcean?
2. Frontend hosting — Vercel (option A) or self-hosted (option B)?
3. Data — fresh start or migrate the existing dataset?
4. Which optional modules are in scope at go-live: SMS, online payments, transport (Maps), live classes (LiveKit), AI assistant?
5. Mobile apps — published under the client's developer accounts, or do they stay on ours for now?
6. Is public internet access required, or campus-network-only?
7. Data residency — must the Atlas region and S3 region be in India?
8. Support hours and severity/response-time targets after handover.

---

_Prepared for the Campus Verse client-environment migration. Source of truth for the technical detail: `docker-compose.prod.yml`, `apps/api/src/config/env.ts`, `infrastructure/deploy/`._
