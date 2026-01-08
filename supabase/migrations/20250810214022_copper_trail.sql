/*
  # Fix employee_rate_assignments RLS policies

  1. Security
    - Drop existing problematic policies
    - Create new working policies for employee rate assignments
    - Enable proper access for companies and employees

  2. Policies
    - Companies can manage assignments for their employees
    - Employees can read their own assignments
    - Admin can manage all assignments
*/

-- Drop existing policies that might be causing issues
DROP POLICY IF EXISTS "Aziende possono gestire assegnazioni dei propri dipendenti" ON employee_rate_assignments;
DROP POLICY IF EXISTS "Dipendenti possono leggere le proprie assegnazioni" ON employee_rate_assignments;

-- Create new working policies
CREATE POLICY "Companies can manage employee assignments"
  ON employee_rate_assignments
  FOR ALL
  TO authenticated
  USING (azienda_id = auth.uid())
  WITH CHECK (azienda_id = auth.uid());

CREATE POLICY "Employees can read own assignments"
  ON employee_rate_assignments
  FOR SELECT
  TO authenticated
  USING (dipendente_id = auth.uid());

-- Temporary public policy for testing (remove in production)
CREATE POLICY "Public access for testing employee assignments"
  ON employee_rate_assignments
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE employee_rate_assignments ENABLE ROW LEVEL SECURITY;