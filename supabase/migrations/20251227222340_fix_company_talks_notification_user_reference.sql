/*
  # Fix Company Talks Notification User Reference

  ## Descrizione
  Corregge il trigger notify_urgent_talk per gestire correttamente la foreign key
  tra notifiche.id_utente (riferisce utenti.id) e company_talks.recipient_id (riferisce auth.users.id).
  
  ## Modifiche
  - Aggiorna notify_urgent_talk per verificare che l'utente esista in utenti prima di creare la notifica
  - Se l'utente non esiste in utenti, la notifica non viene creata (evita errori FK)
*/

CREATE OR REPLACE FUNCTION notify_urgent_talk()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recipient_name text;
  v_company_name text;
  v_user_exists boolean;
BEGIN
  IF NEW.is_urgent = true AND NEW.recipient_id IS NOT NULL THEN
    -- Verifica che l'utente esista nella tabella utenti
    SELECT EXISTS(SELECT 1 FROM utenti WHERE id = NEW.recipient_id) 
    INTO v_user_exists;
    
    -- Se l'utente non esiste in utenti, non creare la notifica
    IF NOT v_user_exists THEN
      RETURN NEW;
    END IF;

    -- Ottieni nome destinatario
    SELECT COALESCE(full_name, first_name || ' ' || last_name, email)
    INTO v_recipient_name
    FROM crew_members
    WHERE id = NEW.recipient_id;

    IF v_recipient_name IS NULL THEN
      SELECT email INTO v_recipient_name
      FROM auth.users
      WHERE id = NEW.recipient_id;
    END IF;

    -- Ottieni nome azienda da regaziendasoftware
    SELECT ragione_sociale INTO v_company_name
    FROM regaziendasoftware
    WHERE id = NEW.sender_company_id;

    -- Inserisci notifica con valori corretti per i constraint
    INSERT INTO notifiche (
      id_utente,
      titolo,
      messaggio,
      tipo,
      priorita,
      letta,
      data_creazione
    ) VALUES (
      NEW.recipient_id,
      'Messaggio Urgente da ' || COALESCE(v_company_name, 'Azienda'),
      CASE
        WHEN NEW.message_type = 'text' THEN LEFT(NEW.message_text, 100)
        WHEN NEW.message_type = 'audio' THEN 'Messaggio vocale'
        WHEN NEW.message_type = 'image' THEN 'Immagine allegata'
        ELSE 'File allegato: ' || COALESCE(NEW.file_name, 'documento')
      END,
      'messaggio_azienda',
      'urgente',
      false,
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;
