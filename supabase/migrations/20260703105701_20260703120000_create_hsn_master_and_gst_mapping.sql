/*
# HSN Master and Automatic GST Mapping System

## Overview
Replaces the manual tax_rates/tax_rate_id system with a centralized HSN Master
table. Products reference an HSN code, and all GST components (CGST, SGST, IGST,
cess) are derived from the HSN master. Order items copy all HSN/GST values at
checkout time so historical orders never change when rates are updated.

## New Tables

### hsn_master
Central master table for HSN (Harmonized System Nomenclature) codes and their
GST rates.
- id (uuid PK)
- hsn_code (text, unique) — the HSN code (e.g. '69139090')
- description (text) — what the HSN code covers
- gst_percentage (numeric) — total GST rate
- cgst_percentage (numeric) — Central GST share
- sgst_percentage (numeric) — State GST share
- igst_percentage (numeric) — Integrated GST (for inter-state)
- cess_percentage (numeric, default 0) — additional cess
- is_active (boolean, default true)
- created_at, updated_at (timestamptz)

## Modified Tables

### products
- Added hsn_id (uuid FK → hsn_master, nullable)
- Added hsn_code (text, nullable) — cached for quick reads
- Added gst_percentage (numeric, nullable) — cached for quick reads
- These replace the old tax_rate_id → tax_rates system.
- The old tax_rate_id column is kept for backward compatibility but is no longer
  used by the application.

### order_items
- Added hsn_code (text, nullable)
- Added cgst_percentage (numeric, default 0)
- Added sgst_percentage (numeric, default 0)
- Added igst_percentage (numeric, default 0)
- Added cess_percentage (numeric, default 0)
- Existing tax_percentage and tax_amount columns are kept and used as before.
- All HSN/GST values are copied from the product's HSN at checkout time.

## Data Migration
1. Seed common HSN codes for home décor, ceramics, planters, glassware,
   artificial plants, furniture, candles, gift items, etc.
2. Migrate existing products by matching their tax_rate_id to the appropriate
   HSN code:
   - tax_rate_id = 1 (18%) → HSN 69139090 (Ceramic decorative articles, 18%)
   - tax_rate_id = 2 (12%) → HSN 70132900 (Glassware, 12%)
   - tax_rate_id = 3 (5%)  → HSN 94036000 (Furniture, 5%)
   - Products with no tax_rate_id are left unmapped (hsn_id = NULL) for manual review.

## Security
- RLS enabled on hsn_master.
- Readable by all (anon + authenticated), writable by admins only.
*/

-- ═══════════════════════════════════════════════════════════════
-- 1. CREATE hsn_master TABLE
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS hsn_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hsn_code text UNIQUE NOT NULL,
  description text NOT NULL,
  gst_percentage numeric NOT NULL DEFAULT 0,
  cgst_percentage numeric NOT NULL DEFAULT 0,
  sgst_percentage numeric NOT NULL DEFAULT 0,
  igst_percentage numeric NOT NULL DEFAULT 0,
  cess_percentage numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- 2. SEED HSN CODES
-- ═══════════════════════════════════════════════════════════════

INSERT INTO hsn_master (hsn_code, description, gst_percentage, cgst_percentage, sgst_percentage, igst_percentage, cess_percentage) VALUES
  -- Ceramics & pottery (18%)
  ('69139090', 'Ceramic decorative articles (non-porcelain/plastic)', 18, 9, 9, 18, 0),
  ('69120090', 'Ceramic tableware/kitchenware (non-porcelain)', 18, 9, 9, 18, 0),
  ('69149000', 'Other ceramic articles', 18, 9, 9, 18, 0),
  ('69131000', 'Ornamental ceramic articles (porcelain)', 18, 9, 9, 18, 0),
  -- Planters / pots (clay/ceramic/stone)
  ('69141000', 'Refractory ceramic building articles (planters)', 18, 9, 9, 18, 0),
  ('68159990', 'Other articles of stone/plaster/cement (stone planters)', 18, 9, 9, 18, 0),
  -- Glassware (12-18%)
  ('70132900', 'Drinking glasses (other glass)', 18, 9, 9, 18, 0),
  ('70139900', 'Other glass articles for table/decor', 18, 9, 9, 18, 0),
  ('70200090', 'Other articles of glass (decorative)', 18, 9, 9, 18, 0),
  ('70189000', 'Glass beads, imitation jewellery', 12, 6, 6, 12, 0),
  -- Vases (glass/ceramic)
  ('70132800', 'Glass vases (for table/decor)', 18, 9, 9, 18, 0),
  -- Artificial plants / flowers (5-12%)
  ('67029090', 'Artificial flowers/foliage (other materials)', 12, 6, 6, 12, 0),
  ('67049000', 'Artificial plants and parts thereof', 12, 6, 6, 12, 0),
  -- Furniture (5%)
  ('94036000', 'Other wooden furniture', 5, 2.5, 2.5, 5, 0),
  ('94037000', 'Furniture of plastic', 18, 9, 9, 18, 0),
  ('94038900', 'Furniture of other materials (metal/stone)', 18, 9, 9, 18, 0),
  ('94031000', 'Metal furniture (office/institutional)', 18, 9, 9, 18, 0),
  -- Candles (18%)
  ('34060000', 'Candles and tapers', 18, 9, 9, 18, 0),
  -- Home décor / decorative articles (18%)
  ('83062910', 'Decorative metal articles (photo frames, figurines)', 18, 9, 9, 18, 0),
  ('83062990', 'Other ornamental metal articles', 18, 9, 9, 18, 0),
  ('39269099', 'Other plastic articles (decorative plastic items)', 18, 9, 9, 18, 0),
  ('46021990', 'Woven articles of vegetable material (baskets, décor)', 5, 2.5, 2.5, 5, 0),
  -- Wall décor / mirrors (18%)
  ('70099100', 'Framed glass mirrors', 18, 9, 9, 18, 0),
  ('83061000', 'Bells and gongs (decorative)', 18, 9, 9, 18, 0),
  -- Gift items / assorted (18%)
  ('48236990', 'Paper/paperboard tableware (gift boxes)', 18, 9, 9, 18, 0),
  ('48199000', 'Other paper packaging (gift wrapping)', 18, 9, 9, 18, 0),
  -- Textile décor (5-12%)
  ('63049200', 'Cotton furnishing articles (cushion covers, rugs)', 5, 2.5, 2.5, 5, 0),
  ('57019000', 'Carpets and textile floor coverings (woven)', 12, 6, 6, 12, 0),
  -- Stone / marble décor (18%)
  ('68029100', 'Marble/granite articles (decorative)', 18, 9, 9, 18, 0),
  ('68022900', 'Other stone articles (decorative)', 18, 9, 9, 18, 0)
ON CONFLICT (hsn_code) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 3. ADD HSN COLUMNS TO products
-- ═══════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'hsn_id') THEN
    ALTER TABLE products ADD COLUMN hsn_id uuid REFERENCES hsn_master(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'hsn_code') THEN
    ALTER TABLE products ADD COLUMN hsn_code text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'gst_percentage') THEN
    ALTER TABLE products ADD COLUMN gst_percentage numeric;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 4. ADD HSN COLUMNS TO order_items
-- ═══════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'hsn_code') THEN
    ALTER TABLE order_items ADD COLUMN hsn_code text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'cgst_percentage') THEN
    ALTER TABLE order_items ADD COLUMN cgst_percentage numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'sgst_percentage') THEN
    ALTER TABLE order_items ADD COLUMN sgst_percentage numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'igst_percentage') THEN
    ALTER TABLE order_items ADD COLUMN igst_percentage numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'cess_percentage') THEN
    ALTER TABLE order_items ADD COLUMN cess_percentage numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 5. MIGRATE EXISTING PRODUCTS
-- ═══════════════════════════════════════════════════════════════

-- Map tax_rate_id = 1 (18%) → HSN 69139090 (Ceramic decorative articles)
UPDATE products p SET
  hsn_id = h.id,
  hsn_code = h.hsn_code,
  gst_percentage = h.gst_percentage
FROM hsn_master h
WHERE p.hsn_id IS NULL
  AND p.tax_rate_id = 1
  AND h.hsn_code = '69139090';

-- Map tax_rate_id = 2 (12%) → HSN 67029090 (Artificial flowers/foliage)
UPDATE products p SET
  hsn_id = h.id,
  hsn_code = h.hsn_code,
  gst_percentage = h.gst_percentage
FROM hsn_master h
WHERE p.hsn_id IS NULL
  AND p.tax_rate_id = 2
  AND h.hsn_code = '67029090';

-- Map tax_rate_id = 3 (5%) → HSN 94036000 (Wooden furniture)
UPDATE products p SET
  hsn_id = h.id,
  hsn_code = h.hsn_code,
  gst_percentage = h.gst_percentage
FROM hsn_master h
WHERE p.hsn_id IS NULL
  AND p.tax_rate_id = 3
  AND h.hsn_code = '94036000';

-- Products with no tax_rate_id are left unmapped for manual review.

-- ═══════════════════════════════════════════════════════════════
-- 6. INDEXES
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_products_hsn_id ON products(hsn_id);
CREATE INDEX IF NOT EXISTS idx_hsn_master_hsn_code ON hsn_master(hsn_code);
CREATE INDEX IF NOT EXISTS idx_hsn_master_is_active ON hsn_master(is_active);

-- ═══════════════════════════════════════════════════════════════
-- 7. ENABLE RLS ON hsn_master
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE hsn_master ENABLE ROW LEVEL SECURITY;

-- Readable by all (anon + authenticated)
DROP POLICY IF EXISTS "read_hsn_master" ON hsn_master;
CREATE POLICY "read_hsn_master" ON hsn_master FOR SELECT
  TO anon, authenticated USING (true);

-- Write for admins only
DROP POLICY IF EXISTS "insert_hsn_master_admin" ON hsn_master;
CREATE POLICY "insert_hsn_master_admin" ON hsn_master FOR INSERT
  TO authenticated WITH CHECK (is_admin_user());

DROP POLICY IF EXISTS "update_hsn_master_admin" ON hsn_master;
CREATE POLICY "update_hsn_master_admin" ON hsn_master FOR UPDATE
  TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());

DROP POLICY IF EXISTS "delete_hsn_master_admin" ON hsn_master;
CREATE POLICY "delete_hsn_master_admin" ON hsn_master FOR DELETE
  TO authenticated USING (is_admin_user());
