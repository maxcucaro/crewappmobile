/*
  # Add warehouse address to crew shift assignments
  
  1. Changes
    - Add indirizzo_magazzino column to crew_assegnazione_turni
    - Populate existing records with warehouse addresses from crew_template_turni
    - Update trigger to automatically populate warehouse address on INSERT/UPDATE
  
  2. Security
    - No RLS changes needed (inherits from existing table policies)
*/

-- Add warehouse address column
ALTER TABLE crew_assegnazione_turni
ADD COLUMN IF NOT EXISTS indirizzo_magazzino text;

-- Populate existing records with warehouse addresses
UPDATE crew_assegnazione_turni cat
SET indirizzo_magazzino = ctt.indirizzo_magazzino
FROM crew_template_turni ctt
WHERE cat.turno_id = ctt.id_template
AND cat.indirizzo_magazzino IS NULL;

-- Update the existing trigger function to also populate warehouse address
CREATE OR REPLACE FUNCTION populate_warehouse_shift_company_name()
RETURNS TRIGGER AS $$
DECLARE
    company_name_var text;
    warehouse_address_var text;
BEGIN
    -- Get company name and warehouse address from crew_template_turni
    SELECT ctt.azienda, ctt.indirizzo_magazzino
    INTO company_name_var, warehouse_address_var
    FROM crew_template_turni ctt
    WHERE ctt.id_template = NEW.turno_id;
    
    -- Update the record with correct company name and warehouse address
    IF company_name_var IS NOT NULL THEN
        NEW.nome_azienda = company_name_var;
    END IF;
    
    IF warehouse_address_var IS NOT NULL THEN
        NEW.indirizzo_magazzino = warehouse_address_var;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
