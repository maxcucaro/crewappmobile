/*
  # Aggiungi informazioni turno a warehouse_checkins

  1. Nuove Colonne
    - `nome_turno` (text) - Nome del template turno
    - `ora_inizio_turno` (time) - Orario inizio programmato
    - `ora_fine_turno` (time) - Orario fine programmato  
    - `pausa_pranzo` (boolean) - Se il turno include pausa pranzo
  
  2. Scopo
    - Avere tutte le info del turno direttamente nel check-in
    - Non dover fare JOIN per visualizzare orari programmati
    - Sapere se è prevista pausa pranzo per calcoli ore
*/

-- Aggiungi colonne informazioni turno
DO $$
BEGIN
  -- Nome del turno
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_checkins' AND column_name = 'nome_turno'
  ) THEN
    ALTER TABLE warehouse_checkins ADD COLUMN nome_turno text;
  END IF;

  -- Orario inizio turno programmato
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_checkins' AND column_name = 'ora_inizio_turno'
  ) THEN
    ALTER TABLE warehouse_checkins ADD COLUMN ora_inizio_turno time without time zone;
  END IF;

  -- Orario fine turno programmato
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_checkins' AND column_name = 'ora_fine_turno'
  ) THEN
    ALTER TABLE warehouse_checkins ADD COLUMN ora_fine_turno time without time zone;
  END IF;

  -- Flag pausa pranzo
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_checkins' AND column_name = 'pausa_pranzo'
  ) THEN
    ALTER TABLE warehouse_checkins ADD COLUMN pausa_pranzo boolean DEFAULT true;
  END IF;
END $$;

-- Aggiungi commenti alle colonne
COMMENT ON COLUMN warehouse_checkins.nome_turno IS 'Nome del template turno (es. "Turno Mattino", "Turno Pomeriggio")';
COMMENT ON COLUMN warehouse_checkins.ora_inizio_turno IS 'Orario inizio programmato del turno';
COMMENT ON COLUMN warehouse_checkins.ora_fine_turno IS 'Orario fine programmato del turno';
COMMENT ON COLUMN warehouse_checkins.pausa_pranzo IS 'Se il turno include pausa pranzo (true = con pausa, false = senza pausa)';

-- Crea funzione per popolare automaticamente i dati del turno
CREATE OR REPLACE FUNCTION populate_shift_info_on_checkin()
RETURNS TRIGGER AS $$
BEGIN
  -- Se shift_id è presente, popola automaticamente le info del turno
  IF NEW.shift_id IS NOT NULL THEN
    SELECT 
      nome_template,
      ora_inizio_turno,
      ora_fine_turno,
      pausa_pranzo
    INTO 
      NEW.nome_turno,
      NEW.ora_inizio_turno,
      NEW.ora_fine_turno,
      NEW.pausa_pranzo
    FROM crew_template_turni
    WHERE id_template = NEW.shift_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crea trigger per popolare automaticamente i dati
DROP TRIGGER IF EXISTS populate_shift_info_trigger ON warehouse_checkins;
CREATE TRIGGER populate_shift_info_trigger
  BEFORE INSERT OR UPDATE ON warehouse_checkins
  FOR EACH ROW
  EXECUTE FUNCTION populate_shift_info_on_checkin();