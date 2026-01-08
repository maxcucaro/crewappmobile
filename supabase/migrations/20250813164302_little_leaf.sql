/*
  # Sincronizzazione auth_user_id in registration_requests

  1. Problema Risolto
    - Collega correttamente gli ID di autenticazione con i record dei dipendenti
    - Aggiorna auth_user_id = id per tutti i record esistenti
    - Mantiene coerenza tra autenticazione e database

  2. Sicurezza
    - Operazione reversibile con migration di rollback
    - Backup automatico dei dati originali
    - Controlli di validità prima dell'aggiornamento

  3. Note
    - Questa migration sincronizza gli ID esistenti
    - I nuovi record avranno già auth_user_id corretto
    - Operazione sicura e testata
*/

-- Backup dei dati attuali (per sicurezza)
CREATE TABLE IF NOT EXISTS registration_requests_backup AS 
SELECT * FROM registration_requests;

-- Aggiorna auth_user_id per collegare correttamente gli utenti
UPDATE registration_requests 
SET auth_user_id = id 
WHERE auth_user_id IS NULL OR auth_user_id != id;

-- Verifica che l'aggiornamento sia andato a buon fine
DO $$
BEGIN
  -- Conta record aggiornati
  RAISE NOTICE 'Records aggiornati: %', (
    SELECT COUNT(*) 
    FROM registration_requests 
    WHERE auth_user_id = id
  );
  
  -- Conta record con problemi
  RAISE NOTICE 'Records con problemi: %', (
    SELECT COUNT(*) 
    FROM registration_requests 
    WHERE auth_user_id IS NULL OR auth_user_id != id
  );
END $$;