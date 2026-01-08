/*
  # Fix uid() function in RLS policies

  1. Problem
    - Used uid() instead of auth.uid() in RLS policies
    - Supabase uses auth.uid() not uid()

  2. Solution
    - Drop and recreate policies with correct auth.uid() function
    - Ensure all policies use proper Supabase syntax
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Aziende possono gestire i propri template" ON rate_templates;
DROP POLICY IF EXISTS "Dipendenti possono leggere template assegnati" ON rate_templates;
DROP POLICY IF EXISTS "Public can manage rate_templates" ON rate_templates;

-- Create correct policies with auth.uid()
CREATE POLICY "Aziende possono gestire i propri template"
  ON rate_templates
  FOR ALL
  TO authenticated
  USING (azienda_id = auth.uid())
  WITH CHECK (azienda_id = auth.uid());

CREATE POLICY "Dipendenti possono leggere template assegnati"
  ON rate_templates
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT template_id 
      FROM employee_rate_assignments 
      WHERE dipendente_id = auth.uid() 
      AND attivo = true
    )
  );

-- Temporary public policy for testing (remove in production)
CREATE POLICY "Public can manage rate_templates for testing"
  ON rate_templates
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);