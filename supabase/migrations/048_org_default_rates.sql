-- Per-org overrides for the default mat/lab rates used when generating estimate items.
-- Structure: { "mat": { "glueSheet": 129, ... }, "lab": { "vinyl": 23, ... } }
-- Missing keys fall back to the hardcoded constants in lib/default-rates.ts.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_rates JSONB NOT NULL DEFAULT '{}';
