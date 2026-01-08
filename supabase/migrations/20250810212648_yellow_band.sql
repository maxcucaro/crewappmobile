/*
  # Popola auth_user_id nella tabella regaziendasoftware

  1. Aggiornamenti
     - Collega ogni azienda al suo utente Supabase Auth tramite email
     - Popola la colonna auth_user_id precedentemente vuota
  
  2. Sicurezza
     - Aggiorna solo record con auth_user_id NULL
     - Usa email come chiave di collegamento
*/

-- Popola auth_user_id per le aziende esistenti collegandole tramite email
UPDATE regaziendasoftware 
SET auth_user_id = auth_users.id
FROM auth.users AS auth_users
WHERE regaziendasoftware.email = auth_users.email 
  AND regaziendasoftware.auth_user_id IS NULL;

-- Verifica il risultato
DO $$
BEGIN
  RAISE NOTICE 'Aziende aggiornate: %', (
    SELECT COUNT(*) 
    FROM regaziendasoftware 
    WHERE auth_user_id IS NOT NULL
  );
  
  RAISE NOTICE 'Aziende ancora senza auth_user_id: %', (
    SELECT COUNT(*) 
    FROM regaziendasoftware 
    WHERE auth_user_id IS NULL
  );
END $$;