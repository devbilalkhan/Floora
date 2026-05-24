# Flooring Estimator — Phase 2 Spec: Estimation Form & Submission Pack

**Phase:** 2 — Pricing, Estimation Form, and Submission Package Generation  
**Depends on:** Phase 1 (Digital Takeoff Module — `spec.md`)  
**Owner:** Bilal (SPM Commercial Flooring / DFO Flooring, Australia)  
**Developer:** Claude Code  
**Last updated:** 2026-05-22

---

## 1. Purpose

Phase 2 takes the structured takeoff quantities produced in Phase 1 and turns them into a
priced estimate and a polished two-track submission package:

- **Client-facing pack** — cover letter, quotation document, takeoff schedule, ITP, optional
  add-ons; combined into a single branded PDF.
- **Internal workings report** — the full 5-step cost breakdown. **Never sent to the client.**

The canonical reference for every formula, rate, and document convention in this phase is the
SPM wiki at `~/Documents/spm/02-estimating/`. When this spec and the wiki diverge, the wiki
wins; surface the conflict to Bilal rather than guessing.

**Design principle inherited from Phase 1: no room for error.** Every number must be
traceable to a source (takeoff item, labour default, manually typed line). The user must
never wonder where a figure came from.

---

## 2. Australian standards (same as Phase 1 — restated for completeness)

- **Units:** metric only — m², lm (lineal metres), blm (broadloom metres), each, bag (20 kg),
  item. No imperial anywhere.
- **Currency:** AUD ($). All prices shown as `$X,XXX.00`.
- **GST:** 10%, statutory, locked. Not user-editable.
- **Date format:** DD/MM/YYYY display; ISO 8601 storage.
- **Time zone:** `Australia/Sydney`.
- **Method of measurement:** Australian Standard Method of Measurement / AIQS conventions.

---

## 3. Phase 2 scope — what to build

1. **Estimation** — a priced record linked to a project. Multiple estimations per project,
   each independently versioned.
2. **Estimation form** — the main Phase 2 UI: material lines, labour lines, additional costs,
   live running 5-step calculation, margin control.
3. **Labour Defaults library** — org-level library of pre-set labour rates. User picks a
   default; rate pre-fills; override is allowed per line.
4. **5-step calculation engine** — exact SPM formula; see §7.
5. **Submission pack generation** — two-track PDF output; see §9.
6. **Versioning** — clone-on-revise; auto-version labels (v1, v2-revised-YYYY-MM-DD).

---

## 4. Out of scope (Phase 3+)

| Out of Phase 2 | Phase |
|---|---|
| Material catalog / supplier price library | Phase 3 |
| Wastage rules engine (auto-apply % by product type) | Phase 3 |
| Risk & allowances calculator (after-hours, infection control, EWP, regional travel) | Phase 3 |
| Multi-user / roles / sharing | Phase 3 |
| ITP builder (custom ITP per project type) | Phase 3 |
| Variation mini-quote workflow | Phase 3 |
| PS / PC item tracking | Phase 3 |
| Reporting dashboard (P/L across projects) | Phase 3 |

---

## 5. Tech stack

Same stack as Phase 1. No new frameworks required.

- **Framework:** Next.js 14+ (App Router), TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Database / Auth / Storage:** Supabase (Postgres, Auth, Storage)
- **PDF generation:** `@react-pdf/renderer` (preferred) or `puppeteer` server-side
  — choose based on layout complexity once wireframed. Both are acceptable.
- **State:** Zustand store for the active estimation (mirrors the takeoff canvas pattern)
- **Deployment:** Vercel, region `syd1`

---

## 6. Data model additions

All new tables follow the same conventions as Phase 1: UUID PKs, `owner_id` FK to
`profiles.id`, RLS on every table (`owner_id = auth.uid()`), `created_at` / `updated_at`
timestamptz.

### `estimations`

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| project_id | uuid (FK → projects.id) | |
| owner_id | uuid (FK → profiles.id) | |
| version_label | text | "v1", "v2-revised-2026-06-01", etc. |
| version_number | int | auto-increment per project; display as v{n} |
| status | text | "draft" \| "submitted" \| "won" \| "lost" \| "archived" |
| net_margin_pct | numeric | default 23.00; user-editable; stored as percentage (23 = 23%) |
| accounting_cost_pct | numeric | default 2.00; editable |
| admin_cost_pct | numeric | default 5.00; editable |
| notes | text (nullable) | internal notes |
| submitted_at | timestamptz (nullable) | set when status → submitted |
| cloned_from_id | uuid (nullable, FK → estimations.id) | populated when created via "Revise" |
| created_at, updated_at | timestamptz | |

> Net margin and overhead percentages are stored per-estimation because SPM may adjust
> defaults over time and existing estimations must not change retroactively.

### `material_lines`

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| estimation_id | uuid (FK → estimations.id) | |
| owner_id | uuid (FK → profiles.id) | |
| sort_order | int | user-draggable ordering within the form |
| scope_category | text | same enum as Phase 1 — "vinyl" \| "carpet" \| "coving" \| "skirting" \| "transition" \| "wall_vinyl" \| "stairs" \| "trim" \| "other" |
| description | text | free-text; e.g. "Altro Whiterock 2.5mm — White" |
| qty | numeric | e.g. 240.60 |
| unit | text | "m2" \| "lm" \| "blm" \| "each" \| "bag" \| "item" |
| wastage_pct | numeric | e.g. 10 (= 10%); applied to qty to produce supply_qty |
| supply_qty | numeric | **computed:** `qty × (1 + wastage_pct / 100)`; stored for auditability |
| unit_price | numeric | ex-GST per unit; manually entered |
| line_total | numeric | **computed:** `supply_qty × unit_price`; stored |
| notes | text (nullable) | e.g. "check stock lead time" |
| created_at, updated_at | timestamptz | |

> No material catalog in Phase 2. All material lines are manually typed. Phase 3 adds a
> supplier catalog with pre-set unit prices.

### `labour_lines`

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| estimation_id | uuid (FK → estimations.id) | |
| owner_id | uuid (FK → profiles.id) | |
| sort_order | int | |
| scope_category | text | same enum |
| description | text | e.g. "Vinyl installation — main corridor" |
| labour_default_id | uuid (nullable, FK → labour_defaults.id) | null if typed freehand |
| qty | numeric | |
| unit | text | "m2" \| "lm" \| "blm" \| "each" \| "bag" \| "item" |
| rate | numeric | ex-GST per unit; pre-filled from default but overridable |
| line_total | numeric | **computed:** `qty × rate`; stored |
| notes | text (nullable) | |
| created_at, updated_at | timestamptz | |

### `additional_costs`

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| estimation_id | uuid (FK → estimations.id) | |
| owner_id | uuid (FK → profiles.id) | |
| sort_order | int | |
| type | text | "freight" \| "accommodation" \| "travel" \| "bailing_fee" \| "other" |
| description | text | free-text label shown on workings report |
| amount | numeric | ex-GST; passed through at cost — **no markup applied** |
| notes | text (nullable) | |
| created_at, updated_at | timestamptz | |

> **Bailing Fee** is the correct SPM terminology. Do not rename or autocorrect to
> "Billing Fee" anywhere in the UI, database, or documents.

### `labour_defaults`

Org-level library. Not per-project; one global set per `owner_id`.

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| owner_id | uuid (FK → profiles.id) | |
| scope_category | text | |
| description | text | e.g. "Vinyl installation" |
| unit | text | |
| rate | numeric | ex-GST; default rate |
| is_active | boolean | soft-delete; inactive defaults hidden from picker |
| sort_order | int | |
| created_at, updated_at | timestamptz | |

### `submission_packs`

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| estimation_id | uuid (FK → estimations.id) | |
| owner_id | uuid (FK → profiles.id) | |
| type | text | "client" \| "internal" |
| storage_path | text | Supabase Storage path to the generated PDF |
| generated_at | timestamptz | |
| created_at | timestamptz | |

---

## 7. The 5-step calculation engine

This is the **exact SPM formula**. Do not deviate. The canonical worked example is the
Tamworth Project (North Constructions, May 2026) in
`~/Documents/spm/02-estimating/calculation-formula.md`.

```
Step 1 — Base Cost
  materials_total = sum(line_total) across all material_lines
  labour_total    = sum(line_total) across all labour_lines
  base            = materials_total + labour_total

Step 2 — Operating Costs (on Base only — NOT on additional costs)
  operating_costs            = base × (accounting_cost_pct + admin_cost_pct) / 100
                               [defaults: accounting 2% + admin 5% = 7%]
  subtotal_after_overheads   = base + operating_costs

Step 3 — Net Margin (markup on cost — NOT gross margin on revenue)
  net_margin_amount          = subtotal_after_overheads × net_margin_pct / 100
                               [default net_margin_pct = 23%]
  subtotal_after_margin      = subtotal_after_overheads + net_margin_amount

Step 4 — Additional Costs (passed through at cost — NO markup applied)
  additional_total           = sum(amount) across all additional_costs
  total_ex_gst               = subtotal_after_margin + additional_total

Step 5 — GST
  gst_amount                 = total_ex_gst × 0.10
  grand_total                = total_ex_gst + gst_amount
```

### Derived display values

In addition to the above, compute and display:

```
gross_profit_margin_pct = (1 − 1 / (1 + net_margin_pct / 100)) × 100
  e.g. at 23% net margin: 1 − 1/1.23 = 18.70% gross profit margin
```

Show both figures prominently in the margin control panel:
- **Net Margin (markup):** 23.00% ← the lever Bilal adjusts
- **Gross Profit Margin:** 18.70% ← calculated read-only, for context

### Margin guard rails

- If `net_margin_pct < 10`: show amber warning banner "Margin below 10% — confirm this is
  intentional." Do **not** block save.
- If `net_margin_pct > 35`: show amber warning banner "Margin above 35% — confirm this is
  intentional." Do **not** block save.
- These thresholds are soft warnings only.

### Calculation rules — non-negotiable

These rules are **deliberate SPM business decisions** — do not "improve" them:

1. Operating costs are calculated on `base` only (Materials + Labour). They do **not**
   apply to additional costs (freight, accommodation, travel, bailing fee).
2. Additional costs are passed through at cost. No margin, no markup.
3. "Net Margin" is markup-on-cost. It is **not** gross margin on revenue.
4. GST is always 10%, applied to `total_ex_gst`.
5. Wastage (`wastage_pct`) is applied at the material line level, increasing supply qty
   before multiplying by unit price. Wastage is not a separate line item.

---

## 8. Labour Defaults library

### 8.1 Seeded defaults (from `~/Documents/spm/02-estimating/labour-rates.md`)

These are the confirmed rates to seed into `labour_defaults` on first login / initial setup:

| Description | Unit | Rate (ex-GST) | Scope category |
|---|---|---|---|
| Vinyl installation | m² | $23.00 | vinyl |
| Carpet installation | m² | $8.00 | carpet |
| Carpet installation | blm | $35.00 | carpet |
| Wall vinyl installation | m² | $25.00 | wall_vinyl |
| Coving installation | lm | $25.00 | coving |
| Stairs — vinyl | each | $85.00 | stairs |
| Skirting — vinyl | lm | $6.00 | skirting |
| Transition strip installation | each | $20.00 | transition |
| Trim installation | each | $20.00 | trim |
| Ramp installation | each | $50.00 | trim |
| Feather finish (floor prep) | m² | $8.00 | other |
| Grind (floor prep) | m² | $10.00 | other |
| Plywood overlay | m² | $13.00 | other |
| Take-up — vinyl | m² | $10.00 | other |
| Take-up — tiles | m² | $35.00 | other |
| Furniture handling | item | $50.00 | other |
| Flood / bulk fill | bag | $40.00 | other |

> **Still to be captured (not in MVP defaults — add when wiki is updated):**  
> LVT/LVP installation, sports flooring, wall protection panels, handrails, corner guards,
> acoustic panels, wet-area / damp-course, carpet on stairs, supervision uplift,
> after-hours multiplier, occupied-site multiplier.

### 8.2 Library management UI

Accessible from Settings → Labour Defaults.

- Table view: description, scope category, unit, rate, active toggle.
- Inline edit of any row. Rate changes do **not** retroactively affect saved estimation lines.
- Add new default. Soft-delete (deactivate) rather than hard-delete.
- Drag to reorder (sort_order). The order here is the order shown in the picker.

### 8.3 Picker behaviour in the estimation form

- When the user clicks "+ Add labour line", a modal or inline dropdown shows active defaults
  grouped by scope category.
- Selecting a default pre-fills: description, unit, rate. The user then types qty.
- The user can override rate inline after selecting a default. A small "✏ Overridden" badge
  appears when the saved rate differs from the current default rate.
- "Add custom" option at the bottom of the picker adds a blank labour line with no default
  linkage (`labour_default_id = null`).

---

## 9. Estimation form — screens and behaviour

### 9.1 Estimation list (within Project detail)

The Project detail screen (Phase 1 §6.3) gains an **Estimations** tab alongside Drawings.

- Table: version label, status badge, net margin %, grand total (ex-GST), grand total (inc-
  GST), submitted_at / updated_at.
- "New estimation" button → creates a draft `estimations` row, opens the estimation form.
- "Revise" action on any estimation → clones the row and all child lines into a new
  estimation with `version_number = n+1`, `cloned_from_id` set, status = "draft".
- Status change actions: Draft → Submitted → Won / Lost / Archived.

### 9.2 Estimation form layout

Desktop-first. Three-panel layout:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ← Back · ProjectName  ·  v2 — Draft  ·  [Submit]  [Revise]  [Generate PDF] │
├────────────────────────────────┬─────────────────────────────────────────────┤
│  LEFT PANEL                    │  RIGHT PANEL                                │
│  ─────────                     │  ─────────────────────────────────────────  │
│  Estimation details            │  5-STEP CALCULATION SUMMARY                 │
│  (project meta, version,       │  (live, updates on every keystroke)         │
│   status, notes)               │                                             │
│                                │  Materials total        $XX,XXX.00          │
│  ────────────────────────      │  Labour total           $XX,XXX.00          │
│  MATERIALS                     │  ─────────────────────────────────────────  │
│  [grouped by scope_category]   │  Base cost              $XX,XXX.00          │
│  + Add material line           │                                             │
│                                │  Operating costs (7%)   $X,XXX.00           │
│  ────────────────────────      │    Accounting (2%)       $X,XXX.00           │
│  LABOUR                        │    Admin (5%)            $X,XXX.00           │
│  [grouped by scope_category]   │  Subtotal               $XX,XXX.00          │
│  + Add labour line             │                                             │
│                                │  ┌──────────────────────────────────────┐   │
│  ────────────────────────      │  │  NET MARGIN (markup)  [  23.00  ] %  │   │
│  ADDITIONAL COSTS              │  │  Gross profit margin     18.70  %    │   │
│  [freight / accom / travel /   │  └──────────────────────────────────────┘   │
│   bailing fee / other]         │                                             │
│  + Add additional cost         │  Margin amount          $XX,XXX.00          │
│                                │  Subtotal after margin  $XX,XXX.00          │
│                                │                                             │
│                                │  Additional costs       $X,XXX.00           │
│                                │  ─────────────────────────────────────────  │
│                                │  TOTAL (ex-GST)         $XX,XXX.00          │
│                                │  GST (10%)              $X,XXX.00           │
│                                │  ═══════════════════════════════════════    │
│                                │  GRAND TOTAL (inc-GST)  $XX,XXX.00          │
│                                │                                             │
│                                │  [Copy link to summary]                     │
└────────────────────────────────┴─────────────────────────────────────────────┘
```

The right panel is sticky — it stays visible as the user scrolls through lines in the left
panel. On narrower viewports, the summary panel collapses to a floating bottom bar showing
only Grand Total (inc-GST) with an expand chevron.

### 9.3 Estimation details panel

- **Project** (read-only link)
- **Version label** (auto-set; user can rename, e.g. "v2 — revised scope")
- **Status** (dropdown: Draft / Submitted / Won / Lost / Archived)
- **Brand** (read-only; inherited from project — SPM or DFO Flooring; drives PDF branding)
- **Addressed to** (free text — name of the builder's estimator, used in cover letter)
- **Reference number** (free text — builder's tender/RFQ number if applicable)
- **Notes** (textarea — internal only; not shown in any PDF output)
- **Submitted date** (auto-set when status → Submitted; editable)

### 9.4 Materials section

Displayed as a table, grouped by `scope_category`. Each group has a header row with a
running subtotal for the group.

Columns per material line:

| Column | Input type | Notes |
|---|---|---|
| Scope category | dropdown | from fixed enum |
| Description | text input | free-text; required |
| Qty | number input | required; ≥ 0 |
| Unit | dropdown | m², lm, blm, each, bag, item |
| Wastage % | number input | default 0; range 0–50 |
| Supply qty | read-only | computed: qty × (1 + wastage/100); shown greyed |
| Unit price | currency input | ex-GST; required |
| Line total | read-only | supply qty × unit price; shown bold |
| Notes | text input (optional) | |
| Actions | — | drag handle (reorder), duplicate, delete |

**Section totals row** at bottom of each category group: "Vinyl — 3 lines — $XX,XXX.00"  
**Section grand total** at bottom of all materials: "Materials total — $XX,XXX.00"

Inline validation:
- Qty and unit price cannot be negative.
- Description is required; show inline red border if left blank on save attempt.
- Wastage > 25% shows an amber "High wastage — confirm" tooltip.

### 9.5 Labour section

Same layout as Materials. Columns:

| Column | Input type | Notes |
|---|---|---|
| Scope category | dropdown | |
| Description | text input | pre-filled from default; editable |
| Qty | number input | required |
| Unit | dropdown | m², lm, blm, each, bag, item |
| Rate | currency input | ex-GST per unit; pre-filled from default; editable |
| Line total | read-only | qty × rate; shown bold |
| Default source | read-only badge | "Default: $23.00/m²" or "✏ Overridden" or "—" if custom |
| Notes | text input (optional) | |
| Actions | — | drag handle, duplicate, delete |

"+ Add labour line" opens the Labour Defaults picker (see §8.3).

### 9.6 Additional costs section

Simpler table — no grouping by category.

| Column | Input type | Notes |
|---|---|---|
| Type | dropdown | Freight / Accommodation / Travel / Bailing Fee / Other |
| Description | text input | e.g. "Truck hire — Tamworth delivery" |
| Amount | currency input | ex-GST; passed through at cost |
| Notes | text input (optional) | |
| Actions | — | drag handle, duplicate, delete |

**Section total** at bottom: "Additional costs total — $X,XXX.00"

A persistent info note above this section:
> "Additional costs are passed through at cost. No operating costs or margin are applied."

### 9.7 Auto-save

Same pattern as Phase 1: optimistic UI, 2-second debounce write to Supabase. "Saved ✓" /
"Saving…" indicator in the top bar. Hard refresh must restore exact state.

### 9.8 Import from takeoff (optional but highly valuable)

If the project has drawing takeoffs (from Phase 1), an **"Import from takeoffs"** button
appears at the top of the Labour section.

Behaviour:
- Modal lists all takeoff items across all drawings in the project, grouped by
  `scope_category`, with their computed values and units.
- User checks which items to import.
- On confirm: for each selected takeoff item, a new labour line is created with:
  - `scope_category` from the takeoff
  - `description` = takeoff label (e.g. "VYL1 Main Corridor")
  - `qty` = takeoff `computed_value`
  - `unit` = takeoff `unit`
  - `rate` = pre-filled from the best-matching labour default for that scope_category
    (if one exists); otherwise blank
  - `labour_default_id` = matched default id (or null)
- User then reviews and adjusts rates before saving.

> This feature closes the loop between Phase 1 takeoffs and Phase 2 pricing without
> requiring a fully automated pipeline in Phase 2.

---

## 10. Submission pack generation

Two distinct documents generated from the same estimation data. Both are stored in
Supabase Storage and linked via `submission_packs`.

### 10.1 Client-facing pack

A combined, branded PDF with the following sections in order. Each section is a separate
logical chapter with the TOC reflecting its page number.

1. **Cover letter**
   - Brand header (SPM or DFO Flooring letterhead)
   - Date (DD/MM/YYYY)
   - Addressed to: `estimations.addressed_to`
   - Builder reference: `estimations.reference_number`
   - Project name + location
   - Standard cover letter body (templated; editable per estimation in Phase 3)
   - Signed off by Bilal / SPM / DFO

2. **Table of contents** (auto-generated page numbers)

3. **Quotation document**
   - Project details header (project name, location, head client, date, version, reference)
   - **Scope of works** — list of scope categories included in this estimation (auto-
     generated from the grouped material/labour lines)
   - **Pricing schedule** — a clean line-item table per scope category showing:
     - Description
     - Qty + unit
     - Unit price
     - Line total (ex-GST)
     - Category subtotal
     - **Does NOT show wastage %, internal rates, or operating cost breakdown**
   - **Total pricing** (two lines only):
     - Total (ex-GST): $XX,XXX.00
     - GST (10%): $X,XXX.00
     - **Grand Total (inc-GST): $XX,XXX.00**
   - **Inclusions** (free-text field; standard template in Phase 3)
   - **Exclusions / Qualifications** — critical commercial protection section:
     - Supply and installation only; subfloor preparation by others unless stated
     - Drawing-based takeoff; re-measure on site variations to be agreed as variation
     - Prices based on unimpeded access during business hours
     - Any latent conditions (asbestos, moisture, contamination) excluded
     - [Further standard exclusions — to be templated from commercial-terms.md in Phase 3]
   - **Commercial terms summary** (displayed in table):
     - Quote validity: [as per `estimations.validity_period` or "30 days from date of issue"]
     - Payment terms: [as per `estimations.payment_terms` or "As per contract"]
     - Defects Liability Period: "12 months from Practical Completion unless otherwise agreed"
     - Variations: "Variations to be priced and agreed in writing prior to proceeding"

4. **Takeoff schedule** (sourced from Phase 1 data — only if takeoffs are linked)
   - Table grouped by scope_category
   - Columns: Drawing name / Page / Label / Type / Value / Unit
   - Subtotals per category

5. **ITP (Inspection & Test Plan)**
   - Standard SPM ITP document (seeded template; Phase 3 makes it project-customisable)
   - Covers: pre-installation inspection, subfloor moisture test, installation inspection,
     adhesive coverage check, completion inspection sign-off

6. **Optional add-ons** (toggle per estimation):
   - Capability statement (static branded PDF insert)
   - Public liability / professional indemnity insurance certificate (upload per project)
   - SWMS (Safe Work Method Statement — upload per project or use static template)
   - Reference list (static)

### 10.2 Internal workings report

A separate PDF. **MUST NEVER be included in the client pack or shared externally.**

Contains the full 5-step cost breakdown:

1. **Header**: Project name, estimation version, date generated, "CONFIDENTIAL — INTERNAL ONLY"
2. **Materials detail**: full table including wastage %, supply qty, unit price, line totals
3. **Labour detail**: full table including rate, line totals, default source
4. **Step-by-step calculation:**
   ```
   Materials total:                  $XX,XXX.00
   Labour total:                     $XX,XXX.00
   ────────────────────────────────────────────
   Base cost:                        $XX,XXX.00

   Operating costs:
     Accounting (2.00%):             $X,XXX.00
     Admin (5.00%):                  $X,XXX.00
     Operating total (7.00%):        $X,XXX.00
   ────────────────────────────────────────────
   Subtotal after overheads:         $XX,XXX.00

   Net Margin (markup 23.00%):       $XX,XXX.00
   Gross profit margin:              18.70%
   ────────────────────────────────────────────
   Subtotal after margin:            $XX,XXX.00

   Additional costs (pass-through):
     Freight:                        $X,XXX.00
     Accommodation:                  $X,XXX.00
     Travel:                         $X,XXX.00
     Bailing Fee:                    $XXX.00
   ────────────────────────────────────────────
   Total (ex-GST):                   $XX,XXX.00
   GST (10%):                        $X,XXX.00
   ════════════════════════════════════════════
   GRAND TOTAL (inc-GST):            $XX,XXX.00
   ```
5. **Additional notes / internal comments** from `estimations.notes`

### 10.3 PDF generation — technical approach

- Trigger: "Generate PDF" button in the estimation form top bar.
- Two buttons: "Generate client pack" and "Generate workings report".
- PDFs are generated server-side (Next.js API route or Server Action).
- Generated PDF stored in Supabase Storage bucket `submissions/` at path
  `{owner_id}/{estimation_id}/{type}-{timestamp}.pdf`.
- A `submission_packs` row is created.
- The user gets a signed URL to download / open immediately.
- Previous generations are kept (not overwritten); the latest one is the default shown.

---

## 11. Versioning

- On "New estimation": `version_number = 1`, `version_label = "v1"`.
- On "Revise": clone the estimation and all child lines into a new row:
  - `version_number = parent + 1`
  - `version_label = "v{n}-revised-{YYYY-MM-DD}"`
  - `cloned_from_id` = source estimation id
  - Status = "draft"
- The original estimation is NOT modified. It stays at its existing status.
- The estimation list shows all versions; the most recent draft is highlighted.
- Editing a version label is allowed (e.g. rename "v2-revised-2026-06-01" to "v2 — Revised
  Scope After Addendum 3").

---

## 12. Commercial terms fields

The following fields are stored on `estimations` (add these columns to the data model above):

| Column | Type | Default |
|---|---|---|
| validity_days | int (nullable) | null — show "As negotiated"; 30 if Bilal requests a default |
| payment_terms | text (nullable) | null — show "As per contract" |
| dlp_terms | text (nullable) | "12 months from Practical Completion unless otherwise agreed" |
| variations_terms | text (nullable) | "Priced and agreed in writing prior to proceeding" |

These fields feed the commercial terms summary block in the quotation document. Editable
per estimation; they do not affect the calculation.

---

## 13. Estimation summary card (reused component)

A compact read-only card used in the Estimations tab list and anywhere the estimation is
referenced elsewhere in the app:

- Version label + status badge
- Grand Total (inc-GST) — large, prominent
- Net margin % | Gross profit margin %
- Materials total / Labour total / Additional costs total
- Last updated timestamp

---

## 14. Build order / milestones

**M11 — Labour Defaults library (2 days)**
- `labour_defaults` table + RLS.
- Settings → Labour Defaults: table view, inline edit, add, soft-delete, reorder.
- Seed with the 17 confirmed rates from §8.1.

**M12 — Estimation CRUD + form skeleton (2–3 days)**
- `estimations` table + RLS.
- Estimations tab on Project detail.
- Create / open / status-change / versioning (clone on revise).
- Estimation form layout with three-panel structure, sticky calc summary, auto-save.

**M13 — Material lines (2 days)**
- `material_lines` table + RLS.
- Material section in estimation form: add, edit, reorder, delete, inline validation.
- Wastage computation; line totals; section subtotals.
- Calculation engine Step 1 (materials total) live in right panel.

**M14 — Labour lines (2 days)**
- `labour_lines` table + RLS.
- Labour section with defaults picker modal.
- "Overridden" badge logic.
- Calculation engine Steps 1–3 live in right panel.

**M15 — Additional costs + full calc engine (1–2 days)**
- `additional_costs` table + RLS.
- Additional costs section with type dropdown.
- Full 5-step calc engine wired up (Steps 4–5).
- Both margin figures (net markup + gross profit) shown in control panel.
- Margin warning banners at <10% and >35%.

**M16 — Import from takeoffs (1–2 days)**
- Import modal on Labour section.
- Match takeoff items to best-matching labour default.
- Confirm → create labour lines.

**M17 — Submission pack generation (3–4 days)**
- Choose PDF library; build layout components.
- Internal workings report (simpler — data table layout).
- Client-facing pack: cover letter, TOC, quotation document, takeoff schedule, ITP.
- `submission_packs` table + storage bucket.
- Generate / download buttons in estimation form.
- Optional add-ons: capability statement, insurance cert, SWMS (file upload per project).

**M18 — Polish + acceptance testing (2–3 days)**
- Keyboard navigation in the form.
- Print / PDF preview before generating.
- Error states (PDF gen failure, storage upload failure).
- Mobile / narrow viewport handling (collapsible summary panel).
- Full walkthrough against acceptance criteria.

**Estimated Phase 2 timeline:** 3–4 weeks of focused work for one developer agent,
following Phase 1 completion.

---

## 15. Acceptance criteria

| Feature | Done when… |
|---|---|
| Labour Defaults library | All 17 seeded rates appear on first login; inline edit saves; deactivated defaults hidden from picker |
| Estimation form | Creating a new estimation, adding 3 material lines + 2 labour lines + 1 additional cost, and refreshing the page restores exact state |
| Wastage computation | A material line with qty=100, wastage=10% shows supply_qty=110 and line_total=110×unit_price |
| 5-step calc engine | The Tamworth worked example from calculation-formula.md produces the correct grand total to the cent |
| Net margin | Changing net_margin_pct from 23% to 15% immediately updates the right panel; amber warning shows below 10% |
| Gross profit display | At 23% net margin, gross profit margin shows 18.70% |
| Additional costs | A $500 bailing fee is not marked up — it appears at $500 in total_ex_gst with no margin applied |
| Import from takeoffs | Selecting 5 takeoff items creates 5 labour lines with qty pre-filled and rate pre-filled from best-matching default |
| Versioning | "Revise" creates a clone with version_number+1; original estimation unchanged |
| Client PDF | Generated PDF contains cover letter, TOC, quotation document (no internal rates), takeoff schedule, ITP |
| Internal workings PDF | Generated PDF shows the full 5-step breakdown; is separate from the client pack and cannot be accidentally sent |
| Bailing Fee | Appears as "Bailing Fee" (not "Billing Fee") in all form labels, dropdowns, PDF output, and database values |

---

## 16. Open questions for Bilal

1. **Inclusions / exclusions template:** Should these be hard-coded in Phase 2, or should
   there be a free-text editor per estimation? Recommendation: hard-coded standard text in
   Phase 2, free-text editor in Phase 3.
2. **ITP template:** Is the standard SPM ITP a fixed document for all jobs in Phase 2, or
   does it vary by project type (e.g., hospital vs. office)? If fixed, can you share a PDF
   version to embed?
3. **Cover letter body:** Can you share the standard cover letter template text you use, so
   we embed an accurate version from day one?
4. **Optional add-ons:** Do you want the capability statement built as a dynamic PDF (pulled
   from a settings template), or uploaded as a static file?
5. **Carpet: m² vs blm:** The labour defaults have both $8/m² and $35/blm for carpet. Does
   the form let you add both options and pick per line, or is one chosen at the project level?
6. **Validity period:** Do you want a default of 30 days shown on the quote, or "As
   negotiated" until you fill it in explicitly?
7. **Reference number field:** Is this free-text, or should it follow a specific format
   (e.g., SPM-2026-001)?
8. **Quotation document pricing schedule:** The client pack shows line-item descriptions and
   totals but hides internal rates and wastage. Is this the correct level of detail? Some
   builders ask for a fully itemised schedule — should there be a toggle?

---

## 17. Phase 3 preview (so Phase 2 isn't painted into a corner)

The Phase 2 data model is designed to plug straight into Phase 3 additions:

- `labour_defaults` gains a `material_catalog_id` FK in Phase 3 when the supplier catalog
  lands — no schema change needed on `labour_lines`.
- Wastage rules (`wastage_rules` table keyed by product_type) will auto-populate
  `material_lines.wastage_pct` in Phase 3; the column already exists and defaults to 0.
- The `submission_packs` bucket and table support multiple generations; Phase 3 document
  templating simply writes new rows.
- Multi-user / roles: `owner_id` is already per-row on every table; RLS policies only need
  an `org_id` column added and policies updated when Phase 3 multi-user lands.
- Variation mini-quotes: a `parent_estimation_id` FK on `estimations` (nullable) can be
  added without touching any existing records.

No retrofitting needed when Phase 3 starts.
