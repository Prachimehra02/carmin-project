/*
# Order Management System Refactor — Master Status Tables

## Overview
Replaces all hardcoded order/payment/return status strings with database-driven
master tables. Statuses, their colors, icons, visibility, and cancellation rules
become fully configurable without code changes.

## New Tables

### 1. order_statuses
Master table for order lifecycle statuses.
- id (uuid PK)
- code (text, unique) — machine-readable identifier (e.g. 'order_placed')
- name (text) — human-readable display name
- description (text, nullable) — optional description
- sequence (int) — sort order for display
- color (text) — Tailwind CSS color classes (e.g. 'bg-yellow-100 text-yellow-800')
- icon (text) — lucide-react icon name (e.g. 'Package')
- show_to_customer (bool) — whether customers see this status
- allow_customer_cancel (bool) — whether customers can cancel while in this status
- is_terminal (bool) — whether this is a final state (no further transitions expected)
- active (bool) — whether this status is available for use
- created_at, updated_at (timestamptz)

### 2. payment_statuses
Master table for payment lifecycle statuses.
- id (uuid PK)
- code (text, unique)
- name (text)
- color (text)
- active (bool)
- created_at, updated_at

### 3. return_statuses
Master table for return workflow statuses.
- id (uuid PK)
- code (text, unique)
- name (text)
- sequence (int)
- active (bool)
- created_at, updated_at

### 4. order_status_history
Audit trail for order status changes.
- id (uuid PK)
- order_id (uuid FK → orders)
- old_status_id (uuid FK → order_statuses, nullable)
- new_status_id (uuid FK → order_statuses)
- changed_by (uuid FK → auth.users, nullable)
- notes (text, nullable)
- created_at (timestamptz)

### 5. payment_status_history
Audit trail for payment status changes.
- id (uuid PK)
- order_id (uuid FK → orders)
- old_status_id (uuid FK → payment_statuses, nullable)
- new_status_id (uuid FK → payment_statuses)
- changed_by (uuid FK → auth.users, nullable)
- notes (text, nullable)
- created_at (timestamptz)

### 6. return_status_history
Audit trail for return status changes.
- id (uuid PK)
- order_id (uuid FK → orders)
- old_status_id (uuid FK → return_statuses, nullable)
- new_status_id (uuid FK → return_statuses)
- changed_by (uuid FK → auth.users, nullable)
- notes (text, nullable)
- created_at (timestamptz)

## Modified Tables

### orders
- Added `order_status_id` (uuid FK → order_statuses)
- Added `payment_status_id` (uuid FK → payment_statuses)
- Added `return_status_id` (uuid FK → return_statuses, nullable)
- Dropped old CHECK constraints on `order_status`, `payment_status`, `status`
- Existing text columns (`order_status`, `payment_status`, `status`) are kept for
  backward compatibility but are no longer authoritative. New code reads from
  the `_id` FK columns.

## Data Migration
1. Seed all master tables with the specified initial statuses.
2. Map existing text status values to the new UUID references:
   - order_status: 'pending' → 'order_placed', 'confirmed' → 'payment_confirmed',
     'paid' → 'payment_confirmed', 'processing' → 'processing',
     'shipped' → 'shipped', 'delivered' → 'delivered',
     'cancelled' → 'cancelled', 'refunded' → 'returned',
     'ready for dispatch' → 'ready_for_dispatch', 'invoiced' → 'processing',
     'returned' → 'returned'
   - payment_status: 'pending' → 'pending', 'paid' → 'paid',
     'failed' → 'failed', 'refunded' → 'refunded'
   - return_status: all orders get 'none' initially
3. Set `order_status_id`, `payment_status_id`, `return_status_id` on all existing orders.

## Security
- RLS enabled on all new tables.
- order_statuses, payment_statuses, return_statuses: readable by all (anon + authenticated),
  writable by authenticated admins only.
- History tables: readable by order owner + admins, writable by authenticated only.
- Admin detection uses the existing is_admin() function if available, otherwise
  checks the user_profiles table for role = 'admin'.
*/

-- ═══════════════════════════════════════════════════════════════
-- 1. CREATE MASTER TABLES
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS order_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  sequence int NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT 'bg-gray-100 text-gray-800',
  icon text NOT NULL DEFAULT 'Package',
  show_to_customer boolean NOT NULL DEFAULT true,
  allow_customer_cancel boolean NOT NULL DEFAULT true,
  is_terminal boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'bg-gray-100 text-gray-800',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS return_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  sequence int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- 2. SEED MASTER TABLES
-- ═══════════════════════════════════════════════════════════════

-- Order statuses (sequence per spec)
INSERT INTO order_statuses (code, name, description, sequence, color, icon, show_to_customer, allow_customer_cancel, is_terminal) VALUES
  ('order_placed',       'Order Placed',       'Order has been placed by the customer',          1, 'bg-yellow-100 text-yellow-800',   'Package',      true,  true,  false),
  ('awaiting_payment',   'Awaiting Payment',   'Waiting for customer to make payment',           2, 'bg-orange-100 text-orange-800',   'Clock',        true,  true,  false),
  ('payment_confirmed',  'Payment Confirmed',  'Payment has been received and confirmed',         3, 'bg-green-100 text-green-800',     'CheckCircle2', true,  true,  false),
  ('processing',         'Processing',         'Order is being prepared',                         4, 'bg-blue-100 text-blue-800',       'Package',      true,  true,  false),
  ('ready_for_dispatch', 'Ready for Dispatch', 'Order is packed and ready to ship',               5, 'bg-indigo-100 text-indigo-800',   'Truck',        false, true,  false),
  ('shipped',            'Shipped',            'Order has been shipped',                          6, 'bg-purple-100 text-purple-800',   'Truck',        true,  false, false),
  ('delivered',          'Delivered',          'Order has been delivered to the customer',       7, 'bg-green-100 text-green-800',     'CheckCircle2', true,  false, true),
  ('cancelled',          'Cancelled',          'Order has been cancelled',                        8, 'bg-red-100 text-red-800',          'XCircle',      true,  false, true),
  ('returned',           'Returned',           'Order has been returned',                         9, 'bg-red-100 text-red-800',          'RotateCcw',    true,  false, true)
ON CONFLICT (code) DO NOTHING;

-- Payment statuses
INSERT INTO payment_statuses (code, name, color) VALUES
  ('pending',          'Pending',          'bg-yellow-100 text-yellow-800'),
  ('partially_paid',   'Partially Paid',   'bg-blue-100 text-blue-800'),
  ('paid',             'Paid',             'bg-green-100 text-green-800'),
  ('failed',           'Failed',           'bg-red-100 text-red-800'),
  ('refund_pending',   'Refund Pending',   'bg-orange-100 text-orange-800'),
  ('refunded',         'Refunded',         'bg-gray-100 text-gray-800')
ON CONFLICT (code) DO NOTHING;

-- Return statuses
INSERT INTO return_statuses (code, name, sequence) VALUES
  ('none',               'None',               0),
  ('requested',          'Requested',          1),
  ('approved',           'Approved',           2),
  ('rejected',           'Rejected',           3),
  ('picked_up',          'Picked Up',          4),
  ('received',           'Received',           5),
  ('inspection_pending', 'Inspection Pending', 6),
  ('inspection_passed',  'Inspection Passed',  7),
  ('inspection_failed',  'Inspection Failed',  8),
  ('refund_initiated',   'Refund Initiated',   9),
  ('refunded',           'Refunded',           10),
  ('closed',             'Closed',             11)
ON CONFLICT (code) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 3. ADD FK COLUMNS TO orders
-- ═══════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'order_status_id') THEN
    ALTER TABLE orders ADD COLUMN order_status_id uuid REFERENCES order_statuses(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_status_id') THEN
    ALTER TABLE orders ADD COLUMN payment_status_id uuid REFERENCES payment_statuses(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'return_status_id') THEN
    ALTER TABLE orders ADD COLUMN return_status_id uuid REFERENCES return_statuses(id);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 4. MIGRATE EXISTING ORDER DATA
-- ═══════════════════════════════════════════════════════════════

-- Map old text order_status to new order_statuses.code
UPDATE orders o SET order_status_id = os.id
FROM order_statuses os
WHERE o.order_status_id IS NULL
  AND os.code = CASE o.order_status
    WHEN 'pending' THEN 'order_placed'
    WHEN 'confirmed' THEN 'payment_confirmed'
    WHEN 'paid' THEN 'payment_confirmed'
    WHEN 'processing' THEN 'processing'
    WHEN 'shipped' THEN 'shipped'
    WHEN 'delivered' THEN 'delivered'
    WHEN 'cancelled' THEN 'cancelled'
    WHEN 'refunded' THEN 'returned'
    WHEN 'returned' THEN 'returned'
    WHEN 'ready for dispatch' THEN 'ready_for_dispatch'
    WHEN 'invoiced' THEN 'processing'
    ELSE 'order_placed'
  END;

-- Map old text payment_status to new payment_statuses.code
UPDATE orders o SET payment_status_id = ps.id
FROM payment_statuses ps
WHERE o.payment_status_id IS NULL
  AND ps.code = CASE o.payment_status
    WHEN 'pending' THEN 'pending'
    WHEN 'paid' THEN 'paid'
    WHEN 'failed' THEN 'failed'
    WHEN 'refunded' THEN 'refunded'
    ELSE 'pending'
  END;

-- Set return_status_id to 'none' for all orders
UPDATE orders o SET return_status_id = rs.id
FROM return_statuses rs
WHERE o.return_status_id IS NULL AND rs.code = 'none';

-- ═══════════════════════════════════════════════════════════════
-- 5. DROP OLD CHECK CONSTRAINTS
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_status_check;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- ═══════════════════════════════════════════════════════════════
-- 6. CREATE HISTORY TABLES
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  old_status_id uuid REFERENCES order_statuses(id),
  new_status_id uuid NOT NULL REFERENCES order_statuses(id),
  changed_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  old_status_id uuid REFERENCES payment_statuses(id),
  new_status_id uuid NOT NULL REFERENCES payment_statuses(id),
  changed_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS return_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  old_status_id uuid REFERENCES return_statuses(id),
  new_status_id uuid NOT NULL REFERENCES return_statuses(id),
  changed_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- 7. INDEXES
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_orders_order_status_id ON orders(order_status_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status_id ON orders(payment_status_id);
CREATE INDEX IF NOT EXISTS idx_orders_return_status_id ON orders(return_status_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_status_history_order_id ON payment_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_return_status_history_order_id ON return_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_statuses_sequence ON order_statuses(sequence);
CREATE INDEX IF NOT EXISTS idx_return_statuses_sequence ON return_statuses(sequence);

-- ═══════════════════════════════════════════════════════════════
-- 8. ENABLE RLS
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE order_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_status_history ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- 9. RLS POLICIES — Master tables
-- Readable by everyone (anon + authenticated), writable by admins only
-- ═══════════════════════════════════════════════════════════════

-- Helper function: check if current user is admin
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- order_statuses: SELECT for all, write for admins
DROP POLICY IF EXISTS "read_order_statuses" ON order_statuses;
CREATE POLICY "read_order_statuses" ON order_statuses FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_order_statuses_admin" ON order_statuses;
CREATE POLICY "insert_order_statuses_admin" ON order_statuses FOR INSERT
  TO authenticated WITH CHECK (is_admin_user());

DROP POLICY IF EXISTS "update_order_statuses_admin" ON order_statuses;
CREATE POLICY "update_order_statuses_admin" ON order_statuses FOR UPDATE
  TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());

DROP POLICY IF EXISTS "delete_order_statuses_admin" ON order_statuses;
CREATE POLICY "delete_order_statuses_admin" ON order_statuses FOR DELETE
  TO authenticated USING (is_admin_user());

-- payment_statuses: SELECT for all, write for admins
DROP POLICY IF EXISTS "read_payment_statuses" ON payment_statuses;
CREATE POLICY "read_payment_statuses" ON payment_statuses FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_payment_statuses_admin" ON payment_statuses;
CREATE POLICY "insert_payment_statuses_admin" ON payment_statuses FOR INSERT
  TO authenticated WITH CHECK (is_admin_user());

DROP POLICY IF EXISTS "update_payment_statuses_admin" ON payment_statuses;
CREATE POLICY "update_payment_statuses_admin" ON payment_statuses FOR UPDATE
  TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());

DROP POLICY IF EXISTS "delete_payment_statuses_admin" ON payment_statuses;
CREATE POLICY "delete_payment_statuses_admin" ON payment_statuses FOR DELETE
  TO authenticated USING (is_admin_user());

-- return_statuses: SELECT for all, write for admins
DROP POLICY IF EXISTS "read_return_statuses" ON return_statuses;
CREATE POLICY "read_return_statuses" ON return_statuses FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_return_statuses_admin" ON return_statuses;
CREATE POLICY "insert_return_statuses_admin" ON return_statuses FOR INSERT
  TO authenticated WITH CHECK (is_admin_user());

DROP POLICY IF EXISTS "update_return_statuses_admin" ON return_statuses;
CREATE POLICY "update_return_statuses_admin" ON return_statuses FOR UPDATE
  TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());

DROP POLICY IF EXISTS "delete_return_statuses_admin" ON return_statuses;
CREATE POLICY "delete_return_statuses_admin" ON return_statuses FOR DELETE
  TO authenticated USING (is_admin_user());

-- ═══════════════════════════════════════════════════════════════
-- 10. RLS POLICIES — History tables
-- Readable by order owner + admins, writable by authenticated
-- ═══════════════════════════════════════════════════════════════

-- order_status_history
DROP POLICY IF EXISTS "read_order_status_history" ON order_status_history;
CREATE POLICY "read_order_status_history" ON order_status_history FOR SELECT
  TO authenticated USING (
    is_admin_user() OR EXISTS (
      SELECT 1 FROM orders WHERE orders.id = order_status_history.order_id AND orders.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_order_status_history" ON order_status_history;
CREATE POLICY "insert_order_status_history" ON order_status_history FOR INSERT
  TO authenticated WITH CHECK (true);

-- payment_status_history
DROP POLICY IF EXISTS "read_payment_status_history" ON payment_status_history;
CREATE POLICY "read_payment_status_history" ON payment_status_history FOR SELECT
  TO authenticated USING (
    is_admin_user() OR EXISTS (
      SELECT 1 FROM orders WHERE orders.id = payment_status_history.order_id AND orders.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_payment_status_history" ON payment_status_history;
CREATE POLICY "insert_payment_status_history" ON payment_status_history FOR INSERT
  TO authenticated WITH CHECK (true);

-- return_status_history
DROP POLICY IF EXISTS "read_return_status_history" ON return_status_history;
CREATE POLICY "read_return_status_history" ON return_status_history FOR SELECT
  TO authenticated USING (
    is_admin_user() OR EXISTS (
      SELECT 1 FROM orders WHERE orders.id = return_status_history.order_id AND orders.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_return_status_history" ON return_status_history;
CREATE POLICY "insert_return_status_history" ON return_status_history FOR INSERT
  TO authenticated WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
-- 11. TRIGGERS — Auto-insert history on status changes
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_status_id IS DISTINCT FROM OLD.order_status_id THEN
    INSERT INTO order_status_history (order_id, old_status_id, new_status_id, changed_by)
    VALUES (NEW.id, OLD.order_status_id, NEW.order_status_id, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_order_status_change ON orders;
CREATE TRIGGER trigger_log_order_status_change
  AFTER UPDATE OF order_status_id ON orders
  FOR EACH ROW
  EXECUTE FUNCTION log_order_status_change();

CREATE OR REPLACE FUNCTION log_payment_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status_id IS DISTINCT FROM OLD.payment_status_id THEN
    INSERT INTO payment_status_history (order_id, old_status_id, new_status_id, changed_by)
    VALUES (NEW.id, OLD.payment_status_id, NEW.payment_status_id, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_payment_status_change ON orders;
CREATE TRIGGER trigger_log_payment_status_change
  AFTER UPDATE OF payment_status_id ON orders
  FOR EACH ROW
  EXECUTE FUNCTION log_payment_status_change();

CREATE OR REPLACE FUNCTION log_return_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.return_status_id IS DISTINCT FROM OLD.return_status_id THEN
    INSERT INTO return_status_history (order_id, old_status_id, new_status_id, changed_by)
    VALUES (NEW.id, OLD.return_status_id, NEW.return_status_id, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_return_status_change ON orders;
CREATE TRIGGER trigger_log_return_status_change
  AFTER UPDATE OF return_status_id ON orders
  FOR EACH ROW
  EXECUTE FUNCTION log_return_status_change();
