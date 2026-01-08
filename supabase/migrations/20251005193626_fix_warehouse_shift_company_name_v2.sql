/*
  # Fix warehouse shift company name
  
  1. Updates
    - Update existing crew_assegnazione_turni records to have the correct company name
    - Populate nome_azienda from crew_template_turni.azienda field
  
  2. Trigger
    - Create trigger to automatically populate nome_azienda on INSERT/UPDATE
    - Uses the company name from crew_template_turni.azienda
*/

-- Update existing records to have correct company name
UPDATE crew_assegnazione_turni cat
SET nome_azienda = ctt.azienda
FROM crew_template_turni ctt
WHERE cat.turno_id = ctt.id_template
AND (cat.nome_azienda = 'Azienda' OR cat.nome_azienda IS NULL OR cat.nome_azienda = '');

-- Create function to populate company name automatically
CREATE OR REPLACE FUNCTION populate_warehouse_shift_company_name()
RETURNS TRIGGER AS $$
DECLARE
    company_name_var text;
BEGIN
    -- Get company name from crew_template_turni
    SELECT ctt.azienda
    INTO company_name_var
    FROM crew_template_turni ctt
    WHERE ctt.id_template = NEW.turno_id;
    
    -- Update the record with correct company name
    IF company_name_var IS NOT NULL THEN
        NEW.nome_azienda = company_name_var;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically populate company name
DROP TRIGGER IF EXISTS populate_warehouse_shift_company_name_trigger ON crew_assegnazione_turni;
CREATE TRIGGER populate_warehouse_shift_company_name_trigger
    BEFORE INSERT OR UPDATE ON crew_assegnazione_turni
    FOR EACH ROW
    EXECUTE FUNCTION populate_warehouse_shift_company_name();
