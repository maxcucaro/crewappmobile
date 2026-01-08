/*
  # Aggiungi colonne rettificate per pausa pranzo specifica

  1. Modifiche
    - Aggiunge `rectified_pausa_pranzo_inizio` (time) a warehouse_checkins
    - Aggiunge `rectified_pausa_pranzo_fine` (time) a warehouse_checkins
    - Aggiunge `rectified_pausa_pranzo_inizio` (time) a extra_shifts_checkins
    - Aggiunge `rectified_pausa_pranzo_fine` (time) a extra_shifts_checkins
    - Aggiorna la view warehouse_checkins_enriched per includere le nuove colonne

  2. Motivo
    - Mantiene coerenza con la duplicazione esistente (pausa_pranzo_inizio/fine + break_start/end)
    - Permette di rettificare specificatamente gli orari della pausa pranzo
    - Non distruttivo: mantiene tutti i dati esistenti
*/

-- Aggiungi colonne a warehouse_checkins
ALTER TABLE warehouse_checkins 
ADD COLUMN IF NOT EXISTS rectified_pausa_pranzo_inizio time,
ADD COLUMN IF NOT EXISTS rectified_pausa_pranzo_fine time;

-- Aggiungi colonne a extra_shifts_checkins
ALTER TABLE extra_shifts_checkins 
ADD COLUMN IF NOT EXISTS rectified_pausa_pranzo_inizio time,
ADD COLUMN IF NOT EXISTS rectified_pausa_pranzo_fine time;

-- Aggiorna la view warehouse_checkins_enriched
DROP VIEW IF EXISTS warehouse_checkins_enriched CASCADE;

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
  wc.pausa_pranzo_inizio,
  wc.pausa_pranzo_fine,
  wc.pausa_pranzo_minuti,
  wc.rectified_check_in_time,
  wc.rectified_check_out_time,
  wc.rectified_pausa_pranzo,
  wc.rectified_pausa_pranzo_inizio,
  wc.rectified_pausa_pranzo_fine,
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
  COALESCE(wc.meal_cost, 0) AS meal_amount,
  0 AS benefit_amount,
  COALESCE(w.name, '') AS warehouse_name,
  COALESCE(w.address, '') AS warehouse_address,
  wc."NoteTurno" AS noteturno
FROM warehouse_checkins wc
LEFT JOIN warehouses w ON wc.warehouse_id = w.id;

-- Commenti
COMMENT ON COLUMN warehouse_checkins.rectified_pausa_pranzo_inizio IS 'Orario inizio pausa pranzo rettificato';
COMMENT ON COLUMN warehouse_checkins.rectified_pausa_pranzo_fine IS 'Orario fine pausa pranzo rettificato';
COMMENT ON COLUMN extra_shifts_checkins.rectified_pausa_pranzo_inizio IS 'Orario inizio pausa pranzo rettificato';
COMMENT ON COLUMN extra_shifts_checkins.rectified_pausa_pranzo_fine IS 'Orario fine pausa pranzo rettificato';
