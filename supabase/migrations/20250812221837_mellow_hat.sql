/*
  # Fix warehouse_checkins foreign key constraint

  1. Problem Resolution
    - The foreign key constraint already exists in the database
    - Previous migration failed because it tried to create an existing constraint
    - This migration safely handles the existing constraint

  2. Solution
    - Check if the foreign key constraint exists
    - Only create it if it doesn't exist
    - Provide informative messages about the operation
*/

DO $$
BEGIN
  -- Check if the foreign key constraint already exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'warehouse_checkins_warehouse_id_fkey'
    AND table_name = 'warehouse_checkins'
    AND constraint_type = 'FOREIGN KEY'
  ) THEN
    -- Create the foreign key constraint if it doesn't exist
    ALTER TABLE warehouse_checkins 
    ADD CONSTRAINT warehouse_checkins_warehouse_id_fkey 
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Foreign key constraint warehouse_checkins_warehouse_id_fkey created successfully';
  ELSE
    RAISE NOTICE 'Foreign key constraint warehouse_checkins_warehouse_id_fkey already exists - no action needed';
  END IF;
END $$;