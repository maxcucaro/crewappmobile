/*
  # Auto-Chiusura Automatica Check-in Eventi (timesheet_entries)
  
  1. Funzionalità
    - Chiude automaticamente i check-in degli eventi (timesheet_entries) alle ore 23:59 del giorno stesso
    - Utilizza il timezone italiano (Europe/Rome)
    - Invia notifica automatica al dipendente quando il check-in viene chiuso automaticamente
    - Popola automaticamente i benefit anche se il checkout non è stato fatto manualmente
  
  2. Schema Changes
    - Aggiungi colonna `auto_checkout` (boolean) a `timesheet_entries`
    - Aggiungi colonna `auto_checkout_time` (timestamptz) a `timesheet_entries`
  
  3. Function
    - `auto_close_event_timesheet_checkouts()` - Funzione che chiude automaticamente i check-in eventi aperti alle 23:59
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
    WHERE table_name = 'timesheet_entries' AND column_name = 'auto_checkout'
  ) THEN
    ALTER TABLE timesheet_entries ADD COLUMN auto_checkout boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'timesheet_entries' AND column_name = 'auto_checkout_time'
  ) THEN
    ALTER TABLE timesheet_entries ADD COLUMN auto_checkout_time timestamptz;
  END IF;
END $$;

-- Funzione per chiudere automaticamente i check-in eventi aperti alle 23:59
CREATE OR REPLACE FUNCTION auto_close_event_timesheet_checkouts()
RETURNS void AS $$
DECLARE
  checkout_record RECORD;
  checkout_time time;
BEGIN
  -- Imposta il timezone a Europe/Rome per questo contesto
  SET TIMEZONE TO 'Europe/Rome';
  
  -- Trova tutti i check-in eventi attivi che dovrebbero essere chiusi
  FOR checkout_record IN
    SELECT 
      te.id,
      te.crew_id,
      te.event_id,
      te.date,
      te.start_time,
      cm.first_name || ' ' || cm.last_name as crew_name,
      cea.nome_evento
    FROM timesheet_entries te
    LEFT JOIN crew_members cm ON cm.id = te.crew_id
    LEFT JOIN crew_event_assegnazione cea ON cea.evento_id = te.event_id AND cea.dipendente_freelance_id = te.crew_id
    WHERE te.event_id IS NOT NULL
      AND te.end_time IS NULL
      AND (
        -- Se la data è passata, chiudi immediatamente
        te.date < CURRENT_DATE
        OR
        -- Se è oggi e sono le 23:59 o oltre, chiudi
        (te.date = CURRENT_DATE AND CURRENT_TIME >= '23:59:00'::time)
      )
  LOOP
    -- Imposta l'orario di checkout a 23:59
    checkout_time := '23:59:00'::time;
    
    -- Aggiorna il timesheet entry con il checkout automatico
    UPDATE timesheet_entries
    SET 
      end_time = checkout_time,
      status = 'submitted',
      auto_checkout = true,
      auto_checkout_time = now()
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
      'Il tuo check-in per l''evento "' || COALESCE(checkout_record.nome_evento, 'Evento') || 
      '" del ' || TO_CHAR(checkout_record.date, 'DD/MM/YYYY') || 
      ' è stato chiuso automaticamente alle 23:59.',
      false,
      now()
    );

  END LOOP;
  
  -- Ripristina il timezone di default
  RESET TIMEZONE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commenti sulle nuove colonne
COMMENT ON COLUMN timesheet_entries.auto_checkout IS 'Indica se il checkout è stato chiuso automaticamente dal sistema alle 23:59';
COMMENT ON COLUMN timesheet_entries.auto_checkout_time IS 'Timestamp della chiusura automatica';

-- Commento sulla funzione
COMMENT ON FUNCTION auto_close_event_timesheet_checkouts() IS 'Chiude automaticamente i check-in eventi (timesheet_entries) attivi alle 23:59 (orario italiano) e invia notifiche';