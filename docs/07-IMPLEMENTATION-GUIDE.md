# Campus Verse - Implementation Guide

## Code Patterns and Examples

This guide provides code patterns for common implementations in Campus Verse.

---

## 1. Express App Setup

### apps/api/src/app.ts

```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { logger } from './lib/logger';
import { errorHandler } from './middleware/errorHandler';
import { apiRateLimiter } from './middleware/rateLimit';

// Routes
import authRoutes from './modules/auth/auth.routes';
import organizationRoutes from './modules/organization/organization.routes';
import studentRoutes from './modules/student/student.routes';
import financeRoutes from './modules/finance/finance.routes';
import attendanceRoutes from './modules/attendance/attendance.routes';
import hrRoutes from './modules/hr/hr.routes';
import communicationRoutes from './modules/communication/communication.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';

const app = express();

// Security
app.use(helmet());
app.use(
  cors({
    origin: process.env.APP_URL,
    credentials: true,
  })
);

// Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(pinoHttp({ logger }));

// Rate limiting
app.use('/api', apiRateLimiter);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/organization', organizationRoutes);
app.use('/api/v1/students', studentRoutes);
app.use('/api/v1/finance', financeRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/hr', hrRoutes);
app.use('/api/v1/communications', communicationRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);

// Error handler (must be last)
app.use(errorHandler);

export { app };
```

---

## 2. MongoDB Connection

### apps/api/src/config/database.ts

```typescript
import { MongoClient, Db } from 'mongodb';
import { logger } from '../lib/logger';

let client: MongoClient;
let db: Db;

export async function connectDatabase(): Promise<Db> {
  if (db) return db;

  const uri = process.env.MONGODB_URI!;

  client = new MongoClient(uri, {
    maxPoolSize: 50,
    minPoolSize: 10,
    maxIdleTimeMS: 30000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });

  try {
    await client.connect();
    db = client.db();

    // Verify connection
    await db.command({ ping: 1 });
    logger.info('Connected to MongoDB');

    return db;
  } catch (error) {
    logger.error('MongoDB connection failed', error);
    throw error;
  }
}

export function getDb(): Db {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.close();
    logger.info('MongoDB connection closed');
  }
}

// Collection getters for type safety
export const collections = {
  get tenants() {
    return getDb().collection('tenants');
  },
  get branches() {
    return getDb().collection('branches');
  },
  get users() {
    return getDb().collection('users');
  },
  get roles() {
    return getDb().collection('roles');
  },
  get students() {
    return getDb().collection('students');
  },
  get studentEnrollments() {
    return getDb().collection('student_enrollments');
  },
  get feeStructures() {
    return getDb().collection('fee_structures');
  },
  get feeAssignments() {
    return getDb().collection('fee_assignments');
  },
  get feeTransactions() {
    return getDb().collection('fee_transactions');
  },
  get studentAttendance() {
    return getDb().collection('student_attendance');
  },
  get staff() {
    return getDb().collection('staff');
  },
  get leaves() {
    return getDb().collection('leaves');
  },
  get announcements() {
    return getDb().collection('announcements');
  },
  get auditLogs() {
    return getDb().collection('audit_logs');
  },
  get counters() {
    return getDb().collection('counters');
  },
};
```

---

## 3. Authentication Middleware

### apps/api/src/middleware/auth.ts

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { redis } from '../config/redis';
import { ApiError } from '../utils/errors';

interface TokenPayload {
  userId: string;
  tenantId: string;
  email: string;
  roleId: string;
  roleName: string;
  permissions: Record<string, string[]>;
}

declare global {
  namespace Express {
    interface Request {
      user: TokenPayload;
      tenantId: string;
      branchId?: string;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new ApiError('AUTH_TOKEN_MISSING', 'No token provided', 401);
    }

    const token = authHeader.split(' ')[1];

    // Check if token is blacklisted
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      throw new ApiError('AUTH_TOKEN_INVALID', 'Token is invalid', 401);
    }

    // Verify token
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as TokenPayload;

    // Attach to request
    req.user = payload;
    req.tenantId = payload.tenantId;

    // Get branch from header if provided
    const branchId = req.headers['x-branch-id'] as string;
    if (branchId) {
      req.branchId = branchId;
    }

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new ApiError('AUTH_TOKEN_EXPIRED', 'Token expired', 401));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new ApiError('AUTH_TOKEN_INVALID', 'Invalid token', 401));
    } else {
      next(error);
    }
  }
}
```

---

## 4. RBAC Middleware

### apps/api/src/middleware/rbac.ts

```typescript
import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/errors';

export function requirePermission(module: string, action: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { permissions } = req.user;

    // Check if user has the required permission
    const modulePermissions = permissions[module];

    if (!modulePermissions || !modulePermissions.includes(action)) {
      throw new ApiError(
        'AUTH_UNAUTHORIZED',
        `You don't have permission to ${action} ${module}`,
        403
      );
    }

    next();
  };
}

// Usage in routes:
// router.get('/students', authenticate, requirePermission('students.list', 'view'), controller.list);
```

---

## 5. Validation Middleware

### apps/api/src/middleware/validate.ts

```typescript
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ApiError } from '../utils/errors';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        throw new ApiError('VALIDATION_ERROR', 'Validation failed', 400, details);
      }
      next(error);
    }
  };
}
```

---

## 6. Service Pattern Example

### apps/api/src/modules/student/student.service.ts

```typescript
import { ObjectId, Filter, Sort } from 'mongodb';
import { collections } from '../../config/database';
import { ApiError } from '../../utils/errors';
import { generateSequence } from '../../utils/generators';
import { PaginationParams, PaginatedResult } from '../../types';
import { CreateStudentDTO, UpdateStudentDTO, Student } from './student.types';

export class StudentService {
  async create(
    tenantId: string,
    branchId: string,
    data: CreateStudentDTO,
    createdBy: string
  ): Promise<Student> {
    // Generate admission number
    const admissionNumber = await this.generateAdmissionNumber(
      tenantId,
      branchId,
      data.academicBatchId
    );

    // Generate enrollment code
    const enrollmentCode = await generateSequence('enrollmentCode', tenantId);

    const student = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      admissionNumber,
      enrollmentCode,
      ...data,
      status: 'active',
      createdBy: new ObjectId(createdBy),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await collections.students.insertOne(student);

    return { _id: result.insertedId, ...student } as Student;
  }

  async list(
    tenantId: string,
    branchId: string,
    filters: StudentFilters,
    pagination: PaginationParams
  ): Promise<PaginatedResult<Student>> {
    const query: Filter<Student> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      status: { $in: filters.status || ['active'] },
    };

    if (filters.classId) {
      query['currentEnrollment.classId'] = new ObjectId(filters.classId);
    }

    if (filters.sectionId) {
      query['currentEnrollment.sectionId'] = new ObjectId(filters.sectionId);
    }

    if (filters.search) {
      query.$text = { $search: filters.search };
    }

    const sort: Sort = { [pagination.sortBy]: pagination.sortOrder === 'asc' ? 1 : -1 };
    const skip = (pagination.page - 1) * pagination.limit;

    const [data, total] = await Promise.all([
      collections.students.find(query).sort(sort).skip(skip).limit(pagination.limit).toArray(),
      collections.students.countDocuments(query),
    ]);

    return {
      data: data as Student[],
      meta: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
        hasMore: pagination.page * pagination.limit < total,
      },
    };
  }

  async getById(tenantId: string, id: string): Promise<Student> {
    const student = await collections.students.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!student) {
      throw new ApiError('NOT_FOUND', 'Student not found', 404);
    }

    return student as Student;
  }

  async update(
    tenantId: string,
    id: string,
    data: UpdateStudentDTO,
    updatedBy: string
  ): Promise<Student> {
    const result = await collections.students.findOneAndUpdate(
      {
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      },
      {
        $set: {
          ...data,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new ApiError('NOT_FOUND', 'Student not found', 404);
    }

    return result as Student;
  }

  private async generateAdmissionNumber(
    tenantId: string,
    branchId: string,
    academicBatchId: string
  ): Promise<string> {
    // Get branch code
    const branch = await collections.branches.findOne({
      _id: new ObjectId(branchId),
    });

    // Get batch code
    const batch = await collections.academicBatches.findOne({
      _id: new ObjectId(academicBatchId),
    });

    // Atomic increment
    const counter = await collections.counters.findOneAndUpdate(
      {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        type: 'admissionNumber',
        academicBatchId: new ObjectId(academicBatchId),
      },
      { $inc: { sequence: 1 } },
      { upsert: true, returnDocument: 'after' }
    );

    const sequence = String(counter!.sequence).padStart(4, '0');
    return `${branch!.code}-${batch!.code}-${sequence}`;
  }
}

export const studentService = new StudentService();
```

---

## 7. Controller Pattern

### apps/api/src/modules/student/student.controller.ts

```typescript
import { Request, Response, NextFunction } from 'express';
import { studentService } from './student.service';
import { success, created } from '../../utils/response';
import { getPagination } from '../../utils/pagination';

export class StudentController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = getPagination(req.query);
      const filters = {
        status: req.query.status as string[],
        classId: req.query.classId as string,
        sectionId: req.query.sectionId as string,
        search: req.query.search as string,
      };

      const result = await studentService.list(req.tenantId, req.branchId!, filters, pagination);

      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const student = await studentService.create(
        req.tenantId,
        req.branchId!,
        req.body,
        req.user.userId
      );

      created(res, student, 'Student created successfully');
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const student = await studentService.getById(req.tenantId, req.params.id);

      success(res, student);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const student = await studentService.update(
        req.tenantId,
        req.params.id,
        req.body,
        req.user.userId
      );

      success(res, student, 'Student updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const studentController = new StudentController();
```

---

## 8. Routes Pattern

### apps/api/src/modules/student/student.routes.ts

```typescript
import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { studentController } from './student.controller';
import { createStudentSchema, updateStudentSchema } from './student.schema';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/', requirePermission('students.list', 'view'), studentController.list);

router.post(
  '/',
  requirePermission('students.list', 'create'),
  validate(createStudentSchema),
  studentController.create
);

router.get('/:id', requirePermission('students.details', 'view'), studentController.getById);

router.put(
  '/:id',
  requirePermission('students.details', 'edit'),
  validate(updateStudentSchema),
  studentController.update
);

export default router;
```

---

## 9. Response Helpers

### apps/api/src/utils/response.ts

```typescript
import { Response } from 'express';

interface Meta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  hasMore?: boolean;
}

export function success<T>(res: Response, data: T, meta?: Meta, message?: string) {
  res.json({
    success: true,
    data,
    ...(meta && { meta }),
    ...(message && { message }),
  });
}

export function created<T>(res: Response, data: T, message = 'Created successfully') {
  res.status(201).json({
    success: true,
    data,
    message,
  });
}

export function noContent(res: Response) {
  res.status(204).send();
}
```

---

## 10. Error Handler

### apps/api/src/middleware/errorHandler.ts

```typescript
import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

export class ApiError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500,
    public details?: any[]
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function errorHandler(error: Error, req: Request, res: Response, next: NextFunction) {
  logger.error({
    err: error,
    req: {
      method: req.method,
      url: req.url,
      body: req.body,
    },
  });

  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details && { details: error.details }),
      },
    });
  }

  // MongoDB duplicate key error
  if ((error as any).code === 11000) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_ENTRY',
        message: 'A record with this value already exists',
      },
    });
  }

  // Default error
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}
```

---

## 11. Frontend API Service

### apps/web/src/lib/api.ts

```typescript
import axios, { AxiosError, AxiosInstance } from 'axios';
import { useAuthStore } from '@/store/authStore';

const api: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use((config) => {
  const { accessToken, selectedBranchId } = useAuthStore.getState();

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  if (selectedBranchId) {
    config.headers['X-Branch-Id'] = selectedBranchId;
  }

  return config;
});

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;

    // Handle token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const { refreshToken, setTokens, logout } = useAuthStore.getState();

        const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data;
        setTokens(accessToken, newRefreshToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export { api };
```

---

## 12. React Query Hooks

### apps/web/src/services/student.service.ts

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Student, CreateStudentDTO, PaginatedResponse } from '@/types';

const QUERY_KEY = 'students';

export function useStudents(params: StudentQueryParams) {
  return useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Student>>('/students', {
        params,
      });
      return data;
    },
  });
}

export function useStudent(id: string) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: async () => {
      const { data } = await api.get<{ data: Student }>(`/students/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateStudentDTO) => {
      const response = await api.post<{ data: Student }>('/students', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Student> }) => {
      const response = await api.put<{ data: Student }>(`/students/${id}`, data);
      return response.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, variables.id] });
    },
  });
}
```

---

## 13. Zustand Store

### apps/web/src/store/authStore.ts

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  branches: string[];
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  selectedBranchId: string | null;
  isAuthenticated: boolean;

  setUser: (user: User) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setSelectedBranch: (branchId: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      selectedBranchId: null,
      isAuthenticated: false,

      setUser: (user) => set({ user, isAuthenticated: true }),

      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),

      setSelectedBranch: (branchId) => set({ selectedBranchId: branchId }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          selectedBranchId: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        selectedBranchId: state.selectedBranchId,
      }),
    }
  )
);
```

---

## 14. Permission Gate Component

### apps/web/src/components/shared/PermissionGate.tsx

```typescript
'use client';

import { ReactNode } from 'react';
import { useAuthStore } from '@/store/authStore';

interface PermissionGateProps {
  module: string;
  action: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGate({
  module,
  action,
  children,
  fallback = null,
}: PermissionGateProps) {
  const { user } = useAuthStore();

  if (!user) return fallback;

  const hasPermission = checkPermission(user.permissions, module, action);

  return hasPermission ? <>{children}</> : <>{fallback}</>;
}

function checkPermission(
  permissions: Record<string, string[]>,
  module: string,
  action: string
): boolean {
  const modulePermissions = permissions[module];
  return modulePermissions?.includes(action) ?? false;
}
```

---

## 15. Data Table Component

### apps/web/src/components/data-table/DataTable.tsx

```typescript
'use client';

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataTablePagination } from './DataTablePagination';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  pageCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  isLoading?: boolean;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  pageCount,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  isLoading,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    pageCount,
    manualPagination: true,
    getCoreRowModel: getCoreRowModel(),
    state: {
      pagination: { pageIndex: page - 1, pageSize },
    },
  });

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination
        page={page}
        pageSize={pageSize}
        pageCount={pageCount}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}
```

---

This implementation guide provides the core patterns. Extend these patterns for each module following the same structure.
