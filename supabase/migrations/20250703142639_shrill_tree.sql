/*
  # Pulizia dati demo e preparazione per dati reali
  
  1. Pulizia
    - Rimuove tutti i dati demo dalle tabelle esistenti
    - Mantiene la struttura delle tabelle
  
  2. Preparazione
    - Aggiunge indici per migliorare le performance
    - Aggiorna le policy di sicurezza
*/

-- Pulizia dati demo dalle tabelle principali
TRUNCATE TABLE crew_members CASCADE;
TRUNCATE TABLE companies CASCADE;
TRUNCATE TABLE events CASCADE;
TRUNCATE TABLE event_crew_assignments CASCADE;
TRUNCATE TABLE rate_negotiations CASCADE;
TRUNCATE TABLE rate_proposals CASCADE;
TRUNCATE TABLE timesheet_entries CASCADE;
TRUNCATE TABLE expenses CASCADE;
TRUNCATE TABLE documents CASCADE;
TRUNCATE TABLE overtime_requests CASCADE;
TRUNCATE TABLE warehouse_checkins CASCADE;
TRUNCATE TABLE training_courses CASCADE;
TRUNCATE TABLE training_enrollments CASCADE;
TRUNCATE TABLE privacy_settings CASCADE;
TRUNCATE TABLE calendar_syncs CASCADE;
TRUNCATE TABLE notifications CASCADE;

-- Pulizia dati demo dalle tabelle in italiano
TRUNCATE TABLE tecnici CASCADE;
TRUNCATE TABLE aziende CASCADE;
TRUNCATE TABLE eventi CASCADE;
TRUNCATE TABLE assegnazioni_tecnici CASCADE;
TRUNCATE TABLE negoziazioni_tariffe CASCADE;
TRUNCATE TABLE proposte_tariffe CASCADE;
TRUNCATE TABLE presenze CASCADE;
TRUNCATE TABLE spese CASCADE;
TRUNCATE TABLE documenti CASCADE;
TRUNCATE TABLE richieste_straordinari CASCADE;
TRUNCATE TABLE checkin_magazzino CASCADE;
TRUNCATE TABLE corsi_formazione CASCADE;
TRUNCATE TABLE iscrizioni_corsi CASCADE;
TRUNCATE TABLE impostazioni_privacy CASCADE;
TRUNCATE TABLE sincronizzazioni_calendario CASCADE;
TRUNCATE TABLE notifiche CASCADE;

-- Manteniamo solo l'utente admin per l'accesso
DELETE FROM users WHERE email != 'admin@crewmanager.com';
DELETE FROM utenti WHERE email != 'admin@crewmanager.com';

-- Aggiunta indici per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_events_date ON events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_events_company ON events(company_id);
CREATE INDEX IF NOT EXISTS idx_crew_members_company ON crew_members(company_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_date ON timesheet_entries(date);
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_crew ON timesheet_entries(crew_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_crew ON expenses(crew_id);

-- Indici per le tabelle in italiano
CREATE INDEX IF NOT EXISTS idx_eventi_date ON eventi(data_inizio, data_fine);
CREATE INDEX IF NOT EXISTS idx_eventi_azienda ON eventi(id_azienda);
CREATE INDEX IF NOT EXISTS idx_tecnici_azienda ON tecnici(id_azienda);
CREATE INDEX IF NOT EXISTS idx_presenze_data ON presenze(data);
CREATE INDEX IF NOT EXISTS idx_presenze_tecnico ON presenze(id_tecnico);
CREATE INDEX IF NOT EXISTS idx_spese_data ON spese(data_spesa);
CREATE INDEX IF NOT EXISTS idx_spese_tecnico ON spese(id_tecnico);

-- Aggiornamento delle policy di sicurezza per garantire l'accesso corretto ai dati reali
DO $$
BEGIN
  -- Assicuriamoci che gli admin abbiano accesso completo
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polname = 'admin_full_access' AND polrelid = 'users'::regclass
  ) THEN
    EXECUTE 'CREATE POLICY "admin_full_access" ON users
      FOR ALL TO authenticated
      USING (auth.jwt() ->> ''role'' = ''admin'')
      WITH CHECK (auth.jwt() ->> ''role'' = ''admin'')';
  END IF;
  
  -- Policy per gli utenti amministratori in italiano
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polname = 'admin_accesso_completo' AND polrelid = 'utenti'::regclass
  ) THEN
    EXECUTE 'CREATE POLICY "admin_accesso_completo" ON utenti
      FOR ALL TO authenticated
      USING (auth.jwt() ->> ''ruolo'' = ''amministratore'')
      WITH CHECK (auth.jwt() ->> ''ruolo'' = ''amministratore'')';
  END IF;
END
$$;

-- Aggiunta di un commento alla tabella registration_requests per documentare il suo scopo
COMMENT ON TABLE registration_requests IS 'Tabella per gestire le richieste di registrazione degli utenti';