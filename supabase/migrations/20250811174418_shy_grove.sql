/*
  # Fix warehouses table RLS policies

  1. Security Updates
    - Update RLS policies to work with unified ID system
    - Allow companies to create warehouses using both company_id and auth_user_id
    - Ensure proper access control for warehouse operations

  2. Policy Changes
    - Companies can create warehouses when authenticated
    - Companies can read/update/delete their own warehouses
    - Admin users have full access to all warehouses
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admin can manage all warehouses" ON warehouses;
DROP POLICY IF EXISTS "Companies can create own warehouses" ON warehouses;
DROP POLICY IF EXISTS "Companies can read own warehouses" ON warehouses;
DROP POLICY IF EXISTS "Companies can update own warehouses" ON warehouses;
DROP POLICY IF EXISTS "Companies can delete own warehouses" ON warehouses;

-- Create new unified policies
CREATE POLICY "Admin can manage all warehouses"
  ON warehouses
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE users.id = auth.uid() 
      AND (users.raw_user_meta_data->>'role')::text = 'admin'
    )
  );

CREATE POLICY "Companies can create warehouses"
  ON warehouses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth_user_id = auth.uid() OR 
    company_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM regaziendasoftware 
      WHERE regaziendasoftware.auth_user_id = auth.uid() 
      AND regaziendasoftware.id = company_id
    )
  );

CREATE POLICY "Companies can read own warehouses"
  ON warehouses
  FOR SELECT
  TO authenticated
  USING (
    auth_user_id = auth.uid() OR 
    company_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM regaziendasoftware 
      WHERE regaziendasoftware.auth_user_id = auth.uid() 
      AND regaziendasoftware.id = company_id
    )
  );

CREATE POLICY "Companies can update own warehouses"
  ON warehouses
  FOR UPDATE
  TO authenticated
  USING (
    auth_user_id = auth.uid() OR 
    company_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM regaziendasoftware 
      WHERE regaziendasoftware.auth_user_id = auth.uid() 
      AND regaziendasoftware.id = company_id
    )
  )
  WITH CHECK (
    auth_user_id = auth.uid() OR 
    company_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM regaziendasoftware 
      WHERE regaziendasoftware.auth_user_id = auth.uid() 
      AND regaziendasoftware.id = company_id
    )
  );

CREATE POLICY "Companies can delete own warehouses"
  ON warehouses
  FOR DELETE
  TO authenticated
  USING (
    auth_user_id = auth.uid() OR 
    company_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM regaziendasoftware 
      WHERE regaziendasoftware.auth_user_id = auth.uid() 
      AND regaziendasoftware.id = company_id
    )
  );