/*
  # Fix trigger per usare dati da crew_assegnazione_turni

  Il trigger deve copiare i dati direttamente da crew_assegnazione_turni
  dove sono già presenti nome_turno, ora_inizio_turno, ora_fine_turno
  
  1. Elimina trigger vecchio
  2. Crea trigger corretto che usa dati esistenti
  3. Aggiorna record esistenti
*/

-- Elimina trigger vecchio
DROP TRIGGER IF EXISTS populate_shift_info_trigger ON warehouse_checkins;
DROP FUNCTION IF EXISTS populate_shift_info_on_checkin();

-- Crea funzione corretta che usa dati da crew_assegnazione_turni
CREATE OR REPLACE FUNCTION populate_shift_info_on_checkin()
RETURNS TRIGGER AS $$
BEGIN
  -- Trova l'assegnazione turno per questo dipendente e data
  -- I dati sono GIÀ tutti in crew_assegnazione_turni
  UPDATE warehouse_checkins 
  SET 
    shift_id = cat.turno_id,
    nome_turno = cat.nome_turno,
    ora_inizio_turno = cat.ora_inizio_turno,
    ora_fine_turno = cat.ora_fine_turno,
    pausa_pranzo = ctt.pausa_pranzo,
    has_checked_in = CASE 
      WHEN NEW.check_in_time IS NOT NULL THEN true 
      ELSE false 
    END,
    has_checked_out = CASE 
      WHEN NEW.check_out_time IS NOT NULL THEN true 
      ELSE false 
    END,
    status = CASE 
      WHEN NEW.check_out_time IS NOT NULL THEN 'completed'
      WHEN NEW.check_in_time IS NOT NULL THEN 'active'
      ELSE 'pending'
    END
  FROM crew_assegnazione_turni cat
  LEFT JOIN crew_template_turni ctt ON ctt.id_template = cat.turno_id
  WHERE warehouse_checkins.id = NEW.id
    AND cat.dipendente_id = NEW.crew_id
    AND cat.data_turno = NEW.date;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crea trigger
CREATE TRIGGER populate_shift_info_trigger
  BEFORE INSERT OR UPDATE ON warehouse_checkins
  FOR EACH ROW
  EXECUTE FUNCTION populate_shift_info_on_checkin();

-- Aggiorna record esistenti che hanno shift_id ma mancano i dati
UPDATE warehouse_checkins 
SET 
  nome_turno = cat.nome_turno,
  ora_inizio_turno = cat.ora_inizio_turno,
  ora_fine_turno = cat.ora_fine_turno,
  pausa_pranzo = COALESCE(ctt.pausa_pranzo, true),
  has_checked_in = CASE 
    WHEN check_in_time IS NOT NULL THEN true 
    ELSE false 
  END,
  has_checked_out = CASE 
    WHEN check_out_time IS NOT NULL THEN true 
    ELSE false 
  END
FROM crew_assegnazione_turni cat
LEFT JOIN crew_template_turni ctt ON ctt.id_template = cat.turno_id
WHERE warehouse_checkins.shift_id = cat.turno_id
  AND warehouse_checkins.crew_id = cat.dipendente_id
  AND warehouse_checkins.date = cat.data_turno
  AND (warehouse_checkins.nome_turno IS NULL 
       OR warehouse_checkins.ora_inizio_turno IS NULL 
       OR warehouse_checkins.ora_fine_turno IS NULL);