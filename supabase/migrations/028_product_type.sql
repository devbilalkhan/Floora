ALTER TABLE project_takeoff ADD COLUMN IF NOT EXISTS product_type text;
ALTER TABLE estimate_items  ADD COLUMN IF NOT EXISTS product_type text;
