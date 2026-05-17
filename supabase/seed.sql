-- ── Seed: SPM Flooring demo data ─────────────────────────────────────────────
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Based on real project: REV0 BoQ Faith Lutheran College Plainland.
-- Safe to re-run — uses ON CONFLICT DO NOTHING / DELETE + re-insert for takeoff.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_user_id   uuid := '8aa1b613-92da-463e-bc15-f398cb8bf83a';
  v_org_id    uuid;
  v_proj_id   uuid;
BEGIN

  -- ── 1. Profile ──────────────────────────────────────────────────────────────
  INSERT INTO profiles (id, email, display_name)
  VALUES (v_user_id, 'bilal.khan@spmprotect.com', 'Bilal Khan')
  ON CONFLICT (id) DO UPDATE
    SET display_name = 'Bilal Khan';

  -- ── 2. Organisation ─────────────────────────────────────────────────────────
  INSERT INTO organizations (name, slug)
  VALUES ('SPM & DFO Flooring', 'spm-dfo')
  ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO v_org_id FROM organizations WHERE slug = 'spm-dfo';

  -- ── 3. Admin membership ─────────────────────────────────────────────────────
  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (v_org_id, v_user_id, 'admin')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  -- ── 4. Project ──────────────────────────────────────────────────────────────
  INSERT INTO projects (name, organization_id, created_by, brand, location, head_client, status, notes)
  VALUES (
    'Faith Lutheran College Plainland',
    v_org_id,
    v_user_id,
    'spm',
    '5 Faith Ave, Plainland QLD 4341',
    'Faith Lutheran College',
    'active',
    'Scope: Floorings & Wall Vinyl. Plan rev date 13/11/2025.'
  )
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_proj_id
  FROM projects
  WHERE name = 'Faith Lutheran College Plainland'
    AND organization_id = v_org_id;

  -- ── 5. Takeoff rows (clear + re-insert for clean re-runs) ───────────────────
  DELETE FROM project_takeoff WHERE project_id = v_proj_id;

  INSERT INTO project_takeoff
    (project_id, created_by, scope_category, sort_order,
     finish_code, description, manufacturer, colour,
     location, level, qty, unit, notes)
  VALUES

  -- ── VINYL FLOORING ──────────────────────────────────────────────────────────
  (v_proj_id, v_user_id, 'vinyl', 0,
   'RF-01', 'Non-Slip Vinyl Flooring', 'Gerflor Tarasafe Ultra H2O', '7325 Seashore',
   'G.06 Amenities', 'GF', 9.50, 'm2', 'P3/R11 · LRV 63 · Heat Welded · 5 units'),

  (v_proj_id, v_user_id, 'vinyl', 1,
   'RF-01', 'Non-Slip Vinyl Flooring', 'Gerflor Tarasafe Ultra H2O', '7325 Seashore',
   'L1.06 Amenities', 'L1', 11.87, 'm2', 'P3/R11 · LRV 63 · Heat Welded · 5 units'),

  (v_proj_id, v_user_id, 'vinyl', 2,
   'RF-01', 'Non-Slip Vinyl Flooring', 'Gerflor Tarasafe Ultra H2O', '7325 Seashore',
   'G.03 PWD', 'GF', 7.50, 'm2', 'P3/R11 · LRV 63 · Heat Welded · 1 unit'),

  (v_proj_id, v_user_id, 'vinyl', 3,
   'RF-01', 'Non-Slip Vinyl Flooring', 'Gerflor Tarasafe Ultra H2O', '7325 Seashore',
   'L1.06 PWD', 'L1', 7.50, 'm2', 'P3/R11 · LRV 63 · Heat Welded · 1 unit'),

  (v_proj_id, v_user_id, 'vinyl', 4,
   'RF-01', 'Non-Slip Vinyl Flooring', 'Gerflor Tarasafe Ultra H2O', '7325 Seashore',
   'G.05 Cleaners Cupboard', 'GF', 1.07, 'm2', 'P3/R11 · LRV 63 · 1 unit'),

  (v_proj_id, v_user_id, 'vinyl', 5,
   'RF-01', 'Non-Slip Vinyl Flooring', 'Gerflor Tarasafe Ultra H2O', '7325 Seashore',
   'L1.08 Cleaners Cupboard', 'L1', 1.16, 'm2', 'P3/R11 · LRV 63 · 1 unit'),

  (v_proj_id, v_user_id, 'vinyl', 6,
   'RF-02', 'Timber Look Vinyl Flooring', 'Shawcontract Nordic', 'Honey (77103)',
   'Learning Spaces & Learning Common', 'GF', 299.38, 'm2', 'Ashlar · Heat Welded · LRV 26.8'),

  (v_proj_id, v_user_id, 'vinyl', 7,
   'RF-02', 'Timber Look Vinyl Flooring', 'Shawcontract Nordic', 'Honey (77103)',
   'Stair 02', 'L1', 16.35, 'm2', 'Ashlar · Heat Welded · LRV 26.8'),

  -- ── CARPET FLOORING ─────────────────────────────────────────────────────────
  (v_proj_id, v_user_id, 'carpet', 0,
   'CP-01', 'Carpet Tile', 'ShawContract Style Poured 5T206', 'Gypsum (06515)',
   'GLA', 'GF', 458.92, 'm2', '610×610mm · Ashlar · LRV 21.3 · 6 units'),

  (v_proj_id, v_user_id, 'carpet', 1,
   'CP-02', 'Carpet Plank Tile', 'Interface Sandbank', 'Spinifex (2528005)',
   'G.01 Admin', 'GF', 75.82, 'm2', '250×1000mm · Ashlar · LRV 12.11 · 1 unit'),

  -- ── WALL VINYL ──────────────────────────────────────────────────────────────
  (v_proj_id, v_user_id, 'wall_vinyl', 0,
   'WV-01', 'Wall Vinyl 2002mm H', 'Gerflor Mural Calypso', '7311 Cloud Linen',
   'Amenities, PWD & Cleaner - GF', 'GF', 82.00, 'm2', 'Heat Welded · 7 units'),

  (v_proj_id, v_user_id, 'wall_vinyl', 1,
   'WV-01', 'Wall Vinyl 2002mm H', 'Gerflor Mural Calypso', '7311 Cloud Linen',
   'Amenities, PWD & Cleaner - L1', 'L1', 83.93, 'm2', 'Heat Welded · 7 units'),

  -- ── COVINGS & SKIRTINGS ─────────────────────────────────────────────────────
  (v_proj_id, v_user_id, 'coving_skirting', 0,
   'SK-02', 'Coved Skirting 100mm H — with Vinyl', 'Gerflor', 'To match adjacent vinyl',
   'Amenities, PWD & Cleaner - GF', 'GF', 43.40, 'lm', 'Flexible cove former · Clean Corner System · 7 units'),

  (v_proj_id, v_user_id, 'coving_skirting', 1,
   'SK-02', 'Coved Skirting 100mm H — with Vinyl', 'Gerflor', 'To match adjacent vinyl',
   'Amenities, PWD & Cleaner - L1', 'L1', 39.86, 'lm', 'Flexible cove former · Clean Corner System · 7 units'),

  (v_proj_id, v_user_id, 'coving_skirting', 2,
   'SK-02', 'Coved Skirting 100mm H — at Concrete', 'Gerflor', 'To match adjacent vinyl',
   'L1.07 Services', 'L1', 7.20, 'lm', 'Existing concrete substrate · 1 unit'),

  -- ── ENTRY MATTING ───────────────────────────────────────────────────────────
  (v_proj_id, v_user_id, 'matting', 0,
   'EM-01', 'Recessed Entry Mat', 'MatTek Delux Scraper', 'Charcoal Carpet / Clear Anodised',
   'Building Entry', 'GF', 10.04, 'm2', 'Recess depth 15.2mm · Aluminium extrusion · Cut pile insert'),

  -- ── STAIRS & NOSINGS ────────────────────────────────────────────────────────
  (v_proj_id, v_user_id, 'stairs', 0,
   'NS-01', 'Stair Tread Nosing — Internal', 'Classic Architectural Group', 'Black Aluminium',
   'Stair 02', 'L1', 80.62, 'lm', 'SNR019 · 50mm(W) surface mount · P4 slip resistance · Riser 174mm · Tread 280mm'),

  -- ── FLOOR TRANSITIONS ───────────────────────────────────────────────────────
  (v_proj_id, v_user_id, 'transition', 0,
   'TS-01', 'Floor Transition Strip', 'Schluter', 'Brushed Chrome',
   'Various floor junctions', 'GF', 21.00, 'ea', 'Carpet to vinyl transitions');

END $$;
