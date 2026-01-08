/*
  # Fix Recursive Trigger Loop in warehouse_checkins

  ## Problem
  - The `populate_shift_info_on_checkin` trigger was causing infinite recursion
  - It was doing UPDATE on the same row being modified, triggering itself again
  - This caused "stack depth limit exceeded" error (code 54001)

  ## Solution
  - Modify NEW record directly instead of doing separate UPDATE
  - This avoids the recursive trigger call
  - The trigger only runs once per actual row change

  ## Changes
  - Recreate `populate_shift_info_on_checkin()` function to modify NEW directly
  - No more UPDATE statement inside the trigger
*/

CREATE OR REPLACE FUNCTION populate_shift_info_on_checkin()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_shift_info RECORD;
BEGIN
  -- Trova l'assegnazione turno per questo dipendente e data
  SELECT 
    cat.turno_id,
    cat.nome_turno,
    cat.ora_inizio_turno,
    cat.ora_fine_turno,
    ctt.pausa_pranzo
  INTO v_shift_info
  FROM crew_assegnazione_turni cat
  LEFT JOIN crew_template_turni ctt ON ctt.id_template = cat.turno_id
  WHERE cat.dipendente_id = NEW.crew_id
    AND cat.data_turno = NEW.date
  LIMIT 1;

  -- Se trovato, popola i campi
  IF FOUND THEN
    NEW.shift_id := v_shift_info.turno_id;
    NEW.nome_turno := v_shift_info.nome_turno;
    NEW.ora_inizio_turno := v_shift_info.ora_inizio_turno;
    NEW.ora_fine_turno := v_shift_info.ora_fine_turno;
    NEW.pausa_pranzo := v_shift_info.pausa_pranzo;
  END IF;

  -- Aggiorna status in base agli orari
  IF NEW.check_in_time IS NOT NULL THEN
    NEW.has_checked_in := true;
  ELSE
    NEW.has_checked_in := false;
  END IF;

  IF NEW.check_out_time IS NOT NULL THEN
    NEW.has_checked_out := true;
    NEW.status := 'completed';
  ELSIF NEW.check_in_time IS NOT NULL THEN
    NEW.status := 'active';
  ELSE
    NEW.status := 'pending';
  END IF;

  RETURN NEW;
END;
$$;
