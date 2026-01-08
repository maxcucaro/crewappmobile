/*
  # Fix syntax error in previous migration
  
  1. Clean Data
    - Remove all demo data from existing tables
    - Keep table structure intact
  
  2. Setup
    - Add performance indexes
    - Update security policies for production environment
*/

-- Clean demo data from main tables
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

-- Clean demo data from Italian tables if they exist
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'utenti') THEN
    TRUNCATE TABLE utenti CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'aziende') THEN
    TRUNCATE TABLE aziende CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tecnici') THEN
    TRUNCATE TABLE tecnici CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'eventi') THEN
    TRUNCATE TABLE eventi CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'assegnazioni_tecnici') THEN
    TRUNCATE TABLE assegnazioni_tecnici CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'negoziazioni_tariffe') THEN
    TRUNCATE TABLE negoziazioni_tariffe CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'proposte_tariffe') THEN
    TRUNCATE TABLE proposte_tariffe CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'presenze') THEN
    TRUNCATE TABLE presenze CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'spese') THEN
    TRUNCATE TABLE spese CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'documenti') THEN
    TRUNCATE TABLE documenti CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'richieste_straordinari') THEN
    TRUNCATE TABLE richieste_straordinari CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'checkin_magazzino') THEN
    TRUNCATE TABLE checkin_magazzino CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'corsi_formazione') THEN
    TRUNCATE TABLE corsi_formazione CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'iscrizioni_corsi') THEN
    TRUNCATE TABLE iscrizioni_corsi CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'impostazioni_privacy') THEN
    TRUNCATE TABLE impostazioni_privacy CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sincronizzazioni_calendario') THEN
    TRUNCATE TABLE sincronizzazioni_calendario CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notifiche') THEN
    TRUNCATE TABLE notifiche CASCADE;
  END IF;
END $$;

-- Add performance indexes for production
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

-- Add indexes for Italian tables if they exist
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'eventi') THEN
    CREATE INDEX IF NOT EXISTS idx_eventi_date ON eventi(data_inizio, data_fine);
    CREATE INDEX IF NOT EXISTS idx_eventi_azienda ON eventi(id_azienda);
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tecnici') THEN
    CREATE INDEX IF NOT EXISTS idx_tecnici_azienda ON tecnici(id_azienda);
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'presenze') THEN
    CREATE INDEX IF NOT EXISTS idx_presenze_data ON presenze(data);
    CREATE INDEX IF NOT EXISTS idx_presenze_tecnico ON presenze(id_tecnico);
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'spese') THEN
    CREATE INDEX IF NOT EXISTS idx_spese_data ON spese(data_spesa);
    CREATE INDEX IF NOT EXISTS idx_spese_tecnico ON spese(id_tecnico);
  END IF;
END $$;

-- Update security policies for production environment
DO $$
BEGIN
  -- Ensure admins have full access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polname = 'admin_full_access' AND polrelid = 'users'::regclass
  ) THEN
    EXECUTE 'CREATE POLICY "admin_full_access" ON users
      FOR ALL TO authenticated
      USING (auth.jwt() ->> ''role'' = ''admin'')
      WITH CHECK (auth.jwt() ->> ''role'' = ''admin'')';
  END IF;
  
  -- Policy for Italian admin users if table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'utenti') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policy 
      WHERE polname = 'admin_accesso_completo' AND polrelid = 'utenti'::regclass
    ) THEN
      EXECUTE 'CREATE POLICY "admin_accesso_completo" ON utenti
        FOR ALL TO authenticated
        USING (auth.jwt() ->> ''ruolo'' = ''amministratore'')
        WITH CHECK (auth.jwt() ->> ''ruolo'' = ''amministratore'')';
    END IF;
  END IF;
END $$;

-- Add comments to document the purpose of this migration
COMMENT ON TABLE users IS 'Main table for system users';
COMMENT ON TABLE companies IS 'Companies registered in the system';
COMMENT ON TABLE crew_members IS 'Technicians and crew members registered in the system';
COMMENT ON TABLE events IS 'Events created by companies';
COMMENT ON TABLE registration_requests IS 'Registration requests awaiting approval';