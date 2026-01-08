/*
  # Add crew_name column to event_crew_assignments

  1. New Columns
    - `crew_name` (text) - Nome completo del crew member per visualizzazione diretta
  
  2. Data Population
    - Popola automaticamente i record esistenti con i nomi dai profili
    - Trigger per aggiornamento automatico su nuovi inserimenti
  
  3. Performance
    - Indice per ricerche per nome
    - Denormalizzazione per performance migliori
*/

-- Aggiungi la colonna crew_name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_crew_assignments' AND column_name = 'crew_name'
  ) THEN
    ALTER TABLE event_crew_assignments ADD COLUMN crew_name text;
  END IF;
END $$;

-- Popola i record esistenti con i nomi
UPDATE event_crew_assignments 
SET crew_name = COALESCE(
  (SELECT full_name FROM registration_requests WHERE id = event_crew_assignments.crew_id),
  (SELECT company_name FROM registration_requests WHERE id = event_crew_assignments.crew_id),
  (SELECT first_name || ' ' || last_name FROM crew_members WHERE id = event_crew_assignments.crew_id),
  'Nome non trovato'
)
WHERE crew_name IS NULL;

-- Crea funzione per aggiornare automaticamente crew_name
CREATE OR REPLACE FUNCTION update_crew_name_on_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Cerca prima in registration_requests
  SELECT COALESCE(full_name, company_name) INTO NEW.crew_name
  FROM registration_requests 
  WHERE id = NEW.crew_id;
  
  -- Se non trovato, cerca in crew_members
  IF NEW.crew_name IS NULL THEN
    SELECT first_name || ' ' || last_name INTO NEW.crew_name
    FROM crew_members 
    WHERE id = NEW.crew_id;
  END IF;
  
  -- Se ancora non trovato, usa default
  IF NEW.crew_name IS NULL THEN
    NEW.crew_name := 'Nome non trovato';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crea trigger per aggiornamento automatico
DROP TRIGGER IF EXISTS update_crew_name_trigger ON event_crew_assignments;
CREATE TRIGGER update_crew_name_trigger
  BEFORE INSERT OR UPDATE ON event_crew_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_crew_name_on_assignment();

-- Crea indice per performance
CREATE INDEX IF NOT EXISTS idx_event_crew_assignments_crew_name 
ON event_crew_assignments(crew_name);

-- Commento sulla colonna
COMMENT ON COLUMN event_crew_assignments.crew_name IS 'Nome completo del crew member (denormalizzato per performance)';