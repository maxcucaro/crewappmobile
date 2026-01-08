/*
  # Conversione campi rettifica orari da timestamptz a time

  ## Modifiche
  
  1. **Tabella extra_shifts_checkins**
     - Converte `rectified_check_in_time` da `timestamptz` a `time`
     - Converte `rectified_check_out_time` da `timestamptz` a `time`
  
  2. **Tabella warehouse_checkins**
     - Converte `rectified_check_in_time` da `timestamptz` a `time`
     - Converte `rectified_check_out_time` da `timestamptz` a `time`
  
  ## Motivazione
  
  - Mantiene coerenza con check_in_time e check_out_time (tipo time)
  - Elimina conversioni timezone nel frontend
  - Semplifica la gestione degli orari
  - Orari sempre in formato locale italiano
  
  ## Operazioni
  
  - Drop CASCADE view warehouse_checkins_enriched e dipendenti
  - Drop e ricreazione trigger necessari
  - Conversione dati esistenti con timezone Europe/Rome
  - Ricreazione view
*/

-- Step 1: Drop view con CASCADE (include view dipendenti)
DROP VIEW IF EXISTS warehouse_checkins_enriched CASCADE;

-- Step 2: Drop trigger su extra_shifts_checkins
DROP TRIGGER IF EXISTS trigger_calculate_rectified_total_hours_extra_shifts ON extra_shifts_checkins;

-- Step 3: Drop trigger su warehouse_checkins (se esiste)
DROP TRIGGER IF EXISTS trigger_calculate_rectified_total_hours_warehouse ON warehouse_checkins;

-- Step 4: Converti le colonne in extra_shifts_checkins
ALTER TABLE extra_shifts_checkins 
  ALTER COLUMN rectified_check_in_time TYPE time 
  USING (rectified_check_in_time AT TIME ZONE 'Europe/Rome')::time;

ALTER TABLE extra_shifts_checkins 
  ALTER COLUMN rectified_check_out_time TYPE time 
  USING (rectified_check_out_time AT TIME ZONE 'Europe/Rome')::time;

-- Step 5: Converti le colonne in warehouse_checkins
ALTER TABLE warehouse_checkins 
  ALTER COLUMN rectified_check_in_time TYPE time 
  USING (rectified_check_in_time AT TIME ZONE 'Europe/Rome')::time;

ALTER TABLE warehouse_checkins 
  ALTER COLUMN rectified_check_out_time TYPE time 
  USING (rectified_check_out_time AT TIME ZONE 'Europe/Rome')::time;

-- Step 6: Ricrea il trigger su extra_shifts_checkins
CREATE TRIGGER trigger_calculate_rectified_total_hours_extra_shifts
  BEFORE INSERT OR UPDATE ON extra_shifts_checkins
  FOR EACH ROW
  EXECUTE FUNCTION calculate_rectified_total_hours_extra_shifts();

-- Step 7: Ricrea il trigger su warehouse_checkins (se la funzione esiste)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'calculate_rectified_total_hours_warehouse'
  ) THEN
    CREATE TRIGGER trigger_calculate_rectified_total_hours_warehouse
      BEFORE INSERT OR UPDATE ON warehouse_checkins
      FOR EACH ROW
      EXECUTE FUNCTION calculate_rectified_total_hours_warehouse();
  END IF;
END $$;

-- Step 8: Ricrea la view warehouse_checkins_enriched
CREATE VIEW warehouse_checkins_enriched AS
SELECT 
  wc.id,
  wc.warehouse_id,
  wc.crew_id,
  wc.date,
  wc.check_in_time,
  wc.check_out_time,
  wc.status,
  wc.location,
  wc.notes,
  wc.created_at,
  wc.total_hours::numeric AS total_hours,
  wc.break_minutes,
  wc.net_hours,
  wc.company_meal,
  wc.meal_voucher,
  wc.meal_cost,
  wc.meal_notes,
  wc.shift_id,
  wc.has_taken_break,
  wc.forced_checkin,
  wc.gps_error_reason,
  wc.break_start_time,
  wc.break_end_time,
  wc.break_start_location,
  wc.break_end_location,
  wc.break_registered_late,
  wc.break_modified_at,
  wc.break_auto_applied,
  wc.break_start_forced,
  wc.break_end_forced,
  wc.break_start_gps_error,
  wc.break_end_gps_error,
  wc.location_alert,
  wc.distance_from_warehouse,
  wc.checkout_location_alert,
  wc.checkout_distance_from_warehouse,
  wc.checkout_location,
  wc.pausa_pranzo,
  wc.rectified_check_in_time,
  wc.rectified_check_out_time,
  wc.rectified_pausa_pranzo,
  wc.rectification_note,
  wc.rectified_by,
  wc.rectified_at,
  wc.rectified_total_hours,
  wc.overtime_requested,
  wc.rectified_break_start,
  wc.rectified_break_end,
  wc.auto_checkout,
  wc.auto_checkout_time,
  wc.expected_end_time,
  wc.overtime_hours,
  wc.pausa_pranzo_minuti,
  COALESCE(wc.meal_cost, 0) AS meal_amount,
  0 AS benefit_amount,
  COALESCE(w.name, '') AS warehouse_name,
  COALESCE(w.address, '') AS warehouse_address,
  wc."NoteTurno" AS noteturno
FROM warehouse_checkins wc
LEFT JOIN warehouses w ON wc.warehouse_id = w.id;
