# Campus Verse - Technology Stack

## 1. Backend Technologies

### Runtime & Framework

```
Node.js: v20+ LTS
Express.js: ^4.18.0
TypeScript: ^5.3.0
```

### Database

```
MongoDB: 7.0+ (via mongodb native driver ^6.3.0)
NOTE: Do NOT use Mongoose - use native MongoDB driver only
```

### Caching & Queue

```
Redis: 7.0+ (via ioredis ^5.3.0)
BullMQ: ^5.0.0 (for background jobs)
```

### Backend Dependencies (package.json)

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "mongodb": "^6.3.0",
    "ioredis": "^5.3.2",
    "bullmq": "^5.1.0",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "zod": "^3.22.4",
    "nanoid": "^5.0.4",
    "dayjs": "^1.11.10",
    "pino": "^8.17.2",
    "pino-pretty": "^10.3.1",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.1.5",
    "rate-limit-redis": "^4.2.0",
    "multer": "^1.4.5-lts.1",
    "multer-s3": "^3.0.1",
    "@aws-sdk/client-s3": "^3.478.0",
    "@aws-sdk/client-sqs": "^3.478.0",
    "@aws-sdk/s3-request-presigner": "^3.478.0",
    "nodemailer": "^6.9.7",
    "pdfkit": "^0.14.0",
    "exceljs": "^4.4.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.6",
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/cors": "^2.8.17",
    "@types/multer": "^1.4.11",
    "typescript": "^5.3.3",
    "tsx": "^4.7.0",
    "vitest": "^1.1.1",
    "supertest": "^6.3.3",
    "@types/supertest": "^6.0.2"
  }
}
```

## 2. Frontend Technologies

### Framework & UI

```
Next.js: 14+ (App Router)
React: ^18.2.0
Tailwind CSS: ^3.4.0
shadcn/ui: latest components
```

### State Management

```
Zustand: ^4.4.7 (client state)
TanStack Query: ^5.17.0 (server state)
```

### Frontend Dependencies (package.json)

```json
{
  "dependencies": {
    "next": "^14.0.4",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.4.7",
    "@tanstack/react-query": "^5.17.0",
    "@tanstack/react-table": "^8.11.2",
    "react-hook-form": "^7.49.2",
    "@hookform/resolvers": "^3.3.3",
    "zod": "^3.22.4",
    "axios": "^1.6.4",
    "date-fns": "^3.2.0",
    "recharts": "^2.10.3",
    "lucide-react": "^0.303.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-toast": "^1.1.5",
    "@radix-ui/react-tooltip": "^1.0.7",
    "cmdk": "^0.2.0",
    "sonner": "^1.3.1"
  },
  "devDependencies": {
    "@types/node": "^20.10.6",
    "@types/react": "^18.2.46",
    "@types/react-dom": "^18.2.18",
    "typescript": "^5.3.3",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.33",
    "autoprefixer": "^10.4.16",
    "eslint": "^8.56.0",
    "eslint-config-next": "^14.0.4",
    "@playwright/test": "^1.40.1"
  }
}
```

## 3. Infrastructure

### AWS Services

```
ECS Fargate      - Container orchestration
MongoDB Atlas    - Managed MongoDB (AWS region)
ElastiCache      - Managed Redis
S3               - File storage
CloudFront       - CDN
SQS              - Production job queue
CloudWatch       - Monitoring & logs
Secrets Manager  - Credentials storage
```

### Development Tools

```
Docker           - Containerization
Docker Compose   - Local development
Turborepo        - Monorepo management
pnpm             - Package manager
ESLint           - Linting
Prettier         - Code formatting
Husky            - Git hooks
```

## 4. Development Environment Setup

### Prerequisites

```bash
# Required
Node.js 20+
pnpm 8+
Docker & Docker Compose
MongoDB (local or Atlas)
Redis (local or cloud)
```

### Initial Setup Commands

```bash
# Clone and install
git clone <repo>
cd campus-verse
pnpm install

# Start infrastructure
docker-compose up -d mongo redis

# Setup environment
cp .env.example .env
# Edit .env with your values

# Run database setup
pnpm db:indexes
pnpm db:seed

# Start development
pnpm dev
```

## 5. Environment Variables

```bash
# .env.example

# App
NODE_ENV=development
PORT=3001
APP_URL=http://localhost:3000
API_URL=http://localhost:3001

# MongoDB
MONGODB_URI=mongodb://localhost:27017/campus_verse

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_ACCESS_SECRET=your-access-secret-min-32-chars-long
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars-long
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# AWS
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=campus-verse-dev-files

# SMS Gateway (MSG91 example)
SMS_API_KEY=your-sms-api-key
SMS_SENDER_ID=CAMPUS
SMS_DLT_TE_ID=your-dlt-template-id

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
EMAIL_FROM=noreply@campusverse.com

# Encryption (for sensitive data like bank details)
ENCRYPTION_KEY=your-32-byte-hex-encryption-key

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=debug
```

## 6. Docker Compose (Development)

```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    ports:
      - '3001:3001'
    environment:
      - NODE_ENV=development
      - PORT=3001
      - MONGODB_URI=mongodb://mongo:27017/campus_verse
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./apps/api/src:/app/apps/api/src
      - ./packages:/app/packages
    depends_on:
      - mongo
      - redis
    command: pnpm dev:api

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=development
      - NEXT_PUBLIC_API_URL=http://localhost:3001
    volumes:
      - ./apps/web/src:/app/apps/web/src
      - ./packages:/app/packages
    depends_on:
      - api
    command: pnpm dev:web

  mongo:
    image: mongo:7.0
    ports:
      - '27017:27017'
    volumes:
      - mongo_data:/data/db
    command: mongod --replSet rs0
    healthcheck:
      test: echo 'rs.initiate()' | mongosh --quiet
      interval: 5s
      timeout: 30s
      retries: 30

  redis:
    image: redis:7.2-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

volumes:
  mongo_data:
  redis_data:
```

## 7. Turborepo Configuration

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "test": {
      "dependsOn": ["build"]
    },
    "test:unit": {},
    "test:e2e": {
      "dependsOn": ["build"]
    }
  }
}
```

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

```json
// Root package.json
{
  "name": "campus-verse",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "dev:api": "turbo dev --filter=@campus-verse/api",
    "dev:web": "turbo dev --filter=@campus-verse/web",
    "build": "turbo build",
    "test": "turbo test",
    "test:unit": "turbo test:unit",
    "test:e2e": "turbo test:e2e",
    "lint": "turbo lint",
    "db:seed": "tsx infrastructure/scripts/seed-db.ts",
    "db:indexes": "tsx infrastructure/scripts/create-indexes.ts"
  },
  "devDependencies": {
    "turbo": "^1.11.2",
    "tsx": "^4.7.0"
  },
  "packageManager": "pnpm@8.14.0"
}
```
