/*
  # Add auth_user_id to event_crew_assignments table

  1. Schema Changes
    - Add `auth_user_id` column to `event_crew_assignments` table
    - Populate existing records with auth_user_id from registration_requests
    - Add index for performance

  2. Data Migration
    - Update existing assignments with correct auth_user_id
    - Ensure data consistency between crew_id and auth_user_id

  3. Performance
    - Add index on auth_user_id for faster lookups
*/

-- Add auth_user_id column to event_crew_assignments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_crew_assignments' AND column_name = 'auth_user_id'
  ) THEN
    ALTER TABLE event_crew_assignments ADD COLUMN auth_user_id uuid;
  END IF;
END $$;

-- Populate auth_user_id for existing records from registration_requests
UPDATE event_crew_assignments 
SET auth_user_id = rr.auth_user_id
FROM registration_requests rr
WHERE event_crew_assignments.crew_id = rr.id
AND event_crew_assignments.auth_user_id IS NULL;

-- Populate auth_user_id for crew_members (freelance)
UPDATE event_crew_assignments 
SET auth_user_id = cm.id
FROM crew_members cm
WHERE event_crew_assignments.crew_id = cm.id
AND event_crew_assignments.auth_user_id IS NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_event_crew_assignments_auth_user_id 
ON event_crew_assignments(auth_user_id);

-- Add foreign key constraint (optional, for data integrity)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'event_crew_assignments_auth_user_id_fkey'
  ) THEN
    ALTER TABLE event_crew_assignments 
    ADD CONSTRAINT event_crew_assignments_auth_user_id_fkey 
    FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;