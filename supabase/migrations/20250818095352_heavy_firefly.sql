/*
  # Fix trigger per popolare info turno con logica corretta

  1. Logica Corretta
    - crew_assegnazione_turni.turno_id → crew_template_turni.id_template
    - Popola nome_turno, ora_inizio_turno, ora_fine_turno, pausa_pranzo
    - Aggiorna flag has_checked_in, has_checked_out automaticamente

  2. Trigger Migliorato
    - Cerca prima in crew_assegnazione_turni usando crew_id + date
    - Poi usa turno_id per trovare template in crew_template_turni
    - Popola tutte le info del turno automaticamente
*/

-- Rimuovi trigger esistente se presente
DROP TRIGGER IF EXISTS populate_shift_info_trigger ON warehouse_checkins;
DROP FUNCTION IF EXISTS populate_shift_info_on_checkin();

-- Crea funzione migliorata per popolare info turno
CREATE OR REPLACE FUNCTION populate_shift_info_on_checkin()
RETURNS TRIGGER AS $$
DECLARE
    turno_assignment RECORD;
    turno_template RECORD;
BEGIN
    -- Solo per INSERT o quando shift_id cambia
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.shift_id IS DISTINCT FROM NEW.shift_id) THEN
        
        -- 1. Cerca l'assegnazione turno per questo dipendente e data
        SELECT * INTO turno_assignment
        FROM crew_assegnazione_turni
        WHERE dipendente_id = NEW.crew_id 
        AND data_turno = NEW.date
        LIMIT 1;
        
        -- 2. Se trovato, usa il turno_id per cercare il template
        IF turno_assignment IS NOT NULL THEN
            -- Aggiorna shift_id se non presente
            IF NEW.shift_id IS NULL THEN
                NEW.shift_id = turno_assignment.turno_id;
            END IF;
            
            -- 3. Cerca il template turno
            SELECT * INTO turno_template
            FROM crew_template_turni
            WHERE id_template = turno_assignment.turno_id;
            
            -- 4. Popola le info del turno se template trovato
            IF turno_template IS NOT NULL THEN
                NEW.nome_turno = turno_template.nome_template;
                NEW.ora_inizio_turno = turno_template.ora_inizio_turno;
                NEW.ora_fine_turno = turno_template.ora_fine_turno;
                NEW.pausa_pranzo = turno_template.pausa_pranzo;
                
                RAISE NOTICE 'Turno popolato: % (% - %)', 
                    turno_template.nome_template,
                    turno_template.ora_inizio_turno,
                    turno_template.ora_fine_turno;
            ELSE
                RAISE NOTICE 'Template turno non trovato per turno_id: %', turno_assignment.turno_id;
            END IF;
        ELSE
            RAISE NOTICE 'Assegnazione turno non trovata per crew_id: % e data: %', NEW.crew_id, NEW.date;
        END IF;
    END IF;
    
    -- Aggiorna sempre i flag di controllo
    NEW.has_checked_in = (NEW.check_in_time IS NOT NULL);
    NEW.has_checked_out = (NEW.check_out_time IS NOT NULL);
    
    -- Aggiorna status automaticamente
    IF NEW.has_checked_out THEN
        NEW.status = 'completed';
    ELSIF NEW.has_checked_in THEN
        NEW.status = 'active';
    ELSE
        NEW.status = 'pending';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crea trigger
CREATE TRIGGER populate_shift_info_trigger
    BEFORE INSERT OR UPDATE ON warehouse_checkins
    FOR EACH ROW
    EXECUTE FUNCTION populate_shift_info_on_checkin();

-- Aggiorna record esistenti per popolare info turno mancanti
UPDATE warehouse_checkins 
SET shift_id = shift_id -- Forza trigger su record esistenti
WHERE nome_turno IS NULL;

-- Aggiorna flag per record esistenti
UPDATE warehouse_checkins 
SET 
    has_checked_in = (check_in_time IS NOT NULL),
    has_checked_out = (check_out_time IS NOT NULL),
    has_taken_break = false
WHERE has_checked_in IS NULL OR has_checked_out IS NULL;