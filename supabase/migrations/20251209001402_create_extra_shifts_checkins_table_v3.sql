/*
  # Crea tabella dedicata per i check-in dei turni extra
  
  ## Descrizione
  Crea una nuova tabella `extra_shifts_checkins` per gestire i check-in/checkout 
  dei turni extra, separandoli dalla tabella `warehouse_checkins` che gestisce 
  i turni magazzino normali.
  
  ## 1. Nuova Tabella
  
  ### `extra_shifts_checkins`
  Contiene solo i campi necessari per i turni extra (circa 60 colonne invece di 77).
  
  ## 2. Migrazione Dati
  
  Copia automaticamente tutti i record esistenti da `warehouse_checkins` 
  dove `notes = 'TURNO EXTRA'` nella nuova tabella.
  
  **IMPORTANTE:** I record originali NON vengono cancellati da warehouse_checkins.
  L'utente li eliminerà manualmente dopo aver verificato che la migrazione è ok.
  
  ## 3. Sicurezza RLS
  
  Applica Row Level Security con policies per crew e admin.
  
  ## 4. Indici
  
  Crea indici per ottimizzare le query su (crew_id, date), (crew_id, status), created_at.
*/

-- ============================================================================
-- 1. CREAZIONE TABELLA extra_shifts_checkins
-- ============================================================================

CREATE TABLE extra_shifts_checkins (
  -- Campi Base
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  crew_id uuid NOT NULL REFERENCES registration_requests(id) ON DELETE CASCADE,
  date date NOT NULL,
  check_in_time time NOT NULL,
  check_out_time time,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  
  -- GPS Tracking Check-in/Checkout  
  location jsonb,
  checkout_location jsonb,
  forced_checkin boolean DEFAULT false,
  gps_error_reason text,
  location_alert boolean DEFAULT false,
  distance_from_warehouse numeric,
  checkout_location_alert boolean DEFAULT false,
  checkout_distance_from_warehouse numeric,
  
  -- Pausa Pranzo
  pausa_pranzo_inizio time,
  pausa_pranzo_fine time,
  pausa_pranzo_minuti integer DEFAULT 0,
  break_start_time time,
  break_end_time time,
  break_start_location jsonb,
  break_end_location jsonb,
  break_start_forced boolean DEFAULT false,
  break_end_forced boolean DEFAULT false,
  break_start_gps_error text,
  break_end_gps_error text,
  has_taken_break boolean DEFAULT false,
  break_registered_late boolean DEFAULT false,
  break_modified_at timestamptz,
  break_auto_applied boolean DEFAULT false,
  
  -- Pausa Cena
  pausa_cena_inizio time,
  pausa_cena_fine time,
  pausa_cena_minuti integer DEFAULT 0,
  pausa_cena_start_location jsonb,
  pausa_cena_end_location jsonb,
  pausa_cena_start_gps_error text,
  pausa_cena_end_gps_error text,
  
  -- Totali Pause
  pausa_totale_minuti integer DEFAULT 0,
  break_minutes integer DEFAULT 0,
  
  -- Ore Lavoro
  total_hours numeric,
  net_hours numeric,
  overtime_hours numeric,
  overtime_requested boolean DEFAULT false,
  
  -- Pasti
  company_meal boolean DEFAULT false,
  meal_voucher boolean DEFAULT false,
  meal_cost numeric DEFAULT 0.00,
  meal_notes text,
  
  -- Rettifiche
  rectified_check_in_time timestamptz,
  rectified_check_out_time timestamptz,
  rectified_pausa_pranzo boolean,
  rectified_break_start time,
  rectified_break_end time,
  rectified_total_hours numeric,
  rectification_note text,
  rectified_by uuid REFERENCES registration_requests(id),
  rectified_at timestamptz,
  
  -- Note
  notes text,
  "NoteTurno" text
);

-- Commenti sulle colonne principali
COMMENT ON TABLE extra_shifts_checkins IS 'Check-in/checkout per turni extra (non associati a magazzini o turni programmati)';
COMMENT ON COLUMN extra_shifts_checkins.crew_id IS 'ID dipendente che effettua il check-in';
COMMENT ON COLUMN extra_shifts_checkins.date IS 'Data del turno extra';
COMMENT ON COLUMN extra_shifts_checkins.forced_checkin IS 'True se il check-in è stato forzato senza GPS';
COMMENT ON COLUMN extra_shifts_checkins."NoteTurno" IS 'Note libere inserite dal dipendente sul turno';

-- ============================================================================
-- 2. INDICI PER PERFORMANCE
-- ============================================================================

-- Indice per lookup per dipendente e data
CREATE INDEX idx_extra_shifts_crew_date 
  ON extra_shifts_checkins(crew_id, date DESC);

-- Indice per turni attivi
CREATE INDEX idx_extra_shifts_crew_status 
  ON extra_shifts_checkins(crew_id, status) 
  WHERE status = 'active';

-- Indice temporale
CREATE INDEX idx_extra_shifts_created_at 
  ON extra_shifts_checkins(created_at DESC);

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE extra_shifts_checkins ENABLE ROW LEVEL SECURITY;

-- Policy SELECT: Crew può vedere solo i propri check-in
CREATE POLICY "Crew can view own extra shifts check-ins"
  ON extra_shifts_checkins
  FOR SELECT
  TO authenticated
  USING (
    crew_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM registration_requests
      WHERE id = auth.uid()
      AND registration_type_nome IN ('admin', 'company')
    )
  );

-- Policy INSERT: Crew può inserire solo per se stesso
CREATE POLICY "Crew can insert own extra shifts check-ins"
  ON extra_shifts_checkins
  FOR INSERT
  TO authenticated
  WITH CHECK (
    crew_id = auth.uid()
  );

-- Policy UPDATE: Crew può aggiornare solo i propri check-in
CREATE POLICY "Crew can update own extra shifts check-ins"
  ON extra_shifts_checkins
  FOR UPDATE
  TO authenticated
  USING (
    crew_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM registration_requests
      WHERE id = auth.uid()
      AND registration_type_nome IN ('admin', 'company')
    )
  )
  WITH CHECK (
    crew_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM registration_requests
      WHERE id = auth.uid()
      AND registration_type_nome IN ('admin', 'company')
    )
  );

-- Policy DELETE: Solo admin/company possono eliminare
CREATE POLICY "Only admin can delete extra shifts check-ins"
  ON extra_shifts_checkins
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM registration_requests
      WHERE id = auth.uid()
      AND registration_type_nome IN ('admin', 'company')
    )
  );

-- ============================================================================
-- 4. TRIGGER PER CALCOLO AUTOMATICO ORE
-- ============================================================================

-- Trigger per calcolare automaticamente total_hours e net_hours
CREATE OR REPLACE FUNCTION calculate_extra_shift_hours()
RETURNS TRIGGER AS $$
DECLARE
  v_total_minutes integer := 0;
  v_pause_minutes integer := 0;
BEGIN
  -- Calcola ore solo se abbiamo check-out
  IF NEW.check_out_time IS NOT NULL THEN
    -- Calcola minuti totali tra check-in e check-out
    v_total_minutes := EXTRACT(EPOCH FROM (
      (DATE '2000-01-01' + NEW.check_out_time) - 
      (DATE '2000-01-01' + NEW.check_in_time)
    )) / 60;
    
    -- Se check-out è prima di check-in, aggiungi 24 ore (turno notturno)
    IF v_total_minutes < 0 THEN
      v_total_minutes := v_total_minutes + (24 * 60);
    END IF;
    
    -- Calcola totale pause
    v_pause_minutes := COALESCE(NEW.pausa_pranzo_minuti, 0) + COALESCE(NEW.pausa_cena_minuti, 0);
    
    -- Aggiorna campi calcolati
    NEW.total_hours := ROUND((v_total_minutes / 60.0)::numeric, 2);
    NEW.net_hours := ROUND(((v_total_minutes - v_pause_minutes) / 60.0)::numeric, 2);
    NEW.pausa_totale_minuti := v_pause_minutes;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_extra_shift_hours
  BEFORE INSERT OR UPDATE ON extra_shifts_checkins
  FOR EACH ROW
  EXECUTE FUNCTION calculate_extra_shift_hours();

-- ============================================================================
-- 5. MIGRAZIONE DATI DA warehouse_checkins
-- ============================================================================

-- Copia tutti i turni extra esistenti da warehouse_checkins
INSERT INTO extra_shifts_checkins (
  id,
  crew_id,
  date,
  check_in_time,
  check_out_time,
  status,
  created_at,
  location,
  checkout_location,
  forced_checkin,
  gps_error_reason,
  location_alert,
  distance_from_warehouse,
  checkout_location_alert,
  checkout_distance_from_warehouse,
  pausa_pranzo_inizio,
  pausa_pranzo_fine,
  pausa_pranzo_minuti,
  break_start_time,
  break_end_time,
  break_start_location,
  break_end_location,
  break_start_forced,
  break_end_forced,
  break_start_gps_error,
  break_end_gps_error,
  has_taken_break,
  break_registered_late,
  break_modified_at,
  break_auto_applied,
  pausa_cena_inizio,
  pausa_cena_fine,
  pausa_cena_minuti,
  pausa_cena_start_location,
  pausa_cena_end_location,
  pausa_cena_start_gps_error,
  pausa_cena_end_gps_error,
  pausa_totale_minuti,
  break_minutes,
  total_hours,
  net_hours,
  overtime_hours,
  overtime_requested,
  company_meal,
  meal_voucher,
  meal_cost,
  meal_notes,
  rectified_check_in_time,
  rectified_check_out_time,
  rectified_pausa_pranzo,
  rectified_break_start,
  rectified_break_end,
  rectified_total_hours,
  rectification_note,
  rectified_by,
  rectified_at,
  notes,
  "NoteTurno"
)
SELECT
  w.id,
  w.crew_id,
  w.date,
  w.check_in_time,
  w.check_out_time,
  w.status,
  w.created_at,
  w.location,
  w.checkout_location,
  COALESCE(w.forced_checkin, false),
  w.gps_error_reason,
  COALESCE(w.location_alert, false),
  w.distance_from_warehouse,
  COALESCE(w.checkout_location_alert, false),
  w.checkout_distance_from_warehouse,
  w.pausa_pranzo_inizio,
  w.pausa_pranzo_fine,
  COALESCE(w.pausa_pranzo_minuti, 0),
  w.break_start_time,
  w.break_end_time,
  w.break_start_location,
  w.break_end_location,
  COALESCE(w.break_start_forced, false),
  COALESCE(w.break_end_forced, false),
  w.break_start_gps_error,
  w.break_end_gps_error,
  COALESCE(w.has_taken_break, false),
  COALESCE(w.break_registered_late, false),
  w.break_modified_at,
  COALESCE(w.break_auto_applied, false),
  w.pausa_cena_inizio,
  w.pausa_cena_fine,
  CASE 
    WHEN w.pausa_cena_minuti IS NOT NULL 
    THEN EXTRACT(EPOCH FROM w.pausa_cena_minuti)::integer / 60
    ELSE 0 
  END,
  w.pausa_cena_start_location,
  w.pausa_cena_end_location,
  w.pausa_cena_start_gps_error,
  w.pausa_cena_end_gps_error,
  CASE 
    WHEN w.totale_pause IS NOT NULL 
    THEN EXTRACT(EPOCH FROM w.totale_pause)::integer / 60
    ELSE 0 
  END,
  COALESCE(w.break_minutes, 0),
  w.total_hours,
  w.net_hours,
  w.overtime_hours,
  COALESCE(w.overtime_requested, false),
  COALESCE(w.company_meal, false),
  COALESCE(w.meal_voucher, false),
  COALESCE(w.meal_cost, 0.00),
  w.meal_notes,
  w.rectified_check_in_time,
  w.rectified_check_out_time,
  w.rectified_pausa_pranzo,
  w.rectified_break_start,
  w.rectified_break_end,
  w.rectified_total_hours,
  w.rectification_note,
  w.rectified_by,
  w.rectified_at,
  w.notes,
  w."NoteTurno"
FROM warehouse_checkins w
WHERE w.notes = 'TURNO EXTRA';

-- Log del risultato della migrazione
DO $$
DECLARE
  v_migrated_count integer;
  v_source_count integer;
BEGIN
  SELECT COUNT(*) INTO v_source_count
  FROM warehouse_checkins
  WHERE notes = 'TURNO EXTRA';
  
  SELECT COUNT(*) INTO v_migrated_count
  FROM extra_shifts_checkins;
  
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'MIGRAZIONE TURNI EXTRA COMPLETATA';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Record trovati in warehouse_checkins: %', v_source_count;
  RAISE NOTICE 'Record copiati in extra_shifts_checkins: %', v_migrated_count;
  RAISE NOTICE '';
  RAISE NOTICE 'IMPORTANTE: I record originali sono ancora presenti in';
  RAISE NOTICE 'warehouse_checkins e possono essere eliminati manualmente';
  RAISE NOTICE 'dopo aver verificato che la migrazione è corretta.';
  RAISE NOTICE '============================================================';
END $$;