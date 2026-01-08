/*
  # Fix software population in registration_requests

  1. Debug existing data
    - Shows current state of listasoftware table
    - Shows current state of registration_requests table
  
  2. Population logic
    - Updates software_nome and software_codice based on software_interest
    - Uses intelligent fallback for missing data
    - Determines tipologia_registrazione based on parent_company_id
  
  3. Trigger for automatic updates
    - Keeps data synchronized when software_interest changes
*/

-- Debug: Show current listasoftware data
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '=== DEBUG: Contenuto tabella listasoftware ===';
  FOR rec IN SELECT id, codice, nome FROM listasoftware ORDER BY nome LOOP
    RAISE NOTICE 'Software: ID=%, Codice=%, Nome=%', rec.id, rec.codice, rec.nome;
  END LOOP;
END $$;

-- Debug: Show current registration_requests data
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '=== DEBUG: Contenuto tabella registration_requests ===';
  FOR rec IN SELECT id, email, software_interest, software_nome, parent_company_id FROM registration_requests LIMIT 10 LOOP
    RAISE NOTICE 'Request: ID=%, Email=%, SoftwareInterest=%, SoftwareNome=%, ParentCompany=%', 
                 rec.id, rec.email, rec.software_interest, rec.software_nome, rec.parent_company_id;
  END LOOP;
END $$;

-- Add columns if they don't exist
DO $$
BEGIN
  -- Add software_nome column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'registration_requests' AND column_name = 'software_nome'
  ) THEN
    ALTER TABLE registration_requests ADD COLUMN software_nome TEXT;
    RAISE NOTICE 'Added column software_nome';
  END IF;

  -- Add software_codice column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'registration_requests' AND column_name = 'software_codice'
  ) THEN
    ALTER TABLE registration_requests ADD COLUMN software_codice TEXT;
    RAISE NOTICE 'Added column software_codice';
  END IF;

  -- Add tipologia_registrazione column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'registration_requests' AND column_name = 'tipologia_registrazione'
  ) THEN
    ALTER TABLE registration_requests ADD COLUMN tipologia_registrazione TEXT;
    RAISE NOTICE 'Added column tipologia_registrazione';
  END IF;

  -- Add registration_type_nome column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'registration_requests' AND column_name = 'registration_type_nome'
  ) THEN
    ALTER TABLE registration_requests ADD COLUMN registration_type_nome TEXT;
    RAISE NOTICE 'Added column registration_type_nome';
  END IF;
END $$;

-- Update software information
UPDATE registration_requests 
SET 
  software_nome = COALESCE(
    (SELECT nome FROM listasoftware WHERE id::text = software_interest),
    (SELECT nome FROM listasoftware WHERE codice = software_interest),
    (SELECT nome FROM listasoftware WHERE LOWER(nome) LIKE '%' || LOWER(software_interest) || '%'),
    CASE 
      WHEN software_interest ILIKE '%crew%' THEN 'CrewManager'
      WHEN software_interest ILIKE '%comanda%' THEN 'ComandaPlus'
      WHEN software_interest ILIKE '%sintonia%' THEN 'Sintonia'
      ELSE 'Software Generico'
    END
  ),
  software_codice = COALESCE(
    (SELECT codice FROM listasoftware WHERE id::text = software_interest),
    (SELECT codice FROM listasoftware WHERE codice = software_interest),
    (SELECT codice FROM listasoftware WHERE LOWER(nome) LIKE '%' || LOWER(software_interest) || '%'),
    software_interest
  ),
  tipologia_registrazione = CASE
    WHEN parent_company_id IS NOT NULL THEN 'dipendente'
    WHEN company_name ILIKE '%srl%' OR company_name ILIKE '%spa%' OR company_name ILIKE '%snc%' OR company_name ILIKE '%sas%' THEN 'azienda'
    ELSE 'freelance'
  END,
  registration_type_nome = CASE
    WHEN parent_company_id IS NOT NULL THEN 'Dipendente'
    WHEN company_name ILIKE '%srl%' OR company_name ILIKE '%spa%' OR company_name ILIKE '%snc%' OR company_name ILIKE '%sas%' THEN 'Azienda'
    ELSE 'Freelance'
  END
WHERE software_nome IS NULL OR software_nome = 'Software Sconosciuto' OR software_nome = '';

-- Show results after update
DO $$
DECLARE
  rec RECORD;
  total_updated INTEGER;
BEGIN
  RAISE NOTICE '=== RISULTATI DOPO UPDATE ===';
  
  SELECT COUNT(*) INTO total_updated FROM registration_requests WHERE software_nome IS NOT NULL;
  RAISE NOTICE 'Totale record con software_nome popolato: %', total_updated;
  
  FOR rec IN 
    SELECT email, software_interest, software_nome, software_codice, tipologia_registrazione 
    FROM registration_requests 
    ORDER BY created_at DESC 
    LIMIT 10 
  LOOP
    RAISE NOTICE 'Updated: Email=%, Interest=%, Nome=%, Codice=%, Tipo=%', 
                 rec.email, rec.software_interest, rec.software_nome, rec.software_codice, rec.tipologia_registrazione;
  END LOOP;
END $$;

-- Create function to update software info automatically
CREATE OR REPLACE FUNCTION update_registration_software_info()
RETURNS TRIGGER AS $$
DECLARE
  software_record RECORD;
BEGIN
  -- Try to find software by different methods
  SELECT nome, codice INTO software_record
  FROM listasoftware 
  WHERE id::text = NEW.software_interest
     OR codice = NEW.software_interest
     OR LOWER(nome) LIKE '%' || LOWER(NEW.software_interest) || '%'
  LIMIT 1;

  IF FOUND THEN
    NEW.software_nome := software_record.nome;
    NEW.software_codice := software_record.codice;
  ELSE
    -- Fallback logic
    NEW.software_nome := CASE 
      WHEN NEW.software_interest ILIKE '%crew%' THEN 'CrewManager'
      WHEN NEW.software_interest ILIKE '%comanda%' THEN 'ComandaPlus'
      WHEN NEW.software_interest ILIKE '%sintonia%' THEN 'Sintonia'
      ELSE 'Software Generico'
    END;
    NEW.software_codice := NEW.software_interest;
  END IF;

  -- Set tipologia_registrazione
  NEW.tipologia_registrazione := CASE
    WHEN NEW.parent_company_id IS NOT NULL THEN 'dipendente'
    WHEN NEW.company_name ILIKE '%srl%' OR NEW.company_name ILIKE '%spa%' OR NEW.company_name ILIKE '%snc%' OR NEW.company_name ILIKE '%sas%' THEN 'azienda'
    ELSE 'freelance'
  END;

  NEW.registration_type_nome := CASE
    WHEN NEW.parent_company_id IS NOT NULL THEN 'Dipendente'
    WHEN NEW.company_name ILIKE '%srl%' OR NEW.company_name ILIKE '%spa%' OR NEW.company_name ILIKE '%snc%' OR NEW.company_name ILIKE '%sas%' THEN 'Azienda'
    ELSE 'Freelance'
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_registration_software_info_trigger ON registration_requests;
CREATE TRIGGER update_registration_software_info_trigger
  BEFORE INSERT OR UPDATE ON registration_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_registration_software_info();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_registration_requests_software_nome 
ON registration_requests(software_nome);

CREATE INDEX IF NOT EXISTS idx_registration_requests_software_codice 
ON registration_requests(software_codice);

CREATE INDEX IF NOT EXISTS idx_registration_requests_tipologia 
ON registration_requests(tipologia_registrazione);