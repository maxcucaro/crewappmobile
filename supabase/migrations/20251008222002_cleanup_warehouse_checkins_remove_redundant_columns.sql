/*
  # Cleanup Warehouse Check-ins Table - Remove Redundant Columns

  ## Changes Made
  
  1. **Updated View**: Modified `admin_forced_checkins_view` to fetch shift name from crew_assegnazione_turni
  
  2. **Removed Columns**:
     - `pausa_pranzo` - Redundant with `has_taken_break`, `break_start_time`, `break_end_time`
     - `has_checked_in` - Redundant with `check_in_time IS NOT NULL`
     - `has_checked_out` - Redundant with `check_out_time IS NOT NULL`
     - `ora_inizio_turno` - Should be fetched from `crew_assegnazione_turni` via `shift_id`
     - `ora_fine_turno` - Should be fetched from `crew_assegnazione_turni` via `shift_id`
     - `nome_turno` - Should be fetched from `crew_assegnazione_turni` via `shift_id`
  
  3. **Kept Essential Columns**:
     - All timestamp fields (check_in_time, check_out_time, break_start_time, break_end_time)
     - All location tracking fields
     - All calculated fields (break_minutes, total_hours, net_hours)
     - All status and alert fields
     - has_taken_break (essential for break tracking logic)
  
  ## Rationale
  
  - Reduces data duplication and potential inconsistencies
  - Shift details should always come from the source table (crew_assegnazione_turni)
  - Boolean flags that duplicate timestamp existence checks are unnecessary
  - Simpler table structure = easier maintenance and fewer bugs
*/

-- First, drop and recreate the view without nome_turno dependency
DROP VIEW IF EXISTS admin_forced_checkins_view;

CREATE VIEW admin_forced_checkins_view AS
SELECT 
  'evento'::text AS tipo_checkin,
  p.id,
  p.id_tecnico AS crew_id,
  rr.full_name AS crew_name,
  rr.email AS crew_email,
  ce.title AS evento_nome,
  p.data,
  p.ora_inizio AS check_in_time,
  p.forced_checkin,
  p.gps_error_reason,
  p.posizione_gps,
  p.data_creazione AS created_at
FROM presenze p
LEFT JOIN registration_requests rr ON rr.id = p.id_tecnico
LEFT JOIN crew_events ce ON ce.id = p.id_evento
WHERE p.forced_checkin = true

UNION ALL

SELECT 
  'magazzino'::text AS tipo_checkin,
  wc.id,
  wc.crew_id,
  rr.full_name AS crew_name,
  rr.email AS crew_email,
  COALESCE(cat.nome_turno, 'Turno Magazzino'::text) AS evento_nome,
  wc.date AS data,
  wc.check_in_time,
  wc.forced_checkin,
  wc.gps_error_reason,
  wc.location AS posizione_gps,
  wc.created_at
FROM warehouse_checkins wc
LEFT JOIN registration_requests rr ON rr.id = wc.crew_id
LEFT JOIN crew_assegnazione_turni cat ON cat.id = wc.shift_id
WHERE wc.forced_checkin = true
ORDER BY created_at DESC;

-- Now remove redundant columns

-- Remove redundant boolean flags
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'warehouse_checkins' AND column_name = 'has_checked_in'
  ) THEN
    ALTER TABLE warehouse_checkins DROP COLUMN has_checked_in;
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'warehouse_checkins' AND column_name = 'has_checked_out'
  ) THEN
    ALTER TABLE warehouse_checkins DROP COLUMN has_checked_out;
  END IF;
END $$;

-- Remove redundant pausa_pranzo field (use has_taken_break instead)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'warehouse_checkins' AND column_name = 'pausa_pranzo'
  ) THEN
    ALTER TABLE warehouse_checkins DROP COLUMN pausa_pranzo;
  END IF;
END $$;

-- Remove redundant shift info columns (fetch from crew_assegnazione_turni via shift_id)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'warehouse_checkins' AND column_name = 'ora_inizio_turno'
  ) THEN
    ALTER TABLE warehouse_checkins DROP COLUMN ora_inizio_turno;
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'warehouse_checkins' AND column_name = 'ora_fine_turno'
  ) THEN
    ALTER TABLE warehouse_checkins DROP COLUMN ora_fine_turno;
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'warehouse_checkins' AND column_name = 'nome_turno'
  ) THEN
    ALTER TABLE warehouse_checkins DROP COLUMN nome_turno;
  END IF;
END $$;