# Power Automate / Logic Apps — Flow Definitions

Each JSON file is a complete **Azure Logic Apps workflow definition** that can be deployed in two ways:

---

## Option A — Azure Logic Apps (recommended)

### 1. Create a Logic App

```bash
az group create -n pdpl-flows -l saudiarabia

# Create one Consumption Logic App per flow
az logic workflow create \
  --resource-group pdpl-flows \
  --name pdpl-ai-stream \
  --definition @flows/01-ai-stream.json \
  --parameters flows/params/01-ai-stream.params.json
```

After deploying, copy the trigger URL from:
**Azure Portal → Logic App → Overview → Trigger URL**

Set it in `.env.local` as `VITE_PA_AI_STREAM_URL`.

### 2. Create parameter files

Create a `flows/params/` directory and one `.params.json` per flow.
See the **Parameters** section for each flow below.

---

## Option B — Power Automate (manual paste)

1. Go to **make.powerautomate.com**
2. Click **+ Create → Instant cloud flow**
3. Add trigger: **"When an HTTP request is received"** → Create
4. Click the **"…"** menu on the trigger → **"Peek code"** (or switch to Code View)
5. Replace the entire `definition` field with the contents of the JSON file
6. Save → copy the HTTP POST URL shown in the trigger
7. Set that URL in `.env.local`

> Note: For flows that use HTTP actions to call Dataverse, you must set parameters
> as flow variables or use Power Automate's built-in **Environment Variables** feature.

---

## Flows

### 01-ai-stream.json → `VITE_PA_AI_STREAM_URL`

Calls Azure OpenAI and returns SSE-formatted response.

**Parameters:**

| Name | Value |
|------|-------|
| `aoai_key` | Azure OpenAI API key |
| `aoai_endpoint` | e.g. `https://myresource.openai.azure.com` |
| `aoai_deployment` | Deployment name, e.g. `gpt-4o` |

**Example params file** (`flows/params/01-ai-stream.params.json`):
```json
{
  "aoai_key":        { "value": "your-openai-key" },
  "aoai_endpoint":   { "value": "https://your-resource.openai.azure.com" },
  "aoai_deployment": { "value": "gpt-4o" }
}
```

---

### 02-generate-external-link.json → `VITE_PA_EL_GENERATE_URL`

Creates a `pdplr_externallink` row in Dataverse and returns the token + URL.
Requires Bearer auth (called by the app with the user's MSAL token — flow ignores it,
using its own service principal for Dataverse writes).

**Parameters:**

| Name | Value |
|------|-------|
| `tenant_id` | Your Entra ID tenant ID |
| `client_id` | App Registration client ID (needs Dataverse `user_impersonation`) |
| `client_secret` | App Registration client secret |
| `dataverse_url` | e.g. `https://orgXXX.crm4.dynamics.com` |
| `app_url` | Your deployed app URL, e.g. `https://pdplreviewer.vercel.app` |
| `dv_prefix` | `pdplr_` (or your custom prefix) |

---

### 03-redeem-external-link.json → `VITE_PA_EL_REDEEM_URL`

Validates a token, checks expiry/revocation, returns ticket data.
**No auth required** — called by unauthenticated external recipients.

Same parameters as flow 02 (minus `app_url`).

---

### 04-submit-external-decision.json → `VITE_PA_EL_DECIDE_URL`

Records approve/reject decision on the external link row.
**No auth required** — called by unauthenticated external recipients.

Same parameters as flow 02 (minus `app_url`).

---

### 05-create-account.json → `VITE_PA_CREATE_ACCOUNT_URL`

Creates a new Entra ID user (via Graph API) and a `pdplr_user` row in Dataverse.

**Extra requirement:** The App Registration used for `client_id` must have:
- **Microsoft Graph → Application permission** → `User.ReadWrite.All` → admin consented

**Parameters:** Same as flow 02, plus `app_url`.

---

## Service Principal setup

Flows 02–05 use a **service principal** (client credentials) to write to Dataverse,
since they run without a user context (or as unauthenticated calls).

Use **the same App Registration** you created for MSAL (or create a separate one):

1. **Azure Portal → App registrations → your app → Certificates & secrets**
2. New client secret → copy the value → use as `client_secret` parameter
3. In Power Platform Admin Center → your environment → **Settings → Users + permissions → Application users**
4. Click **+ New app user** → select your App Registration → assign **System Administrator** role

This grants the service principal write access to Dataverse.

---

## CORS

All flows already include `Access-Control-Allow-Origin: *` in their Response actions.
For production, replace `*` with your actual app domain.
