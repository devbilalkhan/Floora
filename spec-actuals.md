# Flooring Estimator — Phase 3 Spec: Project Actuals

**Feature:** Project Actuals — Income, Expense & Real Margin Tracking  
**Phase:** 3 (first feature)  
**Depends on:** Phase 1 (Digital Takeoff), Phase 2 (Estimation Form)  
**Owner:** Bilal (SPM Commercial Flooring / DFO Flooring, Australia)  
**Developer:** Claude Code  
**Last updated:** 2026-05-24

---

## 1. Purpose

The Actuals feature gives Bilal a live view of what a project is **actually** making vs. what was estimated. After a job is won, invoices come in (subcontractors, suppliers, site costs) and payments go out (progress claims, final invoice). Today these are tracked in spreadsheets. This feature replaces that by:

1. **Capturing real income** (client invoices issued / progress claims) and **real expenses** (supplier/subcontractor invoices received) against the project.
2. **Extracting line-item data from invoice images or PDFs** using the Claude API already in the codebase — zero manual re-entry for routine invoices.
3. **Computing real margin** and showing it alongside the estimated margin so Bilal can see whether the job is tracking to plan.

**Design principle:** the estimator is already familiar with the dense table pattern from the Estimation form. Actuals extends that same language — collapsible groups, Excel-like inline editing, numeric totals — while adding the AI-extraction layer as a first-class power tool.

---

## 2. Access control

The Actuals feature is **restricted to Admins and Project Managers only.** Regular members (e.g., on-site staff, viewers) cannot see or access this page.

### 2.1 Role definitions

| Role | Access to Actuals |
|---|---|
| `admin` | Full read + write — all tables, all groups, all line items, prompt config, margin dashboard |
| `project_manager` | Full read + write — same as admin for Actuals |
| `member` | No access — tab hidden, direct URL returns 403 |
| `viewer` (if added later) | No access — same as member |

> These roles map to the existing `org_members.role` column (or equivalent in the current schema). If the role system uses different names, align to the closest match and flag to Bilal before implementing.

### 2.2 Where access is enforced

Access is enforced at **three layers** — never rely on a single layer alone:

**Layer 1 — Supabase RLS**

Use the existing `user_project_role()` and `is_superadmin()` security-definer helpers (added in migration 021). These are already used across the codebase:

```sql
-- actual_groups, actual_line_items, extraction_runs: scoped by project_id
CREATE POLICY "admin_pm_access" ON actual_groups
  FOR ALL USING (
    is_superadmin()
    OR user_project_role(project_id) IN ('admin', 'project_manager')
  );

-- Apply the same pattern to actual_line_items and extraction_runs.

-- actuals_prompt_config: scoped by org via user_org_role()
CREATE POLICY "admin_pm_access" ON actuals_prompt_config
  FOR ALL USING (
    is_superadmin()
    OR user_org_role(org_id) IN ('admin', 'project_manager')
  );
```

**Layer 2 — Server Component route guard**

In `app/(protected)/orgs/[orgSlug]/projects/[projectId]/actuals/page.tsx`:

```ts
const member = await getOrgMember(orgSlug, userId)
if (!['admin', 'project_manager'].includes(member.role)) {
  redirect('/orgs/[orgSlug]/projects/[projectId]')
  // or return notFound() — consistent with how other protected routes handle 403
}
```

**Layer 3 — Tab visibility**

In the project detail tab bar, the **Actuals tab is only rendered** when the current user is an admin or project manager. Other roles see the tab list without it — no "disabled" state, no tooltip hinting it exists.

### 2.3 API route auth

The `/api/actuals/extract` route already checks authentication (§12). Extend it to also check the user's role:

```ts
const member = await getOrgMember(orgId, userId)
if (!['admin', 'project_manager'].includes(member.role)) {
  return Response.json({ error: 'Forbidden' }, { status: 403 })
}
```

### 2.4 Server Actions

All Server Actions in `actions.ts` must also verify the role before executing any mutation. Use a shared `assertActualsAccess(orgId, userId)` helper that throws if the role check fails — call it at the top of every action.

---

## 4. Australian context (same rules as Phase 2 — restated)

- **GST:** 10%, statutory, locked. All captured amounts are stored **ex-GST**. The page-level GST toggle controls display only — it never changes stored values.
- **Currency:** AUD. Display format: `$X,XXX.00`.
- **Date format:** DD/MM/YYYY display; ISO 8601 storage.
- **Time zone:** `Australia/Sydney`.

---

## 5. Scope — what to build

| In scope | Notes |
|---|---|
| Income table | Collapsible groups → individual invoice lines |
| Expense table | Collapsible groups → individual invoice lines |
| AI invoice extraction | Claude API, image/PDF upload, reviewer modal |
| Editable extraction prompt | "Prompt" button → modal to customise system prompt |
| Page-level GST toggle | Global; controls display of all amounts on this page |
| Real margin dashboard | Revenue vs. cost vs. estimated margin |
| Inline editing | All non-computed cells editable in place |
| Row-level subtotals | Per group + per table grand total |

| Out of scope | Future |
|---|---|
| Document storage | Files are uploaded for extraction only — not saved |
| Multi-user locking | Phase 4 |
| Automated bank/accounting reconciliation | Phase 4 |
| Supplier catalog matching | Phase 3 later |

---

## 6. Route & navigation

```
/orgs/[orgSlug]/projects/[projectId]/actuals
```

Added as a new tab on the Project detail page, alongside **Takeoff** and **Estimate**:

```
[ Takeoff ]  [ Estimate ]  [ Actuals ]   ← new tab
```

The Actuals tab is always visible on projects that have at least one estimation with status `submitted`, `won`, or `lost`. For `draft` projects the tab is visible but shows an empty-state prompt: _"Mark the estimation as submitted before tracking actuals."_

---

## 7. Data model

All tables follow Phase 1/2 conventions: UUID PKs, `owner_id` FK → `profiles.id`, `org_id` FK → `orgs.id`, RLS on every table (`owner_id = auth.uid()`), `created_at` / `updated_at` timestamptz.

### 5.1 `actual_groups`

Top-level grouping row in either the income or expense table. Analogous to a "section" (e.g., "Progress Claim 1", "Labour — Subcontractor July").

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| project_id | uuid (FK → projects.id) | |
| org_id | uuid (FK → orgs.id) | |
| owner_id | uuid (FK → profiles.id) | |
| type | text | `"income"` \| `"expense"` |
| name | text | User-editable group label; e.g. "Progress Claim 1 — North Constructions" |
| sort_order | int | Controls display order within the table |
| is_collapsed | boolean | Default false; persisted per group so state survives refresh |
| notes | text (nullable) | Internal note on the group |
| created_at, updated_at | timestamptz | |

> `is_collapsed` is a UI preference stored server-side so the collapsed state persists across sessions and devices.

### 5.2 `actual_line_items`

One row per invoice line. Always a child of an `actual_group`.

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| group_id | uuid (FK → actual_groups.id, ON DELETE CASCADE) | |
| project_id | uuid (FK → projects.id) | denormalised for fast querying |
| owner_id | uuid (FK → profiles.id) | |
| sort_order | int | Controls display order within the group |
| invoice_date | date (nullable) | DD/MM/YYYY display; ISO storage |
| invoice_number | text (nullable) | e.g. "INV-2045" |
| description | text | Required; e.g. "Vinyl installation — Level 2 wards" |
| qty | numeric (nullable) | Optional; blank renders as `—` |
| unit_price | numeric (nullable) | Ex-GST per unit; optional |
| subtotal | numeric | **Required. Ex-GST.** If qty + unit_price both present, computed as `qty × unit_price`; otherwise manually entered. Stored always. |
| source | text | `"manual"` \| `"ai_extracted"` — audit trail |
| extraction_run_id | uuid (nullable) | FK → `extraction_runs.id`; links to the AI run that created this row |
| created_at, updated_at | timestamptz | |

> **Subtotal is always stored ex-GST.** The GST toggle affects display only.

**Computed subtotal logic:**
- If both `qty` and `unit_price` are filled: `subtotal = qty × unit_price` (computed live; stored on save).
- If either is blank: `subtotal` is a free-entry field the user types directly.
- If the user later clears `qty` or `unit_price`, `subtotal` becomes free-entry again and retains the last stored value (do not auto-zero).

### 5.3 `extraction_runs`

Audit log of each Claude API extraction call. One run per invoice file uploaded.

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| project_id | uuid (FK → projects.id) | |
| owner_id | uuid (FK → profiles.id) | |
| group_id | uuid (nullable, FK → actual_groups.id) | the group the user was adding to when they triggered extraction |
| file_name | text | Original filename (display only — file is NOT stored) |
| file_mime_type | text | `"image/jpeg"` \| `"image/png"` \| `"application/pdf"` etc. |
| prompt_used | text | The exact system prompt sent to Claude (including any user customisation) |
| raw_response | jsonb | Full Claude API response (for debugging / re-review) |
| line_items_extracted | int | Count of line items returned |
| status | text | `"pending"` \| `"completed"` \| `"failed"` |
| error_message | text (nullable) | Set if status = `"failed"` |
| created_at | timestamptz | |

### 5.4 `actuals_prompt_config`

Org-level stored prompt config. One row per `org_id`.

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| org_id | uuid (FK → organizations.id, UNIQUE) | one config per org |
| owner_id | uuid (FK → profiles.id) | last editor |
| income_system_prompt | text | Custom system prompt for income invoice extraction |
| expense_system_prompt | text | Custom system prompt for expense invoice extraction |
| updated_at | timestamptz | |

> Default prompts are defined in the application layer (see §8.3) and used when no row exists for the org. The row is only written when the user saves a customisation.

### 5.5 Retention (on `projects` table)

Retention is stored on the project itself, not in a separate Actuals table. Migration 038 adds two columns:

| Column | Type | Notes |
|---|---|---|
| retention_pct | numeric(5,2) nullable | Percentage withheld from each progress claim. `null` or `0` = no retention. Typical values: `5.00`, `10.00`. |
| retention_released | numeric(12,2) not null default 0 | Cumulative amount of retention already released by the client (ex-GST). Used to compute outstanding retention. |

**How retention works:**
- `retention_held` (display-only, not stored) = `total_income × (retention_pct / 100) − retention_released`
- When the client releases retention, the PM adds a regular income line item (e.g., _"Retention Release — Practical Completion"_) **and** increments `retention_released` on the project. The two columns stay in sync.
- The margin dashboard shows `retention_held` as an informational line below gross income — it does **not** affect the GP% calculation, which compares invoiced revenue vs. expenses.

**Where to set `retention_pct`:**
In the existing Edit Project Details dialog — add a nullable "Retention %" numeric field. Zero and null both mean no retention.

**Australian context:** Retention is typically 5–10% of the contract value, split release at Practical Completion (50%) and end of Defects Liability Period (50%).

---

## 8. Page layout

### 6.1 Overall structure

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← Back · ProjectName                                     [org nav]  │
├──────────────────────────────────────────────────────────────────────┤
│  [ Takeoff ]  [ Estimate ]  [ Actuals ]  ← active tab                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─ MARGIN DASHBOARD ────────────────────────────────────────────┐   │
│  │  Estimated margin  ←→  Actual margin  ←→  Variance           │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─ INCOME ─────────────────────────────────────────── [+ Add] ─┐   │
│  │  [table]                                                      │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─ EXPENSES ────────────────────────────────────────── [+ Add] ─┐   │
│  │  [table]                                                      │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Global controls (top-right of page, sticky):**

```
[ ex-GST ⟷ inc-GST ]   [ Prompt ⚙ ]
```

- **GST toggle** — pill switch; default `ex-GST`. When toggled to `inc-GST`, all displayed subtotals and totals multiply by 1.1. The underlying stored values never change.
- **Prompt button** — opens the Prompt Config modal (§8.4). Icon: `Settings2` (Lucide).

---

### 6.2 Margin dashboard

A compact glass card spanning the full width directly below the tab bar.

```
┌────────────────────────────────────────────────────────────────────┐
│  ESTIMATED                    ACTUAL (TO DATE)         VARIANCE    │
│                                                                    │
│  Revenue (ex-GST)             Revenue (ex-GST)                    │
│  $142,500.00                  $95,000.00              -33%         │
│                                Retention held: -$4,750.00 (5%)    │
│                                Net received:   $90,250.00          │
│                                                                    │
│  Gross Profit                 Gross Profit                         │
│  $26,662.50  (18.7%)          $18,200.00  (19.2%)    +0.5pp       │
│                                                                    │
│  Net Margin (markup)                                               │
│  23.0%                        24.1%                  +1.1pp       │
└────────────────────────────────────────────────────────────────────┘
```

**Computed values:**

```
// Estimated side — sourced from latest estimate with status submitted/approved.
// estimates table has no stored total_ex_gst — must fetch estimate row + items
// and run computeSummary() from lib/estimate-types.ts (same as project detail page).
estimated_revenue      = summary.totalExGst          // total price to client ex-GST
estimated_gross_profit = estimated_revenue - summary.baseTotal  // baseTotal = mat+lab costs
estimated_gp_pct       = (estimated_gross_profit / estimated_revenue) × 100
estimated_net_margin   = estimates.net_markup_pct    // stored as a % e.g. 23.00

// Actual side — sourced from actual_line_items
actual_income_total   = SUM(subtotal) WHERE group.type = 'income'
actual_expense_total  = SUM(subtotal) WHERE group.type = 'expense'
actual_gross_profit   = actual_income_total - actual_expense_total
actual_gp_pct         = (actual_gross_profit / actual_income_total) × 100 [show — if income = 0]
actual_net_margin     = (actual_gross_profit / actual_expense_total) × 100 [markup on cost]

// Retention (shown informational only — does not affect GP calculation)
retention_held        = actual_income_total × (projects.retention_pct / 100) − projects.retention_released
                        [only shown when projects.retention_pct is not null and > 0]
net_cash_received     = actual_income_total - retention_held

// Variance
revenue_variance_pct  = ((actual_income_total - estimated_revenue) / estimated_revenue) × 100
gp_variance_pp        = actual_gp_pct - estimated_gp_pct           [percentage points]
margin_variance_pp    = actual_net_margin - estimated_net_margin    [percentage points]
```

**Colour coding for variance column:**

| Condition | Colour |
|---|---|
| Actual GP% > estimated GP% | `text-success` |
| Within ±2pp | `text-muted-foreground` |
| Actual GP% < estimated GP% by 2–5pp | `text-warning` |
| Actual GP% < estimated GP% by >5pp | `text-destructive` |

The dashboard does **not** show GST amounts regardless of the GST toggle — it is always ex-GST because margin is a pre-GST concept.

If no winning estimation exists: show a `text-muted-foreground/50` placeholder row _"No submitted estimation linked — estimated figures unavailable."_

**Retention row (conditional):** If `projects.retention_pct` is set and > 0, render two extra rows in the Actual column directly below "Revenue":
- `Retention held (X%)` — `text-warning/80 tabular-nums` — value shown as `−$X,XXX.XX`
- `Net cash received` — `text-muted-foreground tabular-nums` — value shown as `$X,XXX.XX`

These rows have no Estimated or Variance counterpart — they are informational only and always ex-GST regardless of the GST toggle.

---

### 6.3 Income & expense table layout

Both tables share the same component (`<ActualsTable type="income" | "expense" />`). The section header distinguishes them.

**Section header:**
```
INCOME        $95,000.00 invoiced · $4,750.00 held (5%) · $90,250.00 net    [+ Add Group]   [↑ Upload Invoice ⚡]
```
(The retention summary is only rendered when `projects.retention_pct > 0`; otherwise just the invoiced total is shown.)

- Title: `text-[11px] font-semibold uppercase tracking-wide text-muted-foreground`
- Invoiced total: `text-[11px] tabular-nums text-foreground/70` (updates live with GST toggle)
- Retention held: `text-[11px] tabular-nums text-warning/70` — shown only when retention applies
- Net received: `text-[11px] tabular-nums text-muted-foreground` — shown only when retention applies
- `[+ Add Group]` — creates a new empty `actual_group` row inline
- `[↑ Upload Invoice ⚡]` — triggers AI extraction flow (§8) — lightning bolt signals AI action

---

### 6.4 Group row

Each `actual_group` renders as a header row spanning all columns:

```
▼  Progress Claim 1 — North Constructions    3 lines    $45,000.00    [ ⋯ ]
```

| Element | Style |
|---|---|
| Chevron (`▼` / `▶`) | `h-3 w-3 text-muted-foreground/70`; rotates 90° when collapsed (150ms ease-out) |
| Group name | Inline-editable text; `text-[11px] font-medium text-foreground/70`; click to edit |
| Line count | `text-[10px] text-muted-foreground/45` |
| Group subtotal | `text-[11px] tabular-nums text-foreground/70`; right-aligned; updates with GST toggle |
| `⋯` menu | Ghost icon button; options: Add line, Duplicate group, Delete group (with confirmation) |

Row background: `bg-muted/20 border-t border-b border-black/10 dark:border-white/10`

Collapse / expand: clicking the chevron or anywhere on the group row (except the name input and kebab) toggles `is_collapsed`. The transition is a smooth height animation (200ms ease-out) — children slide up/down, not cut instantly.

---

### 6.5 Line item columns

When a group is expanded, its child `actual_line_items` appear below it. Table uses `table-fixed` layout with a `<colgroup>`.

| # | Column | Width | Input type | Notes |
|---|---|---|---|---|
| — | Row index | 24px | Read-only | `text-[10px] text-muted-foreground/45` |
| 1 | Date | 88px | Date picker / text | DD/MM/YYYY; `text-[11px] text-foreground/70` |
| 2 | Invoice # | 96px | Text input | e.g. "INV-2045"; `font-mono uppercase text-[11px]` |
| 3 | Description | flex (absorbs remaining space) | Text input | Required; `text-[11px] text-foreground/70` |
| 4 | Qty | 56px | Number input | Optional; right-aligned; tabular-nums |
| 5 | Unit Price | 88px | Currency input | Ex-GST; right-aligned; tabular-nums |
| 6 | Subtotal | 96px | Currency / computed | Ex-GST; **read-only** if qty + price both filled (computed tint `bg-primary/5`); otherwise editable; right-aligned; `text-foreground/70` |
| 7 | Actions | 32px | — | Trash icon; `opacity-0 group-hover:opacity-100` |

**GST toggle effect on display:**
When `inc-GST` is active, columns 5 (Unit Price) and 6 (Subtotal) display `value × 1.1`. A subtle `(inc. GST)` label appears in the column header. The input cells show the GST-inclusive value in a read-only overlay — the underlying input always stores and edits ex-GST values to prevent rounding drift.

**Shared input class** (from design.md §13):
```
h-full w-full px-2 py-1 text-[11px] bg-transparent border-0 outline-none
focus:ring-1 focus:ring-inset focus:ring-primary/40
placeholder:text-muted-foreground/55 text-foreground/70
```

**Numeric inputs** add: `text-right tabular-nums`  
**Invoice number** adds: `font-mono uppercase tracking-wide`

**AI-extracted rows** get a subtle left border accent: `border-l-2 border-l-secondary/40` and a `⚡` badge in the row index cell (`text-[9px] text-secondary/60`) to distinguish them from manually entered rows. On hover, a tooltip reads _"Extracted by Claude — verify before saving."_

---

### 6.6 Table footer (per-table grand total bar)

Below each table (not per-group — there is one grand total per table):

```
┌───────────────────────────────────────────────────────────────────┐
│  Total income (ex-GST)     $95,000.00      12 line items          │
└───────────────────────────────────────────────────────────────────┘
```

Style: `flex items-center gap-6 px-4 py-2 bg-card/65 backdrop-blur-xl border border-white/[0.08] rounded-sm`

| Element | Class |
|---|---|
| Label | `text-[10px] text-muted-foreground` |
| Total | `text-sm font-semibold tabular-nums text-foreground/75` |
| Line count | `text-[11px] text-muted-foreground/70` |
| GST note (when toggle = inc-GST) | `text-[10px] text-warning/70 ml-auto` → "Amounts shown inc. 10% GST" |

---

### 6.7 Empty state

When a table has no groups yet:

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│            [Receipt icon — h-10 w-10 text-muted-foreground]     │
│                                                                  │
│                    No income recorded yet                        │
│         Upload an invoice or add a group to get started.        │
│                                                                  │
│         [ ↑ Upload Invoice ⚡ ]    [ + Add Group manually ]     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 9. Inline editing behaviour

- **Click to edit**: any non-computed cell becomes an `<input>` on click. The active cell gets `focus:ring-1 focus:ring-inset focus:ring-primary/40`.
- **Tab / Shift-Tab**: moves focus to the next / previous editable cell in reading order (left-to-right, then next row).
- **Enter**: confirms the edit and moves to the cell below (same column, next row) — same behaviour as Excel.
- **Escape**: cancels the edit and restores the previous value.
- **Auto-save**: 2-second debounce after the last keystroke writes to Supabase. "Saving…" → "Saved ✓" indicator in the page header (same pattern as Phase 2).
- **Drag to reorder**: `actual_line_items` within a group can be dragged by the row-index cell (cursor: `grab`). Group order can be dragged by a `⠿` drag-handle on the group row left-edge.

---

## 10. AI invoice extraction

### 8.1 Entry points

Three ways to trigger extraction:

1. **`[↑ Upload Invoice ⚡]` button** in the section header — opens the extraction dialog targeting the most recent group (or prompting to create one).
2. **`⋯` menu on a group row → "Upload invoice to this group"** — explicitly targets that group.
3. **Drag-and-drop** on the Actuals page — dragging a file anywhere onto the income or expense table triggers the extraction dialog, pre-selecting that table's type.

### 8.2 Extraction dialog — step 1: file selection

A `sm:max-w-md` glass modal:

```
┌─────────────────────────────────────────────────────┐
│  Extract invoice data                            ✕  │
│  ─────────────────────────────────────────────────  │
│                                                     │
│   ┌─────────────────────────────────────────────┐   │
│   │                                             │   │
│   │   📎  Drop invoice here or click to browse  │   │
│   │   PNG · JPG · PDF · HEIC · XLSX · CSV       │   │
│   │                                             │   │
│   └─────────────────────────────────────────────┘   │
│                                                     │
│  Add to group:  [ Progress Claim 1          ▾ ]    │
│                 [ + New group                  ]    │
│                                                     │
│  Invoice type:  ● Income   ○ Expense               │
│                                                     │
│                            [ Cancel ]  [ Extract ⚡]│
└─────────────────────────────────────────────────────┘
```

- File input: `accept="image/*,application/pdf,.xlsx,.xls,.csv"`. Max size: **20MB**. If exceeded: `text-destructive` inline error _"File too large — max 20MB."_
- Once a file is selected: images show a thumbnail preview; PDFs and spreadsheets show a file-name chip with an appropriate icon (`FileSpreadsheet` for xlsx/csv, `FileText` for PDF).
- "Add to group" dropdown is pre-selected to whichever group triggered the action.
- "Invoice type" defaults to `income` in the income section, `expense` in the expense section. Can be changed here (e.g., the user opened it from the wrong section).
- "Extract ⚡" is disabled until a file is selected.

### 8.3 File type routing

The extraction pipeline forks based on file type before calling Claude. Two pathways:

| File type | Pathway | What Claude receives |
|---|---|---|
| Image (PNG, JPG, HEIC, WEBP) | Vision pathway | Base64-encoded image as a `image` content block |
| PDF | Vision pathway | Base64-encoded PDF as a `document` content block (Claude's native PDF support) |
| Excel (.xlsx, .xls) | Spreadsheet pathway | Structured text (CSV-like) extracted client-side by SheetJS |
| CSV (.csv) | Spreadsheet pathway | Raw CSV text read via `FileReader.readAsText()` |

The pathway is determined **client-side** before the POST, so the server always receives either a base64 blob or a structured text string — never a raw file binary.

### 8.4 Spreadsheet pathway — Excel & CSV extraction

Excel and CSV files contain structured tabular data. Rather than sending them as images (which would lose fidelity on large sheets), parse them client-side first and send Claude structured text — faster, cheaper, and more accurate.

**Client-side parsing (in `extraction-dialog.tsx`):**

```ts
import * as XLSX from 'xlsx'  // lazy-loaded — already behind dynamic() boundary

async function parseSpreadsheet(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })

  // Use the first sheet, or the sheet named "Invoice" / "Lines" if present
  const sheetName =
    workbook.SheetNames.find(n => /invoice|lines|items/i.test(n))
    ?? workbook.SheetNames[0]

  const sheet = workbook.Sheets[sheetName]

  // Convert to CSV — preserves structure without the binary overhead
  // header: 1 = first row is headers; defval = '' fills empty cells
  return XLSX.utils.sheet_to_csv(sheet, { defval: '' })
}
```

The resulting CSV string is sent in the POST body as `structured_text` (not `file_base64`).

**Multi-sheet files:** If the workbook has more than one sheet, show a sheet selector in the dialog **before** the "Extract ⚡" button is enabled:

```
Sheet:  [ Invoice Lines ▾ ]    (dropdown — only shown when >1 sheet)
```

Default: the first sheet whose name matches `invoice|lines|items` (case-insensitive), else the first sheet. User can change it.

### 8.5 Extraction — Claude API call

**On "Extract ⚡" click:**

1. Show a loading state inside the modal — spinner + _"Claude is reading the invoice…"_
2. **Branch on file type (client-side):**
   - Image / PDF → convert to base64 with `FileReader.readAsDataURL()`, strip the `data:...;base64,` prefix.
   - Excel / CSV → parse with SheetJS / `readAsText()` into a CSV string (see §8.4).
3. POST to `/api/actuals/extract` with either `file_base64` + `file_mime_type`, or `structured_text` + `file_mime_type`.
4. The API route calls the Claude API (using the existing API client in the codebase):

**For image / PDF inputs** — vision message:
```
System prompt (from actuals_prompt_config, or default):

  You are an invoice data extraction assistant for a commercial flooring company.
  Extract every line item from this invoice.
  Return a JSON array with this exact shape — nothing else:
  [
    {
      "invoice_date": "YYYY-MM-DD or null",
      "invoice_number": "string or null",
      "description": "string",
      "qty": number or null,
      "unit_price": number or null,
      "subtotal": number  ← REQUIRED, always ex-GST
    }
  ]
  Rules:
  - All monetary amounts must be EXCLUDING GST (10% Australian GST).
    If the invoice shows inc-GST amounts, divide by 1.1 before returning.
  - If qty and unit_price are present, subtotal = qty × unit_price (verify this).
  - If there is only a lump-sum line (no qty/unit_price), set qty and unit_price to null
    and put the amount in subtotal.
  - invoice_date: convert any Australian date format (DD/MM/YYYY) to ISO (YYYY-MM-DD).
  - invoice_number: use the invoice/reference number printed on the document.
    If there are multiple (e.g., PO number + invoice number), use the invoice number.
  - description: the line item description as printed. Keep it concise.
  - Do not invent data. If a field is not on the invoice, return null.
  - Do not include GST line items as separate rows.

User message: [image / document content block]
```

**For spreadsheet inputs** — text message (different prompt, no vision needed):
```
System prompt (from actuals_prompt_config, or default):

  You are an invoice data extraction assistant for a commercial flooring company.
  The following is a CSV export of an Excel invoice or expense sheet.
  Extract every line item that represents a billable item, cost, or expense.
  Ignore header rows, summary rows, totals rows, and blank rows.
  Return a JSON array with this exact shape — nothing else:
  [
    {
      "invoice_date": "YYYY-MM-DD or null",
      "invoice_number": "string or null",
      "description": "string",
      "qty": number or null,
      "unit_price": number or null,
      "subtotal": number  ← REQUIRED, always ex-GST
    }
  ]
  Rules:
  - All monetary amounts must be EXCLUDING GST (10% Australian GST).
    If any column label contains "inc GST" or "incl GST", divide those values by 1.1.
  - If both qty and unit_price columns exist and are populated, set subtotal = qty × unit_price.
  - invoice_date: convert any Australian date format (DD/MM/YYYY) to ISO (YYYY-MM-DD).
  - invoice_number: look for columns named "Invoice No", "Inv #", "Reference", "Ref No" etc.
  - description: use the most descriptive column available (Description, Item, Details, etc.).
  - If a row has no description and no subtotal, skip it.
  - Do not invent data. If a field is not present, return null.

User message: [CSV text pasted as plain text]
```

5. Parse the JSON response. If parsing fails, return `status: "failed"` and store `error_message`.
6. Create an `extraction_runs` row with `prompt_used`, `raw_response`, `line_items_extracted`, `status`. Store the file type in `file_mime_type` so the pathway is auditable.
7. Return the parsed array to the client.

**Error handling:**
- Claude API error / timeout: modal shows `text-destructive` banner _"Extraction failed — you can add lines manually."_ The "Extract ⚡" button becomes "Retry".
- JSON parse failure: same banner + show the raw text response in a collapsed `<details>` block so the user can copy-paste manually.
- Empty result (`[]`): for images/PDFs → _"No line items found — the invoice may be handwritten or unclear. Try a clearer photo, or add lines manually."_ For spreadsheets → _"No line items found — the sheet may not contain a recognisable invoice structure. Try selecting a different sheet, or add lines manually."_
- SheetJS parse error (corrupt xlsx): `text-destructive` inline error in the dialog — _"Could not read this file. Try saving it as .csv from Excel and uploading again."_

### 8.6 Extraction dialog — step 2: review

After a successful extraction, the modal expands to a review step (`sm:max-w-2xl`):

```
┌────────────────────────────────────────────────────────────────────────┐
│  Review extracted lines                                             ✕  │
│  4 lines found in "invoice-RM-2045.pdf"                                │
│  ──────────────────────────────────────────────────────────────────   │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  DATE        INV #      DESCRIPTION              QTY  PRICE  SUBTOTAL │
│  │  ──────────────────────────────────────────────────────────────  │
│  │  15/07/2026  INV-2045   Vinyl install L2 wards   240  $23.00  $5,520.00  [✓] │
│  │  15/07/2026  INV-2045   Coving installation       87  $25.00  $2,175.00  [✓] │
│  │  15/07/2026  INV-2045   Floor prep — grind        60  $10.00    $600.00  [✓] │
│  │  15/07/2026  INV-2045   Freight to site            —       —  $1,200.00  [✓] │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  All amounts shown ex-GST.   Total: $9,495.00                         │
│                                                                        │
│  ⚠ Verify amounts against the original invoice before importing.       │
│                                                                        │
│                      [ ← Back ]  [ Cancel ]  [ Import X lines ]       │
└────────────────────────────────────────────────────────────────────────┘
```

**Review table behaviour:**
- Every cell is editable inline — the user can correct any value Claude got wrong before importing.
- Each row has a checkbox `[✓]` on the right; all are checked by default. User can uncheck rows to exclude them.
- The total at the bottom updates live as rows are edited or deselected.
- Dates are shown DD/MM/YYYY. Storage will convert to ISO.
- "Import X lines" button label updates to reflect the checked-row count.
- On import: creates `actual_line_items` rows under the target group, all with `source = "ai_extracted"` and `extraction_run_id` set. The modal closes and the table scrolls to the new rows.

### 8.7 Editable prompt — "Prompt ⚙" modal

Accessible from the sticky global control bar (top-right of the Actuals page).

A `sm:max-w-2xl` glass modal with two tabs: **Income prompt** | **Expense prompt**

```
┌──────────────────────────────────────────────────────────────┐
│  Extraction prompt settings                              ✕   │
│  ──────────────────────────────────────────────────────────  │
│  [ Income prompt ]  [ Expense prompt ]                       │
│  ──────────────────────────────────────────────────────────  │
│                                                              │
│  This prompt is sent to Claude when extracting data from     │
│  income invoices. Customise it if your invoices have unusual │
│  formats or you want to capture additional fields.           │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  [textarea — full system prompt, monospace, h-64]    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  [ Reset to default ]          [ Cancel ]  [ Save prompt ]  │
└──────────────────────────────────────────────────────────────┘
```

- Textarea: `font-mono text-[11px] text-foreground/70 bg-input rounded-md p-3 resize-y`
- Pre-populated with the current saved prompt, or the application default if none saved.
- **"Reset to default"**: clears `actuals_prompt_config` for this org and restores the hardcoded default. Requires an inline confirmation tooltip/popover: _"Reset to the default prompt? Your customisation will be lost."_  
- "Save prompt": upserts `actuals_prompt_config` row. Shows "Saved ✓" toast (1.5s).
- The prompt is saved per `org_id` — shared across all projects in the org.
- This modal is non-blocking: the user can save the prompt and immediately go back to upload an invoice.

---

## 11. GST toggle — global page behaviour

The toggle is a pill switch in the sticky page controls:

```tsx
<div className="flex items-center gap-1.5 rounded-md border border-white/10 p-0.5 bg-card/65">
  <button
    className={cn("px-2.5 py-1 rounded text-[11px] transition-colors",
      gstMode === 'ex' ? 'bg-muted text-foreground/75' : 'text-muted-foreground hover:text-foreground/60'
    )}
    onClick={() => setGstMode('ex')}
  >
    ex-GST
  </button>
  <button
    className={cn("px-2.5 py-1 rounded text-[11px] transition-colors",
      gstMode === 'inc' ? 'bg-muted text-foreground/75' : 'text-muted-foreground hover:text-foreground/60'
    )}
    onClick={() => setGstMode('inc')}
  >
    inc-GST
  </button>
</div>
```

**Rules:**
- Default: `ex-GST`.
- `gstMode` lives in React state at the page level and is passed via context to all child table components. It is **not** persisted to the database.
- When `inc-GST` is active:
  - All `subtotal`, group subtotals, and table grand totals display `value × 1.1`.
  - Column headers `Unit Price` and `Subtotal` gain a `(inc. GST)` suffix in `text-muted-foreground/50`.
  - The inline inputs **still show and accept ex-GST values** — the GST label beside the column header serves as a reminder, but editing always works in ex-GST.
  - Margin dashboard is always ex-GST and ignores the toggle.
- A `text-[10px] text-warning/70` note appears in the grand total bar when in `inc-GST` mode: _"Amounts shown inc. 10% GST — stored values are ex-GST."_

---

## 12. Component hierarchy

```
ActualsPage (Server Component)
  ├── fetches: project, linked estimation, actual_groups + actual_line_items in parallel
  │            (Promise.all — never sequential awaits)
  ├── MarginDashboard (Client Component — receives props)
  ├── GstToggle + PromptButton (Client, sticky controls)
  └── ActualsSection type="income" | "expense" (Client Component)
        ├── SectionHeader (group count, total, add/upload buttons)
        └── ActualsTable
              ├── GroupRow (collapsible)
              │     └── LineItemRow × n (inline-editable)
              └── TableFooter (grand total bar)
```

**Server Component data fetching:**
```ts
// app/(protected)/orgs/[orgSlug]/projects/[projectId]/actuals/page.tsx

const [project, estimation, groups, lineItems] = await Promise.all([
  getProject(projectId),
  getLatestWonEstimation(projectId),     // for margin dashboard
  getActualGroups(projectId),
  getActualLineItems(projectId),         // denormalised by project_id for one round-trip
])
```

The `getActualLineItems` query selects explicit columns only — no `select("*")`:
```ts
.select("id, group_id, sort_order, invoice_date, invoice_number, description, qty, unit_price, subtotal, source")
```

**Client Components** (`'use client'`):
- `ActualsSection` — manages optimistic updates for add/delete/reorder
- `GroupRow` — manages collapsed state, inline group-name edit
- `LineItemRow` — manages cell editing, tab navigation
- `GstToggle` — manages `gstMode` context
- `ExtractionDialog` — multi-step modal
- `PromptConfigModal` — prompt editor

None of these Components fetch from Supabase directly. All mutations go through **Server Actions** in `app/actions/actuals.ts`.

**Suspense boundaries:**

The page has two independent slow sections (income table + expense table) and one faster section (margin dashboard). Wrap them independently so the fastest section renders first:

```tsx
// page.tsx (Server Component)
export default async function ActualsPage({ params }) {
  // Fast: project header data only — needed immediately for shell render
  const project = await getProject(params.projectId)

  return (
    <>
      <ProjectHeader project={project} />
      <Suspense fallback={<MarginDashboardSkeleton />}>
        <MarginDashboardLoader projectId={params.projectId} />
      </Suspense>
      <Suspense fallback={<ActualsTableSkeleton label="INCOME" />}>
        <ActualsSectionLoader projectId={params.projectId} type="income" />
      </Suspense>
      <Suspense fallback={<ActualsTableSkeleton label="EXPENSES" />}>
        <ActualsSectionLoader projectId={params.projectId} type="expense" />
      </Suspense>
    </>
  )
}
```

Each `*Loader` is a Server Component that fetches its own data. The income and expense tables load in parallel (Next.js streams them concurrently) — neither blocks the other. The skeleton fallbacks must use `bg-muted/40 animate-pulse` per design.md.

---

## 13. Server Actions

All in `app/(protected)/orgs/[orgSlug]/projects/[projectId]/actuals/actions.ts`.

| Action | Description |
|---|---|
| `createGroup(projectId, type, name)` | Insert `actual_groups` row |
| `updateGroup(groupId, patch)` | Patch name / is_collapsed / notes |
| `deleteGroup(groupId)` | Hard delete; CASCADE deletes child line items |
| `reorderGroups(projectId, type, orderedIds)` | Batch update `sort_order` |
| `createLineItem(groupId, data)` | Insert one `actual_line_items` row |
| `updateLineItem(lineItemId, patch)` | Patch any editable field |
| `deleteLineItem(lineItemId)` | Hard delete |
| `reorderLineItems(groupId, orderedIds)` | Batch update `sort_order` |
| `importExtractedLines(groupId, lines[], extractionRunId)` | Bulk insert extracted line items |
| `savePromptConfig(orgId, type, prompt)` | Upsert `actuals_prompt_config` |
| `resetPromptConfig(orgId, type)` | Delete row (falls back to app default) |

The extraction API call itself is **not** a Server Action — it is a Next.js API route (`/api/actuals/extract`) because it streams a response and requires the `claude` API client with potentially long timeouts.

---

## 14. API route — `/api/actuals/extract`

```
POST /api/actuals/extract
Content-Type: application/json

// Image / PDF pathway:
{
  "file_base64": "...",          // base64-encoded file content
  "file_mime_type": "image/jpeg" | "image/png" | "application/pdf" | ...,
  "type": "income" | "expense",
  "org_id": "...",
  "project_id": "...",
  "group_id": "..." | null
}

// Spreadsheet pathway (Excel / CSV):
{
  "structured_text": "...",      // CSV string from SheetJS or FileReader
  "file_mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" | "text/csv",
  "file_name": "invoice.xlsx",   // for audit log only
  "type": "income" | "expense",
  "org_id": "...",
  "project_id": "...",
  "group_id": "..." | null
}
```

**Route behaviour:**
1. Auth check — return 401 if not authenticated.
2. Role check — return 403 if not admin/project_manager (§2.3).
3. Fetch `actuals_prompt_config` for `org_id`. Fall back to hardcoded defaults if not found.
4. Select the correct prompt (`income_system_prompt` vs `expense_system_prompt`).
5. Branch on payload:
   - `file_base64` present → vision pathway: pass base64 as `image` or `document` content block depending on mime type.
   - `structured_text` present → text pathway: pass CSV string as a plain text user message; use the spreadsheet-specific system prompt.
6. Call Claude API (using existing `lib/claude.ts` client).
7. Parse JSON from response.
8. Insert `extraction_runs` row (status = `"completed"` or `"failed"`).
9. Return `{ run_id, lines: [...] }` or `{ error: "..." }`.

**Model:** Use `claude-opus-4-6` for vision inputs (images/PDFs with messy layouts, handwriting). For spreadsheet inputs, `claude-haiku-4-5` is sufficient and significantly cheaper — the data is already structured. Implement as a constant in the route:

```ts
const MODEL = {
  vision: 'claude-opus-4-6',
  spreadsheet: 'claude-haiku-4-5-20251001',
}
```

**Timeout:** Set `maxDuration = 60` on the API route (Vercel Pro allows up to 300s for syd1 region).

---

## 15. Caching & performance

Follows the rules in `CLAUDE.md` exactly. No caching is added speculatively — each cache decision here is tied to a specific, measurable benefit.

### 15.1 What to cache and why

| Data | Cache strategy | TTL / revalidation | Reason |
|---|---|---|---|
| Project header (name, org, brand) | `unstable_cache` | `revalidateTag('project-{id}')` on project update | Read on every page load; changes rarely |
| Linked estimation (margin dashboard) | `unstable_cache` | `revalidateTag('estimation-{id}')` when estimation status/totals change | Computed totals are expensive to re-derive; never changes mid-session |
| `actuals_prompt_config` | `unstable_cache` | `revalidateTag('prompt-config-{orgId}')` on save/reset | Rarely changes; fetched on every extraction dialog open |
| `actual_groups` + `actual_line_items` | **No cache** | — | User edits these constantly inline; stale data on re-render would be confusing |

> **Never cache `actual_groups` or `actual_line_items`.** They are live-edited data. Caching them would cause the page to show stale totals immediately after an auto-save. Supabase is fast enough for these reads without caching.

### 15.2 Cache implementation

```ts
// lib/actuals-data.ts

import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export const getCachedProjectForActuals = unstable_cache(
  async (projectId: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('projects')
      .select('id, name, org_id, brand, status')   // explicit columns only — no select("*")
      .eq('id', projectId)
      .single()
    return data
  },
  ['project-actuals'],
  { tags: ['project'] }   // revalidated by revalidateTag('project') on project update
)

export const getCachedLinkedEstimation = unstable_cache(
  async (projectId: string) => {
    const supabase = createClient()
    // estimates table has no stored totals — must compute via computeSummary()
    const { data: estimate } = await supabase
      .from('estimates')
      .select('id, name, status, updated_at, accounting_rate, admin_rate, net_markup_pct, freight, accommodation, travel_allowance, bailing_fee, floor_prep_area, floor_prep_depth_mm, floor_prep_charge_per_bag, floor_prep_mat_per_bag, floor_prep_lab_per_bag')
      .eq('project_id', projectId)
      .in('status', ['submitted', 'approved'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!estimate) return null
    const { data: items } = await supabase
      .from('estimate_items')
      .select('id, estimate_id, scope, mat_cost, lab_cost, mat_qty, lab_qty, parent_item_id, is_consumable')
      .eq('estimate_id', estimate.id)
    const summary = computeSummary(items ?? [], estimate as EstimateSettings)
    return { estimate, summary }
  },
  ['linked-estimation'],
  { tags: ['estimation'] }
)

export const getCachedPromptConfig = unstable_cache(
  async (orgId: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('actuals_prompt_config')
      .select('income_system_prompt, expense_system_prompt')
      .eq('org_id', orgId)
      .maybeSingle()
    return data   // null = use app defaults
  },
  ['actuals-prompt-config'],
  { tags: ['prompt-config'] }
)
```

Each cache is **per-user** implicitly because `createClient()` uses the user's session — Supabase RLS ensures different users get different data even with the same cache key. No cross-user cache leakage risk here.

### 15.3 Cache invalidation

Every Server Action that mutates cached data must call `revalidateTag` after the write:

```ts
// In actions.ts

import { revalidateTag } from 'next/cache'

// After updating project name/status anywhere:
revalidateTag('project')

// After updating estimation status or totals:
revalidateTag('estimation')

// After savePromptConfig or resetPromptConfig:
revalidateTag('prompt-config')
```

Do not use `revalidatePath` — it is too broad and re-renders the entire page tree. Tag-based invalidation is surgical.

### 15.4 Navigation prefetching

The Actuals tab should feel instant when the user is already on the project detail page. Next.js App Router prefetches `<Link>` targets automatically on hover — ensure the Actuals tab is a standard `<Link href="...">` (not a `<button>` that sets state) so prefetching works correctly.

For the common flow **Projects list → Project detail → Actuals**, add `prefetch={true}` to the Project detail links in the projects list table. This ensures the project detail shell is in the router cache when the user clicks.

### 15.5 Optimistic UI for mutations

All mutations (add group, add line, update line, delete) use **optimistic updates** via React's `useOptimistic` hook in the Client Components. The user sees the change immediately; the Server Action write happens in the background. If the write fails, the optimistic state is rolled back and a toast error is shown.

```ts
// Pattern used in ActualsSection

const [optimisticGroups, addOptimisticGroup] = useOptimistic(
  groups,
  (state, newGroup) => [...state, newGroup]
)
```

This means: no spinner on "Add group", no spinner on "Delete line" — the table updates at click speed, with the database following 200–500ms later.

### 15.6 Bundle size — lazy-load the extraction dialog

The `ExtractionDialog` (multi-step modal) depends on the file preview logic, review table, and SheetJS (for Excel parsing). These are not needed on initial page load. Lazy-load it with `dynamic()`:

```ts
// In ActualsSection.tsx

const ExtractionDialog = dynamic(
  () => import('./extraction-dialog'),
  { ssr: false }
)
```

SheetJS (`xlsx` npm package) is ~400KB — **must not** be in the initial bundle. It is imported inside `extraction-dialog.tsx` which is already behind the `dynamic()` boundary, so no additional action needed beyond the above. The import should use a dynamic `import('xlsx')` inside the `parseSpreadsheet` function (see §8.4) rather than a top-level import, so it is only loaded when the user actually selects an Excel/CSV file.

### 15.7 Supabase query performance

- All `actual_line_items` fetches use `project_id` (indexed) — one round-trip for the whole page regardless of how many groups there are.
- The `actual_groups` fetch uses `project_id` (indexed) with an explicit `order('sort_order')`.
- `getActualLineItems` returns items for **all groups** in one query. Client-side grouping via a `Map<groupId, lineItem[]>` lookup — no N+1 queries for groups.

```ts
// One query, client-side grouping
const lineItemsByGroup = useMemo(() => {
  const map = new Map<string, ActualLineItem[]>()
  for (const item of lineItems) {
    if (!map.has(item.group_id)) map.set(item.group_id, [])
    map.get(item.group_id)!.push(item)
  }
  return map
}, [lineItems])
```

---

## 16. Supabase migrations

Three new tables + one RLS policy set each. All in `supabase/migrations/`:

```sql
-- Migration 038: Project Actuals + Retention
-- Tables ordered to satisfy FK dependencies:
--   actual_groups → extraction_runs → actual_line_items

-- ── Retention fields on projects ─────────────────────────────────────────────
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS retention_pct      numeric(5,2),
  ADD COLUMN IF NOT EXISTS retention_released numeric(12,2) NOT NULL DEFAULT 0;

-- ── actual_groups ─────────────────────────────────────────────────────────────
CREATE TABLE actual_groups (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  org_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_id     uuid NOT NULL REFERENCES profiles(id),
  type         text NOT NULL CHECK (type IN ('income', 'expense')),
  name         text NOT NULL DEFAULT 'New group',
  sort_order   int  NOT NULL DEFAULT 0,
  is_collapsed boolean NOT NULL DEFAULT false,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── extraction_runs (must precede actual_line_items — FK dependency) ──────────
CREATE TABLE extraction_runs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id           uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_id             uuid NOT NULL REFERENCES profiles(id),
  group_id             uuid REFERENCES actual_groups(id) ON DELETE SET NULL,
  file_name            text NOT NULL,
  file_mime_type       text NOT NULL,
  prompt_used          text NOT NULL,
  raw_response         jsonb,
  line_items_extracted int  NOT NULL DEFAULT 0,
  status               text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  error_message        text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- ── actual_line_items ─────────────────────────────────────────────────────────
CREATE TABLE actual_line_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id          uuid NOT NULL REFERENCES actual_groups(id) ON DELETE CASCADE,
  project_id        uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_id          uuid NOT NULL REFERENCES profiles(id),
  sort_order        int  NOT NULL DEFAULT 0,
  invoice_date      date,
  invoice_number    text,
  description       text NOT NULL DEFAULT '',
  qty               numeric,
  unit_price        numeric,
  subtotal          numeric NOT NULL DEFAULT 0,
  source            text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai_extracted')),
  extraction_run_id uuid REFERENCES extraction_runs(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ── actuals_prompt_config ─────────────────────────────────────────────────────
CREATE TABLE actuals_prompt_config (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  owner_id              uuid NOT NULL REFERENCES profiles(id),
  income_system_prompt  text NOT NULL,
  expense_system_prompt text NOT NULL,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE actual_groups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE actual_line_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_runs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE actuals_prompt_config ENABLE ROW LEVEL SECURITY;

-- Admin/PM access via existing user_project_role() helper (migration 021)
CREATE POLICY "admin_pm_access" ON actual_groups
  FOR ALL USING (is_superadmin() OR user_project_role(project_id) IN ('admin', 'project_manager'));

CREATE POLICY "admin_pm_access" ON actual_line_items
  FOR ALL USING (is_superadmin() OR user_project_role(project_id) IN ('admin', 'project_manager'));

CREATE POLICY "admin_pm_access" ON extraction_runs
  FOR ALL USING (is_superadmin() OR user_project_role(project_id) IN ('admin', 'project_manager'));

-- actuals_prompt_config is org-scoped
CREATE POLICY "admin_pm_access" ON actuals_prompt_config
  FOR ALL USING (is_superadmin() OR user_org_role(org_id) IN ('admin', 'project_manager'));

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX actual_groups_project_id_idx      ON actual_groups(project_id);
CREATE INDEX actual_line_items_group_id_idx    ON actual_line_items(group_id);
CREATE INDEX actual_line_items_project_id_idx  ON actual_line_items(project_id);
CREATE INDEX extraction_runs_project_id_idx    ON extraction_runs(project_id);
```

---

## 16. Design tokens & component spec summary

All UI follows `design.md` strictly. Quick reference for this feature:

| Element | Class |
|---|---|
| Page background | `bg-background` (`#0A0A0F`) |
| Section card | `bg-card/65 backdrop-blur-xl border border-white/[0.08] rounded-sm` |
| Group row background | `bg-muted/20` |
| Table header | `bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground` |
| Table cell text | `text-[11px] text-foreground/70` |
| Computed / read-only cell | `bg-primary/5 text-foreground/70 cursor-default` |
| AI-extracted row accent | `border-l-2 border-l-secondary/40` |
| Row hover | `hover:bg-muted/10` |
| Focus ring | `focus:ring-1 focus:ring-inset focus:ring-primary/40` |
| Input placeholder | `placeholder:text-muted-foreground/55` |
| Grand total value | `text-sm font-semibold tabular-nums text-foreground/75` |
| Chevron | `h-3 w-3 text-muted-foreground/70 transition-transform duration-150` |
| ⚡ AI button | `variant="ghost"` + `text-secondary` icon; label `text-[11px] text-secondary` |
| Prompt button | `variant="ghost" size="sm"` + `Settings2` icon |

**Text size rule:** All table data uses `text-[11px]`. No cell text is larger than `text-sm`. This matches the project-wide compact-density rule from `design.md §4`.

**Opacity rule (from design.md §14):** Maximum foreground opacity is `/90` (T1). Table data defaults to `/70` (T3). Subdued context uses `/55` (T4). Labels use `text-muted-foreground` (T5). Ghost metadata uses `text-muted-foreground/45` (T6). No one-off opacities.

---

## 17. Build order / milestones

**M19 — Schema + page scaffold + access control (1.5 days)**
- Write and run migration 038 (§16): four Actuals tables + retention fields on `projects`.
- Add `retention_pct` and `retention_released` fields to the Edit Project Details dialog.
- Implement `assertActualsAccess(projectId)` helper using `user_project_role()`.
- RLS policies with role check on all four Actuals tables using existing helpers (§2.1).
- Server Component route guard: redirect non-admin/PM users (§2.2).
- Tab visibility: hide Actuals tab from non-admin/PM (§2.2).
- API route role check for `/api/actuals/extract` (§2.3).
- Create the Actuals tab route and empty page component.
- Wire up the tab in the project detail layout.

**M20 — Income & expense tables (2–3 days)**
- Server Component data fetch (parallel).
- `ActualsTable` component: group rows, line item rows, inline editing, tab navigation.
- Add group, add line item, delete, reorder (drag-and-drop).
- Group collapse / expand with animation.
- Grand total bar.
- Auto-save debounce (Server Actions).

**M21 — GST toggle (0.5 day)**
- `GstToggle` context.
- Wire display multiplier into all subtotal/total renders.
- `(inc. GST)` column header annotations.
- Warning note in grand total bar.

**M22 — Margin dashboard (1 day)**
- Fetch linked estimation data.
- Compute all six dashboard figures.
- Colour-coded variance column.
- Empty-state for no linked estimation.

**M23 — AI extraction flow (2 days)**
- `/api/actuals/extract` API route with Claude API call.
- `ExtractionDialog` — file upload step.
- Review step — editable table, checkbox selection.
- Import action.
- AI-extracted row accent (`border-l-secondary/40`).
- Error states (API failure, parse failure, empty result).

**M24 — Editable prompt modal (0.5 day)**
- `PromptConfigModal` with two tabs.
- `actuals_prompt_config` upsert/reset Server Actions.
- Pre-populate textarea with current or default prompt.

**M25 — Polish + acceptance testing (1–2 days)**
- Keyboard navigation (Tab, Enter, Escape in table).
- Mobile: verify layout degrades gracefully on narrow viewports.
- Empty states (no groups, failed extraction).
- End-to-end walkthrough: upload → extract → review → import → check margin dashboard.

**Estimated timeline:** 2 weeks of focused work for one developer agent.

---

## 18. Acceptance criteria

| Feature | Done when… |
|---|---|
| Admin/PM access | Logged-in admin or project manager sees the Actuals tab and can add groups and lines |
| Member blocked — tab | Regular member does not see the Actuals tab in the project detail nav |
| Member blocked — URL | Regular member navigating directly to `/actuals` is redirected to the project page (not a raw 403 page) |
| Member blocked — API | POST to `/api/actuals/extract` as a regular member returns 403 |
| Member blocked — RLS | Supabase query against `actual_groups` as a regular member returns 0 rows |
| Income table | Add group, add 3 lines, refresh page — exact state restored |
| Expense table | Same as above |
| Subtotal computation | Line with qty=5, unit_price=100 shows subtotal=$500; change qty to 10 → $1,000 instantly |
| Manual subtotal | Line with qty=null, unit_price=null shows editable subtotal field; typed value persists |
| Group collapse | Clicking chevron collapses children with animation; `is_collapsed=true` persists on refresh |
| GST toggle | Switching to inc-GST shows all subtotals × 1.1; switching back restores exact ex-GST values |
| GST editing | While in inc-GST mode, editing a line item still edits the ex-GST value (not GST-inclusive) |
| Margin dashboard | With income=$100,000 and expense=$81,300, shows actual GP=$18,700 (18.7%) |
| AI extraction — image/PDF | Upload a clean PDF invoice → lines extracted correctly (date, number, desc, qty, price, subtotal all populated) |
| AI extraction — Excel | Upload a .xlsx file with invoice line items → SheetJS parses it client-side → CSV sent to Claude → lines extracted correctly |
| AI extraction — CSV | Upload a .csv file → lines extracted correctly without SheetJS (plain FileReader) |
| AI extraction — multi-sheet | .xlsx with 3 sheets shows a sheet selector; changing sheet and re-extracting uses the selected sheet's data |
| AI extraction — GST (vision) | PDF invoice showing inc-GST amounts are divided by 1.1 before being returned |
| AI extraction — GST (spreadsheet) | Excel column header "Amount inc GST" triggers /1.1 division in Claude's response |
| AI extraction — model routing | PDF extraction uses `claude-opus-4-6`; spreadsheet extraction uses `claude-haiku-4-5` (verify via `extraction_runs.prompt_used` or a log) |
| Review modal | User can edit any cell in the review table before importing |
| Partial import | Unchecking 1 of 4 rows imports only 3 lines |
| AI row accent | Imported lines show `border-l-secondary/40` and ⚡ badge |
| Prompt edit | Save custom prompt → next extraction uses the custom prompt (verified via `extraction_runs.prompt_used`) |
| Prompt reset | "Reset to default" removes the saved config and restores the hardcoded default prompt |
| Extraction failure | Claude API error shows error banner with "Retry" button; no crashed state |
| Auto-save | Editing a cell shows "Saving…" then "Saved ✓"; hard refresh restores the edit |
| Drag to reorder | Drag a line item to a new position → sort_order updates; position persists on refresh |
| Retention — setup | Setting retention_pct = 5% on a project saves correctly; Edit dialog shows the value on next open |
| Retention — income header | With retention_pct = 5% and $100,000 income, header shows "held: −$5,000.00 (5%) · net: $95,000.00" |
| Retention — release | Incrementing retention_released by $2,500 reduces retention_held to $2,500 |
| Retention — no retention | Project with retention_pct = null shows no retention row in dashboard or income header |
| Retention — dashboard | Margin dashboard shows retention held and net received rows when retention applies; GP% is unaffected |
| Performance | Page loads with parallel Promise.all; no sequential awaits |
| No select(*) | All Supabase queries use explicit column lists |

---

## 19. Open questions for Bilal

1. **Income grouping:** What labels do you typically use for income groups? (e.g., "Progress Claim 1", "Final Invoice", "Variation 1") — knowing the common patterns would help pre-seed a group-name picker.
2. **Expense grouping:** Same question — do you group by subcontractor, by trade, or by invoice? (e.g., "RM Flooring — Labour", "Carpet Court — Materials", "Freight July").
3. **Margin dashboard vs. estimation:** Should the "estimated revenue" figure on the dashboard come from the `total_ex_gst` of the linked estimation (i.e., the price quoted to the client), or from a separate "contract value" field on the project? They're the same in the MVP, but a variation could change the contract value without changing the original estimation.
4. **Multi-estimation projects:** If a project has multiple estimations (v1, v2, v3 revised), which one feeds the margin dashboard — the latest submitted? The one marked "Won"? Or should the user be able to pick?
5. **Extraction model:** Cost sensitivity — `claude-opus-4-6` gives best accuracy on messy invoices but costs more. `claude-haiku-4-5` is faster and cheaper. Do you want to default to Haiku with a "use Opus" toggle, or always Opus for extraction?
6. **File size limit:** 20MB cap in the spec. Is that generous enough for high-res phone photos of invoices? (iPhone 15 Pro photos are ~8–15MB in full resolution.)
7. **Reimbursable vs. company expense:** Some expenses (e.g., accommodation) might be reimbursable from the client. Should expense lines have a "reimbursable" flag so they can be excluded from the cost-side of the margin calc?

8. **Retention release workflow:** When releasing retention in two tranches (50% at PC, 50% at DLP), should the PM enter two income lines manually and update `retention_released` twice, or should there be a dedicated "Release retention" button that pre-fills an income line and auto-increments `retention_released`?

---

## 20. Phase 4 preview (so Phase 3 isn't painted into a corner)

- `actual_line_items` gains a `category` column in Phase 4 to enable breakdown by material / labour / overhead — the column is omitted from Phase 3 but the table is ready for it.
- `extraction_runs` stores `raw_response` as jsonb — this enables a Phase 4 "re-extract with updated prompt" feature without re-uploading the file (by caching the encoded image).
- The `actuals_prompt_config` table is per-org — Phase 4 can extend it to per-project overrides by adding `project_id nullable` without breaking existing rows.
- A Phase 4 cash-flow module can join `actual_groups` on `invoice_date` without any schema change.
- The margin dashboard widget is designed as a standalone component (`<MarginDashboard />`) — it can be embedded on the project list page as a summary column in Phase 4.
