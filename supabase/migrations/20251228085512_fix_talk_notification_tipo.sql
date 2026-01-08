/*
  # Fix Company Talk Notification Type

  ## Descrizione
  Corregge la funzione notify_urgent_talk() per usare il tipo corretto 'messaggio_azienda'
  invece di 'talk' che viola il constraint notifiche_tipo_check.

  ## Problema
  Il constraint notifiche_tipo_check richiede che tipo sia uno dei valori:
  - 'scadenza_agibilita'
  - 'negoziazione_tariffa'
  - 'aggiornamento_pagamento'
  - 'assegnazione_evento'
  - 'caricamento_documento'
  - 'stato_spesa'
  - 'stato_straordinario'
  - 'invito_corso'
  - 'assegnazione_turno_magazzino'
  - 'messaggio_azienda' ✓ (corretto)

  Ma il trigger usava 'talk' ✗ (non valido)

  ## Modifiche
  1. Aggiorna notify_urgent_talk() per usare tipo = 'messaggio_azienda'
  2. Usa le colonne corrette per la tabella notifiche
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
    
    -- Ottieni nome azienda da company_profiles
    SELECT ragione_sociale INTO v_company_name
    FROM company_profiles
    WHERE id = NEW.sender_company_id;
    
    -- Se non trovato in company_profiles, prova in regaziendasoftware
    IF v_company_name IS NULL THEN
      SELECT ragione_sociale INTO v_company_name
      FROM regaziendasoftware
      WHERE id = NEW.sender_company_id;
    END IF;
    
    -- Inserisci notifica con valori corretti
    INSERT INTO notifiche (
      id_utente,
      titolo,
      messaggio,
      tipo,
      priorita,
      letta,
      stato,
      talk_id,
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
      'messaggio_azienda',  -- Tipo corretto secondo il constraint
      'urgente',
      false,
      'non_letta',
      NEW.id,
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION notify_urgent_talk() IS 'Trigger per notifiche messaggi urgenti da Company Talk. Usa tipo=messaggio_azienda per rispettare il constraint notifiche_tipo_check';
