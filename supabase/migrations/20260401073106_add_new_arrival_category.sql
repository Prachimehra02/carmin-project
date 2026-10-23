/*
  # Add new-arrival category

  Adds the new-arrival category to the allowed product categories
*/

DO $$
BEGIN
  ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_check;
  
  ALTER TABLE products 
  ADD CONSTRAINT products_category_check 
  CHECK (category IN ('pots-planters', 'vases', 'home-decor', 'sculptures', 'artifacts', 'decor-accessories', 'wall-decor', 'mirrors', 'new-arrival'));
END $$;