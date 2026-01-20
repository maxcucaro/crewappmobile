-- Fix populate_richieste_v2_fields function to use correct column names
-- Bug: La funzione cercava 'nome' e 'cognome' ma crew_members usa 'first_name' e 'last_name'
-- Fix 2: crew_assegnazione_turni usa 'azienda_id' non 'company_id'
-- Fix 3: Gestisce caso in cui turno_id o event_id non esistono - fallback su crew_members

CREATE OR REPLACE FUNCTION public.populate_richieste_v2_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_company_id uuid;
BEGIN
  -- Popola crew_name da crew_members (corretto: first_name e last_name, non nome e cognome)
  SELECT first_name || ' ' || last_name 
  INTO NEW.crew_name
  FROM crew_members
  WHERE id = NEW.crewid;

  -- Popola company_id dal turno o evento o crew_members (con fallback)
  v_company_id := NULL;
  
  IF NEW.turno_id IS NOT NULL THEN
    -- crew_assegnazione_turni usa 'azienda_id' non 'company_id'
    SELECT azienda_id 
    INTO v_company_id
    FROM crew_assegnazione_turni
    WHERE id = NEW.turno_id;
  END IF;
  
  -- Se non trovato dal turno, prova con event
  IF v_company_id IS NULL AND NEW.event_id IS NOT NULL THEN
    SELECT company_id 
    INTO v_company_id
    FROM crew_events
    WHERE id = NEW.event_id;
  END IF;
  
  -- Se ancora NULL, fallback su crew_members
  IF v_company_id IS NULL THEN
    SELECT company_id 
    INTO v_company_id
    FROM crew_members
    WHERE id = NEW.crewid;
  END IF;
  
  NEW.company_id := v_company_id;

  RETURN NEW;
END;
$function$;

-- Commento sulla fix
COMMENT ON FUNCTION populate_richieste_v2_fields() IS 'Popola automaticamente crew_name e company_id nelle richieste straordinari v2. Usa first_name/last_name e gestisce azienda_id vs company_id con fallback su crew_members.';
