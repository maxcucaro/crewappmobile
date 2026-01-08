/*
  # Popola auth_user_id mancanti nella tabella regaziendasoftware

  1. Operazione
     - Aggiorna auth_user_id per aziende che hanno email corrispondente in auth.users
     - Mostra risultati dell'operazione

  2. Sicurezza
     - Usa email come chiave di collegamento
     - Aggiorna solo record con auth_user_id NULL
*/

-- Popola auth_user_id per aziende esistenti
UPDATE regaziendasoftware 
SET auth_user_id = auth_users.id
FROM auth.users AS auth_users
WHERE regaziendasoftware.email = auth_users.email 
  AND regaziendasoftware.auth_user_id IS NULL;

-- Mostra risultati
DO $$
DECLARE
  updated_count integer;
  total_null_count integer;
BEGIN
  -- Conta quante aziende hanno ancora auth_user_id NULL
  SELECT COUNT(*) INTO total_null_count 
  FROM regaziendasoftware 
  WHERE auth_user_id IS NULL;
  
  -- Conta quante aziende hanno auth_user_id popolato
  SELECT COUNT(*) INTO updated_count 
  FROM regaziendasoftware 
  WHERE auth_user_id IS NOT NULL;
  
  RAISE NOTICE 'Aziende con auth_user_id popolato: %', updated_count;
  RAISE NOTICE 'Aziende con auth_user_id ancora NULL: %', total_null_count;
  
  IF total_null_count > 0 THEN
    RAISE NOTICE 'ATTENZIONE: % aziende non hanno corrispondenza in auth.users', total_null_count;
  END IF;
END $$;