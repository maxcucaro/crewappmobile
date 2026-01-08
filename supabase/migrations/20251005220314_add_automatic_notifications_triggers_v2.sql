/*
  # Sistema Notifiche Automatiche

  1. Trigger per Notifiche Automatiche
    - Nuovi turni assegnati (eventi e magazzino)
    - Modifiche a turni esistenti
    - Approvazione/rifiuto note spese
    - Approvazione/rifiuto straordinari
    - Nuovi documenti caricati

  2. Funzioni Helper
    - Funzione per creare notifiche standard
    - Funzione per ottenere nome dipendente
    - Funzione per formattare date in italiano

  3. Tipi di Notifiche
    - normale: Notifiche informative
    - urgente: Richiedono attenzione immediata
    - info: Informazioni generali
*/

-- ===================================
-- FUNZIONI HELPER
-- ===================================

-- Funzione per creare una notifica
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id uuid,
  p_tipo text,
  p_titolo text,
  p_messaggio text,
  p_url_azione text DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO notifiche (
    id,
    id_utente,
    tipo,
    titolo,
    messaggio,
    letta,
    url_azione,
    data_creazione
  ) VALUES (
    gen_random_uuid(),
    p_user_id,
    p_tipo,
    p_titolo,
    p_messaggio,
    false,
    p_url_azione,
    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funzione per ottenere nome dipendente da auth user
CREATE OR REPLACE FUNCTION get_employee_name(p_user_id uuid) 
RETURNS text AS $$
DECLARE
  v_name text;
BEGIN
  SELECT COALESCE(full_name, email) INTO v_name
  FROM registration_requests
  WHERE id = p_user_id OR email = (SELECT email FROM auth.users WHERE id = p_user_id);
  
  RETURN COALESCE(v_name, 'Dipendente');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================
-- TRIGGER: NUOVI TURNI EVENTI
-- ===================================

CREATE OR REPLACE FUNCTION notify_new_event_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_event_title text;
  v_event_date date;
  v_event_location text;
BEGIN
  -- Ottieni informazioni evento
  SELECT titolo, data_evento, luogo
  INTO v_event_title, v_event_date, v_event_location
  FROM crew_events
  WHERE id = NEW.evento_id;

  -- Crea notifica per il dipendente
  PERFORM create_notification(
    NEW.dipendente_freelance_id,
    'normale',
    'Nuovo Turno Assegnato',
    'Sei stato assegnato all''evento "' || v_event_title || '" il ' || 
    TO_CHAR(v_event_date, 'DD/MM/YYYY') || ' presso ' || v_event_location,
    '/calendar'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_new_event_assignment ON crew_event_assegnazione;
CREATE TRIGGER trigger_notify_new_event_assignment
  AFTER INSERT ON crew_event_assegnazione
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_event_assignment();

-- ===================================
-- TRIGGER: NUOVI TURNI MAGAZZINO
-- ===================================

CREATE OR REPLACE FUNCTION notify_new_warehouse_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Crea notifica per il dipendente
  PERFORM create_notification(
    NEW.dipendente_id,
    'normale',
    'Nuovo Turno Magazzino Assegnato',
    'Sei stato assegnato al turno "' || COALESCE(NEW.nome_turno, 'Turno') || '" presso ' || 
    NEW.nome_magazzino || ' il ' || TO_CHAR(NEW.data_turno, 'DD/MM/YYYY') ||
    ' dalle ' || TO_CHAR(NEW.ora_inizio_turno, 'HH24:MI') || 
    ' alle ' || TO_CHAR(NEW.ora_fine_turno, 'HH24:MI'),
    '/calendar'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_new_warehouse_assignment ON crew_assegnazione_turni;
CREATE TRIGGER trigger_notify_new_warehouse_assignment
  AFTER INSERT ON crew_assegnazione_turni
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_warehouse_assignment();

-- ===================================
-- TRIGGER: MODIFICHE TURNI EVENTI
-- ===================================

CREATE OR REPLACE FUNCTION notify_event_assignment_update()
RETURNS TRIGGER AS $$
DECLARE
  v_event_title text;
  v_message text;
BEGIN
  -- Solo se cambiano campi rilevanti
  IF (OLD.ruolo_evento IS DISTINCT FROM NEW.ruolo_evento OR
      OLD.paga_oraria IS DISTINCT FROM NEW.paga_oraria OR
      OLD.stato IS DISTINCT FROM NEW.stato) THEN
    
    SELECT titolo INTO v_event_title
    FROM crew_events
    WHERE id = NEW.evento_id;

    v_message := 'Il tuo turno per "' || v_event_title || '" è stato aggiornato.';
    
    IF OLD.stato IS DISTINCT FROM NEW.stato THEN
      v_message := v_message || ' Stato: ' || NEW.stato || '.';
    END IF;

    PERFORM create_notification(
      NEW.dipendente_freelance_id,
      'info',
      'Turno Modificato',
      v_message,
      '/calendar'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_event_assignment_update ON crew_event_assegnazione;
CREATE TRIGGER trigger_notify_event_assignment_update
  AFTER UPDATE ON crew_event_assegnazione
  FOR EACH ROW
  EXECUTE FUNCTION notify_event_assignment_update();

-- ===================================
-- TRIGGER: APPROVAZIONE NOTE SPESE
-- ===================================

CREATE OR REPLACE FUNCTION notify_expense_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_message text;
  v_tipo text;
  v_event_or_shift text;
BEGIN
  -- Solo se lo stato cambia
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('approved', 'rejected') THEN
    
    -- Determina se è evento o turno magazzino
    IF NEW.event_id IS NOT NULL THEN
      SELECT titolo INTO v_event_or_shift FROM crew_events WHERE id = NEW.event_id;
    ELSIF NEW.warehouse_shift_id IS NOT NULL THEN
      SELECT COALESCE(nome_turno, 'Turno') || ' - ' || nome_magazzino INTO v_event_or_shift 
      FROM crew_assegnazione_turni WHERE id = NEW.warehouse_shift_id;
    ELSE
      v_event_or_shift := 'Turno';
    END IF;

    IF NEW.status = 'approved' THEN
      v_tipo := 'normale';
      v_message := 'La tua nota spesa di €' || NEW.amount || ' per "' || v_event_or_shift || '" è stata approvata.';
    ELSE
      v_tipo := 'urgente';
      v_message := 'La tua nota spesa di €' || NEW.amount || ' per "' || v_event_or_shift || '" è stata rifiutata.';
    END IF;

    PERFORM create_notification(
      NEW.crew_id,
      v_tipo,
      CASE WHEN NEW.status = 'approved' THEN 'Nota Spesa Approvata' ELSE 'Nota Spesa Rifiutata' END,
      v_message,
      '/expenses'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_expense_status_change ON expenses;
CREATE TRIGGER trigger_notify_expense_status_change
  AFTER UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION notify_expense_status_change();

-- ===================================
-- TRIGGER: APPROVAZIONE STRAORDINARI
-- ===================================

CREATE OR REPLACE FUNCTION notify_overtime_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_message text;
  v_tipo text;
BEGIN
  -- Solo se lo stato cambia
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('approved', 'rejected') THEN
    
    IF NEW.status = 'approved' THEN
      v_tipo := 'normale';
      v_message := 'La tua richiesta straordinari del ' || TO_CHAR(NEW.date, 'DD/MM/YYYY') || 
                   ' per ' || NEW.hours || ' ore è stata approvata.';
    ELSE
      v_tipo := 'urgente';
      v_message := 'La tua richiesta straordinari del ' || TO_CHAR(NEW.date, 'DD/MM/YYYY') || 
                   ' per ' || NEW.hours || ' ore è stata rifiutata.';
    END IF;

    PERFORM create_notification(
      NEW.crew_member_id,
      v_tipo,
      CASE WHEN NEW.status = 'approved' THEN 'Straordinari Approvati' ELSE 'Straordinari Rifiutati' END,
      v_message,
      '/overtime'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verifica se la tabella esiste
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'overtime_requests') THEN
    DROP TRIGGER IF EXISTS trigger_notify_overtime_status_change ON overtime_requests;
    CREATE TRIGGER trigger_notify_overtime_status_change
      AFTER UPDATE ON overtime_requests
      FOR EACH ROW
      EXECUTE FUNCTION notify_overtime_status_change();
  END IF;
END $$;

-- ===================================
-- TRIGGER: RICHIESTE STRAORDINARI ITALIANE
-- ===================================

CREATE OR REPLACE FUNCTION notify_richieste_straordinari_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_message text;
  v_tipo text;
BEGIN
  -- Solo se lo stato cambia
  IF OLD.stato IS DISTINCT FROM NEW.stato AND NEW.stato IN ('approvata', 'rifiutata') THEN
    
    IF NEW.stato = 'approvata' THEN
      v_tipo := 'normale';
      v_message := 'La tua richiesta straordinari di ' || NEW.ore_straordinario || ' ore è stata approvata.';
    ELSE
      v_tipo := 'urgente';
      v_message := 'La tua richiesta straordinari di ' || NEW.ore_straordinario || ' ore è stata rifiutata.';
    END IF;

    PERFORM create_notification(
      NEW.dipendente_id,
      v_tipo,
      CASE WHEN NEW.stato = 'approvata' THEN 'Straordinari Approvati' ELSE 'Straordinari Rifiutati' END,
      v_message,
      '/overtime'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_richieste_straordinari_status ON richieste_straordinari;
CREATE TRIGGER trigger_notify_richieste_straordinari_status
  AFTER UPDATE ON richieste_straordinari
  FOR EACH ROW
  EXECUTE FUNCTION notify_richieste_straordinari_status_change();

-- ===================================
-- COMMENTI PER DOCUMENTAZIONE
-- ===================================

COMMENT ON FUNCTION create_notification IS 'Crea una notifica nella tabella notifiche per un utente specifico';
COMMENT ON FUNCTION get_employee_name IS 'Ottiene il nome del dipendente dal suo user_id';
COMMENT ON FUNCTION notify_new_event_assignment IS 'Notifica dipendente quando viene assegnato a un nuovo evento';
COMMENT ON FUNCTION notify_new_warehouse_assignment IS 'Notifica dipendente quando viene assegnato a un nuovo turno magazzino';
COMMENT ON FUNCTION notify_event_assignment_update IS 'Notifica dipendente quando un turno evento viene modificato';
COMMENT ON FUNCTION notify_expense_status_change IS 'Notifica dipendente quando una nota spesa viene approvata/rifiutata';
COMMENT ON FUNCTION notify_overtime_status_change IS 'Notifica dipendente quando una richiesta straordinari viene approvata/rifiutata';
