/*
  # Aggiungi policy RLS per warehouse_shifts

  1. Security
    - Abilita RLS su warehouse_shifts (se non già abilitato)
    - Aggiungi policy INSERT per aziende
    - Aggiungi policy UPDATE per aziende
    - Aggiungi policy DELETE per aziende
    - Aggiungi policy SELECT per aziende e dipendenti

  2. Permissions
    - Le aziende possono gestire i propri turni magazzino
    - I dipendenti possono leggere i turni a cui sono assegnati
    - Admin possono gestire tutto
*/

-- Abilita RLS se non già abilitato
ALTER TABLE warehouse_shifts ENABLE ROW LEVEL SECURITY;

-- Policy per lettura: aziende possono leggere i propri turni
CREATE POLICY "Companies can read own warehouse shifts"
  ON warehouse_shifts
  FOR SELECT
  TO authenticated
  USING (company_id = auth.uid());

-- Policy per inserimento: aziende possono creare turni
CREATE POLICY "Companies can insert own warehouse shifts"
  ON warehouse_shifts
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = auth.uid());

-- Policy per aggiornamento: aziende possono aggiornare i propri turni
CREATE POLICY "Companies can update own warehouse shifts"
  ON warehouse_shifts
  FOR UPDATE
  TO authenticated
  USING (company_id = auth.uid())
  WITH CHECK (company_id = auth.uid());

-- Policy per eliminazione: aziende possono eliminare i propri turni
CREATE POLICY "Companies can delete own warehouse shifts"
  ON warehouse_shifts
  FOR DELETE
  TO authenticated
  USING (company_id = auth.uid());

-- Policy per dipendenti: possono leggere turni a cui sono assegnati
CREATE POLICY "Employees can read assigned warehouse shifts"
  ON warehouse_shifts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM warehouse_shift_assignments 
      WHERE warehouse_shift_assignments.shift_id = warehouse_shifts.id 
      AND warehouse_shift_assignments.employee_id = auth.uid()
    )
  );

-- Policy per admin: accesso completo
CREATE POLICY "Admin can manage all warehouse shifts"
  ON warehouse_shifts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND (auth.users.raw_user_meta_data->>'role' = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND (auth.users.raw_user_meta_data->>'role' = 'admin')
    )
  );

-- Abilita RLS su warehouse_shift_assignments se non già abilitato
ALTER TABLE warehouse_shift_assignments ENABLE ROW LEVEL SECURITY;

-- Policy per assegnazioni: aziende possono gestire assegnazioni dei propri turni
CREATE POLICY "Companies can manage own shift assignments"
  ON warehouse_shift_assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM warehouse_shifts 
      WHERE warehouse_shifts.id = warehouse_shift_assignments.shift_id 
      AND warehouse_shifts.company_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM warehouse_shifts 
      WHERE warehouse_shifts.id = warehouse_shift_assignments.shift_id 
      AND warehouse_shifts.company_id = auth.uid()
    )
  );

-- Policy per dipendenti: possono leggere le proprie assegnazioni
CREATE POLICY "Employees can read own shift assignments"
  ON warehouse_shift_assignments
  FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

-- Abilita RLS su warehouse_shift_templates se non già abilitato
ALTER TABLE warehouse_shift_templates ENABLE ROW LEVEL SECURITY;

-- Policy per template: aziende possono gestire i propri template
CREATE POLICY "Companies can manage own shift templates"
  ON warehouse_shift_templates
  FOR ALL
  TO authenticated
  USING (company_id = auth.uid())
  WITH CHECK (company_id = auth.uid());