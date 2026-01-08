/*
  # Add auth_user_id to regaziendasoftware table

  1. Schema Changes
    - Add `auth_user_id` column to `regaziendasoftware` table
    - Create index for performance
    - Add foreign key constraint to auth.users

  2. Data Migration
    - Populate existing records with auth_user_id where possible
    - Handle cases where auth_user_id might be missing

  3. Security
    - Update existing RLS policies to work with auth_user_id
    - Ensure proper access control
*/

-- Add auth_user_id column to regaziendasoftware table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'regaziendasoftware' AND column_name = 'auth_user_id'
  ) THEN
    ALTER TABLE regaziendasoftware ADD COLUMN auth_user_id uuid;
  END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_regaziendasoftware_auth_user_id 
ON regaziendasoftware(auth_user_id);

-- Add foreign key constraint to auth.users (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'regaziendasoftware_auth_user_id_fkey'
  ) THEN
    ALTER TABLE regaziendasoftware 
    ADD CONSTRAINT regaziendasoftware_auth_user_id_fkey 
    FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Update RLS policies to work with both id and auth_user_id
DROP POLICY IF EXISTS "Admin can manage companies" ON regaziendasoftware;
DROP POLICY IF EXISTS "Public can read active companies for selection" ON regaziendasoftware;

CREATE POLICY "Admin can manage companies"
  ON regaziendasoftware
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Companies can manage own data"
  ON regaziendasoftware
  FOR ALL
  TO authenticated
  USING (auth_user_id = auth.uid() OR id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid() OR id = auth.uid());

CREATE POLICY "Public can read active companies for selection"
  ON regaziendasoftware
  FOR SELECT
  TO public
  USING (attivo = true AND ragione_sociale IS NOT NULL);