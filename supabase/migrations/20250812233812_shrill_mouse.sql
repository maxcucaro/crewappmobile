/*
  # Fix warehouse_checkins foreign key constraint

  1. Problem
    - warehouse_checkins.warehouse_id references events table (wrong)
    - Should reference warehouses table (correct)

  2. Solution
    - Drop incorrect foreign key constraint
    - Add correct foreign key constraint to warehouses table

  3. Result
    - warehouse_checkins can properly reference warehouses
    - Check-in operations will work correctly
*/

-- Drop the incorrect foreign key constraint
ALTER TABLE warehouse_checkins 
DROP CONSTRAINT IF EXISTS warehouse_checkins_warehouse_id_fkey;

-- Add the correct foreign key constraint
ALTER TABLE warehouse_checkins 
ADD CONSTRAINT warehouse_checkins_warehouse_id_fkey 
FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE;