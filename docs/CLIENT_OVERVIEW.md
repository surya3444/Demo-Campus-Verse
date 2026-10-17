# Campus Verse - Educational ERP Platform

## Executive Summary

Campus Verse is a comprehensive, cloud-native Enterprise Resource Planning (ERP) solution designed specifically for educational institutions. The platform supports Schools, Colleges, and Universities with a unified system that manages the complete institutional workflow — from student admissions to finance, attendance, HR, and communications.

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture](#3-system-architecture)
4. [Core Modules & Features](#4-core-modules--features)
5. [Multi-Tenancy & Access Control](#5-multi-tenancy--access-control)
6. [Infrastructure & Deployment](#6-infrastructure--deployment)
7. [Security Features](#7-security-features)
8. [Supported Institution Types](#8-supported-institution-types)

---

## 1. Platform Overview

### What is Campus Verse?

Campus Verse is a modern, scalable ERP platform built to digitize and streamline educational institution operations. It provides:

- **Unified Dashboard** — Real-time insights into institutional KPIs
- **Complete Student Lifecycle Management** — From admission enquiry to graduation
- **Financial Management** — Fee structures, collections, dues tracking, and reporting
- **Attendance Tracking** — Student and staff attendance with comprehensive reports
- **HR Management** — Staff records, leave management, and payroll integration readiness
- **Communication Tools** — Announcements, events calendar, SMS, and email notifications

### Key Differentiators

| Feature                          | Description                                                                 |
| -------------------------------- | --------------------------------------------------------------------------- |
| **Multi-Tenant Architecture**    | Single deployment serves multiple institutions with complete data isolation |
| **Role-Based Access Control**    | Granular permissions at module and action level                             |
| **Institution Type Flexibility** | Adapts to Schools, Colleges, and Universities                               |
| **Real-Time Analytics**          | Live dashboards with actionable insights                                    |
| **Cloud-Native Design**          | Built for scalability, reliability, and performance                         |

---

## 2. Technology Stack

### Frontend Application

| Component        | Technology            | Purpose                                      |
| ---------------- | --------------------- | -------------------------------------------- |
| Framework        | Next.js 15            | Server-side rendering, optimized performance |
| UI Library       | React 19              | Modern component-based architecture          |
| Styling          | Tailwind CSS          | Responsive, utility-first design system      |
| Components       | shadcn/ui (Radix UI)  | Accessible, customizable UI components       |
| State Management | Zustand + React Query | Client and server state management           |
| Forms            | React Hook Form + Zod | Type-safe form handling with validation      |
| Charts           | Recharts              | Data visualization and analytics             |

### Backend Application

| Component    | Technology        | Purpose                                    |
| ------------ | ----------------- | ------------------------------------------ |
| Runtime      | Node.js 20 LTS    | High-performance JavaScript runtime        |
| Framework    | Express.js        | Fast, minimalist web framework             |
| Language     | TypeScript        | Type safety across the entire codebase     |
| Database     | MongoDB 7.0       | Flexible document database                 |
| Caching      | Redis 7.2         | Session management, caching, rate limiting |
| Job Queue    | BullMQ            | Background task processing                 |
| File Storage | AWS S3            | Secure document and media storage          |
| Email        | Nodemailer (SMTP) | Transactional email delivery               |
| SMS          | MSG91 Gateway     | SMS notifications with DLT compliance      |

### Shared Infrastructure

| Component         | Technology       | Purpose                                  |
| ----------------- | ---------------- | ---------------------------------------- |
| Monorepo          | Turborepo + pnpm | Unified codebase management              |
| Validation        | Zod              | Runtime type validation (shared schemas) |
| Authentication    | JWT              | Secure token-based authentication        |
| API Documentation | OpenAPI/Swagger  | Comprehensive API documentation          |

---

## 3. System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Browser   │  │  Mobile App │  │  Third-Party│              │
│  │  (Next.js)  │  │   (Future)  │  │    APIs     │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
└─────────┼────────────────┼────────────────┼─────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY / CDN                           │
│                    (AWS CloudFront / ALB)                        │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  Express.js API Server                   │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │    │
│  │  │  Auth   │ │ Student │ │ Finance │ │   HR    │  ...  │    │
│  │  │ Module  │ │ Module  │ │ Module  │ │ Module  │       │    │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  MongoDB    │  │    Redis    │  │   AWS S3    │              │
│  │  (Primary)  │  │   (Cache)   │  │   (Files)   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### Monorepo Structure

```
campus-verse/
├── apps/
│   ├── api/                 # Backend Express.js application
│   │   ├── src/
│   │   │   ├── config/      # Database & environment config
│   │   │   ├── middleware/  # Auth, validation, error handling
│   │   │   ├── modules/     # Feature modules (10 modules)
│   │   │   └── utils/       # Shared utilities
│   │   └── package.json
│   │
│   └── web/                 # Frontend Next.js application
│       ├── src/
│       │   ├── app/         # App router pages
│       │   ├── components/  # Reusable UI components
│       │   ├── lib/         # API clients, utilities
│       │   └── stores/      # State management
│       └── package.json
│
├── packages/
│   ├── shared/              # Shared types, schemas, constants
│   └── eslint-config/       # Shared linting rules
│
├── docs/                    # Implementation documentation
├── infrastructure/          # Deployment scripts & configs
└── docker-compose.yml       # Local development environment
```

---

## 4. Core Modules & Features

### 4.1 Authentication & Authorization

| Feature              | Description                                                              |
| -------------------- | ------------------------------------------------------------------------ |
| JWT Authentication   | Secure token-based login with access (15min) and refresh (7 days) tokens |
| Multi-Device Support | Users can login from multiple devices with individual session management |
| Password Recovery    | Secure token-based password reset flow                                   |
| Role-Based Access    | Granular permissions per module and action                               |
| Session Management   | Token blacklisting for secure logout                                     |

### 4.2 Organization Management

| Feature              | Description                                              |
| -------------------- | -------------------------------------------------------- |
| Multi-Branch Support | Manage multiple campuses/branches under one organization |
| User Management      | Create staff accounts with role assignments              |
| Role Configuration   | Define custom roles with specific permission sets        |
| Academic Batches     | Configure academic years, terms, and semesters           |
| Class/Section Setup  | Flexible class hierarchy based on institution type       |
| Subject Catalog      | Manage subjects with class assignments                   |

### 4.3 Student Management

| Feature             | Description                                                                  |
| ------------------- | ---------------------------------------------------------------------------- |
| Student Records     | Comprehensive student profiles with personal, academic, and guardian details |
| Enrollment Tracking | Track student-class mappings across academic batches                         |
| Promotion System    | Bulk promote students to next grade/year                                     |
| Section Shuffling   | Move students between sections within same class                             |
| Transfer Management | Handle inter-branch student transfers                                        |
| History Tracking    | Complete enrollment and academic history                                     |
| Bulk Operations     | Import students via Excel/CSV upload                                         |
| Export & Reports    | Generate class-wise student reports                                          |

### 4.4 Admissions Module

| Feature              | Description                                                                |
| -------------------- | -------------------------------------------------------------------------- |
| Lead Management      | Track admission enquiries with follow-up scheduling                        |
| Application Pipeline | Multi-stage application processing workflow                                |
| Status Tracking      | Monitor application progress (Submitted → Processed → Accepted → Enrolled) |
| Lead Conversion      | Convert approved applications to enrolled students                         |
| Funnel Analytics     | Track conversion rates across admission stages                             |
| Bulk Import          | Upload leads and applications via spreadsheet                              |

### 4.5 Finance Module

| Feature                | Description                                                         |
| ---------------------- | ------------------------------------------------------------------- |
| Fee Structures         | Create reusable fee templates with multiple fee types               |
| Installment Plans      | Configure installment-based payment schedules                       |
| Fee Assignment         | Assign fee structures to students (individual or bulk)              |
| Payment Collection     | Record payments with multiple payment mode support                  |
| Receipt Generation     | Auto-generate PDF receipts for payments                             |
| Concession Management  | Process fee discount/exemption requests with approval workflow      |
| Dues Tracking          | Real-time tracking of pending dues by student, class, or branch     |
| Financial Reports      | Daily collection sheets, summary reports, installment-wise analysis |
| Transaction Management | Handle cancellations, refunds, and adjustments                      |

### 4.6 Attendance System

| Feature            | Description                                           |
| ------------------ | ----------------------------------------------------- |
| Student Attendance | Mark daily attendance per class/section               |
| Staff Attendance   | Employee check-in/check-out tracking                  |
| Late Marking       | Configurable thresholds for late attendance           |
| Leave Integration  | Automatic leave deduction from attendance             |
| Attendance Reports | Daily, monthly, and student-wise attendance summaries |
| Holiday Management | Configure holidays and non-working days               |

### 4.7 HR Management

| Feature                | Description                                                   |
| ---------------------- | ------------------------------------------------------------- |
| Staff Records          | Comprehensive employee profiles with department/designation   |
| Leave Management       | Leave request submission and approval workflow                |
| Leave Balance          | Track leave entitlements by type (Sick, Casual, Earned, etc.) |
| Department Setup       | Organizational structure for staff hierarchy                  |
| Designation Management | Job titles and designation catalog                            |

### 4.8 Communications

| Feature             | Description                                 |
| ------------------- | ------------------------------------------- |
| Announcements       | Broadcast messages to targeted audiences    |
| Events Calendar     | Schedule and manage institutional events    |
| SMS Notifications   | Send SMS via MSG91 with DLT compliance      |
| Email Notifications | SMTP-based transactional emails             |
| Notification Logs   | Track delivery status of all communications |

### 4.9 Dashboard & Analytics

| Feature          | Description                                             |
| ---------------- | ------------------------------------------------------- |
| KPI Dashboard    | Real-time metrics for students, staff, fees, attendance |
| Visual Analytics | Charts and graphs for trend analysis                    |
| Quick Actions    | Shortcuts to frequently used functions                  |
| Role-Based Views | Dashboard customized by user role                       |

### 4.10 Certificates & Documents

| Feature              | Description                                              |
| -------------------- | -------------------------------------------------------- |
| Certificate Types    | Define certificate categories (Bonafide, Transfer, etc.) |
| Certificate Requests | Student request and approval workflow                    |
| ID Card Generation   | Customizable ID card templates                           |
| PDF Generation       | Auto-generate certificates and documents                 |

---

## 5. Multi-Tenancy & Access Control

### Multi-Tenant Architecture

Campus Verse supports multiple organizations (tenants) on a single deployment with complete data isolation:

```
┌─────────────────────────────────────────────────────┐
│                    TENANT LAYER                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │  School A   │  │  College B  │  │ University C│  │
│  │  (Tenant 1) │  │  (Tenant 2) │  │  (Tenant 3) │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  │
│         │                │                │         │
│         ▼                ▼                ▼         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │  Branch 1   │  │  Branch 1   │  │  Branch 1   │  │
│  │  Branch 2   │  │  Branch 2   │  │  Branch 2   │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Role-Based Access Control (RBAC)

| Component        | Description                                                               |
| ---------------- | ------------------------------------------------------------------------- |
| **Roles**        | Named permission sets (Super Admin, Principal, Accountant, Teacher, etc.) |
| **Permissions**  | Module + Action combinations (e.g., `students:create`, `finance:view`)    |
| **Access Scope** | Global (all branches), Branch-specific, or Department-specific            |

**Permission Matrix Example:**

| Role        | Students | Finance | Attendance | HR   |
| ----------- | -------- | ------- | ---------- | ---- |
| Super Admin | Full     | Full    | Full       | Full |
| Principal   | Full     | View    | Full       | Full |
| Accountant  | View     | Full    | None       | None |
| Teacher     | View     | None    | Create     | None |
| Front Desk  | Create   | View    | None       | None |

---

## 6. Infrastructure & Deployment

### Development Environment

- **Docker Compose** — Single command to spin up all services
- **Hot Reload** — Instant code changes reflection
- **Local Databases** — MongoDB and Redis in containers

### Production Deployment (AWS)

| Service    | AWS Component   | Purpose                            |
| ---------- | --------------- | ---------------------------------- |
| Compute    | ECS Fargate     | Serverless container orchestration |
| Database   | MongoDB Atlas   | Managed MongoDB with auto-scaling  |
| Cache      | ElastiCache     | Managed Redis cluster              |
| Storage    | S3              | Document and media file storage    |
| CDN        | CloudFront      | Global content delivery            |
| Queue      | SQS             | Reliable message queuing           |
| Monitoring | CloudWatch      | Logs, metrics, and alerts          |
| Secrets    | Secrets Manager | Secure credential storage          |

### Scalability

| Metric               | Capacity                  |
| -------------------- | ------------------------- |
| Concurrent Users     | 5,000+ per tenant         |
| Database Connections | 50 max, 10 min (pooled)   |
| API Rate Limiting    | Configurable per endpoint |
| File Storage         | Unlimited (S3)            |

---

## 7. Security Features

### Application Security

| Feature                 | Implementation                             |
| ----------------------- | ------------------------------------------ |
| **HTTPS Everywhere**    | TLS encryption for all communications      |
| **Security Headers**    | Helmet.js for XSS, clickjacking protection |
| **CORS Protection**     | Configured allowed origins                 |
| **Input Validation**    | Zod schema validation on all inputs        |
| **SQL/NoSQL Injection** | Parameterized queries, no raw inputs       |
| **Rate Limiting**       | Redis-backed request throttling            |

### Authentication Security

| Feature                    | Implementation                                 |
| -------------------------- | ---------------------------------------------- |
| **Password Hashing**       | bcrypt with salt rounds                        |
| **JWT Tokens**             | Short-lived access tokens (15 min)             |
| **Token Blacklisting**     | Redis-based logout invalidation                |
| **Refresh Token Rotation** | New refresh token on each renewal              |
| **MFA Ready**              | Schema structure for future 2FA implementation |

### Data Security

| Feature                       | Implementation                     |
| ----------------------------- | ---------------------------------- |
| **Tenant Isolation**          | Data segregation at database level |
| **Encryption at Rest**        | MongoDB Atlas encryption           |
| **Encryption in Transit**     | TLS 1.3 for all connections        |
| **Sensitive Data Encryption** | AES-256 for bank details, PII      |
| **Audit Logging**             | Complete trail of data changes     |

---

## 8. Supported Institution Types

Campus Verse adapts its data structure based on the type of educational institution:

### Schools (K-12)

```
Branch
  └── Grades (1, 2, 3, ... 12)
       └── Sections (A, B, C, D)
            └── Students
```

**Features Optimized For:**

- Grade-based progression
- Parent communication
- Activity tracking
- Report cards

### Colleges

```
Branch
  └── Streams (MPC, BiPC, CEC, MEC)
       └── Batches (2024-2026, 2025-2027)
            └── Students
```

**Features Optimized For:**

- Stream-based organization
- Batch management
- Inter-college transfers
- Competitive exam tracking

### Universities

```
Branch
  └── Departments (CSE, ECE, MECH, CIVIL)
       └── Years (1st, 2nd, 3rd, 4th)
            └── Sections (A, B)
                 └── Students
```

**Features Optimized For:**

- Department administration
- Semester system
- Credit tracking
- Research management

---

## Summary

Campus Verse provides educational institutions with a **complete, modern ERP solution** that:

- **Scales** from single-branch schools to multi-campus universities
- **Secures** sensitive student and financial data with enterprise-grade protection
- **Simplifies** administrative workflows through automation
- **Integrates** all institutional operations in a unified platform
- **Adapts** to specific institution types and requirements

The platform is built on proven technologies with a focus on reliability, performance, and user experience.

---

**Document Version:** 1.0
**Last Updated:** December 2024
**Platform Version:** Campus Verse ERP v1.0
