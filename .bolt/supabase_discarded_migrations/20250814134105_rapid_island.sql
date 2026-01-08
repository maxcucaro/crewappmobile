-- Query per aggiornare la password in auth.users
-- ATTENZIONE: Questa query aggiorna direttamente la tabella auth.users
-- Sostituisci 'TUA_EMAIL_QUI' con la tua email reale

UPDATE auth.users 
SET 
  encrypted_password = crypt('cucaro1', gen_salt('bf')),
  updated_at = now()
WHERE email = 'TUA_EMAIL_QUI';

-- Verifica che l'aggiornamento sia andato a buon fine
SELECT 
  id,
  email,
  encrypted_password IS NOT NULL as has_password,
  email_confirmed_at IS NOT NULL as email_confirmed,
  created_at,
  updated_at
FROM auth.users 
WHERE email = 'TUA_EMAIL_QUI';