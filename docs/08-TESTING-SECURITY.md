# Campus Verse - Testing & Security Guidelines

## 1. Testing Strategy

### Testing Pyramid

```
         /\
        /E2E\         5% - Critical user journeys
       /------\
      /Integration\   25% - API + Database tests
     /--------------\
    /    Unit Tests   \ 70% - Business logic, utilities
   /--------------------\
```

---

## 2. Unit Testing (Vitest)

### Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', 'dist', '**/*.d.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
```

### Service Unit Test Example

```typescript
// apps/api/src/modules/finance/__tests__/fineCalculation.test.ts
import { describe, it, expect } from 'vitest';
import { calculateFine } from '../services/fineCalculation';

describe('Fine Calculation', () => {
  const fineRules = {
    type: 'daily',
    amount: 50,
    gracePeriodDays: 7,
    maxFine: 1000,
  };

  it('should return 0 fine within grace period', () => {
    const installments = [
      {
        dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        balance: 10000,
      },
    ];

    const fine = calculateFine(installments, fineRules);
    expect(fine).toBe(0);
  });

  it('should calculate daily fine after grace period', () => {
    const installments = [
      {
        dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        balance: 10000,
      },
    ];

    // 10 days - 7 grace = 3 days * 50 = 150
    const fine = calculateFine(installments, fineRules);
    expect(fine).toBe(150);
  });

  it('should cap fine at maxFine', () => {
    const installments = [
      {
        dueDate: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100 days ago
        balance: 10000,
      },
    ];

    // Would be 93 * 50 = 4650, but capped at 1000
    const fine = calculateFine(installments, fineRules);
    expect(fine).toBe(1000);
  });

  it('should calculate percentage-based fine', () => {
    const percentageRules = {
      type: 'percentage',
      amount: 2, // 2%
      gracePeriodDays: 0,
      maxFine: 5000,
    };

    const installments = [
      {
        dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        balance: 10000,
      },
    ];

    // 2% of 10000 = 200
    const fine = calculateFine(installments, percentageRules);
    expect(fine).toBe(200);
  });
});
```

### Utility Unit Test Example

```typescript
// packages/shared/src/utils/__tests__/validators.test.ts
import { describe, it, expect } from 'vitest';
import { validateAadhar, validatePAN, validatePhone } from '../validators';

describe('Validators', () => {
  describe('validateAadhar', () => {
    it('should accept valid 12-digit Aadhar', () => {
      expect(validateAadhar('123456789012')).toBe(true);
    });

    it('should reject invalid Aadhar', () => {
      expect(validateAadhar('12345')).toBe(false);
      expect(validateAadhar('12345678901a')).toBe(false);
    });
  });

  describe('validatePhone', () => {
    it('should accept valid Indian phone number', () => {
      expect(validatePhone('9876543210')).toBe(true);
      expect(validatePhone('6123456789')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(validatePhone('1234567890')).toBe(false); // Doesn't start with 6-9
      expect(validatePhone('98765432')).toBe(false); // Too short
    });
  });
});
```

---

## 3. Integration Testing

### API Integration Test

```typescript
// apps/api/src/modules/student/__tests__/student.integration.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../app';
import { getDb, closeDatabase } from '../../../config/database';
import { ObjectId } from 'mongodb';

describe('Student API Integration', () => {
  let authToken: string;
  let tenantId: string;
  let branchId: string;
  let testStudentId: string;

  beforeAll(async () => {
    // Setup test tenant and user
    const db = getDb();

    const tenant = await db.collection('tenants').insertOne({
      name: 'Test School',
      code: 'TEST001',
      status: 'active',
    });
    tenantId = tenant.insertedId.toString();

    const branch = await db.collection('branches').insertOne({
      tenantId: new ObjectId(tenantId),
      name: 'Test Branch',
      code: 'TB01',
      status: 'active',
    });
    branchId = branch.insertedId.toString();

    // Create test user and get token
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    authToken = loginResponse.body.accessToken;
  });

  afterAll(async () => {
    // Cleanup
    const db = getDb();
    await db.collection('students').deleteMany({ tenantId: new ObjectId(tenantId) });
    await db.collection('branches').deleteMany({ tenantId: new ObjectId(tenantId) });
    await db.collection('tenants').deleteOne({ _id: new ObjectId(tenantId) });
    await closeDatabase();
  });

  describe('POST /api/v1/students', () => {
    it('should create a new student', async () => {
      const studentData = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '2010-05-15',
        gender: 'male',
        academicBatchId: '507f1f77bcf86cd799439011',
        classId: '507f1f77bcf86cd799439012',
        sectionId: '507f1f77bcf86cd799439013',
      };

      const response = await request(app)
        .post('/api/v1/students')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Branch-Id', branchId)
        .send(studentData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.firstName).toBe('John');
      expect(response.body.data.admissionNumber).toBeDefined();

      testStudentId = response.body.data._id;
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/students')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Branch-Id', branchId)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/students', () => {
    it('should list students with pagination', async () => {
      const response = await request(app)
        .get('/api/v1/students')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Branch-Id', branchId)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta).toBeDefined();
    });

    it('should filter by class', async () => {
      const response = await request(app)
        .get('/api/v1/students')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Branch-Id', branchId)
        .query({ classId: '507f1f77bcf86cd799439012' });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/v1/students/:id', () => {
    it('should get student by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/students/${testStudentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Branch-Id', branchId);

      expect(response.status).toBe(200);
      expect(response.body.data._id).toBe(testStudentId);
    });

    it('should return 404 for non-existent student', async () => {
      const response = await request(app)
        .get('/api/v1/students/507f1f77bcf86cd799439999')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Branch-Id', branchId);

      expect(response.status).toBe(404);
    });
  });
});
```

---

## 4. E2E Testing (Playwright)

### Configuration

```typescript
// apps/web/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### E2E Test Example

```typescript
// apps/web/e2e/fee-collection.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Fee Collection Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name="email"]', 'accountant@test.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should collect fee and generate receipt', async ({ page }) => {
    // Navigate to fee counter
    await page.click('text=Finance');
    await page.click('text=Fee Counter');

    // Search for student
    await page.fill('[placeholder="Search student"]', 'John Doe');
    await page.waitForSelector('.student-result');
    await page.click('.student-result:first-child');

    // Verify fee details loaded
    await expect(page.locator('.fee-summary')).toBeVisible();
    await expect(page.locator('.total-due')).toContainText('₹');

    // Select installment
    await page.check('input[name="installment-1"]');

    // Select payment mode
    await page.selectOption('select[name="paymentMode"]', 'cash');

    // Collect fee
    await page.click('button:has-text("Collect Fee")');

    // Confirm
    await page.click('button:has-text("Confirm")');

    // Verify success
    await expect(page.locator('.toast-success')).toContainText('Fee collected');

    // Verify receipt
    await expect(page.locator('.receipt-number')).toBeVisible();

    // Download receipt
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Download Receipt")');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.pdf');
  });

  test('should show error for insufficient payment', async ({ page }) => {
    await page.click('text=Finance');
    await page.click('text=Fee Counter');

    await page.fill('[placeholder="Search student"]', 'John Doe');
    await page.click('.student-result:first-child');

    // Try to collect without selecting installment
    await page.click('button:has-text("Collect Fee")');

    await expect(page.locator('.error-message')).toContainText('Select at least one installment');
  });
});
```

### Login Flow E2E Test

```typescript
// apps/web/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should login successfully', async ({ page }) => {
    await page.goto('/login');

    await page.fill('[name="email"]', 'admin@test.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('text=Welcome')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('[name="email"]', 'wrong@test.com');
    await page.fill('[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('.error-message')).toContainText('Invalid credentials');
  });

  test('should redirect to login when unauthorized', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@test.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');

    // Logout
    await page.click('[data-testid="user-menu"]');
    await page.click('text=Logout');

    await expect(page).toHaveURL('/login');
  });
});
```

---

## 5. Security Implementation

### Password Hashing

```typescript
// apps/api/src/lib/security.ts
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

### Data Encryption

```typescript
// apps/api/src/lib/encryption.ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'),
    iv
  );

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'),
    Buffer.from(ivHex, 'hex')
  );

  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

### Rate Limiting

```typescript
// apps/api/src/middleware/rateLimit.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../config/redis';

// General API rate limit
export const apiRateLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis.call(...args),
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  keyGenerator: (req) => `rate:${req.tenantId}:${req.ip}`,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
});

// Stricter limit for auth endpoints
export const authRateLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis.call(...args),
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  keyGenerator: (req) => `auth:${req.ip}`,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_LOGIN_ATTEMPTS',
      message: 'Too many login attempts, please try again after 15 minutes',
    },
  },
});

// Bulk operation limit
export const bulkOperationLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis.call(...args),
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  keyGenerator: (req) => `bulk:${req.tenantId}:${req.user?.userId}`,
});
```

### Input Validation Schemas

```typescript
// packages/shared/src/schemas/student.schema.ts
import { z } from 'zod';

export const createStudentSchema = z.object({
  body: z.object({
    firstName: z
      .string()
      .min(2, 'First name must be at least 2 characters')
      .max(50, 'First name cannot exceed 50 characters')
      .regex(/^[a-zA-Z\s]+$/, 'First name can only contain letters'),

    lastName: z
      .string()
      .min(2)
      .max(50)
      .regex(/^[a-zA-Z\s]+$/),

    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
      .refine((date) => {
        const dob = new Date(date);
        const minAge = new Date();
        minAge.setFullYear(minAge.getFullYear() - 25);
        const maxAge = new Date();
        maxAge.setFullYear(maxAge.getFullYear() - 3);
        return dob >= minAge && dob <= maxAge;
      }, 'Student age must be between 3 and 25 years'),

    gender: z.enum(['male', 'female', 'other']),

    contact: z
      .object({
        email: z.string().email().optional(),
        phone: z
          .string()
          .regex(/^[6-9]\d{9}$/, 'Invalid Indian phone number')
          .optional(),
      })
      .optional(),

    aadharNumber: z
      .string()
      .regex(/^\d{12}$/, 'Aadhar must be 12 digits')
      .optional(),

    classId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid class ID'),
    sectionId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid section ID'),
    academicBatchId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid batch ID'),
  }),
});

export type CreateStudentDTO = z.infer<typeof createStudentSchema>['body'];
```

### Audit Logging

```typescript
// apps/api/src/lib/audit.ts
import { ObjectId } from 'mongodb';
import { collections } from '../config/database';

interface AuditLogParams {
  tenantId: string;
  branchId?: string;
  action: 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'login' | 'logout';
  module: string;
  subModule?: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  changes?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
  };
  userId: string;
  userName?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function createAuditLog(params: AuditLogParams): Promise<void> {
  await collections.auditLogs.insertOne({
    tenantId: new ObjectId(params.tenantId),
    branchId: params.branchId ? new ObjectId(params.branchId) : null,
    action: params.action,
    module: params.module,
    subModule: params.subModule,
    entityType: params.entityType,
    entityId: new ObjectId(params.entityId),
    entityName: params.entityName,
    changes: params.changes,
    userId: new ObjectId(params.userId),
    userName: params.userName,
    userRole: params.userRole,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    timestamp: new Date(),
  });
}

// Middleware to capture audit context
export function auditMiddleware(req: any, res: any, next: any) {
  req.auditContext = {
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'],
  };
  next();
}
```

### Security Headers (Helmet)

```typescript
// apps/api/src/app.ts
import helmet from 'helmet';

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: 'same-site' },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: true,
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
  })
);
```

---

## 6. Security Checklist

### Authentication & Authorization

- [ ] JWT tokens with short expiry (15 min access, 7 day refresh)
- [ ] Token blacklisting on logout
- [ ] Refresh token rotation
- [ ] Password hashing with bcrypt (12 rounds)
- [ ] Account lockout after failed attempts
- [ ] RBAC permission checks on all routes

### Data Protection

- [ ] Sensitive data encryption (bank details, Aadhar)
- [ ] SQL/NoSQL injection prevention (parameterized queries)
- [ ] XSS protection (input sanitization)
- [ ] CSRF protection (if using cookies)
- [ ] Secure file upload validation

### API Security

- [ ] Rate limiting on all endpoints
- [ ] Stricter limits on auth endpoints
- [ ] Request size limits
- [ ] CORS configuration
- [ ] Security headers (Helmet)

### Infrastructure

- [ ] HTTPS only (TLS 1.3)
- [ ] Secrets in AWS Secrets Manager
- [ ] VPC with private subnets for services
- [ ] Security groups restricting access
- [ ] Regular security patching

### Compliance

- [ ] Audit logging for all sensitive operations
- [ ] Data retention policies (10 years for financial)
- [ ] User consent for data collection
- [ ] Data export capability
- [ ] Right to deletion support
