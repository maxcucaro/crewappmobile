/*
  # Update software names in registration_requests

  1. Updates
    - Set software_nome to actual software names based on software_interest
    - Set tipologia_registrazione based on parent_company_id

  2. Logic
    - If software_interest contains 'crew' -> 'CrewManager'
    - If software_interest contains 'comanda' -> 'ComandaPlus'
    - If parent_company_id exists -> 'dipendente'
    - Otherwise -> 'freelance'
*/

-- Update software names based on software_interest content
UPDATE registration_requests 
SET software_nome = CASE 
  WHEN software_interest ILIKE '%crew%' THEN 'CrewManager'
  WHEN software_interest ILIKE '%comanda%' THEN 'ComandaPlus'
  WHEN software_interest ILIKE '%sintonia%' THEN 'Sintonia'
  ELSE 'CrewManager'
END;

-- Update registration type based on parent_company_id
UPDATE registration_requests 
SET tipologia_registrazione = CASE 
  WHEN parent_company_id IS NOT NULL THEN 'dipendente'
  WHEN company_name ILIKE '%srl%' OR company_name ILIKE '%spa%' OR company_name ILIKE '%snc%' THEN 'azienda'
  ELSE 'freelance'
END;

-- Update software_codice to match
UPDATE registration_requests 
SET software_codice = CASE 
  WHEN software_nome = 'CrewManager' THEN 'crew_manager'
  WHEN software_nome = 'ComandaPlus' THEN 'comanda_plus'
  WHEN software_nome = 'Sintonia' THEN 'sintonia'
  ELSE 'crew_manager'
END;