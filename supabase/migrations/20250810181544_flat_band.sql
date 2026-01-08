/*
  # Add software information columns to registration_requests

  1. New Columns
    - `software_nome` (text) - Nome leggibile del software
    - `software_codice` (text) - Codice tecnico del software  
    - `tipologia_registrazione` (text) - Tipo di registrazione
    - `registration_type_nome` (text) - Nome descrittivo del tipo

  2. Data Population
    - Popola i dati esistenti usando JOIN con listasoftware
    - Determina tipologia basata su parent_company_id

  3. Triggers
    - Mantiene sincronizzati i dati quando cambia software_interest
*/

-- Aggiungi le nuove colonne se non esistono
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'registration_requests' AND column_name = 'software_nome'
  ) THEN
    ALTER TABLE registration_requests ADD COLUMN software_nome text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'registration_requests' AND column_name = 'software_codice'
  ) THEN
    ALTER TABLE registration_requests ADD COLUMN software_codice text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'registration_requests' AND column_name = 'tipologia_registrazione'
  ) THEN
    ALTER TABLE registration_requests ADD COLUMN tipologia_registrazione text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'registration_requests' AND column_name = 'registration_type_nome'
  ) THEN
    ALTER TABLE registration_requests ADD COLUMN registration_type_nome text;
  END IF;
END $$;

-- Popola i dati esistenti usando JOIN con listasoftware
UPDATE registration_requests 
SET 
  software_nome = ls.nome,
  software_codice = ls.codice,
  tipologia_registrazione = CASE 
    WHEN parent_company_id IS NOT NULL THEN 'dipendente'
    WHEN company_name LIKE '%SRL%' OR company_name LIKE '%SPA%' OR company_name LIKE '%S.R.L.%' THEN 'azienda'
    ELSE 'freelance'
  END,
  registration_type_nome = CASE 
    WHEN parent_company_id IS NOT NULL THEN 'Dipendente Aziendale'
    WHEN company_name LIKE '%SRL%' OR company_name LIKE '%SPA%' OR company_name LIKE '%S.R.L.%' THEN 'Azienda'
    ELSE 'Freelance Indipendente'
  END
FROM listasoftware ls
WHERE registration_requests.software_interest = ls.id::text
  AND registration_requests.software_nome IS NULL;

-- Per i record senza software_interest, usa valori di default
UPDATE registration_requests 
SET 
  software_nome = 'Software Sconosciuto',
  software_codice = 'unknown',
  tipologia_registrazione = CASE 
    WHEN parent_company_id IS NOT NULL THEN 'dipendente'
    WHEN company_name LIKE '%SRL%' OR company_name LIKE '%SPA%' OR company_name LIKE '%S.R.L.%' THEN 'azienda'
    ELSE 'freelance'
  END,
  registration_type_nome = CASE 
    WHEN parent_company_id IS NOT NULL THEN 'Dipendente Aziendale'
    WHEN company_name LIKE '%SRL%' OR company_name LIKE '%SPA%' OR company_name LIKE '%S.R.L.%' THEN 'Azienda'
    ELSE 'Freelance Indipendente'
  END
WHERE software_nome IS NULL;

-- Crea indici per performance
CREATE INDEX IF NOT EXISTS idx_registration_requests_software_nome 
ON registration_requests(software_nome);

CREATE INDEX IF NOT EXISTS idx_registration_requests_software_codice 
ON registration_requests(software_codice);

CREATE INDEX IF NOT EXISTS idx_registration_requests_tipologia 
ON registration_requests(tipologia_registrazione);

-- Funzione per aggiornare automaticamente i dati software
CREATE OR REPLACE FUNCTION update_registration_software_info()
RETURNS TRIGGER AS $$
BEGIN
  -- Se software_interest è cambiato, aggiorna le colonne software
  IF NEW.software_interest IS DISTINCT FROM OLD.software_interest THEN
    -- Cerca il software nella tabella listasoftware
    SELECT nome, codice 
    INTO NEW.software_nome, NEW.software_codice
    FROM listasoftware 
    WHERE id::text = NEW.software_interest;
    
    -- Se non trovato, usa valori di default
    IF NEW.software_nome IS NULL THEN
      NEW.software_nome := 'Software Sconosciuto';
      NEW.software_codice := 'unknown';
    END IF;
  END IF;

  -- Aggiorna tipologia se parent_company_id è cambiato
  IF NEW.parent_company_id IS DISTINCT FROM OLD.parent_company_id THEN
    IF NEW.parent_company_id IS NOT NULL THEN
      NEW.tipologia_registrazione := 'dipendente';
      NEW.registration_type_nome := 'Dipendente Aziendale';
    ELSIF NEW.company_name LIKE '%SRL%' OR NEW.company_name LIKE '%SPA%' OR NEW.company_name LIKE '%S.R.L.%' THEN
      NEW.tipologia_registrazione := 'azienda';
      NEW.registration_type_nome := 'Azienda';
    ELSE
      NEW.tipologia_registrazione := 'freelance';
      NEW.registration_type_nome := 'Freelance Indipendente';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crea trigger per mantenere sincronizzati i dati
DROP TRIGGER IF EXISTS update_registration_software_info_trigger ON registration_requests;
CREATE TRIGGER update_registration_software_info_trigger
  BEFORE UPDATE ON registration_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_registration_software_info();