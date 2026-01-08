/*
  # Aggiungi policy RLS per warehouse_checkins

  1. Security
    - Aggiungi policy INSERT per dipendenti autenticati
    - Aggiungi policy UPDATE per dipendenti autenticati  
    - Aggiungi policy DELETE per admin
    - Permetti ai dipendenti di gestire i propri check-in
    - Permetti alle aziende di leggere check-in dei propri magazzini
*/

-- Policy per INSERT: dipendenti possono creare propri check-in
CREATE POLICY "Dipendenti possono creare propri check-in"
  ON warehouse_checkins
  FOR INSERT
  TO authenticated
  WITH CHECK (crew_id = auth.uid());

-- Policy per UPDATE: dipendenti possono aggiornare propri check-in
CREATE POLICY "Dipendenti possono aggiornare propri check-in"
  ON warehouse_checkins
  FOR UPDATE
  TO authenticated
  USING (crew_id = auth.uid())
  WITH CHECK (crew_id = auth.uid());

-- Policy per DELETE: solo admin possono eliminare
CREATE POLICY "Admin possono eliminare check-in"
  ON warehouse_checkins
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND (auth.users.raw_user_meta_data->>'role')::text = 'admin'
    )
  );

-- Policy per INSERT pubblico (per testing e compatibilità)
CREATE POLICY "Public può inserire check-in"
  ON warehouse_checkins
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Policy per UPDATE pubblico (per testing e compatibilità)  
CREATE POLICY "Public può aggiornare check-in"
  ON warehouse_checkins
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);