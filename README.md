# IntelliStore — AI-Powered Distributed Storage Platform

A production-grade distributed storage platform inspired by Dropbox and Amazon S3,
enhanced with AI-driven storage optimization (hot/cold prediction, tiering
recommendations). Built as a microservices system to demonstrate distributed
systems, cloud-native architecture, and production engineering practices.

> Status: **Milestone 2 — JWT authentication service.** Remaining services are
> still health-check-only skeletons; business logic lands in subsequent milestones.

## Architecture

```
                              ┌──────────────┐
                              │   Next.js    │
                              │   Dashboard  │
                              └──────┬───────┘
                                     │
                              ┌──────▼───────┐
                              │ API Gateway  │
                              └──────┬───────┘
             ┌───────────┬──────────┼──────────┬───────────┬────────────┐
             │           │          │          │           │            │
        ┌────▼───┐  ┌────▼────┐┌───▼────┐┌────▼─────┐┌────▼─────┐┌─────▼──────┐
        │  Auth  │  │Metadata ││Storage ││Replication││AI        ││Notification│
        │Service │  │Service  ││Service ││Service    ││Analytics ││Service     │
        └────┬───┘  └────┬────┘└───┬────┘└────┬──────┘└────┬─────┘└─────┬──────┘
             │           │         │          │            │            │
        ┌────▼───────────▼─────────▼──────────▼────────────▼────────────▼─────┐
        │         PostgreSQL · Redis · RabbitMQ · MinIO (S3-compatible)        │
        └────────────────────────────────────────────────────────────────────┘
```

## Repository layout

```
IntelliStore/
├── apps/
│   └── web/                    # Next.js + TypeScript + Tailwind dashboard
├── services/
│   ├── api-gateway/            # Single entry point, routing, rate limiting
│   ├── auth-service/           # JWT auth, users, sessions
│   ├── metadata-service/       # File/chunk metadata, versioning
│   ├── storage-service/        # Chunking, MinIO object storage
│   ├── replication-service/    # Replica management, self-healing
│   ├── ai-analytics-service/   # Storage analytics, hot/cold prediction
│   └── notification-service/   # Email/websocket notifications
├── packages/
│   ├── shared-logger/          # Structured logging (pino)
│   ├── shared-types/           # Cross-service TypeScript types
│   └── shared-config/          # Env var loading + validation (zod)
├── infra/
│   ├── docker/                 # Per-service Dockerfiles (if not co-located)
│   └── k8s/                    # Kubernetes manifests (later milestone)
├── docker-compose.yml          # Local infra: Postgres, Redis, RabbitMQ, MinIO
└── .env.example
```

## Prerequisites

- Node.js >= 20
- Docker Desktop (for Postgres, Redis, RabbitMQ, MinIO)

## Getting started

```bash
# 1. Install dependencies for every workspace
npm install

# 2. Copy environment variables
cp .env.example .env

# 3. Start infra dependencies
docker compose up -d

# 4. Build all workspaces (type-check + compile)
npm run build

# 5. Run pending database migrations (auth-service)
npm run migrate --workspace=@intellistore/auth-service

# 6. Run an individual service in dev mode
npm run dev --workspace=services/auth-service

# 7. Run the frontend
npm run dev --workspace=apps/web
```

### Auth service endpoints

| Method | Route            | Auth           | Description                      |
| ------ | ---------------- | -------------- | -------------------------------- |
| POST   | `/auth/register` | —              | Create an account, returns JWTs  |
| POST   | `/auth/login`    | —              | Verify credentials, returns JWTs |
| POST   | `/auth/refresh`  | —              | Exchange a refresh token         |
| GET    | `/auth/me`       | Bearer access  | Current user profile             |

## Engineering standards

- Clean Architecture / Repository Pattern per service
- Strict TypeScript across the monorepo (`tsconfig.base.json`)
- Centralized env validation, structured logging, consistent error handling
- Each milestone is independently runnable and tested before the next begins

## Milestones

1. **Monorepo scaffold** — workspaces, shared packages, service skeletons, infra compose *(done)*
2. **JWT authentication service** — register/login/refresh/me, bcrypt hashing, Postgres repository *(this milestone)*
3. Metadata service for file tracking
4. Chunk upload pipeline
5. MinIO object storage integration
6. Replica manager
7. Distributed node heartbeat monitoring
8. Automatic self-healing replication
9. AI storage analytics dashboard
10. Kubernetes deployment
11. Architecture and deployment documentation
