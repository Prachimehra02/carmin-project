/*
  # Expand product categories to include home-decor

  Updates the products table to support the new home-decor category
  in addition to the existing pots-planters and vases categories.
*/

DO $$
BEGIN
  ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_check;
  
  ALTER TABLE products 
  ADD CONSTRAINT products_category_check 
  CHECK (category IN ('pots-planters', 'vases', 'home-decor', 'sculptures', 'artifacts', 'decor-accessories', 'wall-decor', 'mirrors'));
END $$;
