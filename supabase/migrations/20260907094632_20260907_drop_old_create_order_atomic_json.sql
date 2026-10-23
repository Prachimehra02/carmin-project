-- Drop the old json-signature overload before creating the jsonb version
DROP FUNCTION IF EXISTS create_order_atomic(uuid, json, jsonb, numeric, text, text);
