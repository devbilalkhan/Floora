#!/usr/bin/env python3
"""
Seed demo data: one realistic flooring project with takeoffs, estimate, and
calendar-spread tasks for May 2026.
Run: python3 scripts/seed_demo.py
"""

import json, os, urllib.request, urllib.error, sys

SUPABASE_URL  = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SERVICE_KEY   = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
USER_ID       = "8aa1b613-92da-463e-bc15-f398cb8bf83a"
ORG_ID        = "f9e488f8-08d8-4dd2-94b7-c0f525ec8528"   # SPM & DFO Flooring


def req(method, path, body=None):
    url  = f"{SUPABASE_URL}/rest/v1/{path}"
    data = json.dumps(body).encode() if body else None
    r    = urllib.request.Request(url, data=data, method=method, headers={
        "apikey":        SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type":  "application/json",
        "Prefer":        "return=representation",
    })
    try:
        with urllib.request.urlopen(r) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"  ERROR {e.code} on {method} {path}: {e.read().decode()}")
        sys.exit(1)


def insert(table, row):
    result = req("POST", table, row)
    return result[0] if isinstance(result, list) else result


def insert_many(table, rows):
    return req("POST", table, rows)


print("── 1. Project ─────────────────────────────────────────────────────")
project = insert("projects", {
    "name":            "Westfield Doncaster – Level 2 Refurbishment",
    "location":        "Doncaster VIC 3108",
    "head_client":     "Scentre Group",
    "status":          "active",
    "brand":           "dfo",
    "notes":           "Major retail refurb across food court and tenancies. Staged works around trading hours.",
    "created_by":      USER_ID,
    "organization_id": ORG_ID,
})
proj_id = project["id"]
print(f"  project id: {proj_id}")


print("── 2. Takeoffs ────────────────────────────────────────────────────")
t1 = insert("takeoffs", {"project_id": proj_id, "name": "Level 2 – Food Court & Seating", "sort_order": 0, "created_by": USER_ID})
t2 = insert("takeoffs", {"project_id": proj_id, "name": "Level 2 – Retail Tenancies 01-10", "sort_order": 1, "created_by": USER_ID})
t1_id, t2_id = t1["id"], t2["id"]
print(f"  takeoff 1: {t1_id}")
print(f"  takeoff 2: {t2_id}")


print("── 3. Takeoff rows (project_takeoff) ──────────────────────────────")
def to_row(takeoff_id, sort_order, scope_category, finish_code, description,
           manufacturer, colour, location, level, qty, unit,
           parent_finish_code=None, cove_height_mm=None):
    return {
        "takeoff_id": takeoff_id, "created_by": USER_ID, "sort_order": sort_order,
        "scope_category": scope_category, "finish_code": finish_code,
        "description": description, "manufacturer": manufacturer, "colour": colour,
        "location": location, "level": level, "qty": qty, "unit": unit,
        "parent_finish_code": parent_finish_code, "cove_height_mm": cove_height_mm,
    }

insert_many("project_takeoff", [
    # ── Food Court ──────────────────────────────────────────────────────────
    to_row(t1_id, 0, "vinyl",           "LVT-FC-01", "Commercial LVT 2.5mm – Food Court East",
           "Armstrong", "Heritage Oak",      "Food Court East",    "L2", 285, "m2"),
    to_row(t1_id, 1, "coving_skirting", "COV-FC-01", "Coving 100mm – LVT-FC-01",
           "Armstrong", "Heritage Oak",      "Food Court East",    "L2", 84,  "lm",
           parent_finish_code="LVT-FC-01", cove_height_mm=100),
    to_row(t1_id, 2, "vinyl",           "LVT-FC-02", "Commercial LVT 2.5mm – Food Court West",
           "Armstrong", "Concrete Grey",     "Food Court West",    "L2", 210, "m2"),
    to_row(t1_id, 3, "carpet",          "CPT-FC-01", "Carpet Tiles 500×500",
           "Interface", "Drawn Thread 003",  "Seating Zone North", "L2", 180, "m2"),
    to_row(t1_id, 4, "transition",      "TRN-FC-01", "Aluminium T-Bar Transition",
           "Schluter",  "Satin Anodised",    "Zone boundaries",    "L2", 12,  "ea"),
    # ── Retail ───────────────────────────────────────────────────────────────
    to_row(t2_id, 0, "vinyl",           "LVT-RET-01","Luxury Vinyl Plank 4mm",
           "Karndean",  "Knight Tile – Pale Limed Oak", "Tenancy 01-05", "L2", 420, "m2"),
    to_row(t2_id, 1, "coving_skirting", "SKT-RET-01","Vinyl Skirting 100mm",
           "Altro",     "Polar White",       "Tenancy 01-05",      "L2", 126, "lm",
           parent_finish_code="LVT-RET-01"),
    to_row(t2_id, 2, "carpet",          "CPT-RET-01","Broadloom Carpet – Cut Pile",
           "Burttons",  "Prestige II – Smoke","Tenancy 06-10",     "L2", 340, "m2"),
    to_row(t2_id, 3, "transition",      "TRN-RET-01","Carpet-to-Vinyl Reducers",
           "Schluter",  "Brushed Nickel",    "Tenancy boundaries", "L2", 42,  "ea"),
    to_row(t2_id, 4, "stairs",          "STR-RET-01","Stair Nosings – Slip Resistant",
           "Gradus",    "Black",             "Escalator Lobby",    "L2", 18,  "ea"),
    to_row(t2_id, 5, "matting",         "MAT-RET-01","Entrance Matting – Recessed",
           "Forbo",     "Anthracite",        "Main Entrance L2",   "L2", 24,  "m2"),
])
print("  inserted 11 takeoff rows")


print("── 4. Estimate ────────────────────────────────────────────────────")
estimate = insert("estimates", {
    "project_id":       proj_id,
    "name":             "Rev 1 – Preliminary Cost Plan",
    "description":      "Indicative pricing based on digital takeoff. Subject to site inspection and supplier confirmation.",
    "status":           "draft",
    "created_by":       USER_ID,
    "source_takeoff_id": t1_id,
    "accounting_rate":  0.02,
    "admin_rate":       0.05,
    "net_markup_pct":   0.23,
    "freight":          2400.00,
    "accommodation":    3600.00,
    "travel_allowance": 1200.00,
    "bailing_fee":      0,
})
est_id = estimate["id"]
print(f"  estimate id: {est_id}")


print("── 5. Estimate items ──────────────────────────────────────────────")

# Primary items first, then consumables will be auto-calculated in the UI.
# We seed the primary rows here to give the estimate meaningful content.
def ei(sort_order, scope_category, finish_code, description,
        qty, unit, waste_pct, mat_rate, lab_rate,
        cov_lm=None, cov_area=None, cov_height_mm=None):
    return {
        "estimate_id": est_id, "sort_order": sort_order, "type": "primary",
        "scope_category": scope_category, "finish_code": finish_code,
        "description": description, "qty": qty, "unit": unit,
        "waste_pct": waste_pct, "mat_rate": mat_rate, "lab_rate": lab_rate,
        "cov_lm": cov_lm, "cov_area": cov_area, "cov_height_mm": cov_height_mm,
    }

ei_rows = [
    ei( 0, "vinyl",           "LVT-FC-01", "Armstrong Commercial LVT 2.5mm – Heritage Oak",    285, "m2",  10, 89.00, 23.00, cov_lm=84,  cov_area=2.10, cov_height_mm=100),
    ei( 1, "vinyl",           "LVT-FC-02", "Armstrong Commercial LVT 2.5mm – Concrete Grey",   210, "m2",  10, 89.00, 23.00),
    ei( 2, "carpet",          "CPT-FC-01", "Interface Carpet Tiles 500×500 – Drawn Thread 003", 180, "m2", 10, 72.00,  8.00),
    ei( 3, "vinyl",           "LVT-RET-01","Karndean Knight Tile LVP – Pale Limed Oak",         420, "m2",  10, 95.00, 23.00, cov_lm=126, cov_area=3.15),
    ei( 4, "carpet",          "CPT-RET-01","Burttons Prestige II Broadloom – Smoke",             340, "m2",   8, 48.00,  8.00),
    ei( 5, "coving_skirting", "COV-FC-01", "Coving 100mm – Armstrong Heritage Oak",              84, "lm",   5, 15.00, 25.00),
    ei( 6, "coving_skirting", "SKT-RET-01","Altro Vinyl Skirting 100mm – Polar White",          126, "lm",   5,  5.00,  6.00),
    ei( 7, "transition",      "TRN-FC-01", "Schluter Aluminium T-Bar – Satin Anodised",          12, "ea",   0, 38.00, 20.00),
    ei( 8, "transition",      "TRN-RET-01","Schluter Carpet-to-Vinyl Reducer – Brushed Nickel",  42, "ea",   0, 35.00, 20.00),
    ei( 9, "stairs",          "STR-RET-01","Gradus Stair Nosing – Slip Resistant Black",          18, "ea",   0, 95.00, 85.00),
    ei(10, "matting",         "MAT-RET-01","Forbo Entrance Matting Recessed – Anthracite",        24, "m2",   5, 185.00, 0.00),
]
insert_many("estimate_items", ei_rows)
print(f"  inserted {len(ei_rows)} estimate items")


print("── 6. Tasks (spread across May 2026) ──────────────────────────────")
tasks = [
    # ── Week 1: Discovery & Takeoff ─────────────────────────────────────────
    {"title": "Site inspection – confirm floor levels and existing substrate @westfield",
     "priority": "high",   "status": "done",       "due_date": "2026-05-01"},
    {"title": "Review Scentre Group brief and scope of works @westfield",
     "priority": "medium", "status": "done",       "due_date": "2026-05-02"},
    {"title": "Upload floor plans and calibrate scale in drawing tool",
     "priority": "high",   "status": "done",       "due_date": "2026-05-05"},
    {"title": "Digital takeoff – Food Court East LVT-FC-01 @westfield",
     "priority": "high",   "status": "done",       "due_date": "2026-05-06"},
    {"title": "Digital takeoff – Food Court West LVT-FC-02 and seating carpet @westfield",
     "priority": "high",   "status": "done",       "due_date": "2026-05-07"},

    # ── Week 2: Retail Takeoff & Supplier Contact ────────────────────────────
    {"title": "Digital takeoff – Retail Tenancies 01-10 Level 2 @westfield",
     "priority": "high",   "status": "done",       "due_date": "2026-05-08"},
    {"title": "Request LVT pricing from @Armstrong – Heritage Oak and Concrete Grey",
     "priority": "urgent", "status": "done",       "due_date": "2026-05-09"},
    {"title": "Request LVP samples from @Karndean – Knight Tile Pale Limed Oak",
     "priority": "medium", "status": "done",       "due_date": "2026-05-09"},
    {"title": "Check substrate moisture levels with @TomCrew before specifying adhesive",
     "priority": "high",   "status": "done",       "due_date": "2026-05-12"},
    {"title": "Preliminary estimate – compile material and labour rates",
     "priority": "urgent", "status": "done",       "due_date": "2026-05-13"},

    # ── Week 3: Estimate & Review ────────────────────────────────────────────
    {"title": "Review Rev 1 estimate with @Mitchell – check rates and quantities",
     "priority": "high",   "status": "done",       "due_date": "2026-05-14"},
    {"title": "Confirm Gradus stair nosing lead time with @Mitchell – 6 week ETA risk",
     "priority": "medium", "status": "done",       "due_date": "2026-05-15"},
    {"title": "Send price request email to @Armstrong for LVT supply",
     "priority": "urgent", "status": "in_progress","due_date": "2026-05-19"},
    {"title": "Send price request email to @Karndean for LVP supply",
     "priority": "urgent", "status": "in_progress","due_date": "2026-05-19"},
    {"title": "Confirm Interface carpet tile availability – Drawn Thread 003 @Interface",
     "priority": "high",   "status": "todo",       "due_date": "2026-05-20"},

    # ── Week 4: Procurement & Scheduling ────────────────────────────────────
    {"title": "Chase @Armstrong for pricing response – deadline for estimate submission",
     "priority": "urgent", "status": "todo",       "due_date": "2026-05-21"},
    {"title": "Confirm installation schedule with @TomCrew – staged works around trading hours",
     "priority": "high",   "status": "todo",       "due_date": "2026-05-22"},
    {"title": "Update estimate with confirmed supplier pricing from @Armstrong @Karndean",
     "priority": "high",   "status": "todo",       "due_date": "2026-05-26"},
    {"title": "Final estimate review and sign-off with @Mitchell",
     "priority": "urgent", "status": "todo",       "due_date": "2026-05-27"},
    {"title": "Submit Rev 2 estimate to Scentre Group @westfield",
     "priority": "urgent", "status": "todo",       "due_date": "2026-05-28"},
    {"title": "Place material order – LVT and LVP supply @Armstrong @Karndean",
     "priority": "high",   "status": "todo",       "due_date": "2026-05-29"},
    {"title": "Confirm delivery schedule with @TomCrew and arrange site access",
     "priority": "medium", "status": "todo",       "due_date": "2026-05-30"},

    # ── No due date – backlog / ongoing ─────────────────────────────────────
    {"title": "Update material library with Karndean current pricing @Karndean",
     "priority": "low",    "status": "todo",       "due_date": None},
    {"title": "Document coving height requirement in project notes @westfield",
     "priority": "low",    "status": "todo",       "due_date": None},
    {"title": "Chase Gradus for stair nosing lead time confirmation @Mitchell",
     "priority": "medium", "status": "todo",       "due_date": None},
]

def parse_tags(title):
    import re
    return list(set(m[1:].lower() for m in re.findall(r"@[\w-]+", title)))

task_rows = [
    {
        "org_id":     ORG_ID,
        "project_id": proj_id,
        "title":      t["title"],
        "tags":       parse_tags(t["title"]),
        "priority":   t["priority"],
        "status":     t["status"],
        "due_date":   t.get("due_date"),
        "created_by": USER_ID,
    }
    for t in tasks
]
insert_many("tasks", task_rows)
print(f"  inserted {len(task_rows)} tasks")


print()
print("── Done ───────────────────────────────────────────────────────────")
print(f"  Project:  Westfield Doncaster – Level 2 Refurbishment")
print(f"  Org:      SPM & DFO Flooring  ({ORG_ID})")
print(f"  Takeoffs: {t1_id}")
print(f"            {t2_id}")
print(f"  Estimate: {est_id}")
print(f"  Tasks:    {len(task_rows)} across May 2026")
print()
print(f"  Open at: /orgs/spm-dfo/projects/{proj_id}")
