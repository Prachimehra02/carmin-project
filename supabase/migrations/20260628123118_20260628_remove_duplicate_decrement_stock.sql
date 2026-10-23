-- Remove the duplicate decrement_stock(uuid) function
-- The frontend uses text product IDs, so we only need the text version
DROP FUNCTION IF EXISTS public.decrement_stock(uuid, integer);
