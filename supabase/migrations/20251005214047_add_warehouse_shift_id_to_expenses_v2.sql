/*
  # Supporto Turni Magazzino nelle Note Spese

  1. Modifiche alla tabella expenses
    - Rende `event_id` nullable (può essere NULL se è un turno magazzino)
    - Aggiunge colonna `warehouse_shift_id` (uuid, nullable, FK a crew_assegnazione_turni)
    - Aggiunge constraint CHECK per garantire che almeno uno tra event_id e warehouse_shift_id sia valorizzato
    
  2. Security
    - Aggiorna le policy RLS esistenti per gestire sia eventi che turni magazzino
    - I dipendenti possono creare note spese per i propri turni magazzino assegnati
    - Le aziende possono vedere note spese dei turni magazzino dei propri dipendenti

  3. Note
    - Mantiene tutti i dati esistenti (tutti gli expenses attuali hanno event_id valorizzato)
    - Non elimina nessuna nota spesa
    - Compatibile con il codice esistente
*/

-- 1. Rendi event_id nullable
ALTER TABLE expenses 
ALTER COLUMN event_id DROP NOT NULL;

-- 2. Aggiungi colonna warehouse_shift_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'warehouse_shift_id'
  ) THEN
    ALTER TABLE expenses ADD COLUMN warehouse_shift_id uuid NULL;
  END IF;
END $$;

-- 3. Aggiungi foreign key a crew_assegnazione_turni
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'expenses_warehouse_shift_id_fkey'
  ) THEN
    ALTER TABLE expenses 
    ADD CONSTRAINT expenses_warehouse_shift_id_fkey 
    FOREIGN KEY (warehouse_shift_id) 
    REFERENCES crew_assegnazione_turni(id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- 4. Aggiungi constraint CHECK per garantire almeno uno tra event_id e warehouse_shift_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'expenses_event_or_warehouse_check'
  ) THEN
    ALTER TABLE expenses 
    ADD CONSTRAINT expenses_event_or_warehouse_check 
    CHECK (
      (event_id IS NOT NULL AND warehouse_shift_id IS NULL) OR 
      (event_id IS NULL AND warehouse_shift_id IS NOT NULL)
    );
  END IF;
END $$;

-- 5. Aggiorna le policy RLS per supportare turni magazzino

-- Policy per crew members: possono gestire note spese per eventi e turni magazzino assegnati
DROP POLICY IF EXISTS "Crew members can manage own expenses" ON expenses;

CREATE POLICY "Crew members can manage own expenses"
  ON expenses
  FOR ALL
  TO authenticated
  USING (
    crew_id = auth.uid() AND (
      -- Per eventi: verifica che sia assegnato all'evento
      (event_id IS NOT NULL AND event_id IN (
        SELECT evento_id FROM crew_event_assegnazione 
        WHERE dipendente_freelance_id = auth.uid()
      )) OR
      -- Per turni magazzino: verifica che sia assegnato al turno
      (warehouse_shift_id IS NOT NULL AND warehouse_shift_id IN (
        SELECT id FROM crew_assegnazione_turni 
        WHERE dipendente_id = auth.uid()
      ))
    )
  )
  WITH CHECK (
    crew_id = auth.uid() AND (
      -- Per eventi: verifica che sia assegnato all'evento
      (event_id IS NOT NULL AND event_id IN (
        SELECT evento_id FROM crew_event_assegnazione 
        WHERE dipendente_freelance_id = auth.uid()
      )) OR
      -- Per turni magazzino: verifica che sia assegnato al turno
      (warehouse_shift_id IS NOT NULL AND warehouse_shift_id IN (
        SELECT id FROM crew_assegnazione_turni 
        WHERE dipendente_id = auth.uid()
      ))
    )
  );

-- Policy per aziende: possono gestire note spese per i propri eventi e turni magazzino
DROP POLICY IF EXISTS "Companies can manage expenses for their events" ON expenses;

CREATE POLICY "Companies can manage expenses for their events"
  ON expenses
  FOR ALL
  TO authenticated
  USING (
    (
      -- Per eventi: verifica che l'evento appartenga all'azienda
      event_id IS NOT NULL AND event_id IN (
        SELECT e.id
        FROM crew_events e
        JOIN regaziendasoftware r ON e.company_id = r.id
        WHERE (
          r.auth_user_id = auth.uid() OR 
          r.email = (SELECT email FROM auth.users WHERE id = auth.uid())::text OR 
          r.id = auth.uid()
        ) AND r.attivo = true
      )
    ) OR (
      -- Per turni magazzino: verifica che il turno appartenga all'azienda
      warehouse_shift_id IS NOT NULL AND warehouse_shift_id IN (
        SELECT cat.id
        FROM crew_assegnazione_turni cat
        JOIN regaziendasoftware r ON cat.azienda_id = r.id
        WHERE (
          r.auth_user_id = auth.uid() OR 
          r.email = (SELECT email FROM auth.users WHERE id = auth.uid())::text OR 
          r.id = auth.uid()
        ) AND r.attivo = true
      )
    )
  )
  WITH CHECK (
    (
      -- Per eventi: verifica che l'evento appartenga all'azienda
      event_id IS NOT NULL AND event_id IN (
        SELECT e.id
        FROM crew_events e
        JOIN regaziendasoftware r ON e.company_id = r.id
        WHERE (
          r.auth_user_id = auth.uid() OR 
          r.email = (SELECT email FROM auth.users WHERE id = auth.uid())::text OR 
          r.id = auth.uid()
        ) AND r.attivo = true
      )
    ) OR (
      -- Per turni magazzino: verifica che il turno appartenga all'azienda
      warehouse_shift_id IS NOT NULL AND warehouse_shift_id IN (
        SELECT cat.id
        FROM crew_assegnazione_turni cat
        JOIN regaziendasoftware r ON cat.azienda_id = r.id
        WHERE (
          r.auth_user_id = auth.uid() OR 
          r.email = (SELECT email FROM auth.users WHERE id = auth.uid())::text OR 
          r.id = auth.uid()
        ) AND r.attivo = true
      )
    )
  );

-- Policy per visualizzazione aziende
DROP POLICY IF EXISTS "Companies can view expenses for their events" ON expenses;

CREATE POLICY "Companies can view expenses for their events"
  ON expenses
  FOR SELECT
  TO authenticated
  USING (
    (
      -- Per eventi: verifica che l'evento appartenga all'azienda
      event_id IS NOT NULL AND event_id IN (
        SELECT e.id
        FROM crew_events e
        JOIN regaziendasoftware r ON e.company_id = r.id
        WHERE (
          r.auth_user_id = auth.uid() OR 
          r.email = (SELECT email FROM auth.users WHERE id = auth.uid())::text OR 
          r.id = auth.uid()
        ) AND r.attivo = true
      )
    ) OR (
      -- Per turni magazzino: verifica che il turno appartenga all'azienda
      warehouse_shift_id IS NOT NULL AND warehouse_shift_id IN (
        SELECT cat.id
        FROM crew_assegnazione_turni cat
        JOIN regaziendasoftware r ON cat.azienda_id = r.id
        WHERE (
          r.auth_user_id = auth.uid() OR 
          r.email = (SELECT email FROM auth.users WHERE id = auth.uid())::text OR 
          r.id = auth.uid()
        ) AND r.attivo = true
      )
    )
  );

-- 6. Crea indice per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_expenses_warehouse_shift 
ON expenses(warehouse_shift_id) 
WHERE warehouse_shift_id IS NOT NULL;
