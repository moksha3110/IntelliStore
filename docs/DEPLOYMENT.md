# IntelliStore — Deployment & Operations Guide

Three ways to run IntelliStore, smallest to largest:

1. [Local development](#1-local-development) — infra in Docker, services via `npm`
2. [Docker images](#2-building-docker-images) — build the container images
3. [Kubernetes](#3-kubernetes-minikube) — full cluster deploy on minikube

Plus [environment variables](#environment-variables), [migrations](#database-migrations),
and [troubleshooting](#troubleshooting).

## Prerequisites

- Node.js >= 20
- Docker Desktop
- For the Kubernetes path: `kubectl` and `minikube`

## 1. Local development

```bash
npm install
cp .env.example .env

# Start infra (Postgres, Redis, RabbitMQ, MinIO)
docker compose up -d

# Build shared packages + everything (ordered so packages build first)
npm run build

# Run pending migrations
npm run migrate --workspace=@intellistore/auth-service
npm run migrate --workspace=@intellistore/metadata-service
npm run migrate --workspace=@intellistore/replication-service
npm run migrate --workspace=@intellistore/ai-analytics-service

# Run a service (repeat per service, each in its own terminal)
npm run dev --workspace=@intellistore/auth-service
# ...auth 4001, metadata 4002, storage 4003, replication 4004, ai-analytics 4005

# Frontend
npm run dev --workspace=@intellistore/web   # http://localhost:3000
```

To watch heartbeats/self-healing do something locally, run node agents (one per
node) so the simulated nodes stay healthy:

```bash
NODE_NAME=node-1 npm run simulate:node --workspace=@intellistore/replication-service
NODE_NAME=node-2 npm run simulate:node --workspace=@intellistore/replication-service
NODE_NAME=node-3 npm run simulate:node --workspace=@intellistore/replication-service
```

`STORAGE_BACKEND=local` in `.env` swaps MinIO for a filesystem backend if you
want to run storage-service without MinIO.

## 2. Building Docker images

Every service and the web app has a multi-stage Dockerfile.

```bash
# NOTE: use the legacy builder. BuildKit hit a "invalid file request" /
# "unexpected EOF" path-handling issue under Git Bash on Windows; the classic
# builder is reliable there.
export DOCKER_BUILDKIT=0

docker build -f services/auth-service/Dockerfile        -t intellistore/auth-service:local .
docker build -f services/metadata-service/Dockerfile    -t intellistore/metadata-service:local .
docker build -f services/storage-service/Dockerfile     -t intellistore/storage-service:local .
docker build -f services/replication-service/Dockerfile -t intellistore/replication-service:local .
docker build -f services/ai-analytics-service/Dockerfile -t intellistore/ai-analytics-service:local .
docker build -f services/api-gateway/Dockerfile         -t intellistore/api-gateway:local .
docker build -f services/notification-service/Dockerfile -t intellistore/notification-service:local .
docker build -f apps/web/Dockerfile                     -t intellistore/web:local .
```

Backend services build to a slim `node:20-alpine` runtime containing only
`dist/`, `node_modules`, and (for schema-owning services) `migrations/`. The web
image uses Next.js standalone output.

## 3. Kubernetes (minikube)

```bash
minikube start --driver=docker

# Load the locally-built images into the cluster's runtime
for img in auth-service metadata-service storage-service replication-service \
           ai-analytics-service api-gateway notification-service web; do
  minikube image load "intellistore/$img:local"
done

# Deploy everything (namespace, config, infra, services, migration jobs)
kubectl apply -k infra/k8s

# Watch it come up
kubectl -n intellistore get pods -w
```

Expected end state: all app/infra pods `Running`, all four `migrate-*` Jobs
`Complete`.

### Accessing services

Services are `ClusterIP` (internal). Port-forward what you want to reach:

```bash
kubectl -n intellistore port-forward svc/web 3000:3000
kubectl -n intellistore port-forward svc/auth-service 4001:4001
kubectl -n intellistore port-forward svc/ai-analytics-service 4005:4005
# ...etc
```

> **Frontend caveat:** `NEXT_PUBLIC_*` URLs are compiled into the browser bundle
> at build time and must be *browser*-reachable, not in-cluster DNS. The image
> bakes in `localhost:<port>` defaults, so the dashboard works when each backend
> service is port-forwarded to its standard port. A production deployment would
> route everything through a single ingress/gateway origin and build the web
> image with that origin baked in.

### Manifest layout

```
infra/k8s/
├── namespace.yaml
├── config.yaml              # ConfigMap + Secret
├── kustomization.yaml       # ties it all together (kubectl apply -k)
├── infra/                   # postgres (StatefulSet), redis, rabbitmq, minio
├── services/                # Deployment + Service per app service, web, node-agents
└── jobs/                    # one migration Job per schema-owning service
```

## Environment variables

Full list with defaults in [`.env.example`](../.env.example). Grouped:

| Group | Vars |
| ----- | ---- |
| Postgres | `POSTGRES_HOST/PORT/USER/PASSWORD/DB` |
| Redis | `REDIS_HOST/PORT` |
| RabbitMQ | `RABBITMQ_HOST/PORT/USER/PASSWORD` |
| MinIO | `MINIO_ENDPOINT/PORT/ROOT_USER/ROOT_PASSWORD/BUCKET/USE_SSL` |
| JWT | `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` |
| Service ports | `AUTH_SERVICE_PORT` … `NOTIFICATION_SERVICE_PORT` |
| storage-service | `METADATA_SERVICE_URL`, `CHUNK_SIZE_BYTES`, `MAX_UPLOAD_SIZE_BYTES`, `STORAGE_BACKEND`, `CHUNK_UPLOADS_QUEUE`, `FILE_ACCESS_QUEUE` |
| replication-service | `REPLICATION_FACTOR`, `HEARTBEAT_STALE_MS`, `HEARTBEAT_SWEEP_INTERVAL_MS`, `SELF_HEALING_INTERVAL_MS` |
| ai-analytics-service | `REPLICATION_SERVICE_URL`, `RECENCY_HALF_LIFE_DAYS`, `FREQUENCY_CAP`, `HOT_THRESHOLD`, `COLD_AGE_THRESHOLD_DAYS` |
| web (build-time) | `NEXT_PUBLIC_*_SERVICE_URL` |

In Kubernetes these come from the `intellistore-config` ConfigMap and
`intellistore-secrets` Secret (`infra/k8s/config.yaml`).

## Database migrations

Each schema-owning service has a small custom migration runner (`src/db/migrate.ts`):
it tracks applied files in a `schema_migrations` table and applies any new
`migrations/*.sql` in order, each in a transaction. Idempotent — safe to re-run.

- **Local:** `npm run migrate --workspace=@intellistore/<service>`
- **Kubernetes:** the `migrate-*` Jobs run automatically on `apply`. Re-running
  requires deleting the completed Job first (`kubectl -n intellistore delete job migrate-<service>`)
  since a Job's pod template is immutable.

## Troubleshooting

**All services crash-loop on k8s with `AUTH_SERVICE_PORT must be a number, got "tcp://..."`.**
Kubernetes injects legacy Docker-link env vars (`<SERVICE>_PORT=tcp://ip:port`)
for every Service, colliding with this app's own `<SERVICE>_PORT` listen-port
vars. Fixed in the manifests with `enableServiceLinks: false` on the pod specs;
if you add a new service, include that field.

**`docker build` fails with "invalid file request Dockerfile" / "unexpected EOF".**
BuildKit path handling under Git Bash on Windows. Prefix builds with
`DOCKER_BUILDKIT=0`.

**Migration Job shows one `Error` pod then a `Complete` one.**
Expected: the Job started before Postgres was ready, exited non-zero, and
`backoffLimit` retried it to success.

**Nodes show unhealthy in `/nodes` or the dashboard.**
No heartbeats are arriving. Locally, run the `simulate:node` agents; in k8s the
`node-agents` Deployment does this — check it's `Running`.

**`kubectl` points at the wrong cluster.**
Always confirm before applying: `kubectl config current-context` should be
`minikube`. (This repo was developed on a machine that also had an AWS EKS
context configured — never `apply` against the wrong one.)
