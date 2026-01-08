/*
  # Add company_id to warehouse_checkins table

  1. New Column
    - `company_id` (uuid, foreign key to regaziendasoftware)
    - Populated from existing warehouse data
    
  2. Data Migration
    - Update existing records with company_id from warehouses table
    
  3. Constraints
    - Foreign key to regaziendasoftware table
    - Index for performance
    
  4. Security
    - Updated RLS policies for company access
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

-- Populate company_id from warehouses table for existing records
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

-- Update RLS policies
DROP POLICY IF EXISTS "Companies can manage warehouse checkins" ON warehouse_checkins;
DROP POLICY IF EXISTS "Crew members can manage own checkins" ON warehouse_checkins;

CREATE POLICY "Companies can manage warehouse checkins"
  ON warehouse_checkins
  FOR ALL
  TO authenticated
  USING (company_id IN (
    SELECT r.id FROM regaziendasoftware r 
    WHERE (r.auth_user_id = auth.uid() OR r.email = email() OR r.id = auth.uid()) 
    AND r.attivo = true
  ))
  WITH CHECK (company_id IN (
    SELECT r.id FROM regaziendasoftware r 
    WHERE (r.auth_user_id = auth.uid() OR r.email = email() OR r.id = auth.uid()) 
    AND r.attivo = true
  ));

CREATE POLICY "Crew members can manage own checkins"
  ON warehouse_checkins
  FOR ALL
  TO authenticated
  USING (crew_id = auth.uid())
  WITH CHECK (crew_id = auth.uid());

-- Enable RLS if not already enabled
ALTER TABLE warehouse_checkins ENABLE ROW LEVEL SECURITY;