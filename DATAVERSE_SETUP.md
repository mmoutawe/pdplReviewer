# Dataverse Setup Guide

This document describes every table, column, and alternate key you need to create in your
Dataverse environment before the app can run against a live backend.

All names use the publisher prefix **`pdplr_`** — change this globally if your solution uses a
different prefix, and set `VITE_DV_TABLE_PREFIX` in your `.env.local` accordingly.

---

## 1. Azure App Registration (Entra ID)

1. Go to **Azure Portal → Entra ID → App registrations → New registration**
2. Name: `PDPL Reviewer`; Supported account type: single tenant (or multi-tenant)
3. Redirect URI: `SPA` → `http://localhost:5173` (dev) and your production URL
4. Under **API Permissions** → Add → `Dynamics CRM → user_impersonation`
5. Grant admin consent
6. Copy **Application (client) ID** → `VITE_MSAL_CLIENT_ID`
7. Copy **Directory (tenant) ID** → `VITE_MSAL_TENANT_ID`

---

## 2. Dataverse Tables

Create each table in **Power Apps → Tables → New table** (or via PAC CLI / solution import).

### 2.1 pdplr_user

| Column logical name       | Display name           | Type           | Notes |
|---------------------------|------------------------|----------------|-------|
| pdplr_userid              | User ID                | Primary key    | Auto-generated GUID |
| pdplr_entraobjectid       | Entra Object ID        | Text (100)     | Azure AD Object ID — used for login lookup |
| pdplr_fullname            | Full Name              | Text (200)     | |
| pdplr_email               | Email                  | Text (200)     | |
| pdplr_role                | Role                   | Text (50)      | requester / data_management / legal / security / admin / external_recipient |
| pdplr_department          | Department             | Text (100)     | |
| pdplr_jobtitle            | Job Title              | Text (100)     | |
| pdplr_initials            | Initials               | Text (10)      | |
| pdplr_avatarcolor         | Avatar Color           | Text (20)      | Hex color e.g. #3B82F6 |

**Alternate key:** `pdplr_entraobjectid` (single column, unique)

---

### 2.2 pdplr_ticket

| Column logical name            | Display name             | Type              | Notes |
|-------------------------------|--------------------------|-------------------|-------|
| pdplr_ticketid                | Ticket ID                | Primary key       | |
| pdplr_ticketnumber            | Ticket Number            | Text (50)         | Human-readable e.g. PDPL-2026-0042 |
| pdplr_type                    | Request Type             | Text (80)         | vendor_onboarding / external_document_sharing / etc. |
| pdplr_state                   | State                    | Text (50)         | draft / submitted / in_data_management / etc. |
| pdplr_title                   | Title                    | Text (200)        | |
| pdplr_description             | Description              | Multiline Text    | |
| pdplr_requesterid             | Requester ID             | Text (50)         | GUID of pdplr_user |
| pdplr_vendorid                | Vendor ID                | Text (50)         | GUID of pdplr_vendor, nullable |
| pdplr_projectid               | Project ID               | Text (50)         | GUID of pdplr_project, nullable |
| pdplr_externalrecipientemail  | External Recipient Email | Text (200)        | nullable |
| pdplr_tags                    | Tags                     | Multiline Text    | Comma-separated |
| pdplr_payload                 | Payload                  | Multiline (1MB)   | JSON string |
| pdplr_datadeclaration         | Data Declaration         | Multiline (1MB)   | JSON string |
| pdplr_slaackhours             | SLA Ack Hours            | Whole Number      | default 24 |
| pdplr_sladecisionhours        | SLA Decision Hours       | Whole Number      | default 72 |
| pdplr_slastartedat            | SLA Started At           | Date/Time         | |
| pdplr_slaackby                | SLA Ack By               | Text (50)         | nullable |
| pdplr_slaackedat              | SLA Acked At             | Date/Time         | nullable |
| pdplr_sladecisiondueat        | SLA Decision Due At      | Date/Time         | |
| pdplr_slabreached             | SLA Breached             | Yes/No            | default No |
| pdplr_preassessmentgenerationid | Pre-Assessment ID      | Text (50)         | nullable |
| pdplr_parentticketid          | Parent Ticket ID         | Text (50)         | nullable |
| pdplr_submittedat             | Submitted At             | Date/Time         | nullable |
| pdplr_decidedat               | Decided At               | Date/Time         | nullable |

**Alternate key:** `pdplr_ticketnumber` (single column, unique)

---

### 2.3 pdplr_reviewslot

| Column logical name       | Display name        | Type         | Notes |
|---------------------------|---------------------|--------------|-------|
| pdplr_reviewslotid        | Review Slot ID      | Primary key  | |
| pdplr_ticketid            | Ticket ID           | Text (50)    | GUID of pdplr_ticket |
| pdplr_role                | Role                | Text (50)    | data_management / legal / security |
| pdplr_reviewerid          | Reviewer ID         | Text (50)    | GUID of pdplr_user, nullable |
| pdplr_verdict             | Verdict             | Text (30)    | pending / approve / return / reject / escalate |
| pdplr_notes               | Notes               | Multiline Text | nullable |
| pdplr_decidedat           | Decided At          | Date/Time    | nullable |
| pdplr_aicopilotgenerationid | AI Copilot Gen ID | Text (50)    | nullable |

**Alternate key:** composite `(pdplr_ticketid, pdplr_role)` — required for upsert

---

### 2.4 pdplr_threadentry

| Column logical name       | Display name        | Type           | Notes |
|---------------------------|---------------------|----------------|-------|
| pdplr_threadentryid       | Thread Entry ID     | Primary key    | |
| pdplr_ticketid            | Ticket ID           | Text (50)      | |
| pdplr_byuserid            | By User ID          | Text (50)      | |
| pdplr_byrole              | By Role             | Text (50)      | |
| pdplr_message             | Message             | Multiline Text | |
| pdplr_attachmentids       | Attachment IDs      | Multiline Text | Comma-separated GUIDs |
| pdplr_aiscore             | AI Score            | Multiline Text | JSON: `{"score":N,"reasoning":"..."}` |
| pdplr_resolvedat          | Resolved At         | Date/Time      | nullable |
| pdplr_resolvedby          | Resolved By         | Text (50)      | nullable |

---

### 2.5 pdplr_attachment

| Column logical name       | Display name        | Type              | Notes |
|---------------------------|---------------------|-------------------|-------|
| pdplr_attachmentid        | Attachment ID       | Primary key       | |
| pdplr_ticketid            | Ticket ID           | Text (50)         | |
| pdplr_filename            | Filename            | Text (300)        | |
| pdplr_sizebytes           | Size Bytes          | Whole Number      | |
| pdplr_contenttype         | Content Type        | Text (100)        | |
| pdplr_uploadedby          | Uploaded By         | Text (50)         | |
| pdplr_uploadedat          | Uploaded At         | Date/Time         | |
| pdplr_storagepath         | Storage Path        | Text (500)        | |
| pdplr_scanstatus          | Scan Status         | Text (30)         | pending / clean / flagged |
| pdplr_classification      | Classification      | Text (30)         | unclassified / public / internal / confidential / restricted |
| pdplr_category            | Category            | Text (30)         | contract / dpa / soc2 / iso27001 / evidence / screenshot / other |
| pdplr_extractedsummary    | Extracted Summary   | Multiline Text    | nullable |
| pdplr_filecontent         | File Content        | **File column**   | Stores the actual file bytes (max 128 MB) |

---

### 2.6 pdplr_auditevent

| Column logical name       | Display name        | Type           | Notes |
|---------------------------|---------------------|----------------|-------|
| pdplr_auditeventid        | Audit Event ID      | Primary key    | |
| pdplr_ts                  | Timestamp           | Date/Time      | |
| pdplr_actorid             | Actor ID            | Text (50)      | |
| pdplr_actorrole           | Actor Role          | Text (50)      | |
| pdplr_action              | Action              | Text (100)     | e.g. ticket.state.transition |
| pdplr_targettype          | Target Type         | Text (50)      | ticket / user / policy / attachment / role / system |
| pdplr_targetid            | Target ID           | Text (50)      | |
| pdplr_beforesnapshot      | Before Snapshot     | Multiline Text | JSON, nullable |
| pdplr_aftersnapshot       | After Snapshot      | Multiline Text | JSON, nullable |
| pdplr_iphash              | IP Hash             | Text (100)     | nullable |
| pdplr_sessionid           | Session ID          | Text (100)     | nullable |
| pdplr_reason              | Reason              | Multiline Text | nullable |
| pdplr_immutablehash       | Immutable Hash      | Text (200)     | |
| pdplr_prevhash            | Prev Hash           | Text (200)     | nullable |

---

### 2.7 pdplr_notification

| Column logical name       | Display name        | Type           | Notes |
|---------------------------|---------------------|----------------|-------|
| pdplr_notificationid      | Notification ID     | Primary key    | |
| pdplr_userid              | User ID             | Text (50)      | |
| pdplr_ts                  | Timestamp           | Text (50)      | ISO 8601 string |
| pdplr_read                | Read                | Yes/No         | default No |
| pdplr_category            | Category            | Text (30)      | ticket / review / mention / system / security |
| pdplr_title               | Title               | Text (200)     | |
| pdplr_body                | Body                | Multiline Text | |
| pdplr_link                | Link                | Text (500)     | nullable |
| pdplr_actionlabel         | Action Label        | Text (100)     | nullable |
| pdplr_ticketid            | Ticket ID           | Text (50)      | nullable |
| pdplr_type                | Type                | Text (80)      | NotificationType enum value |

---

### 2.8 pdplr_policy

| Column logical name       | Display name        | Type           | Notes |
|---------------------------|---------------------|----------------|-------|
| pdplr_policyid            | Policy ID           | Primary key    | |
| pdplr_code                | Code                | Text (50)      | e.g. PDPL-Art-3 |
| pdplr_title               | Title               | Text (200)     | |
| pdplr_category            | Category            | Text (30)      | pdpl / internal / sama / iso27001 / cma |
| pdplr_version             | Version             | Text (20)      | |
| pdplr_effectivedate       | Effective Date      | Text (30)      | |
| pdplr_ownerdept           | Owner Department    | Text (100)     | |
| pdplr_status              | Status              | Text (20)      | active / draft / retired |
| pdplr_summary             | Summary             | Multiline Text | |
| pdplr_body                | Body                | Multiline (1MB)| Full policy text |
| pdplr_embeddingsbuilt     | Embeddings Built    | Yes/No         | |
| pdplr_citationcount       | Citation Count      | Whole Number   | |

---

### 2.9 pdplr_vendor

| Column logical name       | Display name        | Type           | Notes |
|---------------------------|---------------------|----------------|-------|
| pdplr_vendorid            | Vendor ID           | Primary key    | |
| pdplr_legalname           | Legal Name          | Text (200)     | |
| pdplr_tradename           | Trade Name          | Text (200)     | |
| pdplr_jurisdiction        | Jurisdiction        | Text (100)     | |
| pdplr_riskscore           | Risk Score          | Decimal        | 0–100 |
| pdplr_risktier            | Risk Tier           | Text (20)      | low / medium / high / critical |
| pdplr_status              | Status              | Text (20)      | active / pending / sunset / terminated |
| pdplr_category            | Category            | Text (100)     | |
| pdplr_primarycontact      | Primary Contact     | Text (200)     | |
| pdplr_certifications      | Certifications      | Multiline Text | Comma-separated |
| pdplr_hasdpa              | Has DPA             | Yes/No         | |
| pdplr_lastreviewedat      | Last Reviewed At    | Text (50)      | ISO 8601 |
| pdplr_notes               | Notes               | Multiline Text | |

---

### 2.10 pdplr_project

| Column logical name       | Display name        | Type           | Notes |
|---------------------------|---------------------|----------------|-------|
| pdplr_projectid           | Project ID          | Primary key    | |
| pdplr_code                | Code                | Text (50)      | e.g. PRJ-2026-0008 |
| pdplr_name                | Name                | Text (200)     | |
| pdplr_businessunit        | Business Unit       | Text (100)     | |
| pdplr_ownerid             | Owner ID            | Text (50)      | GUID of pdplr_user |
| pdplr_status              | Status              | Text (20)      | active / on_hold / closed |
| pdplr_datainventorycount  | Data Inventory Count| Whole Number   | |
| pdplr_description         | Description         | Multiline Text | |
| pdplr_startedat           | Started At          | Text (50)      | ISO 8601 |

---

### 2.11 pdplr_projectdocument

| Column logical name       | Display name        | Type           | Notes |
|---------------------------|---------------------|----------------|-------|
| pdplr_projectdocumentid   | Document ID         | Primary key    | |
| pdplr_projectid           | Project ID          | Text (50)      | nullable |
| pdplr_vendorid            | Vendor ID           | Text (50)      | nullable |
| pdplr_parentdocumentid    | Parent Document ID  | Text (50)      | nullable |
| pdplr_title               | Title               | Text (200)     | |
| pdplr_documenttype        | Document Type       | Text (30)      | dpa / nda / soc2 / iso27001 / contract / questionnaire / report / other |
| pdplr_version             | Version             | Whole Number   | default 1 |
| pdplr_status              | Status              | Text (20)      | draft / active / superseded / expired |
| pdplr_filepath            | File Path           | Text (500)     | |
| pdplr_filetype            | File Type           | Text (100)     | MIME type |
| pdplr_filesize            | File Size           | Whole Number   | bytes |
| pdplr_description         | Description         | Multiline Text | nullable |
| pdplr_tags                | Tags                | Multiline Text | Comma-separated, nullable |
| pdplr_effectivedate       | Effective Date      | Text (30)      | nullable |
| pdplr_expirydate          | Expiry Date         | Text (30)      | nullable |
| pdplr_uploadedby          | Uploaded By         | Text (50)      | nullable |
| pdplr_filecontent         | File Content        | **File column**| |

---

### 2.12 pdplr_reviewertemplate

| Column logical name       | Display name        | Type           | Notes |
|---------------------------|---------------------|----------------|-------|
| pdplr_reviewertemplateid  | Template ID         | Primary key    | |
| pdplr_title               | Title               | Text (200)     | |
| pdplr_description         | Description         | Multiline Text | nullable |
| pdplr_category            | Category            | Text (30)      | dpa / nda / letter / assessment / other |
| pdplr_filepath            | File Path           | Text (500)     | |
| pdplr_filetype            | File Type           | Text (20)      | extension e.g. docx |
| pdplr_isactive            | Is Active           | Yes/No         | |
| pdplr_uploadedby          | Uploaded By         | Text (50)      | nullable |
| pdplr_filecontent         | File Content        | **File column**| |

---

### 2.13 pdplr_appsettings

| Column logical name               | Display name              | Type    | Notes |
|-----------------------------------|---------------------------|---------|-------|
| pdplr_appsettingsid               | Settings ID               | Primary key | |
| pdplr_requiredocumentvalidation   | Require Doc Validation    | Yes/No  | default No |

*Create exactly one row in this table.*

---

### 2.14 pdplr_externallink

| Column logical name       | Display name        | Type           | Notes |
|---------------------------|---------------------|----------------|-------|
| pdplr_externallinkid      | External Link ID    | Primary key    | |
| pdplr_token               | Token               | Text (200)     | |
| pdplr_label               | Label               | Text (200)     | |
| pdplr_expiresat           | Expires At          | Date/Time      | nullable |
| pdplr_revoked             | Revoked             | Yes/No         | |
| pdplr_recipientemail      | Recipient Email     | Text (200)     | nullable |
| pdplr_recipientname       | Recipient Name      | Text (200)     | nullable |
| pdplr_status              | Status              | Text (30)      | |
| pdplr_approvedat          | Approved At         | Date/Time      | nullable |

---

### 2.15 pdplr_notifpreference

| Column logical name       | Display name        | Type           | Notes |
|---------------------------|---------------------|----------------|-------|
| pdplr_notifpreferenceid   | Preference ID       | Primary key    | |
| pdplr_userid              | User ID             | Text (50)      | |
| pdplr_type                | Notification Type   | Text (80)      | NotificationType enum |
| pdplr_inapp               | In-App Enabled      | Yes/No         | default Yes |

**Alternate key:** composite `(pdplr_userid, pdplr_type)` — required for upsert

---

## 3. Power Automate Flows

Create three HTTP-triggered flows (Instant cloud flow → When an HTTP request is received):

### Flow 1 — AI Streaming (`VITE_PA_AI_STREAM_URL`)

**Input** (JSON body):
```json
{ "feature": "...", "message": "...", "ticketId": "...", "context": {} }
```

**What it does:**
- Calls Azure OpenAI / Anthropic API with the message
- Streams the response back as Server-Sent Events:
  ```
  data: {"token": "Hello"}
  data: {"token": " world"}
  data: {"done": true}
  ```
- Return type: `application/octet-stream` (SSE stream)

> Note: Power Automate does not natively support SSE streaming. Use an **Azure Function** (Node.js)
> for this flow if you need true token-by-token streaming. The app falls back to mock streaming in
> demo mode if this URL is not set.

---

### Flow 2 — External Links (`VITE_PA_EXTERNAL_LINK_URL`)

Three sub-paths are called with `POST`:

| Sub-path    | Input                                              | Output |
|-------------|---------------------------------------------------|--------|
| `/generate` | `{ ticketId, recipientEmail, expiresInHours }`    | `{ token, link, expiresAt }` |
| `/redeem`   | `{ token }`                                       | `{ ticket, expiresAt, recipientEmail, alreadyDecided, decision }` |
| `/decide`   | `{ token, decision: "approve"\|"reject", notes }` | 200 OK |

The flow should use a **Switch** on a `path` query parameter or route to separate child flows.

---

### Flow 3 — Create External Account (`VITE_PA_CREATE_ACCOUNT_URL`)

**Input:**
```json
{ "email": "...", "fullName": "...", "label": "...", "expiresAt": "..." }
```

**What it does:**
- Creates a guest user in Entra ID (Graph API)
- Creates a `pdplr_user` record in Dataverse with `role = external_recipient`
- Generates a temporary password
- Returns: `{ tempPassword, portalUrl }`

---

## 4. Environment Variables (`.env.local`)

```env
VITE_DATAVERSE_URL=https://yourorg.crm.dynamics.com
VITE_DV_TABLE_PREFIX=pdplr_
VITE_MSAL_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_MSAL_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_PA_AI_STREAM_URL=https://...
VITE_PA_EXTERNAL_LINK_URL=https://...
VITE_PA_CREATE_ACCOUNT_URL=https://...
VITE_AZURE_OPENAI_KEY=...
VITE_AZURE_OPENAI_ENDPOINT=https://...
VITE_AZURE_OPENAI_DEPLOYMENT=gpt-5.1-chat
```
