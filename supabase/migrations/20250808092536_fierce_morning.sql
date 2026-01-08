/*
  # Fix JWT function in RLS policies

  1. Problem
    - Using jwt() function which doesn't exist
    - Should use auth.jwt() or current_setting for JWT claims

  2. Solution
    - Replace jwt() with proper Supabase auth functions
    - Use auth.uid() for user ID
    - Use current_setting('request.jwt.claims', true)::json for JWT claims

  3. Tables Updated
    - corsi_formazione
    - iscrizioni_corsi
*/

-- Drop existing policies that use jwt()
DROP POLICY IF EXISTS "Aziende possono gestire propri corsi formazione" ON public.corsi_formazione;
DROP POLICY IF EXISTS "Crew possono leggere corsi pubblici o a cui sono iscritti" ON public.corsi_formazione;
DROP POLICY IF EXISTS "Amministratore può leggere tutti i dati" ON public.iscrizioni_corsi;
DROP POLICY IF EXISTS "Aziende possono gestire iscrizioni ai propri corsi" ON public.iscrizioni_corsi;
DROP POLICY IF EXISTS "Tecnici possono leggere proprie iscrizioni corsi" ON public.iscrizioni_corsi;

-- Recreate policies with correct auth functions for corsi_formazione
CREATE POLICY "Aziende possono gestire propri corsi formazione"
  ON public.corsi_formazione
  FOR ALL
  TO authenticated
  USING (id_azienda = auth.uid())
  WITH CHECK (id_azienda = auth.uid());

CREATE POLICY "Crew possono leggere corsi pubblici o a cui sono iscritti"
  ON public.corsi_formazione
  FOR SELECT
  TO authenticated
  USING (
    (visibilita = 'pubblico'::text) OR 
    (EXISTS (
      SELECT 1 
      FROM iscrizioni_corsi 
      WHERE iscrizioni_corsi.id_corso = corsi_formazione.id 
      AND iscrizioni_corsi.id_tecnico = auth.uid()
    ))
  );

-- Recreate policies with correct auth functions for iscrizioni_corsi
CREATE POLICY "Amministratore può leggere tutti i dati"
  ON public.iscrizioni_corsi
  FOR SELECT
  TO public
  USING (
    (current_setting('request.jwt.claims', true)::json ->> 'role'::text) = 'admin'::text
  );

CREATE POLICY "Aziende possono gestire iscrizioni ai propri corsi"
  ON public.iscrizioni_corsi
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM corsi_formazione 
      WHERE corsi_formazione.id = iscrizioni_corsi.id_corso 
      AND corsi_formazione.id_azienda = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM corsi_formazione 
      WHERE corsi_formazione.id = iscrizioni_corsi.id_corso 
      AND corsi_formazione.id_azienda = auth.uid()
    )
  );

CREATE POLICY "Tecnici possono leggere proprie iscrizioni corsi"
  ON public.iscrizioni_corsi
  FOR SELECT
  TO authenticated
  USING (id_tecnico = auth.uid());