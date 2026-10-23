-- Seed the standard GST slabs.  These are the only tax rates the store uses;
-- the admin UI reads them dynamically from this table, so no GST value is
-- ever hardcoded in the application code.
INSERT INTO tax_rates (name, percentage, active) VALUES
  ('GST 18%', 18, true),
  ('GST 12%', 12, true),
  ('GST 5%',  5,  true)
ON CONFLICT DO NOTHING;
