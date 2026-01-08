/*
  # Creazione Tabelle Report per Commercialista - Opzione A (3 Tabelle Separate)
  
  ## Descrizione
  Crea 3 tabelle separate per i report del commercialista, una per ogni tipo di turno:
  - report_turni_magazzino (warehouse_checkins)
  - report_turni_extra (extra_shifts_checkins)
  - report_turni_eventi (timesheet_entries)
  
  ## Caratteristiche
  
  1. **Dati Consolidati**: Ogni tabella contiene tutti i dati necessari per il commercialista
  2. **Priorità Rettifiche**: I valori rettificati hanno priorità su quelli originali
  3. **Calcoli Automatici**: Ore lavorate, straordinari, pause calcolati automaticamente
  4. **Benefits Dettagliati**: Breakdown completo di diaria, pernottamento, trasferta
  5. **Spese**: Link alle spese sostenute durante il turno
  6. **Tracciabilità**: Info su quando è stato creato/modificato e se rettificato
  
  ## Tabelle Create
  
  ### 1. report_turni_magazzino
  Contiene tutti i turni in magazzino completati (con checkout)
  - Collegamento a warehouse_checkins tramite warehouse_checkin_id
  - Tutti gli orari sono già consolidati (rettificati > originali)
  - Calcoli di ore lavorate e straordinario già fatti
  - Benefits dettagliati
  
  ### 2. report_turni_extra  
  Contiene tutti i turni extra completati
  - Collegamento a extra_shifts_checkins tramite extra_shift_checkin_id
  - Stessa logica di consolidamento dei turni magazzino
  
  ### 3. report_turni_eventi
  Contiene tutti gli eventi completati
  - Collegamento a timesheet_entries tramite timesheet_entry_id
  - Logica adattata per gli eventi (con orario_convocazione)
  
  ## Security
  - RLS abilitato su tutte le tabelle
  - Crew members: vedono solo i propri turni
  - Admin: vedono tutti i turni
  - Sistema: può inserire e aggiornare
*/

-- =====================================================
-- 1. REPORT_TURNI_MAGAZZINO
-- =====================================================

CREATE TABLE IF NOT EXISTS report_turni_magazzino (
  -- Identificativi
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assegnazione_id uuid REFERENCES crew_assegnazione_turni(id) ON DELETE SET NULL,
  warehouse_id uuid REFERENCES warehouses(id) ON DELETE SET NULL,
  template_turno_id uuid,
  warehouse_checkin_id uuid NOT NULL REFERENCES warehouse_checkins(id) ON DELETE CASCADE,
  
  -- Data del turno
  data date NOT NULL,
  
  -- Azienda e Magazzino
  nome_azienda text,
  indirizzo_magazzino text,
  
  -- Orari Effettivi (già con priorità ai rettificati)
  check_in time NOT NULL,
  check_out time,
  orario_inizio_turno time,
  orario_fine_turno time,
  
  -- Pause Pranzo
  pausa_pranzo_inizio time,
  pausa_pranzo_fine time,
  pausa_pranzo_minuti integer DEFAULT 0,
  
  -- Pause Cena
  pausa_cena_inizio time,
  pausa_cena_fine time,
  pausa_cena_minuti integer DEFAULT 0,
  
  -- Totale Pause
  pausa_totale_minuti integer DEFAULT 0,
  
  -- Calcoli Ore
  ore_lavorate numeric(5,2),
  minuti_lavorati integer,
  ore_straordinario numeric(5,2) DEFAULT 0,
  minuti_straordinario integer DEFAULT 0,
  
  -- Benefits
  benefit_diaria numeric(10,2) DEFAULT 0,
  benefit_pernottamento numeric(10,2) DEFAULT 0,
  benefit_trasferta numeric(10,2) DEFAULT 0,
  benefits_totale numeric(10,2) DEFAULT 0,
  
  -- Spese
  spese_ids uuid[] DEFAULT '{}',
  spese_totale numeric(10,2) DEFAULT 0,
  
  -- Flags
  auto_checkout boolean DEFAULT false,
  forced_checkin boolean DEFAULT false,
  was_rectified boolean DEFAULT false,
  
  -- Note
  note text,
  
  -- Metadati
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  rectified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rectified_at timestamptz,
  
  -- Constraints
  CONSTRAINT valid_check_times CHECK (check_out IS NULL OR check_out >= check_in),
  CONSTRAINT valid_pausa_pranzo CHECK (
    (pausa_pranzo_inizio IS NULL AND pausa_pranzo_fine IS NULL) OR
    (pausa_pranzo_inizio IS NOT NULL AND pausa_pranzo_fine IS NOT NULL AND pausa_pranzo_fine > pausa_pranzo_inizio)
  ),
  CONSTRAINT valid_pausa_cena CHECK (
    (pausa_cena_inizio IS NULL AND pausa_cena_fine IS NULL) OR
    (pausa_cena_inizio IS NOT NULL AND pausa_cena_fine IS NOT NULL AND pausa_cena_fine > pausa_cena_inizio)
  )
);

-- Indexes per performance
CREATE INDEX IF NOT EXISTS idx_report_mag_crew ON report_turni_magazzino(crew_id);
CREATE INDEX IF NOT EXISTS idx_report_mag_data ON report_turni_magazzino(data);
CREATE INDEX IF NOT EXISTS idx_report_mag_created ON report_turni_magazzino(created_at);
CREATE INDEX IF NOT EXISTS idx_report_mag_checkin ON report_turni_magazzino(warehouse_checkin_id);

-- RLS
ALTER TABLE report_turni_magazzino ENABLE ROW LEVEL SECURITY;

-- Policy: Dipendenti vedono i propri turni
CREATE POLICY "Crew members can view own shift reports"
  ON report_turni_magazzino FOR SELECT
  TO authenticated
  USING (auth.uid() = crew_id);

-- Policy: Admin vedono tutto
CREATE POLICY "Admin can view all shift reports"
  ON report_turni_magazzino FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Policy: Sistema può inserire/aggiornare
CREATE POLICY "System can insert shift reports"
  ON report_turni_magazzino FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "System can update shift reports"
  ON report_turni_magazzino FOR UPDATE
  TO authenticated
  USING (true);

-- =====================================================
-- 2. REPORT_TURNI_EXTRA
-- =====================================================

CREATE TABLE IF NOT EXISTS report_turni_extra (
  -- Identificativi
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  extra_shift_checkin_id uuid NOT NULL REFERENCES extra_shifts_checkins(id) ON DELETE CASCADE,
  
  -- Data del turno
  data date NOT NULL,
  
  -- Azienda e Luogo
  nome_azienda text,
  luogo text,
  
  -- Orari Effettivi
  check_in time NOT NULL,
  check_out time,
  orario_inizio_turno time,
  orario_fine_turno time,
  
  -- Pause Pranzo
  pausa_pranzo_inizio time,
  pausa_pranzo_fine time,
  pausa_pranzo_minuti integer DEFAULT 0,
  
  -- Pause Cena
  pausa_cena_inizio time,
  pausa_cena_fine time,
  pausa_cena_minuti integer DEFAULT 0,
  
  -- Totale Pause
  pausa_totale_minuti integer DEFAULT 0,
  
  -- Calcoli Ore
  ore_lavorate numeric(5,2),
  minuti_lavorati integer,
  ore_straordinario numeric(5,2) DEFAULT 0,
  minuti_straordinario integer DEFAULT 0,
  
  -- Benefits
  benefit_diaria numeric(10,2) DEFAULT 0,
  benefit_pernottamento numeric(10,2) DEFAULT 0,
  benefit_trasferta numeric(10,2) DEFAULT 0,
  benefits_totale numeric(10,2) DEFAULT 0,
  
  -- Spese
  spese_ids uuid[] DEFAULT '{}',
  spese_totale numeric(10,2) DEFAULT 0,
  
  -- Flags
  auto_checkout boolean DEFAULT false,
  forced_checkin boolean DEFAULT false,
  was_rectified boolean DEFAULT false,
  
  -- Note
  note text,
  
  -- Metadati
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  rectified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rectified_at timestamptz,
  
  -- Constraints
  CONSTRAINT valid_check_times_extra CHECK (check_out IS NULL OR check_out >= check_in),
  CONSTRAINT valid_pausa_pranzo_extra CHECK (
    (pausa_pranzo_inizio IS NULL AND pausa_pranzo_fine IS NULL) OR
    (pausa_pranzo_inizio IS NOT NULL AND pausa_pranzo_fine IS NOT NULL AND pausa_pranzo_fine > pausa_pranzo_inizio)
  ),
  CONSTRAINT valid_pausa_cena_extra CHECK (
    (pausa_cena_inizio IS NULL AND pausa_cena_fine IS NULL) OR
    (pausa_cena_inizio IS NOT NULL AND pausa_cena_fine IS NOT NULL AND pausa_cena_fine > pausa_cena_inizio)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_report_extra_crew ON report_turni_extra(crew_id);
CREATE INDEX IF NOT EXISTS idx_report_extra_data ON report_turni_extra(data);
CREATE INDEX IF NOT EXISTS idx_report_extra_created ON report_turni_extra(created_at);
CREATE INDEX IF NOT EXISTS idx_report_extra_checkin ON report_turni_extra(extra_shift_checkin_id);

-- RLS
ALTER TABLE report_turni_extra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crew members can view own extra shift reports"
  ON report_turni_extra FOR SELECT
  TO authenticated
  USING (auth.uid() = crew_id);

CREATE POLICY "Admin can view all extra shift reports"
  ON report_turni_extra FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY "System can insert extra shift reports"
  ON report_turni_extra FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "System can update extra shift reports"
  ON report_turni_extra FOR UPDATE
  TO authenticated
  USING (true);

-- =====================================================
-- 3. REPORT_TURNI_EVENTI
-- =====================================================

CREATE TABLE IF NOT EXISTS report_turni_eventi (
  -- Identificativi
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid REFERENCES crew_events(id) ON DELETE SET NULL,
  assignment_id uuid,
  timesheet_entry_id uuid NOT NULL REFERENCES timesheet_entries(id) ON DELETE CASCADE,
  
  -- Data del turno
  data date NOT NULL,
  
  -- Evento
  nome_evento text,
  tipo_evento text,
  location text,
  
  -- Orari Effettivi
  orario_convocazione time,
  check_in time NOT NULL,
  check_out time,
  orario_inizio_evento time,
  orario_fine_evento time,
  
  -- Pause (eventi potrebbero avere pause)
  pausa_pranzo_inizio time,
  pausa_pranzo_fine time,
  pausa_pranzo_minuti integer DEFAULT 0,
  
  pausa_cena_inizio time,
  pausa_cena_fine time,
  pausa_cena_minuti integer DEFAULT 0,
  
  pausa_totale_minuti integer DEFAULT 0,
  
  -- Calcoli Ore
  ore_lavorate numeric(5,2),
  minuti_lavorati integer,
  ore_straordinario numeric(5,2) DEFAULT 0,
  minuti_straordinario integer DEFAULT 0,
  
  -- Benefits
  benefit_diaria numeric(10,2) DEFAULT 0,
  benefit_pernottamento numeric(10,2) DEFAULT 0,
  benefit_trasferta numeric(10,2) DEFAULT 0,
  benefits_totale numeric(10,2) DEFAULT 0,
  
  -- Spese
  spese_ids uuid[] DEFAULT '{}',
  spese_totale numeric(10,2) DEFAULT 0,
  
  -- Flags
  auto_checkout boolean DEFAULT false,
  was_rectified boolean DEFAULT false,
  
  -- Note
  note text,
  
  -- Metadati
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  rectified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rectified_at timestamptz,
  
  -- Constraints
  CONSTRAINT valid_check_times_eventi CHECK (check_out IS NULL OR check_out >= check_in),
  CONSTRAINT valid_pausa_pranzo_eventi CHECK (
    (pausa_pranzo_inizio IS NULL AND pausa_pranzo_fine IS NULL) OR
    (pausa_pranzo_inizio IS NOT NULL AND pausa_pranzo_fine IS NOT NULL AND pausa_pranzo_fine > pausa_pranzo_inizio)
  ),
  CONSTRAINT valid_pausa_cena_eventi CHECK (
    (pausa_cena_inizio IS NULL AND pausa_cena_fine IS NULL) OR
    (pausa_cena_inizio IS NOT NULL AND pausa_cena_fine IS NOT NULL AND pausa_cena_fine > pausa_cena_inizio)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_report_eventi_crew ON report_turni_eventi(crew_id);
CREATE INDEX IF NOT EXISTS idx_report_eventi_data ON report_turni_eventi(data);
CREATE INDEX IF NOT EXISTS idx_report_eventi_created ON report_turni_eventi(created_at);
CREATE INDEX IF NOT EXISTS idx_report_eventi_timesheet ON report_turni_eventi(timesheet_entry_id);
CREATE INDEX IF NOT EXISTS idx_report_eventi_event ON report_turni_eventi(event_id);

-- RLS
ALTER TABLE report_turni_eventi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crew members can view own event reports"
  ON report_turni_eventi FOR SELECT
  TO authenticated
  USING (auth.uid() = crew_id);

CREATE POLICY "Admin can view all event reports"
  ON report_turni_eventi FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY "System can insert event reports"
  ON report_turni_eventi FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "System can update event reports"
  ON report_turni_eventi FOR UPDATE
  TO authenticated
  USING (true);

-- =====================================================
-- COMMENTI
-- =====================================================

COMMENT ON TABLE report_turni_magazzino IS 'Report turni magazzino per commercialista - valori già consolidati con priorità alle rettifiche';
COMMENT ON TABLE report_turni_extra IS 'Report turni extra per commercialista - valori già consolidati con priorità alle rettifiche';
COMMENT ON TABLE report_turni_eventi IS 'Report eventi per commercialista - valori già consolidati con priorità alle rettifiche';

COMMENT ON COLUMN report_turni_magazzino.check_in IS 'Check-in effettivo (rettificato se presente, altrimenti originale)';
COMMENT ON COLUMN report_turni_magazzino.check_out IS 'Check-out effettivo (rettificato se presente, altrimenti originale)';
COMMENT ON COLUMN report_turni_magazzino.was_rectified IS 'TRUE se i valori sono stati rettificati manualmente';
COMMENT ON COLUMN report_turni_magazzino.benefits_totale IS 'Totale benefits: diaria + pernottamento + trasferta';
