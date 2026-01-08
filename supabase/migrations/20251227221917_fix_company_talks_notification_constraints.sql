/*
  # Fix Company Talks Notification Constraints

  ## Descrizione
  Corregge i vincoli e il trigger per i messaggi urgenti da company_talks.
  
  ## Modifiche
  1. Aggiunge 'messaggio_azienda' ai tipi di notifica validi
  2. Corregge la funzione notify_urgent_talk per usare:
     - priorita = 'urgente' invece di 'high'
     - tipo = 'messaggio_azienda' invece di 'talk'
*/

-- Aggiungi il nuovo tipo di notifica al constraint
ALTER TABLE notifiche DROP CONSTRAINT IF EXISTS notifiche_tipo_check;
ALTER TABLE notifiche ADD CONSTRAINT notifiche_tipo_check 
  CHECK (tipo = ANY (ARRAY[
    'scadenza_agibilita'::text, 
    'negoziazione_tariffa'::text, 
    'aggiornamento_pagamento'::text, 
    'assegnazione_evento'::text, 
    'caricamento_documento'::text, 
    'stato_spesa'::text, 
    'stato_straordinario'::text, 
    'invito_corso'::text, 
    'assegnazione_turno_magazzino'::text,
    'messaggio_azienda'::text
  ]));

-- Correggi la funzione per usare i valori corretti
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
