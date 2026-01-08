/*
  # Pulizia dati demo e preparazione per produzione
  
  1. Pulizia
    - Rimuove tutti i dati demo dalle tabelle esistenti
    - Mantiene la struttura delle tabelle
  
  2. Preparazione
    - Aggiunge indici per migliorare le performance
    - Aggiorna le policy di sicurezza per l'ambiente di produzione
*/

-- Pulizia dati demo dalle tabelle principali
TRUNCATE TABLE users CASCADE;
TRUNCATE TABLE companies CASCADE;
TRUNCATE TABLE crew_members CASCADE;
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
TRUNCATE TABLE registration_requests CASCADE;

-- Pulizia dati demo dalle tabelle in italiano
TRUNCATE TABLE utenti CASCADE;
TRUNCATE TABLE aziende CASCADE;
TRUNCATE TABLE tecnici CASCADE;
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

-- Creazione utente admin iniziale (password da cambiare al primo accesso)
INSERT INTO users (id, email, role, is_approved, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'admin@crewmanager.com',
  'admin',
  true,
  true,
  now(),
  now()
);

-- Aggiunta indici per migliorare le performance in produzione
CREATE INDEX IF NOT EXISTS idx_events_date ON events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_events_company ON events(company_id);
CREATE INDEX IF NOT EXISTS idx_crew_members_company ON crew_members(company_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_date ON timesheet_entries(date);
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_crew ON timesheet_entries(crew_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_crew ON expenses(crew_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_for ON documents(uploaded_for);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at ON documents(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- Aggiornamento delle policy di sicurezza per l'ambiente di produzione
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
END
$$;

-- Aggiunta di un commento per documentare lo scopo di questa migrazione
COMMENT ON TABLE users IS 'Tabella principale per gli utenti del sistema';
COMMENT ON TABLE companies IS 'Aziende registrate nel sistema';
COMMENT ON TABLE crew_members IS 'Tecnici e crew members registrati nel sistema';
COMMENT ON TABLE events IS 'Eventi creati dalle aziende';
COMMENT ON TABLE registration_requests IS 'Richieste di registrazione in attesa di approvazione';