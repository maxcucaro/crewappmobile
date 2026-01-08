/*
  # Fix crewtariffe RLS policies for custom authentication

  1. Problem
    - Current policies use auth.uid() but app uses custom login system
    - Need to use JWT claims instead of auth.uid()
    
  2. Solution
    - Update policies to use JWT email matching
    - Allow public role with proper email verification
*/

-- Drop existing policies that use auth.uid()
DROP POLICY IF EXISTS "Aziende possono inserire le proprie tariffe" ON crewtariffe;
DROP POLICY IF EXISTS "Aziende possono aggiornare le proprie tariffe" ON crewtariffe;
DROP POLICY IF EXISTS "Aziende possono eliminare le proprie tariffe" ON crewtariffe;
DROP POLICY IF EXISTS "Aziende possono leggere le proprie tariffe" ON crewtariffe;
DROP POLICY IF EXISTS "Admin può gestire tutte le tariffe" ON crewtariffe;

-- Create new policies that work with custom authentication
CREATE POLICY "Companies can manage own rates"
  ON crewtariffe
  FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM regaziendasoftware 
      WHERE regaziendasoftware.id = crewtariffe.azienda_id
      AND regaziendasoftware.email = current_setting('request.jwt.claims', true)::json->>'email'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM regaziendasoftware 
      WHERE regaziendasoftware.id = crewtariffe.azienda_id
      AND regaziendasoftware.email = current_setting('request.jwt.claims', true)::json->>'email'
    )
  );

-- Admin policy using email pattern
CREATE POLICY "Admin can manage all rates"
  ON crewtariffe
  FOR ALL
  TO public
  USING (
    current_setting('request.jwt.claims', true)::json->>'email' LIKE '%admin%'
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'email' LIKE '%admin%'
  );