# IntelliStore — API Reference

All services share one response envelope:

```jsonc
// success
{ "success": true, "data": <payload> }
// error
{ "success": false, "error": { "code": "STRING_CODE", "message": "…", "details": <optional> } }
```

Authenticated routes expect `Authorization: Bearer <access token>`. Tokens are
issued by auth-service and verified locally by each service using the shared
`JWT_SECRET`, so any service accepts a token minted by auth-service.

Base URLs below are the local-dev defaults.

---

## auth-service — `http://localhost:4001`

| Method | Route | Auth | Body | Description |
| ------ | ----- | ---- | ---- | ----------- |
| POST | `/auth/register` | — | `{ email, password, displayName }` | Create account; returns `{ user, tokens }` |
| POST | `/auth/login` | — | `{ email, password }` | Verify credentials; returns `{ user, tokens }` |
| POST | `/auth/refresh` | — | `{ refreshToken }` | Exchange a refresh token for a new pair |
| GET | `/auth/me` | Bearer | — | Current user profile |
| GET | `/health` | — | — | Liveness |

`tokens` = `{ accessToken, refreshToken }`. Passwords are bcrypt-hashed;
refresh tokens carry a distinct `type` claim and are rejected on the access path.

---

## metadata-service — `http://localhost:4002`

All routes Bearer-authenticated. Files are scoped to the caller; another user's
file id returns 404 (not 403), so existence isn't leaked.

| Method | Route | Description |
| ------ | ----- | ----------- |
| POST | `/files` | Register a file + its first version and chunk list |
| GET | `/files` | List the caller's files, each with its latest version |
| GET | `/files/:id` | File detail with all versions |
| DELETE | `/files/:id` | Soft-delete a file |
| POST | `/files/:id/versions` | Add a new version (chunk list) to a file |
| GET | `/files/:id/versions/:versionNumber` | Version detail with its chunks |
| GET | `/files/_stats` | System-wide totals (files/versions/chunks/bytes) |
| GET | `/health` | Liveness |

Register/version body:

```jsonc
{
  "fileName": "report.pdf",           // POST /files only
  "mimeType": "application/pdf",
  "checksum": "<sha256 of whole file>",
  "chunks": [
    { "chunkIndex": 0, "sizeBytes": 1048576, "checksum": "<sha256>", "storageKey": "<key>" }
  ]
}
```

---

## storage-service — `http://localhost:4003`

All routes Bearer-authenticated. This is the service clients actually upload to
and download from; it chunks/hashes, persists chunk bytes to MinIO, and calls
metadata-service to register them (forwarding the caller's token).

| Method | Route | Description |
| ------ | ----- | ----------- |
| POST | `/files` (multipart, field `file`, optional `fileName`) | Chunk + store + register a new file |
| POST | `/files/:id/versions` (multipart, field `file`) | Chunk + store + register a new version |
| GET | `/files/:id/download` | Reassemble + integrity-check + download latest version |
| GET | `/files/:id/versions/:versionNumber/download` | Same for a specific version |
| GET | `/health` | Liveness |

Downloads set `Content-Disposition`, `Content-Type`, and an `X-File-Version`
header, and are verified against the stored whole-file checksum before the body
is sent.

---

## replication-service — `http://localhost:4004`

| Method | Route | Auth | Description |
| ------ | ----- | ---- | ----------- |
| GET | `/nodes` | Bearer | List simulated storage nodes with health + usage |
| GET | `/diagnostics` | Bearer | Node health counts + under-replicated chunk count |
| GET | `/chunks/:chunkId/replicas` | Bearer | Replicas recorded for a chunk |
| POST | `/nodes/:name/heartbeat` | — (see note) | Record a node heartbeat |
| GET | `/health` | — | Liveness |

The heartbeat endpoint is intentionally unauthenticated: a storage node has no
user identity to present. In production it would sit behind network-level
restriction (node subnet / mTLS) rather than a user JWT.

---

## ai-analytics-service — `http://localhost:4005`

All routes Bearer-authenticated. A backend-for-frontend that composes
metadata-service + replication-service data and adds hot/cold scoring.

| Method | Route | Description |
| ------ | ----- | ----------- |
| GET | `/analytics/files` | Caller's files with temperature score/tier/recommendation, coldest first |
| GET | `/analytics/overview` | Storage totals, node health, hot/cold breakdown, system recommendations |
| GET | `/health` | Liveness |

Temperature payload per file:

```jsonc
{
  "fileId": "…", "fileName": "…", "sizeBytes": 4000,
  "accessCount": 5, "lastAccessedAt": "2026-…Z",
  "temperature": { "score": 77, "tier": "hot", "recommendation": "…" }
}
```

Scoring is a deterministic heuristic (recency half-life decay weighted 0.7 +
capped access frequency weighted 0.3), not a trained model — see
[ARCHITECTURE](./ARCHITECTURE.md#design-decisions--rationale).

---

## notification-service — `http://localhost:4006`

All routes Bearer-authenticated and owner-scoped. Notifications are created by
consuming domain events (file uploaded / downloaded) off the RabbitMQ topic
exchange, so this service reacts independently of replication and analytics.

| Method | Route | Description |
| ------ | ----- | ----------- |
| GET | `/notifications` | Caller's notifications (newest first) + `unreadCount` |
| POST | `/notifications/:id/read` | Mark one notification read |
| POST | `/notifications/read-all` | Mark all the caller's notifications read |
| GET | `/health` | Liveness |

## api-gateway — `http://localhost:4000`

The single public origin. Proxies to every service under a prefix
(`/api/auth`, `/api/files`, `/api/storage`, `/api/replication`,
`/api/analytics`, `/api/notifications`), applies rate limiting on `/api/*`, and
exposes `GET /health/services` (aggregate upstream health). The frontend talks
only to this origin. See [ARCHITECTURE](./ARCHITECTURE.md).
