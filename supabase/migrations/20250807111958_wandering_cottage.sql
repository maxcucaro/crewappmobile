/*
  # Correggi policy RLS per tabella crewtariffe

  1. Security
    - Abilita RLS sulla tabella crewtariffe
    - Aggiungi policy per permettere alle aziende di gestire le proprie tariffe crew
    - Aggiungi policy per permettere la lettura delle tariffe
*/

-- Abilita RLS sulla tabella crewtariffe se non già abilitato
ALTER TABLE crewtariffe ENABLE ROW LEVEL SECURITY;

-- Rimuovi eventuali policy esistenti per evitare conflitti
DROP POLICY IF EXISTS "Aziende possono gestire le proprie tariffe" ON crewtariffe;
DROP POLICY IF EXISTS "Aziende possono leggere le proprie tariffe" ON crewtariffe;
DROP POLICY IF EXISTS "Aziende possono inserire le proprie tariffe" ON crewtariffe;
DROP POLICY IF EXISTS "Aziende possono aggiornare le proprie tariffe" ON crewtariffe;
DROP POLICY IF EXISTS "Aziende possono eliminare le proprie tariffe" ON crewtariffe;

-- Policy per permettere alle aziende di leggere le proprie tariffe
CREATE POLICY "Aziende possono leggere le proprie tariffe"
  ON crewtariffe
  FOR SELECT
  TO authenticated
  USING (azienda_id = auth.uid());

-- Policy per permettere alle aziende di inserire nuove tariffe
CREATE POLICY "Aziende possono inserire le proprie tariffe"
  ON crewtariffe
  FOR INSERT
  TO authenticated
  WITH CHECK (azienda_id = auth.uid());

-- Policy per permettere alle aziende di aggiornare le proprie tariffe
CREATE POLICY "Aziende possono aggiornare le proprie tariffe"
  ON crewtariffe
  FOR UPDATE
  TO authenticated
  USING (azienda_id = auth.uid())
  WITH CHECK (azienda_id = auth.uid());

-- Policy per permettere alle aziende di eliminare le proprie tariffe
CREATE POLICY "Aziende possono eliminare le proprie tariffe"
  ON crewtariffe
  FOR DELETE
  TO authenticated
  USING (azienda_id = auth.uid());

-- Policy per amministratori (se necessario)
CREATE POLICY "Admin può gestire tutte le tariffe"
  ON crewtariffe
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.email LIKE '%admin%'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.email LIKE '%admin%'
    )
  );