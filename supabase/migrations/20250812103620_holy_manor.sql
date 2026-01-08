/*
  # Policy RLS semplice per turni magazzino

  1. Permessi
    - Aziende autenticate possono gestire completamente i turni magazzino
    - Stessi permessi degli eventi e crew management
    
  2. Sicurezza
    - Solo utenti autenticati
    - Accesso completo per aziende
*/

-- Abilita RLS sulla tabella warehouse_shifts
ALTER TABLE warehouse_shifts ENABLE ROW LEVEL SECURITY;

-- Policy completa per aziende autenticate
CREATE POLICY "Companies can manage warehouse shifts"
  ON warehouse_shifts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Abilita RLS sulla tabella warehouse_shift_assignments
ALTER TABLE warehouse_shift_assignments ENABLE ROW LEVEL SECURITY;

-- Policy completa per assegnazioni turni
CREATE POLICY "Companies can manage shift assignments"
  ON warehouse_shift_assignments
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Abilita RLS sulla tabella warehouse_shift_templates
ALTER TABLE warehouse_shift_templates ENABLE ROW LEVEL SECURITY;

-- Policy completa per template turni
CREATE POLICY "Companies can manage shift templates"
  ON warehouse_shift_templates
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);