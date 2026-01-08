/*
  # Fix populate_shift_info_on_checkin trigger

  ## Problema
  Il trigger cerca di popolare colonne che non esistono più nella tabella warehouse_checkins:
  - nome_turno
  - ora_inizio_turno
  - ora_fine_turno
  - has_checked_in
  - has_checked_out

  ## Soluzione
  Aggiorna il trigger per popolare solo i campi che esistono realmente:
  - shift_id
  - pausa_pranzo
  - status
*/

CREATE OR REPLACE FUNCTION populate_shift_info_on_checkin()
RETURNS TRIGGER AS $$
DECLARE
  v_shift_info RECORD;
BEGIN
  -- Trova l'assegnazione turno per questo dipendente e data
  SELECT 
    cat.turno_id,
    ctt.pausa_pranzo
  INTO v_shift_info
  FROM crew_assegnazione_turni cat
  LEFT JOIN crew_template_turni ctt ON ctt.id_template = cat.turno_id
  WHERE cat.dipendente_id = NEW.crew_id
    AND cat.data_turno = NEW.date
  LIMIT 1;

  -- Se trovato, popola i campi che esistono
  IF FOUND THEN
    NEW.shift_id := v_shift_info.turno_id;
    NEW.pausa_pranzo := COALESCE(v_shift_info.pausa_pranzo, false);
  END IF;

  -- Aggiorna status in base agli orari (solo campi che esistono)
  IF NEW.check_out_time IS NOT NULL THEN
    NEW.status := 'completed';
  ELSIF NEW.check_in_time IS NOT NULL THEN
    NEW.status := 'active';
  ELSE
    NEW.status := 'pending';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
