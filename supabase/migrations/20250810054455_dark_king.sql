/*
  # Fix expenses table RLS policies for crew insertions

  1. Security Updates
    - Drop existing restrictive policies on expenses table
    - Add new policy allowing crew members to insert their own expenses
    - Add policy allowing crew members to view their own expenses
    - Add policy allowing crew members to update their own pending expenses
    - Add policy allowing crew members to delete their own pending expenses

  2. Changes
    - The policies now properly handle the relationship between auth.users and crew_members
    - Crew members can only manage expenses where crew_id matches their user ID
    - Only pending expenses can be updated/deleted by crew members
*/

-- Drop existing policies that might be too restrictive
DROP POLICY IF EXISTS "Allow authenticated users to delete their own expenses" ON expenses;
DROP POLICY IF EXISTS "Allow authenticated users to insert their own expenses" ON expenses;
DROP POLICY IF EXISTS "Allow authenticated users to update their own expenses" ON expenses;
DROP POLICY IF EXISTS "Allow authenticated users to view their own expenses" ON expenses;

-- Create new policies that properly handle crew member access
CREATE POLICY "Crew members can insert own expenses"
  ON expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (crew_id = auth.uid());

CREATE POLICY "Crew members can view own expenses"
  ON expenses
  FOR SELECT
  TO authenticated
  USING (crew_id = auth.uid());

CREATE POLICY "Crew members can update own pending expenses"
  ON expenses
  FOR UPDATE
  TO authenticated
  USING (crew_id = auth.uid() AND status = 'pending')
  WITH CHECK (crew_id = auth.uid());

CREATE POLICY "Crew members can delete own pending expenses"
  ON expenses
  FOR DELETE
  TO authenticated
  USING (crew_id = auth.uid() AND status = 'pending');

-- Allow companies to view expenses for their events
CREATE POLICY "Companies can view expenses for their events"
  ON expenses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = expenses.event_id
      AND events.company_id = auth.uid()
    )
  );

-- Allow admin to manage all expenses
CREATE POLICY "Admin can manage all expenses"
  ON expenses
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );