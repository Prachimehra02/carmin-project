/*
# Enforce terminal order status states

## Overview
Adds a BEFORE UPDATE trigger on the orders table that prevents changing
order_status_id once the order is in a terminal state (is_terminal = true).
This is the server-side enforcement that cannot be bypassed by the client.

## Changes
1. New function: enforce_terminal_order_status()
   - Runs BEFORE UPDATE OF order_status_id on orders
   - If the OLD order_status_id points to an order_statuses row with
     is_terminal = true, and the NEW order_status_id is different,
     raise an exception to block the transition.
2. New trigger: trigger_enforce_terminal_order_status
   - Fires BEFORE UPDATE OF order_status_id on orders
   - Executes enforce_terminal_order_status()

## Notes
- Payment status and return status are NOT affected — they remain independent.
- The trigger only blocks order_status_id changes, not payment_status_id or
  return_status_id changes. This means an admin can still update payment status
  or return status on a terminal order (e.g., process a refund on a cancelled order).
- Tracking ID and other fields can still be updated on terminal orders.
*/

CREATE OR REPLACE FUNCTION enforce_terminal_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_is_terminal boolean;
BEGIN
  -- Only check if order_status_id is actually changing
  IF NEW.order_status_id IS DISTINCT FROM OLD.order_status_id THEN
    SELECT is_terminal INTO old_is_terminal
    FROM order_statuses
    WHERE id = OLD.order_status_id;

    IF old_is_terminal AND NEW.order_status_id IS NOT NULL AND NEW.order_status_id != OLD.order_status_id THEN
      RAISE EXCEPTION 'Cannot change order status: current status is terminal (final state). Order ID: %', OLD.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_terminal_order_status ON orders;
CREATE TRIGGER trigger_enforce_terminal_order_status
  BEFORE UPDATE OF order_status_id ON orders
  FOR EACH ROW
  EXECUTE FUNCTION enforce_terminal_order_status();
