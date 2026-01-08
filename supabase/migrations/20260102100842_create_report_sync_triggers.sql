/*
  # Trigger per Sincronizzazione Automatica Tabelle Report
  
  ## Descrizione
  Crea trigger e funzioni per popolare automaticamente le tabelle report
  quando vengono completati turni o quando vengono rettificati.
  
  ## Funzioni Create
  
  1. **sync_warehouse_to_report()**: Sincronizza warehouse_checkins → report_turni_magazzino
  2. **sync_extra_to_report()**: Sincronizza extra_shifts_checkins → report_turni_extra
  3. **sync_eventi_to_report()**: Sincronizza timesheet_entries → report_turni_eventi
  
  ## Logica
  
  - I trigger scattano su INSERT e UPDATE
  - Vengono popolati solo i turni con checkout completato
  - I valori rettificati hanno priorità su quelli originali (COALESCE)
  - Se il record esiste già, viene aggiornato (UPSERT)
  - Calcoli automatici di ore lavorate, straordinario, pause
  
  ## Quando Scattano
  
  - **Warehouse**: Dopo INSERT/UPDATE su warehouse_checkins se check_out_time IS NOT NULL
  - **Extra**: Dopo INSERT/UPDATE su extra_shifts_checkins se check_out_time IS NOT NULL
  - **Eventi**: Dopo INSERT/UPDATE su timesheet_entries se end_time IS NOT NULL
*/

-- =====================================================
-- 1. FUNZIONE SYNC WAREHOUSE → REPORT
-- =====================================================

CREATE OR REPLACE FUNCTION sync_warehouse_to_report()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_nome_azienda text;
  v_indirizzo text;
  v_check_in time;
  v_check_out time;
  v_orario_inizio time;
  v_orario_fine time;
  v_pausa_pranzo_inizio time;
  v_pausa_pranzo_fine time;
  v_pausa_pranzo_minuti int;
  v_pausa_cena_inizio time;
  v_pausa_cena_fine time;
  v_pausa_cena_minuti int;
  v_pausa_totale_minuti int;
  v_minuti_lavorati int;
  v_ore_lavorate numeric;
  v_minuti_straordinario int;
  v_ore_straordinario numeric;
BEGIN
  -- Solo se c'è checkout
  IF NEW.check_out_time IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Recupera nome azienda e indirizzo magazzino
  SELECT 
    w.nome_azienda,
    w.indirizzo
  INTO v_nome_azienda, v_indirizzo
  FROM warehouses w
  WHERE w.id = NEW.warehouse_id;
  
  -- Usa valori rettificati se presenti, altrimenti originali
  v_check_in := COALESCE(NEW.rectified_check_in_time, NEW.check_in_time);
  v_check_out := COALESCE(NEW.rectified_check_out_time, NEW.check_out_time);
  v_orario_inizio := NEW.orario_inizio_turno;
  v_orario_fine := NEW.orario_fine_turno;
  
  -- Pause pranzo
  v_pausa_pranzo_inizio := COALESCE(NEW.rectified_pausa_pranzo_inizio, NEW.pausa_pranzo_inizio);
  v_pausa_pranzo_fine := COALESCE(NEW.rectified_pausa_pranzo_fine, NEW.pausa_pranzo_fine);
  v_pausa_pranzo_minuti := COALESCE(NEW.rectified_pausa_pranzo_minuti, NEW.pausa_pranzo_minuti, 0);
  
  -- Pause cena
  v_pausa_cena_inizio := COALESCE(NEW.rectified_pausa_cena_inizio, NEW.pausa_cena_inizio);
  v_pausa_cena_fine := COALESCE(NEW.rectified_pausa_cena_fine, NEW.pausa_cena_fine);
  v_pausa_cena_minuti := COALESCE(NEW.rectified_pausa_cena_minuti, NEW.pausa_cena_minuti, 0);
  
  -- Totale pause
  v_pausa_totale_minuti := COALESCE(NEW.rectified_pausa_totale_minuti, NEW.pausa_totale_minuti, 0);
  
  -- Calcola ore lavorate
  IF v_check_in IS NOT NULL AND v_check_out IS NOT NULL THEN
    -- Minuti totali tra check-in e check-out
    v_minuti_lavorati := EXTRACT(EPOCH FROM (v_check_out - v_check_in)) / 60;
    
    -- Sottrai le pause
    v_minuti_lavorati := v_minuti_lavorati - v_pausa_totale_minuti;
    
    -- Converti in ore decimali
    v_ore_lavorate := ROUND((v_minuti_lavorati::numeric / 60), 2);
    
    -- Calcola straordinario (se lavora più di 8 ore)
    IF v_minuti_lavorati > 480 THEN
      v_minuti_straordinario := v_minuti_lavorati - 480;
      v_ore_straordinario := ROUND((v_minuti_straordinario::numeric / 60), 2);
    ELSE
      v_minuti_straordinario := 0;
      v_ore_straordinario := 0;
    END IF;
  ELSE
    v_minuti_lavorati := 0;
    v_ore_lavorate := 0;
    v_minuti_straordinario := 0;
    v_ore_straordinario := 0;
  END IF;
  
  -- UPSERT nella tabella report
  INSERT INTO report_turni_magazzino (
    crew_id,
    assegnazione_id,
    warehouse_id,
    warehouse_checkin_id,
    data,
    nome_azienda,
    indirizzo_magazzino,
    check_in,
    check_out,
    orario_inizio_turno,
    orario_fine_turno,
    pausa_pranzo_inizio,
    pausa_pranzo_fine,
    pausa_pranzo_minuti,
    pausa_cena_inizio,
    pausa_cena_fine,
    pausa_cena_minuti,
    pausa_totale_minuti,
    ore_lavorate,
    minuti_lavorati,
    ore_straordinario,
    minuti_straordinario,
    benefit_diaria,
    benefit_pernottamento,
    benefit_trasferta,
    benefits_totale,
    auto_checkout,
    forced_checkin,
    was_rectified,
    note,
    rectified_by,
    rectified_at,
    created_at,
    updated_at
  ) VALUES (
    NEW.crew_id,
    NEW.assegnazione_id,
    NEW.warehouse_id,
    NEW.id,
    NEW.data,
    v_nome_azienda,
    v_indirizzo,
    v_check_in,
    v_check_out,
    v_orario_inizio,
    v_orario_fine,
    v_pausa_pranzo_inizio,
    v_pausa_pranzo_fine,
    v_pausa_pranzo_minuti,
    v_pausa_cena_inizio,
    v_pausa_cena_fine,
    v_pausa_cena_minuti,
    v_pausa_totale_minuti,
    v_ore_lavorate,
    v_minuti_lavorati,
    v_ore_straordinario,
    v_minuti_straordinario,
    COALESCE(NEW.benefit_diaria, 0),
    COALESCE(NEW.benefit_pernottamento, 0),
    COALESCE(NEW.benefit_trasferta, 0),
    COALESCE(NEW.benefit_diaria, 0) + COALESCE(NEW.benefit_pernottamento, 0) + COALESCE(NEW.benefit_trasferta, 0),
    COALESCE(NEW.auto_checkout, false),
    COALESCE(NEW.forced_checkin, false),
    (NEW.rectified_check_in_time IS NOT NULL OR NEW.rectified_check_out_time IS NOT NULL),
    NEW.note,
    NEW.rectified_by,
    NEW.rectified_at,
    now(),
    now()
  )
  ON CONFLICT (warehouse_checkin_id)
  DO UPDATE SET
    crew_id = EXCLUDED.crew_id,
    assegnazione_id = EXCLUDED.assegnazione_id,
    warehouse_id = EXCLUDED.warehouse_id,
    data = EXCLUDED.data,
    nome_azienda = EXCLUDED.nome_azienda,
    indirizzo_magazzino = EXCLUDED.indirizzo_magazzino,
    check_in = EXCLUDED.check_in,
    check_out = EXCLUDED.check_out,
    orario_inizio_turno = EXCLUDED.orario_inizio_turno,
    orario_fine_turno = EXCLUDED.orario_fine_turno,
    pausa_pranzo_inizio = EXCLUDED.pausa_pranzo_inizio,
    pausa_pranzo_fine = EXCLUDED.pausa_pranzo_fine,
    pausa_pranzo_minuti = EXCLUDED.pausa_pranzo_minuti,
    pausa_cena_inizio = EXCLUDED.pausa_cena_inizio,
    pausa_cena_fine = EXCLUDED.pausa_cena_fine,
    pausa_cena_minuti = EXCLUDED.pausa_cena_minuti,
    pausa_totale_minuti = EXCLUDED.pausa_totale_minuti,
    ore_lavorate = EXCLUDED.ore_lavorate,
    minuti_lavorati = EXCLUDED.minuti_lavorati,
    ore_straordinario = EXCLUDED.ore_straordinario,
    minuti_straordinario = EXCLUDED.minuti_straordinario,
    benefit_diaria = EXCLUDED.benefit_diaria,
    benefit_pernottamento = EXCLUDED.benefit_pernottamento,
    benefit_trasferta = EXCLUDED.benefit_trasferta,
    benefits_totale = EXCLUDED.benefits_totale,
    auto_checkout = EXCLUDED.auto_checkout,
    forced_checkin = EXCLUDED.forced_checkin,
    was_rectified = EXCLUDED.was_rectified,
    note = EXCLUDED.note,
    rectified_by = EXCLUDED.rectified_by,
    rectified_at = EXCLUDED.rectified_at,
    updated_at = now();
  
  RETURN NEW;
END;
$$;

-- Trigger su warehouse_checkins
DROP TRIGGER IF EXISTS trigger_sync_warehouse_report ON warehouse_checkins;
CREATE TRIGGER trigger_sync_warehouse_report
  AFTER INSERT OR UPDATE ON warehouse_checkins
  FOR EACH ROW
  EXECUTE FUNCTION sync_warehouse_to_report();

-- =====================================================
-- 2. FUNZIONE SYNC EXTRA → REPORT
-- =====================================================

CREATE OR REPLACE FUNCTION sync_extra_to_report()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_check_in time;
  v_check_out time;
  v_pausa_pranzo_inizio time;
  v_pausa_pranzo_fine time;
  v_pausa_pranzo_minuti int;
  v_pausa_cena_inizio time;
  v_pausa_cena_fine time;
  v_pausa_cena_minuti int;
  v_pausa_totale_minuti int;
  v_minuti_lavorati int;
  v_ore_lavorate numeric;
  v_minuti_straordinario int;
  v_ore_straordinario numeric;
BEGIN
  -- Solo se c'è checkout
  IF NEW.check_out_time IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Usa valori rettificati se presenti
  v_check_in := COALESCE(NEW.rectified_check_in_time, NEW.check_in_time);
  v_check_out := COALESCE(NEW.rectified_check_out_time, NEW.check_out_time);
  
  -- Pause pranzo
  v_pausa_pranzo_inizio := COALESCE(NEW.rectified_pausa_pranzo_inizio, NEW.pausa_pranzo_inizio);
  v_pausa_pranzo_fine := COALESCE(NEW.rectified_pausa_pranzo_fine, NEW.pausa_pranzo_fine);
  v_pausa_pranzo_minuti := COALESCE(NEW.rectified_pausa_pranzo_minuti, NEW.pausa_pranzo_minuti, 0);
  
  -- Pause cena
  v_pausa_cena_inizio := COALESCE(NEW.rectified_pausa_cena_inizio, NEW.pausa_cena_inizio);
  v_pausa_cena_fine := COALESCE(NEW.rectified_pausa_cena_fine, NEW.pausa_cena_fine);
  v_pausa_cena_minuti := COALESCE(NEW.rectified_pausa_cena_minuti, NEW.pausa_cena_minuti, 0);
  
  -- Totale pause
  v_pausa_totale_minuti := COALESCE(NEW.rectified_pausa_totale_minuti, NEW.pausa_totale_minuti, 0);
  
  -- Calcola ore lavorate
  IF v_check_in IS NOT NULL AND v_check_out IS NOT NULL THEN
    v_minuti_lavorati := EXTRACT(EPOCH FROM (v_check_out - v_check_in)) / 60;
    v_minuti_lavorati := v_minuti_lavorati - v_pausa_totale_minuti;
    v_ore_lavorate := ROUND((v_minuti_lavorati::numeric / 60), 2);
    
    -- Straordinario
    IF v_minuti_lavorati > 480 THEN
      v_minuti_straordinario := v_minuti_lavorati - 480;
      v_ore_straordinario := ROUND((v_minuti_straordinario::numeric / 60), 2);
    ELSE
      v_minuti_straordinario := 0;
      v_ore_straordinario := 0;
    END IF;
  ELSE
    v_minuti_lavorati := 0;
    v_ore_lavorate := 0;
    v_minuti_straordinario := 0;
    v_ore_straordinario := 0;
  END IF;
  
  -- UPSERT
  INSERT INTO report_turni_extra (
    crew_id,
    extra_shift_checkin_id,
    data,
    nome_azienda,
    luogo,
    check_in,
    check_out,
    pausa_pranzo_inizio,
    pausa_pranzo_fine,
    pausa_pranzo_minuti,
    pausa_cena_inizio,
    pausa_cena_fine,
    pausa_cena_minuti,
    pausa_totale_minuti,
    ore_lavorate,
    minuti_lavorati,
    ore_straordinario,
    minuti_straordinario,
    benefit_diaria,
    benefit_pernottamento,
    benefit_trasferta,
    benefits_totale,
    auto_checkout,
    was_rectified,
    note,
    rectified_by,
    rectified_at,
    created_at,
    updated_at
  ) VALUES (
    NEW.crew_id,
    NEW.id,
    NEW.data,
    NEW.nome_azienda,
    NEW.luogo,
    v_check_in,
    v_check_out,
    v_pausa_pranzo_inizio,
    v_pausa_pranzo_fine,
    v_pausa_pranzo_minuti,
    v_pausa_cena_inizio,
    v_pausa_cena_fine,
    v_pausa_cena_minuti,
    v_pausa_totale_minuti,
    v_ore_lavorate,
    v_minuti_lavorati,
    v_ore_straordinario,
    v_minuti_straordinario,
    COALESCE(NEW.benefit_diaria, 0),
    COALESCE(NEW.benefit_pernottamento, 0),
    COALESCE(NEW.benefit_trasferta, 0),
    COALESCE(NEW.benefit_diaria, 0) + COALESCE(NEW.benefit_pernottamento, 0) + COALESCE(NEW.benefit_trasferta, 0),
    COALESCE(NEW.auto_checkout, false),
    (NEW.rectified_check_in_time IS NOT NULL OR NEW.rectified_check_out_time IS NOT NULL),
    NEW.note,
    NEW.rectified_by,
    NEW.rectified_at,
    now(),
    now()
  )
  ON CONFLICT (extra_shift_checkin_id)
  DO UPDATE SET
    crew_id = EXCLUDED.crew_id,
    data = EXCLUDED.data,
    nome_azienda = EXCLUDED.nome_azienda,
    luogo = EXCLUDED.luogo,
    check_in = EXCLUDED.check_in,
    check_out = EXCLUDED.check_out,
    pausa_pranzo_inizio = EXCLUDED.pausa_pranzo_inizio,
    pausa_pranzo_fine = EXCLUDED.pausa_pranzo_fine,
    pausa_pranzo_minuti = EXCLUDED.pausa_pranzo_minuti,
    pausa_cena_inizio = EXCLUDED.pausa_cena_inizio,
    pausa_cena_fine = EXCLUDED.pausa_cena_fine,
    pausa_cena_minuti = EXCLUDED.pausa_cena_minuti,
    pausa_totale_minuti = EXCLUDED.pausa_totale_minuti,
    ore_lavorate = EXCLUDED.ore_lavorate,
    minuti_lavorati = EXCLUDED.minuti_lavorati,
    ore_straordinario = EXCLUDED.ore_straordinario,
    minuti_straordinario = EXCLUDED.minuti_straordinario,
    benefit_diaria = EXCLUDED.benefit_diaria,
    benefit_pernottamento = EXCLUDED.benefit_pernottamento,
    benefit_trasferta = EXCLUDED.benefit_trasferta,
    benefits_totale = EXCLUDED.benefits_totale,
    auto_checkout = EXCLUDED.auto_checkout,
    was_rectified = EXCLUDED.was_rectified,
    note = EXCLUDED.note,
    rectified_by = EXCLUDED.rectified_by,
    rectified_at = EXCLUDED.rectified_at,
    updated_at = now();
  
  RETURN NEW;
END;
$$;

-- Trigger su extra_shifts_checkins
DROP TRIGGER IF EXISTS trigger_sync_extra_report ON extra_shifts_checkins;
CREATE TRIGGER trigger_sync_extra_report
  AFTER INSERT OR UPDATE ON extra_shifts_checkins
  FOR EACH ROW
  EXECUTE FUNCTION sync_extra_to_report();

-- =====================================================
-- 3. FUNZIONE SYNC EVENTI → REPORT
-- =====================================================

CREATE OR REPLACE FUNCTION sync_eventi_to_report()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_nome_evento text;
  v_tipo_evento text;
  v_location text;
  v_check_in time;
  v_check_out time;
  v_minuti_lavorati int;
  v_ore_lavorate numeric;
BEGIN
  -- Solo se c'è end_time
  IF NEW.end_time IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Recupera info evento
  SELECT 
    e.titolo,
    e.tipo_evento,
    e.location
  INTO v_nome_evento, v_tipo_evento, v_location
  FROM crew_events e
  WHERE e.id = NEW.event_id;
  
  -- Usa valori rettificati se presenti
  v_check_in := COALESCE(NEW.rectified_start_time, NEW.start_time);
  v_check_out := COALESCE(NEW.rectified_end_time, NEW.end_time);
  
  -- Calcola ore lavorate
  IF v_check_in IS NOT NULL AND v_check_out IS NOT NULL THEN
    v_minuti_lavorati := EXTRACT(EPOCH FROM (v_check_out - v_check_in)) / 60;
    v_ore_lavorate := ROUND((v_minuti_lavorati::numeric / 60), 2);
  ELSE
    v_minuti_lavorati := 0;
    v_ore_lavorate := 0;
  END IF;
  
  -- UPSERT
  INSERT INTO report_turni_eventi (
    crew_id,
    event_id,
    timesheet_entry_id,
    data,
    nome_evento,
    tipo_evento,
    location,
    check_in,
    check_out,
    ore_lavorate,
    minuti_lavorati,
    benefit_diaria,
    benefit_pernottamento,
    benefit_trasferta,
    benefits_totale,
    auto_checkout,
    was_rectified,
    rectified_by,
    rectified_at,
    created_at,
    updated_at
  ) VALUES (
    NEW.crew_id,
    NEW.event_id,
    NEW.id,
    NEW.date,
    v_nome_evento,
    v_tipo_evento,
    v_location,
    v_check_in,
    v_check_out,
    v_ore_lavorate,
    v_minuti_lavorati,
    COALESCE(NEW.benefit_diaria, 0),
    COALESCE(NEW.benefit_pernottamento, 0),
    COALESCE(NEW.benefit_trasferta, 0),
    COALESCE(NEW.benefit_diaria, 0) + COALESCE(NEW.benefit_pernottamento, 0) + COALESCE(NEW.benefit_trasferta, 0),
    COALESCE(NEW.auto_checkout, false),
    COALESCE(NEW.is_rectified, false),
    NEW.rectified_by,
    NEW.rectified_at,
    now(),
    now()
  )
  ON CONFLICT (timesheet_entry_id)
  DO UPDATE SET
    crew_id = EXCLUDED.crew_id,
    event_id = EXCLUDED.event_id,
    data = EXCLUDED.data,
    nome_evento = EXCLUDED.nome_evento,
    tipo_evento = EXCLUDED.tipo_evento,
    location = EXCLUDED.location,
    check_in = EXCLUDED.check_in,
    check_out = EXCLUDED.check_out,
    ore_lavorate = EXCLUDED.ore_lavorate,
    minuti_lavorati = EXCLUDED.minuti_lavorati,
    benefit_diaria = EXCLUDED.benefit_diaria,
    benefit_pernottamento = EXCLUDED.benefit_pernottamento,
    benefit_trasferta = EXCLUDED.benefit_trasferta,
    benefits_totale = EXCLUDED.benefits_totale,
    auto_checkout = EXCLUDED.auto_checkout,
    was_rectified = EXCLUDED.was_rectified,
    rectified_by = EXCLUDED.rectified_by,
    rectified_at = EXCLUDED.rectified_at,
    updated_at = now();
  
  RETURN NEW;
END;
$$;

-- Trigger su timesheet_entries
DROP TRIGGER IF EXISTS trigger_sync_eventi_report ON timesheet_entries;
CREATE TRIGGER trigger_sync_eventi_report
  AFTER INSERT OR UPDATE ON timesheet_entries
  FOR EACH ROW
  EXECUTE FUNCTION sync_eventi_to_report();

-- =====================================================
-- COMMENTI
-- =====================================================

COMMENT ON FUNCTION sync_warehouse_to_report() IS 'Sincronizza automaticamente warehouse_checkins nella tabella report_turni_magazzino';
COMMENT ON FUNCTION sync_extra_to_report() IS 'Sincronizza automaticamente extra_shifts_checkins nella tabella report_turni_extra';
COMMENT ON FUNCTION sync_eventi_to_report() IS 'Sincronizza automaticamente timesheet_entries nella tabella report_turni_eventi';
