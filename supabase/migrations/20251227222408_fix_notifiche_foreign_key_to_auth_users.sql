/*
  # Fix notifiche Foreign Key to auth.users

  ## Descrizione
  Corregge la foreign key di notifiche.id_utente per puntare a auth.users
  invece di utenti, perché i crew members sono registrati in auth.users
  e non nella tabella utenti.
  
  ## Modifiche
  - Rimuove la foreign key verso utenti.id
  - Aggiunge la foreign key verso auth.users.id
  - Aggiorna il trigger notify_urgent_talk per non verificare utenti
*/

-- Rimuovi la foreign key esistente verso utenti
ALTER TABLE notifiche DROP CONSTRAINT IF EXISTS notifiche_id_utente_fkey;

-- Aggiungi la foreign key verso auth.users
ALTER TABLE notifiche 
ADD CONSTRAINT notifiche_id_utente_fkey 
FOREIGN KEY (id_utente) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- Aggiorna il trigger per non verificare la tabella utenti
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
