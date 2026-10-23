/*
# Fix is_admin_user() regression and re-seed return_statuses

## Root Cause
The `is_admin_user()` function (created in migration 20260702104615) checks
`user_profiles.role = 'admin'` to determine admin access. However, the app's
admin management uses a SEPARATE `admin_users` table:
  - Frontend (AuthContext) checks `admin_users` for any row with `user_id = auth.uid()`
  - `is_admin()` checks `admin_users` for any row
  - `is_super_admin()` checks `admin_users` for `role = 'super_admin'`
  - `is_admin_user()` checks `user_profiles` for `role = 'admin'` ← MISMATCH

The admin user has `admin_users.role = 'super_admin'` but
`user_profiles.role = 'customer'` (set by the `handle_new_user` trigger which
always inserts 'customer'). So `is_admin_user()` returns FALSE for the actual
admin, causing 403 Forbidden on all status table INSERT/UPDATE/DELETE operations.

The `return_statuses` table is also empty (seed data was lost), which breaks
order creation because `create_order_atomic` requires a 'none' return status.

## Changes
1. Fix `is_admin_user()` to check the `admin_users` table (same source of truth
   as the frontend and `is_admin()`), aligning all three admin-check functions.
   The function remains SECURITY DEFINER, owned by postgres, with safe search_path.
2. Re-seed `return_statuses` with the original 12 initial statuses.

## Security
- RLS is NOT disabled on any table.
- No policies are changed to `USING (true)`.
- Admin-only write access is preserved — `is_admin_user()` now correctly
  returns TRUE for admin users and FALSE for non-admin users.
- The function remains SECURITY DEFINER with `SET search_path TO 'public'`.
*/

-- ═══════════════════════════════════════════════════════════════
-- 1. Fix is_admin_user() to check admin_users table
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
  );
$$;

-- ═══════════════════════════════════════════════════════════════
-- 2. Re-seed return_statuses with original initial data
-- ═══════════════════════════════════════════════════════════════

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
