/*
  # Trigger per popolare automaticamente info turno nei check-in

  1. Funzione
    - `populate_shift_info_on_checkin()` - Popola automaticamente nome turno, orari e pausa pranzo
    - Cerca il turno corrispondente in `crew_template_turni` basandosi su warehouse_id e crew_id
    - Popola le colonne: nome_turno, ora_inizio_turno, ora_fine_turno, pausa_pranzo

  2. Trigger
    - Si attiva BEFORE INSERT OR UPDATE su warehouse_checkins
    - Popola automaticamente i dati del turno se shift_id è presente o se trova un turno corrispondente

  3. Logica
    - Se shift_id è presente, usa quello per trovare il turno
    - Altrimenti cerca un turno per lo stesso warehouse_id e data
    - Popola nome_turno, orari programmati e info pausa pranzo
*/

-- Funzione per popolare info turno automaticamente
CREATE OR REPLACE FUNCTION populate_shift_info_on_checkin()
RETURNS TRIGGER AS $$
DECLARE
    turno_record RECORD;
BEGIN
    -- Se shift_id è presente, usa quello
    IF NEW.shift_id IS NOT NULL THEN
        SELECT 
            nome_template,
            ora_inizio_turno,
            ora_fine_turno,
            pausa_pranzo
        INTO turno_record
        FROM crew_template_turni
        WHERE id_template = NEW.shift_id;
        
        IF FOUND THEN
            NEW.nome_turno = turno_record.nome_template;
            NEW.ora_inizio_turno = turno_record.ora_inizio_turno;
            NEW.ora_fine_turno = turno_record.ora_fine_turno;
            NEW.pausa_pranzo = turno_record.pausa_pranzo;
        END IF;
    ELSE
        -- Altrimenti cerca un turno per questo warehouse e dipendente
        SELECT 
            ctt.nome_template,
            ctt.ora_inizio_turno,
            ctt.ora_fine_turno,
            ctt.pausa_pranzo
        INTO turno_record
        FROM crew_template_turni ctt
        INNER JOIN crew_assegnazione_turni cat ON cat.turno_id = ctt.id_template
        WHERE ctt.warehouse_id = NEW.warehouse_id
        AND cat.dipendente_id = NEW.crew_id
        AND cat.data_turno = NEW.date
        LIMIT 1;
        
        IF FOUND THEN
            NEW.nome_turno = turno_record.nome_template;
            NEW.ora_inizio_turno = turno_record.ora_inizio_turno;
            NEW.ora_fine_turno = turno_record.ora_fine_turno;
            NEW.pausa_pranzo = turno_record.pausa_pranzo;
            
            -- Trova e imposta anche shift_id
            SELECT cat.turno_id INTO NEW.shift_id
            FROM crew_assegnazione_turni cat
            INNER JOIN crew_template_turni ctt ON cat.turno_id = ctt.id_template
            WHERE ctt.warehouse_id = NEW.warehouse_id
            AND cat.dipendente_id = NEW.crew_id
            AND cat.data_turno = NEW.date
            LIMIT 1;
        END IF;
    END IF;
    
    -- Aggiorna i flag di controllo
    NEW.has_checked_in = (NEW.check_in_time IS NOT NULL);
    NEW.has_checked_out = (NEW.check_out_time IS NOT NULL);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crea il trigger
DROP TRIGGER IF EXISTS populate_shift_info_trigger ON warehouse_checkins;
CREATE TRIGGER populate_shift_info_trigger
    BEFORE INSERT OR UPDATE ON warehouse_checkins
    FOR EACH ROW
    EXECUTE FUNCTION populate_shift_info_on_checkin();

-- Aggiorna i record esistenti che hanno shift_id ma non hanno info turno
UPDATE warehouse_checkins 
SET nome_turno = ctt.nome_template,
    ora_inizio_turno = ctt.ora_inizio_turno,
    ora_fine_turno = ctt.ora_fine_turno,
    pausa_pranzo = ctt.pausa_pranzo
FROM crew_template_turni ctt
WHERE warehouse_checkins.shift_id = ctt.id_template
AND warehouse_checkins.nome_turno IS NULL;

-- Aggiorna i record esistenti che non hanno shift_id ma possono essere collegati
UPDATE warehouse_checkins 
SET nome_turno = ctt.nome_template,
    ora_inizio_turno = ctt.ora_inizio_turno,
    ora_fine_turno = ctt.ora_fine_turno,
    pausa_pranzo = ctt.pausa_pranzo,
    shift_id = ctt.id_template
FROM crew_template_turni ctt
INNER JOIN crew_assegnazione_turni cat ON cat.turno_id = ctt.id_template
WHERE ctt.warehouse_id = warehouse_checkins.warehouse_id
AND cat.dipendente_id = warehouse_checkins.crew_id
AND cat.data_turno = warehouse_checkins.date
AND warehouse_checkins.nome_turno IS NULL;