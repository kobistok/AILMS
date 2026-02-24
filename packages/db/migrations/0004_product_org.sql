-- Link products to their org
ALTER TABLE products ADD COLUMN IF NOT EXISTS org_name TEXT;
