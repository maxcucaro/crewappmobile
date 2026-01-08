/*
  # Disabilita sincronizzazione messaggi Talk con tabella Notifiche
  
  ## Descrizione
  I messaggi urgenti di Company Talk non devono più essere sincronizzati con la tabella notifiche.
  Rimangono solo nella tabella company_talks.
  
  ## Modifiche
  1. Rimuove il trigger che invia i messaggi urgenti alla tabella notifiche
  2. Rimuove la funzione notify_urgent_talk
  3. Semplifica mark_talk_as_read per non aggiornare più la tabella notifiche
  4. Semplifica mark_notification_read per non aggiornare più company_talks
*/

-- Drop il trigger che crea notifiche per messaggi urgenti
DROP TRIGGER IF EXISTS trigger_notify_urgent_talk ON company_talks;

-- Drop la funzione che crea notifiche
DROP FUNCTION IF EXISTS notify_urgent_talk();

-- Semplifica mark_talk_as_read per gestire solo company_talks
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
END;
$$;

-- Semplifica mark_notification_read per gestire solo notifiche
CREATE OR REPLACE FUNCTION mark_notification_read(p_notifica_id uuid, p_user_id uuid)
RETURNS boolean AS $$
DECLARE
  v_updated boolean;
BEGIN
  UPDATE notifiche
  SET 
    stato = 'letta',
    read_at = NOW()
  WHERE id = p_notifica_id
    AND id_utente = p_user_id
    AND (stato = 'non_letta' OR stato IS NULL);
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rimuovi la colonna talk_id dalla tabella notifiche (opzionale, puoi lasciarla per futuri utilizzi)
-- ALTER TABLE notifiche DROP COLUMN IF EXISTS talk_id;
