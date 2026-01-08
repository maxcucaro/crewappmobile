/*
  # Add company_id to warehouse_checkins table

  1. New Column
    - `company_id` (uuid, foreign key to regaziendasoftware)
    - Populated automatically from warehouse relationship

  2. Data Migration
    - Update existing records with company_id from warehouses table
    - Add foreign key constraint
    - Add index for performance

  3. Security
    - Update RLS policies to include company access
*/

-- Add company_id column to warehouse_checkins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_checkins' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE warehouse_checkins ADD COLUMN company_id uuid;
  END IF;
END $$;

-- Populate company_id for existing records
UPDATE warehouse_checkins 
SET company_id = warehouses.company_id
FROM warehouses 
WHERE warehouse_checkins.warehouse_id = warehouses.id 
AND warehouse_checkins.company_id IS NULL;

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'warehouse_checkins_company_id_fkey'
  ) THEN
    ALTER TABLE warehouse_checkins 
    ADD CONSTRAINT warehouse_checkins_company_id_fkey 
    FOREIGN KEY (company_id) REFERENCES regaziendasoftware(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_warehouse_checkins_company_id 
ON warehouse_checkins(company_id);

-- Update RLS policies to allow companies to read their checkins
DROP POLICY IF EXISTS "Companies can read own warehouse checkins" ON warehouse_checkins;

CREATE POLICY "Companies can read own warehouse checkins"
  ON warehouse_checkins
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT r.id
      FROM regaziendasoftware r
      WHERE (
        (r.auth_user_id = uid()) OR 
        (r.email = (SELECT users.email FROM auth.users WHERE users.id = uid())::text) OR 
        (r.id = uid())
      ) AND r.attivo = true
    )
  );

-- Allow crew members to read their own checkins
DROP POLICY IF EXISTS "Crew members can read own checkins" ON warehouse_checkins;

CREATE POLICY "Crew members can read own checkins"
  ON warehouse_checkins
  FOR SELECT
  TO authenticated
  USING (crew_id = uid());