/*
  # Fix Employee Software Mapping

  1. Problem
    - Employees added by companies are mapped to "Software Generico" instead of "crew_manager"
    - The trigger function maps software_interest = 'dipendente' incorrectly

  2. Solution
    - Update the trigger function to map employees to crew_manager software
    - Update existing wrong records
*/

-- Fix the trigger function to map employees correctly
CREATE OR REPLACE FUNCTION update_registration_software_info()
RETURNS TRIGGER AS $$
BEGIN
  -- Map software_interest to correct software
  CASE 
    WHEN NEW.software_interest = 'dipendente' THEN
      -- Employees should be mapped to crew_manager software
      SELECT nome, codice INTO NEW.software_nome, NEW.software_codice
      FROM listasoftware 
      WHERE codice = 'crew_manager' AND attivo = true
      LIMIT 1;
      
      NEW.tipologia_registrazione := 'dipendente';
      
    WHEN NEW.software_interest = 'freelance' THEN
      -- Freelance should also be mapped to crew_manager
      SELECT nome, codice INTO NEW.software_nome, NEW.software_codice
      FROM listasoftware 
      WHERE codice = 'crew_manager' AND attivo = true
      LIMIT 1;
      
      NEW.tipologia_registrazione := 'freelance';
      
    ELSE
      -- For other cases, try to find by software_interest as code
      SELECT nome, codice INTO NEW.software_nome, NEW.software_codice
      FROM listasoftware 
      WHERE codice = NEW.software_interest AND attivo = true
      LIMIT 1;
      
      NEW.tipologia_registrazione := COALESCE(NEW.tipologia_registrazione, 'altro');
  END CASE;

  -- If no software found, set defaults
  IF NEW.software_nome IS NULL THEN
    NEW.software_nome := 'CrewManager';
    NEW.software_codice := 'crew_manager';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update existing wrong records
UPDATE registration_requests 
SET 
  software_nome = 'CrewManager',
  software_codice = 'crew_manager',
  tipologia_registrazione = 'dipendente'
WHERE 
  software_interest = 'dipendente' 
  AND (software_nome = 'Software Generico' OR software_nome IS NULL);

-- Show results
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % employee records to use crew_manager software', updated_count;
END $$;