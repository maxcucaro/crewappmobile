/*
  # Fix timesheet_entries RLS policies

  1. Security Updates
    - Drop existing policies if they exist
    - Recreate policies with correct permissions
    - Allow crew members to manage their own timesheet entries

  2. Policy Changes
    - Crew members can insert their own entries
    - Crew members can update their own entries  
    - Crew members can read their own entries
    - Companies can read entries for their events
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Crew members can read own timesheet entries" ON timesheet_entries;
DROP POLICY IF EXISTS "Crew members can insert own timesheet entries" ON timesheet_entries;
DROP POLICY IF EXISTS "Crew members can update own timesheet entries" ON timesheet_entries;
DROP POLICY IF EXISTS "Companies can read timesheet entries for their events" ON timesheet_entries;

-- Recreate policies with correct permissions
CREATE POLICY "Crew members can read own timesheet entries"
  ON timesheet_entries
  FOR SELECT
  TO authenticated
  USING (crew_id = auth.uid());

CREATE POLICY "Crew members can insert own timesheet entries"
  ON timesheet_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (crew_id = auth.uid());

CREATE POLICY "Crew members can update own timesheet entries"
  ON timesheet_entries
  FOR UPDATE
  TO authenticated
  USING (crew_id = auth.uid())
  WITH CHECK (crew_id = auth.uid());

CREATE POLICY "Companies can read timesheet entries for their events"
  ON timesheet_entries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crew_events
      WHERE crew_events.id = timesheet_entries.event_id
      AND crew_events.company_id = auth.uid()
    )
  );