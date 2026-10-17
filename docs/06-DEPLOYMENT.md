# Campus Verse - Deployment Configuration

## 1. Docker Configuration

### Docker Compose (Development)

```yaml
# infrastructure/docker/docker-compose.yml
version: '3.8'

services:
  api:
    build:
      context: ../..
      dockerfile: apps/api/Dockerfile
      target: development
    ports:
      - '3001:3001'
    environment:
      - NODE_ENV=development
      - PORT=3001
      - MONGODB_URI=mongodb://mongo:27017/campus_verse?replicaSet=rs0
      - REDIS_URL=redis://redis:6379
      - JWT_ACCESS_SECRET=dev-access-secret-change-in-production
      - JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production
    volumes:
      - ../../apps/api/src:/app/apps/api/src
      - ../../packages:/app/packages
    depends_on:
      mongo:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: pnpm dev:api

  web:
    build:
      context: ../..
      dockerfile: apps/web/Dockerfile
      target: development
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=development
      - NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
    volumes:
      - ../../apps/web/src:/app/apps/web/src
      - ../../packages:/app/packages
    depends_on:
      - api
    command: pnpm dev:web

  mongo:
    image: mongo:7.0
    ports:
      - '27017:27017'
    volumes:
      - mongo_data:/data/db
      - ./mongo-init.js:/docker-entrypoint-initdb.d/init.js:ro
    command: mongod --replSet rs0 --bind_ip_all
    healthcheck:
      test: |
        mongosh --eval "try { rs.status().ok } catch(e) { rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: 'localhost:27017' }] }).ok }"
      interval: 10s
      timeout: 10s
      retries: 5
      start_period: 30s

  redis:
    image: redis:7.2-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 3s
      retries: 5

  # Optional: Redis Commander for debugging
  redis-commander:
    image: rediscommander/redis-commander:latest
    ports:
      - '8081:8081'
    environment:
      - REDIS_HOSTS=local:redis:6379
    depends_on:
      - redis
    profiles:
      - debug

volumes:
  mongo_data:
  redis_data:
```

### API Dockerfile

```dockerfile
# apps/api/Dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@8.14.0 --activate
WORKDIR /app

# Development stage
FROM base AS development
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile
COPY . .
EXPOSE 3001
CMD ["pnpm", "dev:api"]

# Build stage
FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build --filter=@campus-verse/api

# Production stage
FROM node:20-alpine AS production
RUN corepack enable && corepack prepare pnpm@8.14.0 --activate
WORKDIR /app

ENV NODE_ENV=production

# Copy built files
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3001
CMD ["node", "dist/index.js"]
```

### Web Dockerfile

```dockerfile
# apps/web/Dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@8.14.0 --activate
WORKDIR /app

# Development stage
FROM base AS development
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile
COPY . .
EXPOSE 3000
CMD ["pnpm", "dev:web"]

# Build stage
FROM base AS builder
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build --filter=@campus-verse/web

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
```

---

## 2. AWS Infrastructure (Terraform)

### Main Configuration

```hcl
# infrastructure/terraform/main.tf
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "campus-verse-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "ap-south-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "campus-verse"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# VPC
module "vpc" {
  source = "./modules/vpc"

  environment         = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
}

# ECS Cluster
module "ecs" {
  source = "./modules/ecs"

  environment        = var.environment
  vpc_id            = module.vpc.vpc_id
  private_subnets   = module.vpc.private_subnet_ids
  public_subnets    = module.vpc.public_subnet_ids

  api_image         = var.api_image
  web_image         = var.web_image

  api_cpu           = var.api_cpu
  api_memory        = var.api_memory
  api_desired_count = var.api_desired_count

  web_cpu           = var.web_cpu
  web_memory        = var.web_memory
  web_desired_count = var.web_desired_count

  mongodb_uri       = var.mongodb_uri
  redis_endpoint    = module.elasticache.redis_endpoint

  secrets_arn       = module.secrets.secrets_arn
}

# ElastiCache Redis
module "elasticache" {
  source = "./modules/elasticache"

  environment     = var.environment
  vpc_id         = module.vpc.vpc_id
  subnet_ids     = module.vpc.private_subnet_ids

  node_type      = var.redis_node_type
  num_cache_nodes = var.redis_num_nodes
}

# S3 for file storage
module "s3" {
  source = "./modules/s3"

  environment = var.environment
  bucket_name = var.s3_bucket_name
}

# CloudFront CDN
module "cloudfront" {
  source = "./modules/cloudfront"

  environment      = var.environment
  s3_bucket_domain = module.s3.bucket_domain_name
  alb_domain       = module.ecs.alb_dns_name
  domain_name      = var.domain_name
  certificate_arn  = var.acm_certificate_arn
}

# Secrets Manager
module "secrets" {
  source = "./modules/secrets"

  environment = var.environment
  secrets     = var.secrets
}
```

### Variables

```hcl
# infrastructure/terraform/variables.tf
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones"
  type        = list(string)
  default     = ["ap-south-1a", "ap-south-1b"]
}

variable "api_image" {
  description = "API Docker image"
  type        = string
}

variable "web_image" {
  description = "Web Docker image"
  type        = string
}

variable "api_cpu" {
  description = "API task CPU units"
  type        = number
  default     = 512
}

variable "api_memory" {
  description = "API task memory"
  type        = number
  default     = 1024
}

variable "api_desired_count" {
  description = "API desired task count"
  type        = number
  default     = 2
}

variable "web_cpu" {
  description = "Web task CPU units"
  type        = number
  default     = 256
}

variable "web_memory" {
  description = "Web task memory"
  type        = number
  default     = 512
}

variable "web_desired_count" {
  description = "Web desired task count"
  type        = number
  default     = 2
}

variable "mongodb_uri" {
  description = "MongoDB Atlas connection string"
  type        = string
  sensitive   = true
}

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_num_nodes" {
  description = "Number of Redis nodes"
  type        = number
  default     = 1
}

variable "s3_bucket_name" {
  description = "S3 bucket name for files"
  type        = string
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for HTTPS"
  type        = string
}

variable "secrets" {
  description = "Secrets to store in Secrets Manager"
  type        = map(string)
  sensitive   = true
}
```

### ECS Module

```hcl
# infrastructure/terraform/modules/ecs/main.tf
resource "aws_ecs_cluster" "main" {
  name = "campus-verse-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    base              = 1
    weight            = 100
    capacity_provider = "FARGATE"
  }
}

# API Service
resource "aws_ecs_task_definition" "api" {
  family                   = "campus-verse-api-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn           = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "api"
      image = var.api_image

      portMappings = [
        {
          containerPort = 3001
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "NODE_ENV", value = var.environment },
        { name = "PORT", value = "3001" },
        { name = "REDIS_URL", value = "redis://${var.redis_endpoint}:6379" }
      ]

      secrets = [
        { name = "MONGODB_URI", valueFrom = "${var.secrets_arn}:MONGODB_URI::" },
        { name = "JWT_ACCESS_SECRET", valueFrom = "${var.secrets_arn}:JWT_ACCESS_SECRET::" },
        { name = "JWT_REFRESH_SECRET", valueFrom = "${var.secrets_arn}:JWT_REFRESH_SECRET::" }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.api.name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "api"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:3001/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])
}

resource "aws_ecs_service" "api" {
  name            = "campus-verse-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnets
    security_groups  = [aws_security_group.api.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3001
  }

  deployment_configuration {
    maximum_percent         = 200
    minimum_healthy_percent = 100
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "campus-verse-${var.environment}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets           = var.public_subnets

  enable_deletion_protection = var.environment == "prod"
}

resource "aws_lb_target_group" "api" {
  name        = "cv-api-${var.environment}"
  port        = 3001
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher            = "200"
    path               = "/health"
    port               = "traffic-port"
    protocol           = "HTTP"
    timeout            = 5
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# Auto Scaling
resource "aws_appautoscaling_target" "api" {
  max_capacity       = 10
  min_capacity       = var.api_desired_count
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "api_cpu" {
  name               = "cpu-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 70.0
  }
}
```

---

## 3. Environment Configuration

### .env.example

```bash
# Application
NODE_ENV=development
PORT=3001
APP_URL=http://localhost:3000
API_URL=http://localhost:3001

# MongoDB
MONGODB_URI=mongodb://localhost:27017/campus_verse?replicaSet=rs0

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_ACCESS_SECRET=your-32-character-access-secret-key
JWT_REFRESH_SECRET=your-32-character-refresh-secret-key
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# AWS
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_S3_BUCKET=campus-verse-files-dev

# SMS Gateway (MSG91)
SMS_API_KEY=your-msg91-api-key
SMS_SENDER_ID=CAMPUS
SMS_DLT_TE_ID=your-dlt-template-id
SMS_ROUTE=4

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@campusverse.com

# Encryption
ENCRYPTION_KEY=your-32-byte-hex-encryption-key-here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=debug
```

---

## 4. GitHub Actions CI/CD

### .github/workflows/ci.yml

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm lint

  test:
    runs-on: ubuntu-latest
    services:
      mongodb:
        image: mongo:7.0
        ports:
          - 27017:27017
      redis:
        image: redis:7.2-alpine
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm test
        env:
          MONGODB_URI: mongodb://localhost:27017/campus_verse_test
          REDIS_URL: redis://localhost:6379
          JWT_ACCESS_SECRET: test-secret
          JWT_REFRESH_SECRET: test-refresh-secret

  build:
    runs-on: ubuntu-latest
    needs: [lint, test]
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm build
```

### .github/workflows/deploy.yml

```yaml
name: Deploy

on:
  push:
    branches: [main]

env:
  AWS_REGION: ap-south-1
  ECR_REPOSITORY_API: campus-verse-api
  ECR_REPOSITORY_WEB: campus-verse-web
  ECS_CLUSTER: campus-verse-prod
  ECS_SERVICE_API: campus-verse-api
  ECS_SERVICE_WEB: campus-verse-web

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push API image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY_API:$IMAGE_TAG \
            -t $ECR_REGISTRY/$ECR_REPOSITORY_API:latest \
            --target production \
            -f apps/api/Dockerfile .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY_API:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPOSITORY_API:latest

      - name: Build and push Web image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY_WEB:$IMAGE_TAG \
            -t $ECR_REGISTRY/$ECR_REPOSITORY_WEB:latest \
            --target production \
            --build-arg NEXT_PUBLIC_API_URL=${{ secrets.API_URL }} \
            -f apps/web/Dockerfile .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY_WEB:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPOSITORY_WEB:latest

      - name: Deploy to ECS
        run: |
          aws ecs update-service --cluster $ECS_CLUSTER --service $ECS_SERVICE_API --force-new-deployment
          aws ecs update-service --cluster $ECS_CLUSTER --service $ECS_SERVICE_WEB --force-new-deployment
```

---

## 5. Deployment Commands

### Development

```bash
# Start all services
docker-compose -f infrastructure/docker/docker-compose.yml up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down

# Reset database
docker-compose down -v
```

### Production

```bash
# Initialize Terraform
cd infrastructure/terraform
terraform init

# Plan changes
terraform plan -var-file=environments/prod/terraform.tfvars

# Apply changes
terraform apply -var-file=environments/prod/terraform.tfvars

# Force new deployment
aws ecs update-service --cluster campus-verse-prod --service campus-verse-api --force-new-deployment
```
