/*
  # Sincronizzazione automatica dati autenticazione azienda

  1. Nuova Funzione
    - `sync_azienda_auth_data()` - Popola automaticamente i campi di autenticazione in azienda_software da regaziendasoftware

  2. Campi Sincronizzati
    - `auth_user_id` - ID utente Supabase dell'azienda
    - `email` - Email dell'azienda
    - `password_temporanea` - Password temporanea dell'azienda
    - `password_definitiva` - Password definitiva dell'azienda
    - `password_scadenza` - Data scadenza password/abbonamento

  3. Comportamento
    - Trigger attivo su INSERT e UPDATE
    - Recupera automaticamente i dati da regaziendasoftware
    - Se l'azienda non esiste o i dati non sono disponibili, mantiene i valori NULL
    - NON modifica i record esistenti, solo i nuovi inserimenti

  Note:
    - Questa funzione garantisce che i dati di autenticazione siano sempre sincronizzati
    - Evita inconsistenze tra regaziendasoftware e azienda_software
    - Mantiene la compatibilità con i dati esistenti
*/

-- Crea la funzione per sincronizzare i dati di autenticazione
CREATE OR REPLACE FUNCTION sync_azienda_auth_data()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Recupera i dati di autenticazione da regaziendasoftware
  SELECT 
    auth_user_id,
    email,
    password_temporanea,
    password_definitiva,
    password_scadenza
  INTO 
    NEW.auth_user_id,
    NEW.email,
    NEW.password_temporanea,
    NEW.password_definitiva,
    NEW.password_scadenza
  FROM regaziendasoftware
  WHERE id = NEW.azienda_id;
  
  -- Se l'azienda non viene trovata, mantieni i valori NULL
  IF NOT FOUND THEN
    NEW.auth_user_id := NULL;
    NEW.email := NULL;
    NEW.password_temporanea := NULL;
    NEW.password_definitiva := NULL;
    NEW.password_scadenza := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crea il trigger su INSERT e UPDATE
DROP TRIGGER IF EXISTS sync_azienda_auth_data_trigger ON azienda_software;

CREATE TRIGGER sync_azienda_auth_data_trigger
  BEFORE INSERT OR UPDATE
  ON azienda_software
  FOR EACH ROW
  EXECUTE FUNCTION sync_azienda_auth_data();

-- Commento sulla funzione
COMMENT ON FUNCTION sync_azienda_auth_data() IS 
  'Sincronizza automaticamente i dati di autenticazione (auth_user_id, email, password_temporanea, password_definitiva, password_scadenza) da regaziendasoftware a azienda_software';
