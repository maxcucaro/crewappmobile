/*
  # Fix infinite recursion in events RLS policy

  1. Problem
    - The current RLS policy on events table has infinite recursion
    - This happens when querying timesheet_entries that reference events
    
  2. Solution
    - Drop the problematic recursive policy
    - Create a simpler, non-recursive policy for crew members reading events
    - Ensure policies don't reference themselves or create circular dependencies
*/

-- Drop the problematic policy that causes recursion
DROP POLICY IF EXISTS "Crew members can read assigned events" ON events;

-- Create a new, simpler policy for crew members to read events
-- This policy directly checks event_crew_assignments without recursion
CREATE POLICY "Crew can read assigned events"
  ON events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM event_crew_assignments eca
      WHERE eca.event_id = events.id 
      AND eca.crew_id = auth.uid()
    )
  );