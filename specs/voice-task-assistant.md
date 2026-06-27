# Voice Task Assistant — Feature Spec

**Status:** Draft  
**Stack context:** Next.js App Router · Supabase (ap-southeast-2) · Vercel (syd1)

---

## Overview

A user records a voice memo in the iOS Shortcuts app. The audio is sent to a Next.js API route, transcribed by OpenAI Whisper, then processed by Claude to extract one or more structured tasks. Those tasks are created directly in the existing `tasks` table. The Shortcut receives a plain-text confirmation it can display as a notification.

---

## Who Can Use It

Org members with role `admin` or `project_manager`. The `estimator` and `viewer` roles are excluded. This is enforced server-side via `user_org_role()` — the Shortcut itself carries no role logic.

---

## Authentication

The iOS Shortcut cannot use Supabase session cookies. Instead, each eligible user generates a **personal voice token** — a signed, long-lived JWT or an opaque token row stored in a new `voice_tokens` table:

```sql
create table voice_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  org_id      uuid not null references organizations(id) on delete cascade,
  token       text not null unique default encode(gen_random_bytes(32), 'hex'),
  label       text,                        -- e.g. "Bilal's iPhone"
  last_used   timestamptz,
  created_at  timestamptz default now()
);

alter table voice_tokens enable row level security;

-- Only the owning user can see/delete their tokens
create policy "own_voice_tokens" on voice_tokens
  using (user_id = auth.uid());
```

The API route exchanges this token for the user's identity and checks their org role before proceeding. Tokens are revocable from a settings page (future work; for MVP, delete via Supabase dashboard is acceptable).

**Token storage:** The `token` column stores a SHA-256 hash of the raw value. The raw token is returned to the user once on generation and never stored plaintext. Lookup: `where token = sha256($input)`.

**Org identity from token only:** The `X-Org-Slug` header is used solely for context injection into the Claude prompt (project/member names). The authoritative `org_id` is always read from the `voice_tokens` row — never from the header. This prevents a valid token being used against a different org by passing a different slug.

---

## iOS Shortcut Setup

The Shortcut the user installs does the following in sequence:

1. **Record Audio** — uses the built-in "Record Audio" action. Format: m4a, mono, 16 kHz is sufficient (Whisper handles it).
2. **POST to API** — "Get Contents of URL" action:
   - URL: `https://<app-domain>/api/voice-tasks`
   - Method: `POST`
   - Headers: `Authorization: Bearer <voice_token>`, `X-Org-Slug: <orgSlug>`
   - Body: multipart/form-data with field `audio` = the recorded file
3. **Show Notification** — display the plain-text response body from the API.

The token and org slug are stored as Shortcut variables so the user only configures them once.

---

## API Route — `POST /api/voice-tasks`

**File:** `app/api/voice-tasks/route.ts`

### Request

```
POST /api/voice-tasks
Authorization: Bearer <voice_token>
X-Org-Slug: <orgSlug>
Content-Type: multipart/form-data

audio: <audio file>
```

### Processing Steps

```
1. Validate token → resolve user_id + org_id
2. Check user_org_role(org_id) is 'admin' or 'project_manager' → 403 if not
3. Forward audio bytes to Whisper API → get transcript
4. Call Claude with transcript + org context → get structured task list
5. Insert tasks into Supabase (one or many)
6. Return plain-text confirmation to Shortcut
```

### Request Validation (before any external call)

Before forwarding to Whisper, the route validates the incoming file:

- **Content-type check:** Reject if `Content-Type` is not one of `audio/mp4`, `audio/m4a`, `audio/mpeg`, `audio/wav`, `audio/webm`. Return `415 Unsupported Media Type` with a plain-text message.
- **Size check:** Reject if `audio` field exceeds 25 MB (Whisper hard limit). Return `413` (already in error table).
- **Non-empty check:** Reject if the audio file is 0 bytes. Return `400 "No audio received."`.

### Step 3 — Whisper

Call `openai.audio.transcriptions.create` with model `whisper-1` and `response_format: 'text'`. Pass the audio buffer as a `File` object. No language hint needed — Whisper auto-detects.

**Empty/silent transcript guard:** If Whisper returns an empty string or a string under 3 characters, return `400 "Could not hear anything in the recording. Please try again."` — do not forward to Claude.

### Step 4 — Claude Extraction

**System prompt (compressed):**

```
You are a task extraction assistant for a flooring company. 
Given a voice transcript, extract one or more tasks and return ONLY a JSON array.

Each task object must have:
  title        string   — the task description, written as an action
  project_name string | null  — project name mentioned, or null
  assignee     string | null  — person's name or @handle, or null
  due_date     string | null  — ISO date (YYYY-MM-DD), or null
  priority     "low" | "medium" | "high" | "urgent"  — default "medium"
  is_private   boolean  — true if the speaker says "for me" / "remind me", else false
  needs_review boolean  — true if any field is a guess with low confidence

Today's date is {{DATE}}. Resolve relative dates ("next Monday", "end of the week") to absolute ISO dates.
Org members: {{MEMBER_NAMES}}
Projects: {{PROJECT_NAMES}}

If the transcript contains multiple distinct tasks, return one object per task.
Never return prose. Return only the JSON array.
```

The server injects `DATE`, `MEMBER_NAMES`, and `PROJECT_NAMES` at request time — both are fetched in a single parallel query alongside the token validation.

**Transcript length cap:** If the transcript exceeds 4,000 characters (~30+ minutes of speech), truncate to 4,000 characters and append a note to the system prompt: `"Transcript was truncated. Extract tasks from what is present."` This prevents exceeding Claude's context budget on pathological inputs.

**Fuzzy matching after Claude responds:**  
Claude returns names as strings. The server then fuzzy-matches `project_name` against the org's project list and `assignee` against member display names (case-insensitive, partial match). If a match is found, the UUID is used. If not, the field is left null and `needs_review` is forced true.

Conflict resolution rules:
- If multiple members match the same partial name (e.g. "Sam" matches "Samuel" and "Samantha"), treat as no match — set assignee to null and force `needs_review: true`.
- If multiple projects match, apply the same rule — leave `project_id` null and force `needs_review: true`.
- If `due_date` resolves to a date in the past, force `needs_review: true` (the date is still stored as-is; the user can correct it).

**Schema validation before insertion:** After fuzzy matching, validate each task object has a non-empty `title` string and that `priority` is one of the four allowed values. Drop any task that fails validation and log a warning — do not abort the entire batch.

### Step 5 — Task Insertion

Each extracted task is inserted into the `tasks` table using the server Supabase client. The `created_by` field is the resolved `user_id`. The `tags` field is populated by the existing `parseTags(title)` logic (parses `@mentions` from the title string).

An additional tag `voice-import` is appended to every task created by this route so they are filterable in the UI.

If `needs_review` is true, an additional tag `needs-review` is appended. These tasks will surface in the task panel with a distinct visual indicator (see UI section below).

**Empty task list guard:** If Claude returns an empty array (no tasks found), return `200` with body `"No tasks found in your recording."` — do not attempt any insertion.

**Partial insert failure:** All inserts for a single request are wrapped in a Postgres transaction (via a single RPC call or a `begin`/`commit` block). If any insert fails, the entire batch is rolled back. The response tells the user how many tasks were attempted and asks them to try again. This prevents duplicate tasks on retry.

### Step 6 — Response

Return `200 text/plain` with a human-readable summary:

```
✓ 3 tasks created:
• "Call Henderson re: site access" (due Fri, assigned Sarah) — needs review
• "Order adhesive for Level 2" (high priority)
• "Follow up on Westfield quote"
```

On error, return `4xx` or `5xx` with a plain-text message the Shortcut can display.

---

## DB Changes

### New column on `tasks`

```sql
alter table tasks add column source text default 'manual';
-- values: 'manual' | 'voice'
```

This lets the UI and future analytics distinguish voice-created tasks without relying on tags alone. Tags remain the user-visible signal.

### New table `voice_tokens`

See Authentication section above.

### No RLS changes needed

Task insertion uses the same `insert_org_tasks` policy because `created_by = auth.uid()` is satisfied — the API route resolves the real user identity before inserting.

---

## UI Changes

### Task Panel — `needs-review` indicator

Tasks tagged `needs-review` show a small amber dot next to the title in the task list. Clicking the task opens the existing edit panel pre-focused on the title field so the user can confirm or correct Claude's interpretation. Saving removes the `needs-review` tag.

This is purely a UI layer — the tag drives the indicator, no schema change needed.

### Settings — Voice Token Management (MVP-lite)

A simple section under org settings (`/orgs/[orgSlug]/settings`) visible only to `admin` and `project_manager` roles:

- Shows a masked token with a copy button
- "Regenerate" button (invalidates old token, generates new one)
- "Setup Guide" link → a static page with step-by-step Shortcut installation instructions

Token generation is a Server Action; no client-side Supabase calls.

**Revocation race:** When a user clicks "Regenerate", the old token row is marked `revoked_at = now()` rather than deleted immediately. The API route rejects tokens where `revoked_at is not null`. A cleanup job (or next generation) can hard-delete old rows. This prevents a request that is in-flight at revocation time from causing a partial insert with no feedback to the user.

**`needs-review` dismissal:** The amber dot is cleared when the user explicitly saves a change to the task (any field edit + save). A save with no changes does not clear the tag — the user must modify at least one field to confirm they reviewed Claude's interpretation. This is enforced by comparing the submitted values against the stored values before removing the tag.

---

## Error Handling

| Scenario | API response | Shortcut sees |
|---|---|---|
| Invalid / missing token | 401 | "Invalid token. Check your Shortcut setup." |
| Role not permitted | 403 | "Your account role can't create tasks this way." |
| Unsupported audio format | 415 | "Unsupported audio format. Record as m4a or mp3." |
| Audio too large (>25 MB Whisper limit) | 413 | "Recording too long. Try a shorter memo." |
| Empty audio file | 400 | "No audio received." |
| Silent / inaudible recording | 400 | "Could not hear anything in the recording. Please try again." |
| No tasks found in transcript | 200 | "No tasks found in your recording." |
| Whisper or Claude timeout | 504 | "Request timed out. Try again." |
| Rate limit exceeded | 429 | "Too many requests. Wait a moment and try again." |
| Whisper fails | 502 | "Transcription failed. Try again." |
| Claude returns invalid JSON | 502 | "Could not parse tasks. Try again." |
| Supabase insert fails (all rolled back) | 500 | "Failed to save X tasks. Please try again." |

All errors are logged server-side with the token's `user_id` and `org_id` for debugging.

---

## Performance Notes

Per project rules:

- Token validation + org context (members, projects) fetched in `Promise.all` — single round-trip before hitting external APIs.
- Whisper and Claude calls are sequential by necessity (Claude needs the transcript), but both are external and out of the Supabase hot path.
- The API route is a standard Next.js route handler (not Edge Runtime — Supabase SSR client is incompatible with Edge without evaluation).
- No `select("*")` — member query selects `user_id, display_name`; project query selects `id, name`.

**Timeouts:** Both the Whisper and Claude calls are wrapped with `AbortSignal.timeout(25_000)` (25 s). If either times out, the route returns `504 "Request timed out. Try again."` rather than hanging until the Vercel function limit.

**Rate limiting:** The route enforces a limit of 10 requests per token per minute using an in-memory or KV counter. Exceeding the limit returns `429 "Too many requests. Wait a moment and try again."` This prevents accidental runaway Shortcuts and abuse.

Expected total latency: ~3–6 s for a 30-second memo (Whisper ~1–2 s, Claude ~1–3 s, DB insert <100 ms).

---

## Implementation Order

1. **DB migration** — `voice_tokens` table + `source` column on `tasks`
2. **Token management UI** — settings section, Server Action for generate/revoke
3. **API route** — `/api/voice-tasks` with Whisper + Claude pipeline
4. **Task panel** — `needs-review` amber dot indicator + auto-focus on edit
5. **iOS Shortcut template** — shareable `.shortcut` file linked from settings

---

## Out of Scope (MVP)

- Reminder / push notifications triggered by `due_date` — tasks rely on the existing task panel for visibility
- Multi-org support in a single Shortcut (one token = one org)
- Whisper language selection (auto-detect is sufficient)
- Streaming Claude responses
- Audio stored for replay or audit (audio is processed and discarded, not persisted)
