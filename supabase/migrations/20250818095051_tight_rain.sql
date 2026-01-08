/*
  # Popola automaticamente info turno nei check-in

  1. Funzione per popolare info turno
    - Cerca turno in crew_template_turni usando shift_id
    - Se non trovato, cerca per warehouse_id e orari
    - Popola nome_turno, ora_inizio_turno, ora_fine_turno, pausa_pranzo
    
  2. Trigger per aggiornare flag automaticamente
    - has_checked_in = true se check_in_time presente
    - has_checked_out = true se check_out_time presente
    - Aggiorna status automaticamente
    
  3. Aggiornamento dati esistenti
    - Popola info turno per check-in esistenti
    - Aggiorna flag per dati storici
*/

-- Funzione per popolare info turno automaticamente
CREATE OR REPLACE FUNCTION populate_shift_info_on_checkin()
RETURNS TRIGGER AS $$
DECLARE
    shift_info RECORD;
BEGIN
    -- Se shift_id è presente, usa quello
    IF NEW.shift_id IS NOT NULL THEN
        SELECT nome_template, ora_inizio_turno, ora_fine_turno, pausa_pranzo
        INTO shift_info
        FROM crew_template_turni
        WHERE id_template = NEW.shift_id;
        
        IF FOUND THEN
            NEW.nome_turno = shift_info.nome_template;
            NEW.ora_inizio_turno = shift_info.ora_inizio_turno;
            NEW.ora_fine_turno = shift_info.ora_fine_turno;
            NEW.pausa_pranzo = shift_info.pausa_pranzo;
        END IF;
    ELSE
        -- Altrimenti cerca turno per warehouse_id e crew_id
        SELECT nome_template, ora_inizio_turno, ora_fine_turno, pausa_pranzo
        INTO shift_info
        FROM crew_template_turni
        WHERE warehouse_id = NEW.warehouse_id
        AND company_id IN (
            SELECT parent_company_id 
            FROM registration_requests 
            WHERE id = NEW.crew_id
        )
        LIMIT 1;
        
        IF FOUND THEN
            NEW.nome_turno = shift_info.nome_template;
            NEW.ora_inizio_turno = shift_info.ora_inizio_turno;
            NEW.ora_fine_turno = shift_info.ora_fine_turno;
            NEW.pausa_pranzo = shift_info.pausa_pranzo;
        ELSE
            -- Valori di default se non trova il turno
            NEW.nome_turno = 'Turno Standard';
            NEW.ora_inizio_turno = '09:00'::time;
            NEW.ora_fine_turno = '17:00'::time;
            NEW.pausa_pranzo = true;
        END IF;
    END IF;
    
    -- Aggiorna flag automaticamente
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

-- Applica trigger
DROP TRIGGER IF EXISTS populate_shift_info_trigger ON warehouse_checkins;
CREATE TRIGGER populate_shift_info_trigger
    BEFORE INSERT OR UPDATE ON warehouse_checkins
    FOR EACH ROW
    EXECUTE FUNCTION populate_shift_info_on_checkin();

-- Aggiorna dati esistenti
UPDATE warehouse_checkins 
SET 
    has_checked_in = (check_in_time IS NOT NULL),
    has_checked_out = (check_out_time IS NOT NULL),
    nome_turno = COALESCE(nome_turno, 'Turno Standard'),
    ora_inizio_turno = COALESCE(ora_inizio_turno, '09:00'::time),
    ora_fine_turno = COALESCE(ora_fine_turno, '17:00'::time),
    pausa_pranzo = COALESCE(pausa_pranzo, true)
WHERE nome_turno IS NULL OR has_checked_in IS NULL;