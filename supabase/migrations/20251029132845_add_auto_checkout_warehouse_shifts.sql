/*
  # Chiusura Automatica Checkout Magazzino
  
  1. Funzionalità
    - Chiude automaticamente i checkout dei turni magazzino 30 minuti dopo l'orario di fine previsto
    - Invia notifica automatica al dipendente quando il checkout viene chiuso automaticamente
    - Calcola automaticamente le ore lavorate e gli straordinari
  
  2. Schema Changes
    - Aggiungi colonna `auto_checkout` (boolean) a `warehouse_checkins`
    - Aggiungi colonna `auto_checkout_time` (timestamptz) a `warehouse_checkins`
    - Aggiungi colonna `expected_end_time` (time) a `warehouse_checkins`
  
  3. Function
    - `auto_close_warehouse_checkouts()` - Funzione che chiude automaticamente i checkout scaduti
    - Viene eseguita periodicamente per trovare checkout attivi oltre il timeout
    - Crea notifica per ogni checkout chiuso automaticamente
  
  4. Trigger
    - Trigger per popolare `expected_end_time` al momento del check-in
*/

-- Aggiungi colonne per tracciare la chiusura automatica
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_checkins' AND column_name = 'auto_checkout'
  ) THEN
    ALTER TABLE warehouse_checkins ADD COLUMN auto_checkout boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_checkins' AND column_name = 'auto_checkout_time'
  ) THEN
    ALTER TABLE warehouse_checkins ADD COLUMN auto_checkout_time timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_checkins' AND column_name = 'expected_end_time'
  ) THEN
    ALTER TABLE warehouse_checkins ADD COLUMN expected_end_time time;
  END IF;
END $$;

-- Funzione per popolare expected_end_time al check-in
CREATE OR REPLACE FUNCTION set_expected_end_time()
RETURNS TRIGGER AS $$
BEGIN
  -- Cerca il turno assegnato per questo dipendente e magazzino nella data del check-in
  SELECT ws.end_time INTO NEW.expected_end_time
  FROM warehouse_shifts ws
  INNER JOIN warehouse_shift_assignments wsa ON ws.id = wsa.shift_id
  WHERE wsa.employee_id = NEW.crew_id
    AND ws.warehouse_id = NEW.warehouse_id
    AND ws.date = NEW.date
  LIMIT 1;
  
  -- Se non trova un turno specifico, usa un orario di default (18:00)
  IF NEW.expected_end_time IS NULL THEN
    NEW.expected_end_time := '18:00:00'::time;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger per impostare expected_end_time al check-in
DROP TRIGGER IF EXISTS set_expected_end_time_trigger ON warehouse_checkins;
CREATE TRIGGER set_expected_end_time_trigger
  BEFORE INSERT ON warehouse_checkins
  FOR EACH ROW
  WHEN (NEW.status = 'active')
  EXECUTE FUNCTION set_expected_end_time();

-- Funzione per chiudere automaticamente i checkout scaduti
CREATE OR REPLACE FUNCTION auto_close_warehouse_checkouts()
RETURNS void AS $$
DECLARE
  checkout_record RECORD;
  calculated_hours numeric(5,2);
  calculated_break integer;
  overtime_hours numeric(5,2);
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
        -- Se è oggi, controlla se sono passati 30 minuti dalla fine prevista
        (wc.date = CURRENT_DATE AND CURRENT_TIME > wc.expected_end_time + INTERVAL '30 minutes')
        OR
        -- Se è un giorno passato, chiudi immediatamente
        (wc.date < CURRENT_DATE)
      )
  LOOP
    -- Calcola l'orario di checkout (orario previsto + 30 minuti o ora attuale se giorno passato)
    IF checkout_record.date = CURRENT_DATE THEN
      -- Checkout automatico all'orario previsto + 30 minuti
      UPDATE warehouse_checkins
      SET 
        check_out_time = checkout_record.expected_end_time + INTERVAL '30 minutes',
        status = 'completed',
        auto_checkout = true,
        auto_checkout_time = now()
      WHERE id = checkout_record.id;
    ELSE
      -- Per giorni passati, usa l'orario previsto
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

    -- Calcola la pausa standard (1 ora se il turno è >= 6 ore)
    IF calculated_hours >= 6 THEN
      calculated_break := 60;
      calculated_hours := calculated_hours - 1;
    ELSE
      calculated_break := 0;
    END IF;

    -- Calcola straordinari (oltre le 8 ore nette)
    IF calculated_hours > 8 THEN
      overtime_hours := calculated_hours - 8;
    ELSE
      overtime_hours := 0;
    END IF;

    -- Aggiorna i dati calcolati
    UPDATE warehouse_checkins
    SET 
      total_hours = calculated_hours,
      pausa_pranzo_minuti = calculated_break,
      overtime_hours = overtime_hours
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
        WHEN overtime_hours > 0 THEN ' (inclusi ' || ROUND(overtime_hours, 2) || 'h di straordinari)'
        ELSE ''
      END,
      false,
      now()
    );

  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commenti sulle nuove colonne
COMMENT ON COLUMN warehouse_checkins.auto_checkout IS 'Indica se il checkout è stato chiuso automaticamente dal sistema';
COMMENT ON COLUMN warehouse_checkins.auto_checkout_time IS 'Timestamp della chiusura automatica';
COMMENT ON COLUMN warehouse_checkins.expected_end_time IS 'Orario di fine turno previsto (popolato dal turno assegnato)';

-- Commento sulla funzione
COMMENT ON FUNCTION auto_close_warehouse_checkouts() IS 'Chiude automaticamente i checkout attivi 30 minuti dopo l''orario di fine previsto e invia notifiche';
