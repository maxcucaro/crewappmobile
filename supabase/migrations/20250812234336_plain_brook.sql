/*
  # Fix warehouse_checkins foreign key to point to registration_requests

  1. Changes
    - Drop existing foreign key constraint that points to crew_members
    - Add new foreign key constraint that points to registration_requests
    - This aligns with the authentication system that uses registration_requests

  2. Security
    - Maintains data integrity
    - Aligns with existing authentication flow
*/

-- Drop the existing foreign key constraint
ALTER TABLE warehouse_checkins 
DROP CONSTRAINT IF EXISTS warehouse_checkins_crew_id_fkey;

-- Add new foreign key constraint pointing to registration_requests
ALTER TABLE warehouse_checkins 
ADD CONSTRAINT warehouse_checkins_crew_id_fkey 
FOREIGN KEY (crew_id) REFERENCES registration_requests(id) ON DELETE CASCADE;