/*
  # Fix notify_urgent_talk trigger column names

  ## Descrizione
  Corregge il trigger notify_urgent_talk per usare i nomi corretti delle colonne
  della tabella notifiche (id_utente invece di user_id, data_creazione invece di created_at)

  ## Modifiche
  - Aggiorna la funzione notify_urgent_talk con i nomi corretti delle colonne
*/

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

    -- Inserisci notifica nella tabella notifiche con i nomi colonna corretti
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
      'talk',
      'high',
      false,
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;