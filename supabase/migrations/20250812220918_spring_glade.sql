/*
  # Aggiungi calcolo ore totali per warehouse_checkins

  1. Modifiche Tabella
    - Aggiungi colonna `total_hours` per memorizzare ore totali lavorate
    - Aggiungi colonna `break_minutes` per gestire pause
    - Aggiungi colonna `net_hours` per ore nette (totali - pause)

  2. Funzioni
    - Trigger automatico per calcolare ore quando viene fatto check-out
    - Calcolo: check_out_time - check_in_time = total_hours
    - Calcolo: total_hours - (break_minutes/60) = net_hours

  3. Validazioni
    - check_out_time deve essere successivo a check_in_time
    - break_minutes non può essere negativo
    - total_hours calcolato automaticamente
*/

-- Aggiungi colonne per il calcolo delle ore
DO $$
BEGIN
  -- Aggiungi colonna total_hours se non esiste
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_checkins' AND column_name = 'total_hours'
  ) THEN
    ALTER TABLE warehouse_checkins ADD COLUMN total_hours numeric(5,2);
  END IF;

  -- Aggiungi colonna break_minutes se non esiste
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_checkins' AND column_name = 'break_minutes'
  ) THEN
    ALTER TABLE warehouse_checkins ADD COLUMN break_minutes integer DEFAULT 0;
  END IF;

  -- Aggiungi colonna net_hours se non esiste
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_checkins' AND column_name = 'net_hours'
  ) THEN
    ALTER TABLE warehouse_checkins ADD COLUMN net_hours numeric(5,2);
  END IF;
END $$;

-- Funzione per calcolare le ore totali
CREATE OR REPLACE FUNCTION calculate_warehouse_hours()
RETURNS TRIGGER AS $$
BEGIN
  -- Calcola ore totali solo se entrambi check_in_time e check_out_time sono presenti
  IF NEW.check_in_time IS NOT NULL AND NEW.check_out_time IS NOT NULL THEN
    -- Calcola differenza in ore (gestisce anche il passaggio di mezzanotte)
    NEW.total_hours := EXTRACT(EPOCH FROM (NEW.check_out_time::time - NEW.check_in_time::time)) / 3600.0;
    
    -- Se il risultato è negativo (passaggio mezzanotte), aggiungi 24 ore
    IF NEW.total_hours < 0 THEN
      NEW.total_hours := NEW.total_hours + 24;
    END IF;
    
    -- Calcola ore nette sottraendo le pause
    NEW.net_hours := NEW.total_hours - (COALESCE(NEW.break_minutes, 0) / 60.0);
    
    -- Assicurati che le ore nette non siano negative
    IF NEW.net_hours < 0 THEN
      NEW.net_hours := 0;
    END IF;
  ELSE
    -- Se mancano orari, resetta i calcoli
    NEW.total_hours := NULL;
    NEW.net_hours := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crea trigger per calcolo automatico
DROP TRIGGER IF EXISTS calculate_warehouse_hours_trigger ON warehouse_checkins;
CREATE TRIGGER calculate_warehouse_hours_trigger
  BEFORE INSERT OR UPDATE ON warehouse_checkins
  FOR EACH ROW
  EXECUTE FUNCTION calculate_warehouse_hours();

-- Aggiungi vincoli di validazione
DO $$
BEGIN
  -- Vincolo: check_out_time deve essere dopo check_in_time (stesso giorno)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'warehouse_checkins' AND constraint_name = 'valid_checkout_time'
  ) THEN
    ALTER TABLE warehouse_checkins 
    ADD CONSTRAINT valid_checkout_time 
    CHECK (
      check_out_time IS NULL OR 
      check_in_time IS NULL OR 
      (check_out_time >= check_in_time OR check_out_time < check_in_time) -- Permette passaggio mezzanotte
    );
  END IF;

  -- Vincolo: break_minutes non può essere negativo
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'warehouse_checkins' AND constraint_name = 'valid_break_minutes'
  ) THEN
    ALTER TABLE warehouse_checkins 
    ADD CONSTRAINT valid_break_minutes 
    CHECK (break_minutes >= 0);
  END IF;

  -- Vincolo: total_hours non può essere negativo
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'warehouse_checkins' AND constraint_name = 'valid_total_hours'
  ) THEN
    ALTER TABLE warehouse_checkins 
    ADD CONSTRAINT valid_total_hours 
    CHECK (total_hours IS NULL OR total_hours >= 0);
  END IF;
END $$;

-- Aggiorna record esistenti per calcolare ore retroattivamente
UPDATE warehouse_checkins 
SET 
  break_minutes = COALESCE(break_minutes, 0),
  total_hours = CASE 
    WHEN check_in_time IS NOT NULL AND check_out_time IS NOT NULL THEN
      CASE 
        WHEN check_out_time >= check_in_time THEN
          EXTRACT(EPOCH FROM (check_out_time::time - check_in_time::time)) / 3600.0
        ELSE
          -- Gestisce passaggio mezzanotte
          EXTRACT(EPOCH FROM (check_out_time::time - check_in_time::time)) / 3600.0 + 24
      END
    ELSE NULL
  END
WHERE total_hours IS NULL;

-- Calcola ore nette per record esistenti
UPDATE warehouse_checkins 
SET net_hours = total_hours - (COALESCE(break_minutes, 0) / 60.0)
WHERE total_hours IS NOT NULL AND net_hours IS NULL;