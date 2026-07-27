# IntelliStore — AI-Powered Distributed Storage Platform

A production-grade distributed storage platform inspired by Dropbox and Amazon S3,
enhanced with AI-driven storage optimization (hot/cold prediction, tiering
recommendations). Built as a microservices system to demonstrate distributed
systems, cloud-native architecture, and production engineering practices.

> Status: **Milestone 10 — Kubernetes deployment.** The whole platform (8
> services + web + Postgres/Redis/RabbitMQ/MinIO) runs on Kubernetes, verified
> end-to-end on minikube. The API gateway and notification service remain
> health-check-only skeletons.

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

# 5. Run pending database migrations
npm run migrate --workspace=@intellistore/auth-service
npm run migrate --workspace=@intellistore/metadata-service
npm run migrate --workspace=@intellistore/replication-service
npm run migrate --workspace=@intellistore/ai-analytics-service

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

### Metadata service endpoints

All routes require `Authorization: Bearer <access token>` issued by auth-service
(services share `JWT_SECRET`, so tokens verify across services without a network call).

| Method | Route                              | Description                              |
| ------ | ----------------------------------- | ----------------------------------------- |
| POST   | `/files`                            | Register a file + its first version/chunks |
| GET    | `/files`                            | List the caller's files with latest version |
| GET    | `/files/:id`                        | File detail with all versions             |
| DELETE | `/files/:id`                        | Soft-delete a file                        |
| POST   | `/files/:id/versions`               | Add a new version (chunks) to a file      |
| GET    | `/files/:id/versions/:versionNumber`| Version detail with its chunks            |
| GET    | `/files/_stats`                     | System-wide totals (files/versions/chunks/bytes), consumed by ai-analytics-service |

### Storage service endpoints (chunk upload pipeline)

Requires `Authorization: Bearer <access token>`. Splits uploads into fixed-size
chunks (`CHUNK_SIZE_BYTES`, default 4 MiB), hashes each chunk and the whole file
(SHA-256), writes chunks through a `StorageBackend` interface, and registers the
result with metadata-service by forwarding the caller's token. Download
reassembles chunks in order and re-verifies the whole-file checksum before
responding.

Chunk bytes are stored in MinIO (`STORAGE_BACKEND=minio`, the default — the
bucket named `MINIO_BUCKET` is created automatically on startup if missing).
Set `STORAGE_BACKEND=local` to fall back to a filesystem backend under
`STORAGE_DATA_DIR` (useful in environments without Docker, e.g. CI). Both
implement the same `StorageBackend` interface, so upload/download logic never
changes when swapping backends.

| Method | Route                                          | Description                        |
| ------ | ----------------------------------------------- | ----------------------------------- |
| POST   | `/files` (multipart, field `file`)              | Chunk + store + register a new file |
| POST   | `/files/:id/versions` (multipart, field `file`) | Chunk + store + register a new version |
| GET    | `/files/:id/download`                           | Reassemble and download the latest version |
| GET    | `/files/:id/versions/:versionNumber/download`   | Reassemble and download a specific version |

After a successful upload, storage-service publishes a `chunk-uploads` message
to RabbitMQ (fire-and-forget — publish failures are logged, not surfaced to the
caller, since the chunk is already durably stored and registered). This is
consumed by replication-service to drive replication asynchronously.

### Replication service (replica manager)

Consumes the `chunk-uploads` queue from RabbitMQ. For each chunk, copies the
object from the primary bucket to `REPLICATION_FACTOR` additional storage
nodes (default 2, chosen as the least-used healthy nodes) via MinIO's
server-side `copyObject`, and records one `chunk_replicas` row per target node.

**Simulated topology**: this project runs a single MinIO container, so "nodes"
are simulated as separate buckets (`intellistore-node-1/2/3`) rather than
physically distinct servers — a deliberate simplification given the available
infra. The replica-tracking model (`storage_nodes`, `chunk_replicas`,
least-used node selection, per-node failure isolation) is written so that
swapping in real distinct MinIO/S3 endpoints per node would only require
changing `NodeStorage`'s configuration, not the replication logic itself.

Requires `Authorization: Bearer <access token>` (any authenticated user — this
data isn't per-owner).

| Method | Route                              | Description                          |
| ------ | ----------------------------------- | ------------------------------------- |
| GET    | `/nodes`                            | List simulated storage nodes and usage |
| GET    | `/diagnostics`                      | Node health + under-replicated chunk counts (consumed by ai-analytics-service) |
| GET    | `/chunks/:chunkId/replicas`         | List replicas recorded for a chunk    |

### Node heartbeat monitoring

Two complementary mechanisms keep `storage_nodes.is_healthy` accurate:

- **Push**: each node calls `POST /nodes/:name/heartbeat` (intentionally
  unauthenticated — a storage node has no user identity to present; in
  production this would sit behind network-level restriction rather than a
  user JWT) to report itself alive. `scripts/node-agent.ts` simulates this —
  run `npm run simulate:node --workspace=@intellistore/replication-service`
  with `NODE_NAME=node-1|node-2|node-3` to simulate one node's agent.
- **Pull**: a background sweep (`HeartbeatMonitor`, every
  `HEARTBEAT_SWEEP_INTERVAL_MS`) marks any node unhealthy once it's gone
  longer than `HEARTBEAT_STALE_MS` without a heartbeat.

`ReplicationService` already only selects from `listHealthy()` (milestone 6),
so a node that stops heartbeating is automatically excluded from new replica
placement — verified live by running agents for only 2 of the 3 nodes,
watching the third go unhealthy after the staleness window, and confirming a
subsequent upload's replicas landed only on the two healthy nodes.

### Self-healing replication

`SelfHealingService` runs a reconciliation loop every `SELF_HEALING_INTERVAL_MS`
— the same control-loop pattern Kubernetes controllers use (continuously
compare actual vs. desired state, converge, repeat), rather than reacting only
once to a node's health transition:

1. **Mark-lost pass**: any replica sitting on a currently-unhealthy node (and
   not already marked `lost`) is marked `lost` — it can no longer be trusted.
2. **Reconcile pass**: `listUnderReplicated(REPLICATION_FACTOR)` finds *every*
   chunk whose synced-replica count has fallen short, regardless of when or
   why, and calls `ReplicationService.healChunk` to place new replicas on
   healthy nodes that don't already have one.

Splitting it this way (re-check real counts every sweep, not just newly-changed
ones) is what makes healing retry a chunk it couldn't repair immediately —
found live during testing: with 2 of 3 nodes down, a chunk's only healthy
target already held a replica, so the first sweep had nowhere to place a new
copy and left it under-replicated. Because the reconciliation pass re-scans
`listUnderReplicated` on every tick rather than only when a node's health
just changed, the very next sweep after a node came back online picked it
back up and healed it — no special-casing required. Verified live end-to-end,
including confirming the healed replica's bytes in the new node's MinIO
bucket match the original checksum.

### AI storage analytics dashboard

`ai-analytics-service` is a small BFF (backend-for-frontend): it composes data
from metadata-service (`/files/_stats`, `/files`) and replication-service
(`/nodes`, `/diagnostics`) rather than reading their databases directly, and
owns one table of its own — `file_access_stats` — populated by consuming a
`file-access-events` queue that storage-service publishes to on every
successful download (fire-and-forget, same pattern as `chunk-uploads`).

**Hot/cold scoring is a deterministic heuristic, not a trained model** —
worth being explicit about, since "AI" is easy to oversell. `scoreFileTemperature`
(`src/scoring/temperature-scoring.ts`) combines two engineered features:

- **Recency**: exponential half-life decay (`RECENCY_HALF_LIFE_DAYS`, default
  14) — a file's recency contribution is exactly half at one half-life,
  `100 × 0.5^(daysSinceAccess / halfLife)`.
- **Frequency**: access count capped and normalized to 0-100 (`FREQUENCY_CAP`).

Weighted 0.7 recency / 0.3 frequency into a 0-100 score, thresholded into
`hot`/`cold` (`HOT_THRESHOLD`). Recency is weighted higher deliberately: a file
hit hard months ago but untouched since is a better cold-storage candidate
than one accessed a few times today — the same class of feature engineering
behind real systems like S3 Intelligent-Tiering, not a claim of ML sophistication.
A brand-new, never-accessed file gets a distinct "too new to classify
confidently" recommendation rather than being called cold outright.

The overview endpoint also turns replication-service's diagnostics into plain
recommendations (node over 80% capacity, chunks under-replicated, nodes
unhealthy) alongside the per-file hot/cold breakdown.

Requires `Authorization: Bearer <access token>`.

| Method | Route                  | Description                                          |
| ------ | ---------------------- | ----------------------------------------------------- |
| GET    | `/analytics/files`     | Caller's files with temperature score, tier, and a recommendation, coldest first |
| GET    | `/analytics/overview`  | Storage totals, node health, hot/cold breakdown, system-level recommendations |

Verified live: uploaded two files, downloaded one 5 times and left the other
untouched, and confirmed the accessed file scored hot (77, "keep on hot
storage") while the untouched one scored 0 ("too new to classify
confidently"), with `/analytics/overview` reflecting exact real totals (files,
bytes, per-node usage matching actual replica placement, correct hot/cold
counts).

### Frontend dashboard (apps/web)

A working (not just scaffolded) Next.js frontend: register/login pages
storing the JWT in `localStorage`, an auth guard that redirects `/dashboard`
to `/login` when logged out, and a dashboard rendering live data from
metadata/replication/ai-analytics-service — storage totals, per-node capacity
bars with health badges, system recommendations, and a file table with
hot/cold badges, scores, and per-file recommendations. File downloads go
through an authenticated `fetch` + blob (a plain `<a href>` can't carry the
Authorization header the storage-service requires). Verified live in-browser:
registered an account, landed on the dashboard with real data, confirmed the
logout → auth-guard-redirect round trip, and confirmed zero console errors.

## Kubernetes deployment

Every service (8 backends + the web frontend) has a multi-stage Dockerfile, and
`infra/k8s/` holds the full manifest set (rendered/applied with Kustomize):

- **Infra**: Postgres as a `StatefulSet` with a `volumeClaimTemplate`; Redis,
  RabbitMQ, and MinIO as `Deployment`s (MinIO with its own PVC). Each has
  readiness/liveness probes.
- **Config**: one `ConfigMap` (non-secret settings, in-cluster service DNS
  names) and one `Secret` (credentials/JWT secrets — dev defaults here, sourced
  from a real secrets manager in production) that every service consumes via
  `envFrom`.
- **Services**: a `Deployment` + `ClusterIP` `Service` each, with `/health`
  probes (the web app probes `/`), resource requests/limits, and
  `imagePullPolicy: IfNotPresent` (images are loaded straight into the node).
- **Migrations**: one `Job` per service that owns a schema, running the compiled
  migration runner with `backoffLimit` (so a job that starts before Postgres is
  ready simply retries) and `ttlSecondsAfterFinished` for auto-cleanup.
- **node-agents**: a small `Deployment` that posts heartbeats for the three
  simulated storage nodes, so replication/self-healing has live nodes to work
  with in-cluster.

```bash
# Build all images (this project uses the legacy builder; BuildKit had a
# path-handling issue under Git Bash on Windows).
DOCKER_BUILDKIT=0 docker build -f services/auth-service/Dockerfile -t intellistore/auth-service:local .
# ...repeat per service, and apps/web/Dockerfile -> intellistore/web:local

# Load images into the cluster (minikube) and deploy.
minikube image load intellistore/auth-service:local   # ...per image
kubectl apply -k infra/k8s
kubectl -n intellistore get pods
```

**Gotcha worth calling out** (caught during deployment): for a `Service` named
`auth-service`, Kubernetes injects a legacy Docker-link env var
`AUTH_SERVICE_PORT=tcp://<clusterIP>:4001`, which collided with this project's
own `AUTH_SERVICE_PORT` (the numeric listen port) and crash-looped every
service. Fix: `enableServiceLinks: false` on the pod specs — discovery is done
via DNS, so those link vars were dead weight anyway.

Verified end-to-end on minikube: all 16 pods `Running` and all 4 migration Jobs
`Complete`, then a full pipeline run through the cluster — register (→ k8s
Postgres), an ai-analytics overview fanning out to metadata + replication over
in-cluster DNS, and an upload that chunked to MinIO, registered metadata,
published to RabbitMQ, got replicated to two node buckets by
replication-service, and downloaded back byte-for-byte identical.

> **Note on the frontend in k8s**: `NEXT_PUBLIC_*` URLs are inlined into the
> browser bundle at build time and must be *browser*-reachable, not in-cluster
> DNS. The image bakes in `localhost:<port>` defaults, so browser access works
> when services are `kubectl port-forward`ed to their standard ports; a real
> deployment would put everything behind one ingress/gateway origin and rebuild
> with that URL.

## Engineering standards

- Clean Architecture / Repository Pattern per service
- Strict TypeScript across the monorepo (`tsconfig.base.json`)
- Centralized env validation, structured logging, consistent error handling
- Each milestone is independently runnable and tested before the next begins

## Milestones

1. **Monorepo scaffold** — workspaces, shared packages, service skeletons, infra compose *(done)*
2. **JWT authentication service** — register/login/refresh/me, bcrypt hashing, Postgres repository *(done)*
3. **Metadata service for file tracking** — files/versions/chunks, cross-service JWT verification *(done)*
4. **Chunk upload pipeline** — storage-service splits/hashes/stores chunks, calls metadata-service, reassembles on download *(done)*
5. **MinIO object storage integration** — real S3-compatible backend behind the `StorageBackend` interface, auto-created bucket *(done)*
6. **Replica manager** — RabbitMQ-driven replication to simulated storage nodes, least-used node selection, per-node failure isolation *(done)*
7. **Distributed node heartbeat monitoring** — push heartbeats + a staleness sweep, unhealthy nodes automatically excluded from replication *(done)*
8. **Automatic self-healing replication** — reconciliation loop restores under-replicated chunks, retries across sweeps until a healthy node is available *(done)*
9. **AI storage analytics dashboard** — deterministic hot/cold scoring heuristic, cross-service overview, and a real Next.js dashboard (not just the milestone-1 landing page) *(done)*
10. **Kubernetes deployment** — Dockerfiles for all services + web, k8s manifests (Deployments/Services/StatefulSet/ConfigMap/Secret/Jobs), deployed and verified end-to-end on minikube *(this milestone)*
11. Architecture and deployment documentation
