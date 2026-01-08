/*
  # Regola Straordinari - Tagli di Mezzora
  
  1. Regola Applicata
    - Gli straordinari possono essere richiesti SOLO con tagli di 30 minuti
    - Arrotondamento sempre per DIFETTO al multiplo di 30 inferiore
    - Esempi:
      * 14 minuti → 0 minuti richiedibili (non richiedibile)
      * 35 minuti → 30 minuti richiedibili
      * 55 minuti → 30 minuti richiedibili  
      * 65 minuti → 60 minuti richiedibili
      * 90 minuti → 90 minuti richiedibili
  
  2. Schema Changes
    - Aggiungi colonna `overtime_minutes_requestable` (integer) a `warehouse_checkins`
    - Aggiungi colonna `overtime_minutes_requestable` (integer) a `extra_shifts_checkins`
    - Questa colonna contiene i minuti straordinari che possono essere richiesti (arrotondati)
    - La colonna `overtime_minutes` contiene i minuti effettivi lavorati
  
  3. Function
    - `calculate_requestable_overtime(minutes integer)` - Funzione utility per calcolare i minuti richiedibili
    - Formula: FLOOR(minutes / 30) * 30
  
  4. Updates
    - Aggiorna `auto_close_warehouse_checkouts()` per applicare la regola
    - Aggiorna `auto_close_event_checkouts()` per applicare la regola
    - Aggiorna tutti i record esistenti con i valori calcolati
  
  5. Sicurezza
    - Non rimuove nessuna colonna esistente
    - Non modifica il comportamento delle funzionalità esistenti
    - Aggiunge solo la nuova logica di arrotondamento
*/

-- Aggiungi colonna per i minuti straordinari richiedibili
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_checkins' AND column_name = 'overtime_minutes_requestable'
  ) THEN
    ALTER TABLE warehouse_checkins ADD COLUMN overtime_minutes_requestable integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extra_shifts_checkins' AND column_name = 'overtime_minutes_requestable'
  ) THEN
    ALTER TABLE extra_shifts_checkins ADD COLUMN overtime_minutes_requestable integer DEFAULT 0;
  END IF;
END $$;

-- Funzione utility per calcolare i minuti straordinari richiedibili
CREATE OR REPLACE FUNCTION calculate_requestable_overtime(minutes integer)
RETURNS integer AS $$
BEGIN
  -- Arrotonda per difetto al multiplo di 30
  RETURN FLOOR(minutes / 30) * 30;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Aggiorna la funzione di auto-close warehouse per applicare la regola
CREATE OR REPLACE FUNCTION auto_close_warehouse_checkouts()
RETURNS void AS $$
DECLARE
  checkout_record RECORD;
  calculated_hours numeric(5,2);
  calculated_break integer;
  overtime_hours numeric(5,2);
  overtime_minutes integer;
  overtime_minutes_requestable integer;
BEGIN
  -- Trova tutti i checkout attivi che dovrebbero essere chiusi
  FOR checkout_record IN
    SELECT 
      wc.id,
      wc.crew_id,
      wc.date,
      wc.check_in_time,
      wc.expected_end_time,
      wc.warehouse_id,
      cm.first_name || ' ' || cm.last_name as crew_name
    FROM warehouse_checkins wc
    LEFT JOIN crew_members cm ON cm.id = wc.crew_id
    WHERE wc.status = 'active'
      AND wc.expected_end_time IS NOT NULL
      AND wc.date <= CURRENT_DATE
      AND (
        (wc.date = CURRENT_DATE AND CURRENT_TIME > wc.expected_end_time + INTERVAL '30 minutes')
        OR
        (wc.date < CURRENT_DATE)
      )
  LOOP
    -- Calcola l'orario di checkout
    IF checkout_record.date = CURRENT_DATE THEN
      UPDATE warehouse_checkins
      SET 
        check_out_time = checkout_record.expected_end_time + INTERVAL '30 minutes',
        status = 'completed',
        auto_checkout = true,
        auto_checkout_time = now()
      WHERE id = checkout_record.id;
    ELSE
      UPDATE warehouse_checkins
      SET 
        check_out_time = checkout_record.expected_end_time,
        status = 'completed',
        auto_checkout = true,
        auto_checkout_time = now()
      WHERE id = checkout_record.id;
    END IF;

    -- Calcola le ore lavorate
    calculated_hours := EXTRACT(EPOCH FROM (
      (checkout_record.expected_end_time + 
        CASE 
          WHEN checkout_record.date = CURRENT_DATE THEN INTERVAL '30 minutes'
          ELSE INTERVAL '0 minutes'
        END
      ) - checkout_record.check_in_time
    )) / 3600.0;

    -- Calcola la pausa standard
    IF calculated_hours >= 6 THEN
      calculated_break := 60;
      calculated_hours := calculated_hours - 1;
    ELSE
      calculated_break := 0;
    END IF;

    -- Calcola straordinari (oltre le 8 ore nette)
    IF calculated_hours > 8 THEN
      overtime_hours := calculated_hours - 8;
      overtime_minutes := ROUND((overtime_hours * 60)::numeric);
      -- APPLICA LA REGOLA: arrotonda per difetto a multipli di 30
      overtime_minutes_requestable := calculate_requestable_overtime(overtime_minutes);
    ELSE
      overtime_hours := 0;
      overtime_minutes := 0;
      overtime_minutes_requestable := 0;
    END IF;

    -- Aggiorna i dati calcolati
    UPDATE warehouse_checkins
    SET 
      total_hours = calculated_hours,
      pausa_pranzo_minuti = calculated_break,
      overtime_hours = overtime_hours,
      overtime_minutes = overtime_minutes,
      overtime_minutes_requestable = overtime_minutes_requestable
    WHERE id = checkout_record.id;

    -- Crea notifica con i minuti richiedibili
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      is_read,
      created_at
    ) VALUES (
      checkout_record.crew_id,
      'payment_update',
      'Checkout Automatico Completato',
      'Il tuo turno del ' || TO_CHAR(checkout_record.date, 'DD/MM/YYYY') || 
      ' è stato chiuso automaticamente alle ' || 
      TO_CHAR(
        checkout_record.expected_end_time + 
        CASE 
          WHEN checkout_record.date = CURRENT_DATE THEN INTERVAL '30 minutes'
          ELSE INTERVAL '0 minutes'
        END, 
        'HH24:MI'
      ) || 
      '. Ore lavorate: ' || ROUND(calculated_hours, 2) || 'h' ||
      CASE 
        WHEN overtime_minutes_requestable > 0 THEN ' (Straordinari richiedibili: ' || overtime_minutes_requestable || ' min)'
        WHEN overtime_minutes > 0 AND overtime_minutes_requestable = 0 THEN ' (Straordinari non richiedibili: meno di 30 min)'
        ELSE ''
      END,
      false,
      now()
    );

  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aggiorna la funzione di auto-close eventi per applicare la regola
CREATE OR REPLACE FUNCTION auto_close_event_checkouts()
RETURNS void AS $$
DECLARE
  checkout_record RECORD;
  calculated_hours numeric(5,2);
  calculated_minutes integer;
  total_break_minutes integer;
  net_hours numeric(5,2);
  net_minutes integer;
  overtime_hours numeric(5,2);
  overtime_minutes integer;
  overtime_minutes_requestable integer;
  checkout_time time;
BEGIN
  SET TIMEZONE TO 'Europe/Rome';
  
  FOR checkout_record IN
    SELECT 
      esc.id,
      esc.crew_id,
      esc.date,
      esc.check_in_time,
      esc.pausa_pranzo_minuti,
      esc.pausa_cena_minuti,
      esc.pausa_totale_minuti,
      cm.first_name || ' ' || cm.last_name as crew_name
    FROM extra_shifts_checkins esc
    LEFT JOIN crew_members cm ON cm.id = esc.crew_id
    WHERE esc.status = 'active'
      AND (
        esc.date < CURRENT_DATE
        OR
        (esc.date = CURRENT_DATE AND CURRENT_TIME >= '23:59:00'::time)
      )
  LOOP
    checkout_time := '23:59:00'::time;
    
    calculated_minutes := EXTRACT(EPOCH FROM (checkout_time - checkout_record.check_in_time)) / 60;
    
    total_break_minutes := COALESCE(checkout_record.pausa_pranzo_minuti, 0) + 
                          COALESCE(checkout_record.pausa_cena_minuti, 0);
    
    IF checkout_record.pausa_totale_minuti IS NOT NULL AND checkout_record.pausa_totale_minuti > 0 THEN
      total_break_minutes := checkout_record.pausa_totale_minuti;
    END IF;
    
    net_minutes := calculated_minutes - total_break_minutes;
    
    IF net_minutes < 0 THEN
      net_minutes := 0;
    END IF;
    
    calculated_hours := calculated_minutes / 60.0;
    net_hours := net_minutes / 60.0;
    
    -- Calcola straordinari con la regola dei 30 minuti
    IF net_hours > 8 THEN
      overtime_hours := net_hours - 8;
      overtime_minutes := ROUND((overtime_hours * 60)::numeric);
      -- APPLICA LA REGOLA: arrotonda per difetto a multipli di 30
      overtime_minutes_requestable := calculate_requestable_overtime(overtime_minutes);
    ELSE
      overtime_hours := 0;
      overtime_minutes := 0;
      overtime_minutes_requestable := 0;
    END IF;
    
    UPDATE extra_shifts_checkins
    SET 
      check_out_time = checkout_time,
      status = 'completed',
      auto_checkout = true,
      auto_checkout_time = now(),
      total_hours = calculated_hours,
      total_minutes = calculated_minutes,
      net_hours = net_hours,
      net_minutes = net_minutes,
      overtime_hours = overtime_hours,
      overtime_minutes = overtime_minutes,
      overtime_minutes_requestable = overtime_minutes_requestable,
      pausa_totale_minuti = total_break_minutes
    WHERE id = checkout_record.id;
    
    -- Notifica con i minuti richiedibili
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      is_read,
      created_at
    ) VALUES (
      checkout_record.crew_id,
      'payment_update',
      'Checkout Automatico Evento',
      'Il tuo check-in evento del ' || TO_CHAR(checkout_record.date, 'DD/MM/YYYY') || 
      ' è stato chiuso automaticamente alle 23:59. ' ||
      'Ore lavorate: ' || ROUND(net_hours, 2) || 'h' ||
      CASE 
        WHEN total_break_minutes > 0 THEN ' (pausa: ' || total_break_minutes || ' min)'
        ELSE ''
      END ||
      CASE 
        WHEN overtime_minutes_requestable > 0 THEN '. Straordinari richiedibili: ' || overtime_minutes_requestable || ' min'
        WHEN overtime_minutes > 0 AND overtime_minutes_requestable = 0 THEN '. Straordinari non richiedibili (meno di 30 min)'
        ELSE ''
      END,
      false,
      now()
    );

  END LOOP;
  
  RESET TIMEZONE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aggiorna i record esistenti per calcolare i minuti richiedibili
UPDATE warehouse_checkins
SET overtime_minutes_requestable = calculate_requestable_overtime(COALESCE(overtime_minutes, 0))
WHERE overtime_minutes IS NOT NULL AND overtime_minutes > 0;

UPDATE extra_shifts_checkins
SET overtime_minutes_requestable = calculate_requestable_overtime(COALESCE(overtime_minutes, 0))
WHERE overtime_minutes IS NOT NULL AND overtime_minutes > 0;

-- Commenti
COMMENT ON COLUMN warehouse_checkins.overtime_minutes_requestable IS 'Minuti straordinari richiedibili (arrotondati per difetto a multipli di 30)';
COMMENT ON COLUMN extra_shifts_checkins.overtime_minutes_requestable IS 'Minuti straordinari richiedibili (arrotondati per difetto a multipli di 30)';
COMMENT ON FUNCTION calculate_requestable_overtime(integer) IS 'Calcola i minuti straordinari richiedibili arrotondando per difetto a multipli di 30';
