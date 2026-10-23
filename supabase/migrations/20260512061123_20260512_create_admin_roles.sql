/*
  # Create Admin Roles System

  1. New Tables
    - `admin_users` - Stores which users have admin access
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `role` (text, enum: 'admin', 'super_admin')
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `admin_users` table
    - Only authenticated users can view their own admin status
    - Only super_admin can modify admin users

  3. Notes
    - Super Admin: Can manage other admins and all products
    - Admin: Can manage products only
    - Regular User: Cannot access admin panel
*/

CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Admins can view their own role
CREATE POLICY "Admins can view own role"
  ON admin_users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Super admin can view all admin users
CREATE POLICY "Super admin can view all admins"
  ON admin_users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role = 'super_admin'
    )
  );

-- Super admin can insert new admins
CREATE POLICY "Super admin can create admins"
  ON admin_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role = 'super_admin'
    )
  );

-- Super admin can update admin roles
CREATE POLICY "Super admin can update admins"
  ON admin_users
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role = 'super_admin'
    )
  );

-- Super admin can delete admins
CREATE POLICY "Super admin can delete admins"
  ON admin_users
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role = 'super_admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
