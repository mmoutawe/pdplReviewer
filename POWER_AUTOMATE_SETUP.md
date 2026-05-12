# Power Automate Flows — Setup Guide

Five HTTP-triggered cloud flows replace the Supabase Edge Functions.

| Flow | Env var | Auth required |
|------|---------|--------------|
| AI Stream | `VITE_PA_AI_STREAM_URL` | Bearer (Entra ID) |
| Generate External Link | `VITE_PA_EL_GENERATE_URL` | Bearer (Entra ID) |
| Redeem External Link | `VITE_PA_EL_REDEEM_URL` | None |
| Submit External Decision | `VITE_PA_EL_DECIDE_URL` | None |
| Create External Account | `VITE_PA_CREATE_ACCOUNT_URL` | Bearer (Entra ID) |

---

## Prerequisites

- Power Platform environment with Dataverse already set up (see `DATAVERSE_SETUP.md`)
- Azure App Registration created (same one used for the frontend MSAL config)
- For the **Create Account** flow: Graph API permission `User.ReadWrite.All` added to the App Registration
- For all flows that call Azure OpenAI: `VITE_AZURE_OPENAI_KEY`, `VITE_AZURE_OPENAI_ENDPOINT`, `VITE_AZURE_OPENAI_DEPLOYMENT` from your `.env.local`

---

## How to configure Bearer-token validation

For any flow that requires auth, add this at the top before any other actions:

1. Add a **"Condition"** action.
2. Left value: `@{triggerOutputs()?['headers']?['Authorization']}`
3. Operator: **does not start with**
4. Right value: `Bearer `
5. **If yes (invalid):** add a **"Response"** action → Status `401`, Body `{"error":"Unauthorized"}`; add a **"Terminate"** action → Status `Failed`.
6. Continue the flow in **If no (valid)** branch.

> Note: This checks that a Bearer token is present. Full token signature validation requires calling the Microsoft Graph `validateOAuthToken` API or using an Azure API Management policy. For internal-only flows, the presence check is usually sufficient.

---

## Flow 1 — AI Stream

**Env var:** `VITE_PA_AI_STREAM_URL`

### What it does
Accepts a feature + message, calls Azure OpenAI, returns the response in SSE format so the frontend SSE reader receives it correctly. Power Automate cannot stream token-by-token; the entire response arrives in one chunk, but the frontend handles that fine.

### HTTP Trigger setup
- Method: **POST**
- Request body JSON schema (paste into the trigger's "Use sample payload" dialog):

```json
{
  "feature": "copilot",
  "message": "What data categories does this request involve?",
  "ticketId": "PDPL-2025-0001",
  "policyId": null,
  "context": {}
}
```

### Actions

**1. Check auth** (see "How to configure Bearer-token validation" above)

**2. Initialize variable — SystemPrompt** (String)

Value expression:

```
if(equals(triggerBody()?['feature'], 'pre_assessment'),
  'You are a PDPL compliance reviewer performing a pre-submission risk assessment. Review the provided ticket details and identify: 1) missing information, 2) data categories present, 3) cross-border transfer risks, 4) legal basis adequacy under PDPL Article 4-6. Respond in structured markdown.',
if(equals(triggerBody()?['feature'], 'evaluate_reply'),
  'You are a PDPL compliance reviewer evaluating a requester''s reply to reviewer comments. Score the reply on: completeness (did they address every point?), specificity (concrete answers vs vague), evidentiary support (attachments cited). Respond with JSON: {"score":0-100,"completeness":"...","specificity":"...","evidence":"...","recommendation":"..."}',
if(equals(triggerBody()?['feature'], 'document_chat'),
  'You are a PDPL compliance assistant. Answer questions about the provided document content in the context of Saudi PDPL compliance. Be concise and cite relevant PDPL articles where applicable.',
if(equals(triggerBody()?['feature'], 'policy_chat'),
  'You are a PDPL policy expert. Answer questions about PDPL policies, articles, and obligations for Saudi organizations. Cite specific articles (e.g. Article 4, Article 14) in your answers.',
  'You are a PDPL compliance copilot. Help the user with PDPL compliance questions, ticket drafting, and risk identification. Be concise and practical.'
))))
```

**3. HTTP — Call Azure OpenAI**

- Method: POST
- URI: `https://<your-resource>.openai.azure.com/openai/deployments/<your-deployment>/chat/completions?api-version=2025-04-01-preview`
  Replace the resource and deployment with your actual values.
- Headers:
  - `Content-Type`: `application/json`
  - `api-key`: your Azure OpenAI key (store in a PA Secret or Key Vault connection)
- Body:

```json
{
  "messages": [
    {
      "role": "system",
      "content": "@{variables('SystemPrompt')}"
    },
    {
      "role": "user",
      "content": "@{triggerBody()?['message']}"
    }
  ],
  "max_completion_tokens": 1024
}
```

**4. Parse JSON — OpenAI response**

Schema:
```json
{
  "type": "object",
  "properties": {
    "choices": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "message": {
            "type": "object",
            "properties": {
              "content": { "type": "string" }
            }
          }
        }
      }
    }
  }
}
```

**5. Response**

- Status code: `200`
- Headers:
  - `Content-Type`: `text/event-stream`
  - `Access-Control-Allow-Origin`: `*`
  - `Cache-Control`: `no-cache`
- Body:

```
data: {"token":"@{first(body('Parse_JSON_OpenAI')?['choices'])?['message']?['content']}"}
data: {"done":true}
```

> The two lines must be separated by a real newline character. In the PA expression editor, use `concat('data: {"token":"', replace(first(body('Parse_JSON_OpenAI')?['choices'])?['message']?['content'], '"', '\"'), '"}\ndata: {"done":true}')` as the body expression if the literal newline doesn't work.

---

## Flow 2 — Generate External Link

**Env var:** `VITE_PA_EL_GENERATE_URL`

### What it does
Creates a one-time secure review link for an external party. Stores the link token in the `pdplr_externallinks` Dataverse table and returns the token + full URL.

### HTTP Trigger
- Method: **POST**
- Sample payload:
```json
{
  "ticketId": "PDPL-2025-0001",
  "recipientEmail": "vendor@example.com",
  "expiresInHours": 72
}
```

### Actions

**1. Check auth** (Bearer token validation)

**2. Initialize variable — Token** (String)

Value: `@{guid()}`

**3. Initialize variable — ExpiresAt** (String)

Value: `@{addHours(utcNow(), int(triggerBody()?['expiresInHours']))}`

**4. Create row — Dataverse**

- Table: `pdplr_externallinks`
- Columns:
  - `pdplr_token` → `@{variables('Token')}`
  - `pdplr_recipientemail` → `@{triggerBody()?['recipientEmail']}`
  - `pdplr_label` → `@{concat('External Review — ', triggerBody()?['ticketId'])}`
  - `pdplr_expiresat` → `@{variables('ExpiresAt')}`
  - `pdplr_status` → `pending`
  - `pdplr_revoked` → `false`

  For the ticket lookup column (`pdplr_ticketid`), if it is a lookup:
  - Use the **"List rows"** Dataverse action first to find the ticket GUID by `$filter=pdplr_ticketnumber eq '@{triggerBody()?['ticketId']}'`
  - Then set the lookup: `/pdplr_tickets(@{first(outputs('List_ticket')?['body/value'])?['pdplr_ticketid']})`

  If you stored `pdplr_ticketid` as plain text, just set it directly.

**5. Response**

- Status: `200`
- Headers: `Content-Type: application/json`
- Body:
```json
{
  "token": "@{variables('Token')}",
  "link": "https://<your-app-domain>/external/@{variables('Token')}",
  "expiresAt": "@{variables('ExpiresAt')}"
}
```
Replace `<your-app-domain>` with your Vite app's deployed domain.

---

## Flow 3 — Redeem External Link

**Env var:** `VITE_PA_EL_REDEEM_URL`

### What it does
Validates a token sent by an unauthenticated external recipient. Returns the associated ticket data if the token is valid and not expired.

### HTTP Trigger
- Method: **POST**
- Authentication: **None** (no Bearer check)
- Sample payload:
```json
{ "token": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }
```

### Actions

**1. List rows — Dataverse (find the link)**

- Table: `pdplr_externallinks`
- Filter: `pdplr_token eq '@{triggerBody()?['token']}'`
- Top count: `1`

**2. Condition — token not found**

- Expression: `@{empty(outputs('List_external_link')?['body/value'])}`
- If yes → **Response** 404 `{"error":"Invalid or expired link"}` → **Terminate**

**3. Initialize variable — LinkRow** (Object)

Value: `@{first(outputs('List_external_link')?['body/value'])}`

**4. Condition — revoked**

- Left: `@{variables('LinkRow')?['pdplr_revoked']}`
- Operator: `is equal to`
- Right: `true`
- If yes → **Response** 403 `{"error":"This link has been revoked"}` → **Terminate**

**5. Condition — expired**

- Left: `@{variables('LinkRow')?['pdplr_expiresat']}`
- Operator: `is less than`
- Right: `@{utcNow()}`
- If yes → **Response** 410 `{"error":"This link has expired"}` → **Terminate**

**6. List rows — Dataverse (get the ticket)**

- Table: `pdplr_tickets`
- Filter: `pdplr_ticketnumber eq '@{variables('LinkRow')?['pdplr_ticketid']}'`
  (adjust column name if `pdplr_ticketid` is a lookup — use the expanded value)
- Top count: `1`

**7. Response — success**

- Status: `200`
- Headers: `Content-Type: application/json`
- Body:
```json
{
  "token": "@{triggerBody()?['token']}",
  "expiresAt": "@{variables('LinkRow')?['pdplr_expiresat']}",
  "recipientEmail": "@{variables('LinkRow')?['pdplr_recipientemail']}",
  "alreadyDecided": @{if(equals(variables('LinkRow')?['pdplr_status'], 'pending'), false, true)},
  "decision": @{if(equals(variables('LinkRow')?['pdplr_status'], 'pending'), 'null', concat('"', variables('LinkRow')?['pdplr_status'], '"'))},
  "ticket": @{first(outputs('Get_ticket')?['body/value'])}
}
```

---

## Flow 4 — Submit External Decision

**Env var:** `VITE_PA_EL_DECIDE_URL`

### What it does
Records an external party's approve/reject decision and optionally advances the ticket state.

### HTTP Trigger
- Method: **POST**
- Authentication: **None**
- Sample payload:
```json
{
  "token": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "decision": "approve",
  "notes": "DPA is in order."
}
```

### Actions

**1. List rows — Dataverse (find the link)**

Same as Flow 3 step 1.

**2. Condition — token not found or revoked**

Same validation as Flow 3. Return 404/403 as appropriate.

**3. Update row — Dataverse (mark decision)**

- Table: `pdplr_externallinks`
- Row ID: `@{first(outputs('List_external_link')?['body/value'])?['pdplr_externallinkid']}`
- Columns:
  - `pdplr_status` → `@{triggerBody()?['decision']}` (stores `"approve"` or `"reject"`)
  - `pdplr_approvedat` → `@{utcNow()}`

**4. (Optional) Transition ticket state**

If you want the ticket to automatically move to the next state when an external party decides:

- Get the ticket GUID from the link row
- Update `pdplr_state` on the ticket to `external_reviewed`
- Add a comment thread entry with the decision and notes

**5. Response**

- Status: `200`
- Body: `{}`

---

## Flow 5 — Create External Account

**Env var:** `VITE_PA_CREATE_ACCOUNT_URL`

### What it does
Creates a new Entra ID user account for an external reviewer. Returns the temporary password and portal URL so the admin can share them with the recipient.

### Prerequisites

- App Registration (the same one used for MSAL) must have **Microsoft Graph** → **Application permission** → `User.ReadWrite.All`, admin-consented.
- A **"HTTP with Microsoft Entra ID (preauthorized)"** connection in Power Automate, pointing to `https://graph.microsoft.com` as the base resource.

### HTTP Trigger
- Method: **POST**
- Sample payload:
```json
{
  "email": "vendor.reviewer@example.com",
  "fullName": "Ahmed Al-Rashidi",
  "label": "DPA Review — Sahab Q2",
  "expiresAt": "2025-09-01T00:00:00Z"
}
```

### Actions

**1. Check auth** (Bearer token validation)

**2. Initialize variable — TempPassword** (String)

Value: `@{concat(toUpper(substring(guid(), 0, 4)), toLower(substring(guid(), 9, 4)), substring(guid(), 19, 4), '!7')}`

This generates a ~16-character password that meets most Entra ID complexity requirements.

**3. HTTP — Microsoft Graph: Create user**

- Method: **POST**
- URI: `https://graph.microsoft.com/v1.0/users`
- Authentication: **Active Directory OAuth**
  - Tenant: your Tenant ID
  - Audience: `https://graph.microsoft.com`
  - Client ID: your App Registration client ID
  - Credential type: **Secret** → your App Registration client secret
- Headers: `Content-Type: application/json`
- Body:
```json
{
  "accountEnabled": true,
  "displayName": "@{triggerBody()?['fullName']}",
  "mailNickname": "@{replace(toLower(triggerBody()?['fullName']), ' ', '.')}",
  "userPrincipalName": "@{triggerBody()?['email']}",
  "passwordProfile": {
    "forceChangePasswordNextSignIn": true,
    "password": "@{variables('TempPassword')}"
  },
  "usageLocation": "SA"
}
```

**4. (Optional) Send welcome email**

Add an **"Office 365 Outlook — Send an email (V2)"** action:
- To: `@{triggerBody()?['email']}`
- Subject: `Your PDPL Reviewer portal access`
- Body:
  ```
  Hello @{triggerBody()?['fullName']},

  You have been invited to review a PDPL compliance request.

  Portal: https://<your-app-domain>
  Email: @{triggerBody()?['email']}
  Temporary password: @{variables('TempPassword')}

  You will be prompted to change your password on first login.
  This access expires: @{triggerBody()?['expiresAt']}.
  ```

**5. Response**

- Status: `200`
- Headers: `Content-Type: application/json`
- Body:
```json
{
  "tempPassword": "@{variables('TempPassword')}",
  "portalUrl": "https://<your-app-domain>"
}
```

---

## CORS — Required for all flows

Power Automate HTTP triggers do not return CORS headers by default, which will block requests from your React app running in the browser.

**Option A — Add CORS headers to every Response action** (easiest):

In every Response action, add these headers:
```
Access-Control-Allow-Origin: https://your-app-domain.com
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

For local development add a second value or use `*` (only acceptable for flows that don't require auth):
```
Access-Control-Allow-Origin: *
```

**Option B — Azure API Management** (recommended for production):

Put APIM in front of all flows. Configure a CORS policy in APIM, point each API operation to the corresponding flow's HTTP trigger URL. This also lets you use APIM to validate Entra ID tokens properly.

---

## Environment variables summary

Add these to your `.env.local`:

```env
VITE_PA_AI_STREAM_URL=https://prod-xx.westeurope.logic.azure.com/workflows/.../triggers/manual/paths/invoke?...
VITE_PA_EL_GENERATE_URL=https://prod-xx.westeurope.logic.azure.com/workflows/.../triggers/manual/paths/invoke?...
VITE_PA_EL_REDEEM_URL=https://prod-xx.westeurope.logic.azure.com/workflows/.../triggers/manual/paths/invoke?...
VITE_PA_EL_DECIDE_URL=https://prod-xx.westeurope.logic.azure.com/workflows/.../triggers/manual/paths/invoke?...
VITE_PA_CREATE_ACCOUNT_URL=https://prod-xx.westeurope.logic.azure.com/workflows/.../triggers/manual/paths/invoke?...
```

Each URL is found in the flow's **"When an HTTP request is received"** trigger → **HTTP POST URL** field (visible after the flow is saved).
