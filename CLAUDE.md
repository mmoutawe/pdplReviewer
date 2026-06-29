# PDPL Reviewer — Project Context for Claude Code

## What this app is
A PDPL (Saudi Personal Data Protection Law) compliance intake and review platform. Requesters submit data processing activities; reviewers (Data Management, Legal, Security) assess and approve/return/reject them. External parties can review via one-time links.

## Tech stack (on-premises)
- **Frontend:** React 19, Vite, TypeScript, React Router v7
- **Backend:** Node.js 22 + Express (TypeScript, ESM), in `backend/`
- **Database:** PostgreSQL 16 — schema auto-applied on startup via `backend/src/schema.sql`
- **Auth:** JWT username/password (`bcryptjs` + `jsonwebtoken`), Bearer token in localStorage
- **AI:** OpenAI SDK (supports both OpenAI and Azure OpenAI) — API key stays on the backend
- **File storage:** Local filesystem (Docker volume at `UPLOAD_DIR`), served by Express
- **Containerization:** Docker + docker-compose (services: db, backend, frontend/nginx)

## Repository layout
```
backend/           Node.js/Express backend
  src/
    index.ts       Express app entry — mounts all routes, runs schema.sql on startup
    db.ts          pg Pool + query helpers
    schema.sql     Full DDL for 15 tables (idempotent, IF NOT EXISTS)
    seed.ts        Creates default admin user (run once: node dist/seed.js)
    middleware/
      auth.ts      requireAuth (JWT) + requireRole
    routes/
      auth.ts      POST /api/auth/login|change-password, GET /api/auth/me
      users.ts     CRUD /api/users
      tickets.ts   CRUD /api/tickets + submit/transition/review/thread sub-routes
      ai.ts        POST /api/ai/stream (SSE), /api/ai/stream-raw (SSE, raw messages),
                   POST /api/ai/complete (non-streaming proxy)
      links.ts     External one-time link generate/redeem/submit
      attachments.ts  Multer upload + download
      vendors.ts / projects.ts / policies.ts / audit.ts / settings.ts
      templates.ts / documents.ts / notif-preferences.ts / admin.ts

src/
  lib/
    api.ts         REST client — apiGet/Post/Patch/Delete/PostForm, apiComplete,
                   apiStreamMessages (async generator for SSE), startPolling
    dataverse.ts   Compatibility shim → re-exports from api.ts
  api/
    auth.ts        JWT sign-in/out, session (GET /auth/me)
    tickets.ts     All ticket operations
    ai.ts          streamAI (SSE), generateExternalLink, redeemExternalLink
    aiPresubmit.ts / aiChecklist.ts / aiReviewer.ts / aiRequestBuilder.ts
    aiReviewerAssist.ts / aiEvaluateReply.ts / aiPolicyChat.ts / aiDocumentGenerator.ts
    vendors.ts / projects.ts / attachments.ts / notifications.ts
    library.ts / documentLibrary.ts / templatesLibrary.ts
    notificationPreferences.ts / adminSettings.ts
```

## Auth flow
1. User submits email + password on `/sign-in`
2. `apiSignIn` → `POST /api/auth/login` → bcrypt compare → `jwt.sign` 8h → `{ token, user }`
3. Token stored in localStorage; all subsequent requests send `Authorization: Bearer <token>`
4. `requireAuth` middleware verifies JWT on every protected route
5. 401 response → `api.ts` clears token + redirects to `/sign-in`

## AI routing (all keys stay on server)
- **Non-streaming:** `apiComplete(body)` → `POST /api/ai/complete` → OpenAI SDK → raw response
- **Simple SSE:** `streamAI({ feature, message, context })` → `POST /api/ai/stream` → SSE tokens
- **Raw messages SSE:** `apiStreamMessages(messages, maxTokens)` → `POST /api/ai/stream-raw` → SSE tokens
  Used by: `streamReviewerAssist`, `streamPolicyChat`, `streamDocument`

## Environment variables
See `backend/.env.example` for the full list. Key vars:

| Variable | Purpose |
|----------|---------|
| `PGHOST/PORT/DATABASE/USER/PASSWORD` | PostgreSQL connection |
| `JWT_SECRET` | Token signing secret (change in production!) |
| `PORT` | Backend listen port (default 3000) |
| `APP_URL` | Used in generated external links (e.g. `http://localhost`) |
| `UPLOAD_DIR` | File upload directory (default `./uploads`) |
| `OPENAI_API_KEY` + `OPENAI_DEPLOYMENT` | Standard OpenAI |
| `AZURE_OPENAI_KEY` + `AZURE_OPENAI_ENDPOINT` + `AZURE_OPENAI_DEPLOYMENT` | Azure OpenAI alternative |

## Running locally (dev)
```bash
# 1. Start PostgreSQL (e.g. via Docker)
docker run -d -e POSTGRES_DB=pdplreviewer -e POSTGRES_USER=pdpl \
  -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:16-alpine

# 2. Start backend
cd backend
cp .env.example .env   # fill in values
npm install
npm run dev            # tsx watch, port 3000

# 3. Start frontend (separate terminal)
cd ..
npm install
npm run dev            # Vite, port 5173, proxies /api → localhost:3000

# 4. Seed admin user (first time only)
cd backend && node dist/seed.js
# Default: admin@pdplreviewer.local / Admin@1234
```

## Running with Docker Compose (production-like)
```bash
cp backend/.env.example .env   # fill in PGPASSWORD, JWT_SECRET, OPENAI_API_KEY, APP_URL
docker compose up --build -d

# Seed admin user (first time only)
docker compose exec backend node dist/seed.js
```
App is available at `http://localhost` (port 80 by default; override with `APP_PORT=8080`).

## Database schema highlights
- `users`: `id`, `email`, `password_hash`, `role`, `must_change_pw`
- `tickets`: `payload JSONB`, `data_declaration JSONB`, SLA date columns, `status`
- `review_slots`: `UNIQUE(ticket_id, role)` → upserted on every review save
- `attachments`: file stored at `file_path` on disk; `signed_url` always `/api/attachments/:id/download`
- `audit_events`: SHA-256 hash chain for tamper evidence
- `app_settings`: key-value JSONB; `workflow` key holds `WorkflowSettings`

## Coding conventions
- No comments unless the WHY is non-obvious
- No `console.log` left in production code
- `isDataverseConfigured` re-exported from `src/lib/dataverse.ts` as a compat shim (always `true`)
- `showToast(msg, 'error'|'success'|'info')` for user-visible feedback
- Backend routes use `requireAuth` + `requireRole` middleware for authorization

## Files NOT needed in on-prem setup (legacy, do not use)
- `azure-functions/` — replaced by `backend/`
- `flows/` — Logic Apps definitions (no longer needed)
- `scripts/setup-dataverse.mjs` / `create-user.mjs` — replaced by `backend/src/seed.ts`
- `DATAVERSE_SETUP.md` / `POWER_AUTOMATE_SETUP.md` — Azure-specific setup guides
