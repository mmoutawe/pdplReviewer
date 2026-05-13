# PDPL Reviewer — Project Context for Claude Code

## What this app is
A PDPL (Saudi Personal Data Protection Law) compliance intake and review platform for a FinTech org. Requesters submit data processing activities; reviewers (Data Management, Legal, Security) assess and approve/return/reject them. External parties can review via one-time links.

## Tech stack
- **Frontend:** React 19, Vite, TypeScript, React Router v7
- **Backend:** Microsoft Dataverse (OData v4 Web API) — sole data store
- **Auth:** MSAL (`@azure/msal-browser`) + Entra ID — no username/password auth, all via `loginPopup`
- **AI:** Azure OpenAI (direct from frontend for `request_builder`; Power Automate flow for other features)
- **Server-side logic:** 5 Azure Logic Apps / Power Automate HTTP-triggered flows (see `flows/`)
- **No Supabase** — fully migrated away; `src/lib/supabase.ts` deleted

## Key files
| File | Purpose |
|------|---------|
| `src/lib/dataverse.ts` | Core Dataverse client — OData helpers, file ops, polling, entity transformers |
| `src/api/auth.ts` | MSAL sign-in/out, Entra ID token acquisition, user profile lookup |
| `src/api/tickets.ts` | Ticket CRUD, review decisions, return thread, subscriptions (polling) |
| `src/api/ai.ts` | Azure OpenAI (direct) + PA flow calls; external link functions |
| `flows/` | Logic Apps JSON definitions for all 5 server-side flows |
| `scripts/setup-dataverse.mjs` | Creates all 15 Dataverse tables — run once: `npm run setup:dataverse` |
| `scripts/create-user.mjs` | Creates a user record — run before first sign-in: `npm run create:user` |
| `DATAVERSE_SETUP.md` | Full table schemas, column names, alternate keys, Azure App Registration steps |
| `POWER_AUTOMATE_SETUP.md` | Step-by-step PA flow build guide |
| `flows/README.md` | How to deploy Logic Apps / paste into PA code view |

## Dataverse conventions
- Publisher prefix: `pdplr_` (configurable via `VITE_DV_TABLE_PREFIX`)
- All column logical names: `pdplr_<name>` (all lowercase)
- Entity set names (OData plural): defined in `src/lib/dataverse.ts → T`
- Arrays stored as comma-delimited text; JSON objects as Multiline Text (1 MB)
- Realtime replaced with polling (`startPolling` in dataverse.ts, 15–20 s intervals)
- File storage: Dataverse File columns (`pdplr_filecontent`), fetched via `dvGetFileBlobUrl` → blob URL

## Alternate keys (required for upsert)
| Table | Key |
|-------|-----|
| `pdplr_user` | `pdplr_entraobjectid` (single) |
| `pdplr_ticket` | `pdplr_ticketnumber` (single) |
| `pdplr_reviewslot` | `(pdplr_ticketid, pdplr_role)` composite |
| `pdplr_notifpreference` | `(pdplr_userid, pdplr_type)` composite |

## Auth flow
1. User enters email → `apiSignIn(email, _password)` → `msalInstance.loginPopup()`
2. After popup, look up `pdplr_users` by `pdplr_entraobjectid eq account.localAccountId`
3. If no row found → error "Contact your administrator" → run `npm run create:user` first
4. Token provider wired via `initDataverseTokenProvider` in `src/api/auth.ts`

## Environment variables (`.env.local`)
```
VITE_DATAVERSE_URL=https://orgXXX.crm4.dynamics.com
VITE_DV_TABLE_PREFIX=pdplr_
VITE_MSAL_CLIENT_ID=<app-registration-client-id>
VITE_MSAL_TENANT_ID=<tenant-id>
VITE_PA_AI_STREAM_URL=<logic-app-trigger-url>
VITE_PA_EL_GENERATE_URL=<logic-app-trigger-url>
VITE_PA_EL_REDEEM_URL=<logic-app-trigger-url>
VITE_PA_EL_DECIDE_URL=<logic-app-trigger-url>
VITE_PA_CREATE_ACCOUNT_URL=<logic-app-trigger-url>
VITE_AZURE_OPENAI_KEY=<key>
VITE_AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
VITE_AZURE_OPENAI_DEPLOYMENT=gpt-4o
```
Without `VITE_DATAVERSE_URL` the app runs in demo mode (mock data, no persistence).

## Setup checklist (new environment)
- [ ] Create `.env.local` from `.env.example`
- [ ] Create Azure App Registration (see `DATAVERSE_SETUP.md` §1)
- [ ] Enable "Allow public client flows" on the App Registration
- [ ] `npm run setup:dataverse` — creates all 15 tables (idempotent, safe to re-run)
- [ ] Register App Registration as Application User in Power Platform Admin Center (System Administrator role)
- [ ] Deploy 5 flows from `flows/` (Azure Logic Apps or PA code view)
- [ ] Add flow URLs to `.env.local`
- [ ] `npm run create:user` — creates first admin user record
- [ ] Sign in at `http://localhost:5173`

## What's NOT done yet (as of last session)
- Flows not deployed (definitions written, not deployed — see `flows/`)
- Reference data (vendors, projects, policies) still loaded from `src/data/seed.ts`, not Dataverse
- Frontend not deployed to production

## Commands
```bash
npm run dev               # start dev server
npm run build             # production build
npm run setup:dataverse   # create Dataverse tables (run once)
npm run create:user       # create/update a user record [role]
```

## Coding conventions
- No comments unless the WHY is non-obvious
- No `console.log` left in production code
- Dataverse column access always via the `c()` helper in dataverse.ts (respects prefix)
- `isDataverseConfigured` guards all live API calls; fallback to demo/mock data
- `showToast(msg, 'error'|'success'|'info')` for user-visible feedback
