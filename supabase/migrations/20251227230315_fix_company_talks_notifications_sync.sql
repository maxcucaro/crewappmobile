/*
  # Fix Company Talks - Notifiche Sync

  ## Descrizione
  Collega le notifiche urgenti ai company_talks per sincronizzare lo stato di lettura

  ## Modifiche
  1. Aggiungi colonna `talk_id` alla tabella `notifiche` per collegare le notifiche ai messaggi
  2. Fix trigger `notify_urgent_talk` per usare colonne corrette e salvare talk_id
  3. Update `mark_notification_read` per segnare come letto anche il company_talk
  4. Update `mark_talk_as_read` per segnare come letta anche la notifica
*/

-- Aggiungi colonna talk_id alla tabella notifiche
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifiche' AND column_name = 'talk_id'
  ) THEN
    ALTER TABLE notifiche ADD COLUMN talk_id uuid REFERENCES company_talks(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_notifiche_talk_id ON notifiche(talk_id);
  END IF;
END $$;

-- Fix trigger per usare colonne corrette e salvare talk_id
CREATE OR REPLACE FUNCTION notify_urgent_talk()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recipient_name text;
  v_company_name text;
BEGIN
  IF NEW.is_urgent = true AND NEW.recipient_id IS NOT NULL THEN
    SELECT COALESCE(full_name, first_name || ' ' || last_name, email)
    INTO v_recipient_name
    FROM crew_members
    WHERE id = NEW.recipient_id;
    
    IF v_recipient_name IS NULL THEN
      SELECT email INTO v_recipient_name
      FROM auth.users
      WHERE id = NEW.recipient_id;
    END IF;
    
    SELECT ragione_sociale INTO v_company_name
    FROM company_profiles
    WHERE id = NEW.sender_company_id;
    
    INSERT INTO notifiche (
      id_utente,
      titolo,
      messaggio,
      tipo,
      priorita,
      stato,
      talk_id,
      created_at
    ) VALUES (
      NEW.recipient_id,
      'Messaggio Urgente da ' || COALESCE(v_company_name, 'Azienda'),
      CASE 
        WHEN NEW.message_type = 'text' THEN LEFT(NEW.message_text, 100)
        WHEN NEW.message_type = 'audio' THEN 'Messaggio vocale'
        WHEN NEW.message_type = 'image' THEN 'Immagine allegata'
        ELSE 'File allegato: ' || COALESCE(NEW.file_name, 'documento')
      END,
      'talk',
      'urgente',
      'non_letta',
      NEW.id,
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_urgent_talk ON company_talks;
CREATE TRIGGER trigger_notify_urgent_talk
  AFTER INSERT ON company_talks
  FOR EACH ROW
  EXECUTE FUNCTION notify_urgent_talk();

-- Update mark_notification_read per segnare come letto anche il company_talk
CREATE OR REPLACE FUNCTION mark_notification_read(p_notifica_id uuid, p_user_id uuid)
RETURNS boolean AS $$
DECLARE
  v_updated boolean;
  v_talk_id uuid;
BEGIN
  SELECT talk_id INTO v_talk_id
  FROM notifiche
  WHERE id = p_notifica_id AND id_utente = p_user_id;
  
  UPDATE notifiche
  SET 
    stato = 'letta',
    read_at = NOW()
  WHERE id = p_notifica_id
    AND id_utente = p_user_id
    AND (stato = 'non_letta' OR stato IS NULL);
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  
  IF v_updated > 0 AND v_talk_id IS NOT NULL THEN
    UPDATE company_talks
    SET is_read = true,
        read_at = NOW()
    WHERE id = v_talk_id
      AND recipient_id = p_user_id
      AND is_read = false;
  END IF;
  
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update mark_talk_as_read per segnare come letta anche la notifica
CREATE OR REPLACE FUNCTION mark_talk_as_read(talk_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE company_talks
  SET is_read = true,
      read_at = now()
  WHERE id = talk_id
  AND recipient_id = auth.uid()
  AND is_read = false;
  
  UPDATE notifiche
  SET stato = 'letta',
      read_at = now()
  WHERE talk_id = mark_talk_as_read.talk_id
    AND id_utente = auth.uid()
    AND stato = 'non_letta';
END;
$$;

COMMENT ON COLUMN notifiche.talk_id IS 'Collegamento al messaggio in company_talks (per messaggi urgenti)';
