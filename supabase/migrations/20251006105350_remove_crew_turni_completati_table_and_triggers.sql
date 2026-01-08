/*
  # Remove crew_turni_completati table and related triggers

  ## Problem
  - The crew_turni_completati table is redundant
  - warehouse_checkins already handles all check-in/out operations
  - The sync trigger causes errors and is unnecessary

  ## Changes
  1. Drop the sync trigger and function
  2. Drop the crew_turni_completati table completely
  3. Keep only warehouse_checkins for warehouse shift management

  ## Security
  - Removes unnecessary data duplication
  - Simplifies the data model
*/

-- Drop the trigger first
DROP TRIGGER IF EXISTS sync_warehouse_checkout_trigger ON warehouse_checkins;

-- Drop the function
DROP FUNCTION IF EXISTS sync_warehouse_checkout_to_completed_shifts();

-- Drop all RLS policies on crew_turni_completati
DROP POLICY IF EXISTS "Admin full access to crew_turni_completati" ON crew_turni_completati;
DROP POLICY IF EXISTS "Crew can view own completed shifts" ON crew_turni_completati;
DROP POLICY IF EXISTS "Company can view their crew completed shifts" ON crew_turni_completati;

-- Drop the table
DROP TABLE IF EXISTS crew_turni_completati CASCADE;