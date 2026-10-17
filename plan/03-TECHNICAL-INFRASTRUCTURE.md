# Technical Infrastructure Plan

This document outlines the technical infrastructure gaps and implementation requirements.

---

## 1. File Storage (S3)

### Current State

- Env variables defined but no S3 service implementation
- Document uploads not functional
- Student/staff photos not stored

### AWS Credentials (Configured)

```env
AWS_ACCESS_KEY_ID=REPLACE_WITH_IAM_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=REPLACE_WITH_SECRET_KEY
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=qr-code-logo
```

### Requirements

**Storage Structure**:

```
s3://campus-verse-{env}/
├── {tenantId}/
│   ├── students/
│   │   └── {studentId}/
│   │       ├── photo.jpg
│   │       └── documents/
│   │           ├── aadhar.pdf
│   │           └── birth-certificate.pdf
│   ├── staff/
│   │   └── {staffId}/
│   │       ├── photo.jpg
│   │       └── documents/
│   ├── organization/
│   │   └── {branchId}/
│   │       ├── logo.png
│   │       └── documents/
│   ├── finance/
│   │   └── receipts/
│   │       └── {year}/
│   │           └── {receiptId}.pdf
│   ├── certificates/
│   │   └── {certificateId}.pdf
│   └── reports/
│       └── {reportId}.pdf
```

**Implementation**:

```typescript
// apps/api/src/config/s3.ts
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const uploadFile = async (
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> => {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return key;
};

export const getSignedDownloadUrl = async (key: string, expiresIn = 3600): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn });
};

export const deleteFile = async (key: string): Promise<void> => {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
    })
  );
};
```

**Environment Variables**:

```env
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=REPLACE_WITH_IAM_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=REPLACE_WITH_SECRET_KEY
S3_BUCKET=campus-verse-production
```

**Priority**: P0 (Critical)
**Effort**: 1 week

---

## 2. Full-text Search (Elasticsearch/Meilisearch)

### Current State

- MongoDB text indexes (basic)
- Slow searches on large datasets
- No fuzzy matching

### Requirements

**Search Indexes**:

```
1. students
   - name (fuzzy)
   - admissionNumber
   - enrollmentCode
   - parentName
   - phone
   - email

2. staff
   - name (fuzzy)
   - employeeId
   - phone
   - email
   - department

3. fee_transactions
   - receiptNumber
   - studentName
   - amount

4. leads
   - name
   - phone
   - email
   - source
```

**Recommended: Meilisearch** (simpler than Elasticsearch, good for this scale)

**Implementation**:

```typescript
// apps/api/src/config/search.ts
import { MeiliSearch } from 'meilisearch';

const searchClient = new MeiliSearch({
  host: process.env.MEILISEARCH_HOST!,
  apiKey: process.env.MEILISEARCH_API_KEY,
});

export const indexStudent = async (student: Student) => {
  const index = searchClient.index(`students_${student.tenantId}`);
  await index.addDocuments([
    {
      id: student._id.toString(),
      name: student.name,
      admissionNumber: student.admissionNumber,
      enrollmentCode: student.enrollmentCode,
      class: student.currentEnrollment?.class,
      section: student.currentEnrollment?.section,
      phone: student.contact?.phone,
      parentPhone: student.parents?.father?.phone,
    },
  ]);
};

export const searchStudents = async (
  tenantId: string,
  query: string,
  options?: { limit?: number; filters?: string }
) => {
  const index = searchClient.index(`students_${tenantId}`);
  return index.search(query, {
    limit: options?.limit || 20,
    filter: options?.filters,
  });
};
```

**Sync Strategy**:

- Real-time: Index on create/update
- Batch: Nightly full reindex job
- Recovery: Manual reindex endpoint

**Priority**: P1 (High)
**Effort**: 2 weeks

---

## 3. API Rate Limiting

### Current State

- No rate limiting
- Vulnerable to abuse
- No tenant-level throttling

### Requirements

```typescript
// apps/api/src/middleware/rateLimit.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { getRedisClient } from '../config/redis';

// Global rate limit
export const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) => getRedisClient().call(...args),
  }),
  keyGenerator: (req) => {
    return req.ip || (req.headers['x-forwarded-for'] as string);
  },
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' },
  },
});

// Tenant-specific rate limit
export const tenantRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000, // 1000 requests per tenant per minute
  keyGenerator: (req) => req.tenantId || req.ip,
  store: new RedisStore({
    sendCommand: (...args: string[]) => getRedisClient().call(...args),
  }),
});

// Auth endpoints (stricter)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  keyGenerator: (req) => req.body?.email || req.ip,
});

// Bulk operations (very strict)
export const bulkRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 bulk operations per hour
  keyGenerator: (req) => req.tenantId,
});
```

**Rate Limit Tiers**:
| Endpoint Type | Requests | Window |
|---------------|----------|--------|
| Global | 100 | 1 min |
| Per Tenant | 1000 | 1 min |
| Auth endpoints | 5 | 15 min |
| Bulk operations | 10 | 1 hour |
| File uploads | 50 | 1 hour |

**Priority**: P0 (Critical for production)
**Effort**: 3 days

---

## 4. Caching Strategy

### Current State

- Redis configured but underutilized
- No cache invalidation strategy
- Dashboard queries slow

### Requirements

**Cache Layers**:

```typescript
// apps/api/src/utils/cache.ts
import { getRedisClient } from '../config/redis';

const redis = getRedisClient();

export const cache = {
  // Simple key-value cache
  async get<T>(key: string): Promise<T | null> {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  },

  async set(key: string, value: any, ttlSeconds = 300): Promise<void> {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  },

  async del(key: string): Promise<void> {
    await redis.del(key);
  },

  // Pattern-based invalidation
  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  },

  // Tenant-scoped cache key
  tenantKey(tenantId: string, key: string): string {
    return `tenant:${tenantId}:${key}`;
  },
};

// Cache decorator
export function Cached(ttl: number = 300) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${target.constructor.name}:${propertyKey}:${JSON.stringify(args)}`;

      const cached = await cache.get(cacheKey);
      if (cached) return cached;

      const result = await originalMethod.apply(this, args);
      await cache.set(cacheKey, result, ttl);
      return result;
    };

    return descriptor;
  };
}
```

**What to Cache**:
| Data | TTL | Invalidation |
|------|-----|--------------|
| Dashboard KPIs | 5 min | On transaction |
| User permissions | 15 min | On role change |
| Branch settings | 1 hour | On update |
| Academic structure | 1 hour | On update |
| Fee structures | 30 min | On update |
| Report results | 10 min | Time-based |

**Priority**: P1 (High)
**Effort**: 1 week

---

## 5. Background Jobs / Queue

### Current State

- Basic scheduler exists
- No job queue for async tasks
- Bulk operations block API

### Requirements

**Use BullMQ (Redis-based)**:

```typescript
// apps/api/src/jobs/queue.ts
import { Queue, Worker, Job } from 'bullmq';
import { getRedisClient } from '../config/redis';

const connection = getRedisClient();

// Define queues
export const emailQueue = new Queue('email', { connection });
export const smsQueue = new Queue('sms', { connection });
export const reportQueue = new Queue('reports', { connection });
export const bulkQueue = new Queue('bulk-operations', { connection });

// Email worker
new Worker(
  'email',
  async (job: Job) => {
    const { to, subject, html, attachments } = job.data;
    await sendEmail(to, subject, html, attachments);
  },
  { connection, concurrency: 10 }
);

// SMS worker
new Worker(
  'sms',
  async (job: Job) => {
    const { phone, message, templateId } = job.data;
    await sendSMS(phone, message, templateId);
  },
  { connection, concurrency: 5 }
);

// Report generation worker
new Worker(
  'reports',
  async (job: Job) => {
    const { reportType, params, userId } = job.data;
    const report = await generateReport(reportType, params);
    await notifyUser(userId, 'Report ready', report.downloadUrl);
  },
  { connection, concurrency: 2 }
);

// Bulk operation worker
new Worker(
  'bulk-operations',
  async (job: Job) => {
    const { type, data, tenantId, userId } = job.data;

    switch (type) {
      case 'student-import':
        await processStudentImport(data, tenantId, job);
        break;
      case 'fee-reminder':
        await sendBulkFeeReminders(data, tenantId, job);
        break;
      case 'certificate-generation':
        await generateBulkCertificates(data, tenantId, job);
        break;
    }
  },
  { connection, concurrency: 1 }
);
```

**Job Types**:
| Queue | Jobs | Concurrency |
|-------|------|-------------|
| email | Send emails | 10 |
| sms | Send SMS | 5 |
| reports | Generate reports | 2 |
| bulk-operations | Imports, bulk sends | 1 |
| notifications | Push notifications | 20 |

**Priority**: P1 (High)
**Effort**: 1 week

---

## 6. Monitoring & Observability

### Current State

- Basic Pino logging
- No APM
- No error tracking
- No alerting

### Requirements

**Stack**:

- **APM**: Datadog or New Relic
- **Error Tracking**: Sentry
- **Logging**: Pino → CloudWatch/ELK
- **Uptime**: Better Uptime or Pingdom

**Sentry Integration**:

```typescript
// apps/api/src/config/sentry.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Express({ app }),
    new Sentry.Integrations.Mongo(),
  ],
});

// Error handler middleware
app.use(Sentry.Handlers.errorHandler());
```

**Metrics to Track**:
| Metric | Alert Threshold |
|--------|-----------------|
| API Response Time (p95) | > 500ms |
| Error Rate | > 1% |
| CPU Usage | > 80% |
| Memory Usage | > 85% |
| Database Connections | > 80% pool |
| Queue Depth | > 1000 jobs |
| Failed Jobs | > 10/hour |

**Priority**: P1 (High)
**Effort**: 1 week

---

## 7. Security Enhancements

### Current State

- JWT auth only
- No 2FA
- Basic session management
- No IP restrictions

### Requirements

**Two-Factor Authentication (2FA)**:

```typescript
// apps/api/src/modules/auth/twoFactor.service.ts
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export const twoFactorService = {
  generateSecret(email: string) {
    return speakeasy.generateSecret({
      name: `CampusVerse:${email}`,
      length: 32,
    });
  },

  async generateQRCode(otpauthUrl: string): Promise<string> {
    return QRCode.toDataURL(otpauthUrl);
  },

  verifyToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1,
    });
  },
};

// Auth flow with 2FA
export const loginWith2FA = async (email: string, password: string, totpToken?: string) => {
  const user = await verifyCredentials(email, password);

  if (user.twoFactorEnabled) {
    if (!totpToken) {
      return { requiresTwoFactor: true };
    }

    const isValid = twoFactorService.verifyToken(user.twoFactorSecret, totpToken);
    if (!isValid) {
      throw new UnauthorizedError('Invalid 2FA token');
    }
  }

  return generateTokens(user);
};
```

**Session Management**:

```typescript
// Track active sessions
interface UserSession {
  sessionId: string;
  userId: ObjectId;
  deviceInfo: string;
  ipAddress: string;
  createdAt: Date;
  lastActive: Date;
}

// Force logout all sessions
export const logoutAllSessions = async (userId: ObjectId) => {
  await redis.del(`user:${userId}:sessions:*`);
  await blacklistAllUserTokens(userId);
};

// Device management
export const getActiveSessions = async (userId: ObjectId): Promise<UserSession[]> => {
  const keys = await redis.keys(`user:${userId}:sessions:*`);
  return Promise.all(keys.map((k) => redis.hgetall(k)));
};
```

**IP Whitelisting (Admin)**:

```typescript
// For super admin routes
export const ipWhitelistMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const allowedIPs = process.env.ADMIN_WHITELISTED_IPS?.split(',') || [];
  const clientIP = req.ip || req.headers['x-forwarded-for'];

  if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP as string)) {
    return res.status(403).json({
      success: false,
      error: { code: 'IP_NOT_ALLOWED', message: 'Access denied' },
    });
  }

  next();
};
```

**Priority**: P1 (High)
**Effort**: 2 weeks

---

## 8. Backup & Disaster Recovery

### Current State

- No automated backups
- No DR plan
- No point-in-time recovery

### Requirements

**Backup Strategy**:

```bash
# MongoDB backup script
#!/bin/bash
# infrastructure/scripts/backup.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/backups/mongodb
S3_BUCKET=campus-verse-backups

# Create backup
mongodump --uri="$MONGODB_URI" --out="$BACKUP_DIR/$TIMESTAMP"

# Compress
tar -czf "$BACKUP_DIR/$TIMESTAMP.tar.gz" "$BACKUP_DIR/$TIMESTAMP"

# Upload to S3
aws s3 cp "$BACKUP_DIR/$TIMESTAMP.tar.gz" "s3://$S3_BUCKET/mongodb/$TIMESTAMP.tar.gz"

# Cleanup local (keep 7 days)
find $BACKUP_DIR -type f -mtime +7 -delete

# Cleanup S3 (keep 30 days) - via lifecycle policy
```

**Backup Schedule**:
| Type | Frequency | Retention |
|------|-----------|-----------|
| Full backup | Daily 2 AM | 30 days |
| Incremental | Every 6 hours | 7 days |
| Transaction logs | Continuous | 7 days |

**Disaster Recovery**:

- RPO (Recovery Point Objective): 6 hours
- RTO (Recovery Time Objective): 4 hours
- Secondary region: AWS Mumbai → Singapore

**Priority**: P1 (High)
**Effort**: 1 week

---

## 9. CI/CD Pipeline

### Current State

- Basic GitHub Actions for linting
- No automated testing in CI
- Manual deployments

### Requirements

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Type check
        run: pnpm typecheck

      - name: Unit tests
        run: pnpm test:unit

      - name: Integration tests
        run: pnpm test:integration
        env:
          MONGODB_URI: ${{ secrets.TEST_MONGODB_URI }}

  build:
    needs: lint-and-test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build
        run: pnpm build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build
          path: |
            apps/api/dist
            apps/web/.next

  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to staging
        run: |
          # Deploy to staging server
          ssh deploy@staging.campusverse.app "cd /opt/campusverse && ./deploy.sh"

  deploy-production:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to production
        run: |
          # Deploy to production
          ssh deploy@api.campusverse.app "cd /opt/campusverse && ./deploy.sh"
```

**Priority**: P2 (Medium)
**Effort**: 1 week

---

## 10. Performance Optimization

### Current State

- No query optimization
- No connection pooling tuning
- No CDN for static assets

### Requirements

**MongoDB Optimization**:

```javascript
// Compound indexes for common queries
db.students.createIndex({ tenantId: 1, branchId: 1, status: 1 });
db.students.createIndex({ tenantId: 1, 'currentEnrollment.classId': 1 });
db.students.createIndex({ tenantId: 1, admissionNumber: 1 }, { unique: true });

db.fee_transactions.createIndex({ tenantId: 1, branchId: 1, createdAt: -1 });
db.fee_transactions.createIndex({ tenantId: 1, studentId: 1, createdAt: -1 });

// Query analysis
db.setProfilingLevel(1, { slowms: 100 }); // Log queries > 100ms
```

**Connection Pool Tuning**:

```typescript
// MongoDB connection options
const mongoOptions = {
  maxPoolSize: 50,
  minPoolSize: 10,
  maxIdleTimeMS: 30000,
  waitQueueTimeoutMS: 5000,
  serverSelectionTimeoutMS: 5000,
};
```

**CDN Configuration**:

```
CloudFront Distribution:
- Origin: S3 bucket for static files
- Cache behaviors:
  - /static/* → Cache 1 year
  - /uploads/* → Cache 1 day
  - /api/* → No cache (pass through)
```

**Priority**: P2 (Medium)
**Effort**: Ongoing

---

## Infrastructure Summary

| Component     | Tool/Service               | Status          | Priority |
| ------------- | -------------------------- | --------------- | -------- |
| File Storage  | AWS S3                     | Not implemented | P0       |
| Search        | Meilisearch                | Not implemented | P1       |
| Rate Limiting | Redis + express-rate-limit | Not implemented | P0       |
| Caching       | Redis                      | Partial         | P1       |
| Job Queue     | BullMQ                     | Not implemented | P1       |
| Monitoring    | Sentry + Datadog           | Not implemented | P1       |
| 2FA           | speakeasy                  | Not implemented | P1       |
| Backups       | MongoDB + S3               | Not implemented | P1       |
| CI/CD         | GitHub Actions             | Partial         | P2       |
| CDN           | CloudFront                 | Not implemented | P2       |

---

## Environment Variables (Complete List)

```env
# Application
NODE_ENV=production
PORT=3001
API_URL=https://api.campusverse.app

# Database
MONGODB_URI=mongodb+srv://...
REDIS_URL=redis://...

# AWS
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=REPLACE_WITH_IAM_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=REPLACE_WITH_SECRET_KEY
S3_BUCKET=campus-verse-production

# Auth
JWT_ACCESS_SECRET=xxx
JWT_REFRESH_SECRET=xxx
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Email
EMAIL_PROVIDER=ses
EMAIL_FROM=noreply@campusverse.app
SES_ACCESS_KEY=xxx
SES_SECRET_KEY=xxx

# SMS
SMS_PROVIDER=msg91
MSG91_AUTH_KEY=xxx
MSG91_SENDER_ID=CAMPUS

# Search
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_API_KEY=xxx

# Monitoring
SENTRY_DSN=xxx
DATADOG_API_KEY=xxx

# Security
ADMIN_WHITELISTED_IPS=1.2.3.4,5.6.7.8
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
```
