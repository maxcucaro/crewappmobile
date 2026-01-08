/*
  # Auto-Chiusura Automatica Check-in Eventi
  
  1. Funzionalità
    - Chiude automaticamente i check-in degli eventi (extra_shifts_checkins) alle ore 23:59 del giorno stesso
    - Utilizza il timezone italiano (Europe/Rome)
    - Invia notifica automatica al dipendente quando il check-in viene chiuso automaticamente
    - Calcola automaticamente le ore lavorate e le pause
  
  2. Schema Changes
    - Aggiungi colonna `auto_checkout` (boolean) a `extra_shifts_checkins`
    - Aggiungi colonna `auto_checkout_time` (timestamptz) a `extra_shifts_checkins`
  
  3. Function
    - `auto_close_event_checkouts()` - Funzione che chiude automaticamente i check-in eventi aperti alle 23:59
    - Viene eseguita periodicamente per trovare check-in attivi da chiudere
    - Crea notifica per ogni check-in chiuso automaticamente
  
  4. Sicurezza
    - Non modifica nessuna funzionalità esistente
    - Aggiunge solo nuove colonne e una nuova funzione
*/

-- Aggiungi colonne per tracciare la chiusura automatica
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extra_shifts_checkins' AND column_name = 'auto_checkout'
  ) THEN
    ALTER TABLE extra_shifts_checkins ADD COLUMN auto_checkout boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extra_shifts_checkins' AND column_name = 'auto_checkout_time'
  ) THEN
    ALTER TABLE extra_shifts_checkins ADD COLUMN auto_checkout_time timestamptz;
  END IF;
END $$;

-- Funzione per chiudere automaticamente i check-in eventi aperti alle 23:59
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
  checkout_time time;
BEGIN
  -- Imposta il timezone a Europe/Rome per questo contesto
  SET TIMEZONE TO 'Europe/Rome';
  
  -- Trova tutti i check-in eventi attivi che dovrebbero essere chiusi
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
        -- Se la data è passata, chiudi immediatamente
        esc.date < CURRENT_DATE
        OR
        -- Se è oggi e sono le 23:59 o oltre, chiudi
        (esc.date = CURRENT_DATE AND CURRENT_TIME >= '23:59:00'::time)
      )
  LOOP
    -- Imposta l'orario di checkout a 23:59
    checkout_time := '23:59:00'::time;
    
    -- Calcola le ore lavorate totali (da check_in a 23:59)
    calculated_minutes := EXTRACT(EPOCH FROM (checkout_time - checkout_record.check_in_time)) / 60;
    
    -- Calcola il totale delle pause
    total_break_minutes := COALESCE(checkout_record.pausa_pranzo_minuti, 0) + 
                          COALESCE(checkout_record.pausa_cena_minuti, 0);
    
    -- Se pausa_totale_minuti è valorizzato, usalo al posto della somma
    IF checkout_record.pausa_totale_minuti IS NOT NULL AND checkout_record.pausa_totale_minuti > 0 THEN
      total_break_minutes := checkout_record.pausa_totale_minuti;
    END IF;
    
    -- Calcola i minuti netti (totale - pause)
    net_minutes := calculated_minutes - total_break_minutes;
    
    -- Se i minuti netti sono negativi, imposta a 0
    IF net_minutes < 0 THEN
      net_minutes := 0;
    END IF;
    
    -- Converti in ore
    calculated_hours := calculated_minutes / 60.0;
    net_hours := net_minutes / 60.0;
    
    -- Calcola straordinari (oltre le 8 ore nette)
    IF net_hours > 8 THEN
      overtime_hours := net_hours - 8;
      overtime_minutes := ROUND((overtime_hours * 60)::numeric);
    ELSE
      overtime_hours := 0;
      overtime_minutes := 0;
    END IF;
    
    -- Aggiorna il check-in con i dati calcolati
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
      pausa_totale_minuti = total_break_minutes
    WHERE id = checkout_record.id;
    
    -- Crea notifica per il dipendente
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
        WHEN overtime_hours > 0 THEN '. Straordinari: ' || ROUND(overtime_hours, 2) || 'h'
        ELSE ''
      END,
      false,
      now()
    );

  END LOOP;
  
  -- Ripristina il timezone di default
  RESET TIMEZONE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commenti sulle nuove colonne
COMMENT ON COLUMN extra_shifts_checkins.auto_checkout IS 'Indica se il checkout è stato chiuso automaticamente dal sistema alle 23:59';
COMMENT ON COLUMN extra_shifts_checkins.auto_checkout_time IS 'Timestamp della chiusura automatica';

-- Commento sulla funzione
COMMENT ON FUNCTION auto_close_event_checkouts() IS 'Chiude automaticamente i check-in eventi attivi alle 23:59 (orario italiano) e invia notifiche';
