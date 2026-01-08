-- Query per verificare gli utenti in auth.users
-- ATTENZIONE: Questa query può essere eseguita solo da un amministratore

-- 1. Verifica utenti in auth.users
SELECT 
  id,
  email,
  created_at,
  email_confirmed_at,
  last_sign_in_at,
  CASE 
    WHEN encrypted_password IS NOT NULL THEN 'HAS_PASSWORD'
    ELSE 'NO_PASSWORD'
  END as password_status
FROM auth.users 
ORDER BY created_at DESC;

-- 2. Verifica se ci sono utenti senza password confermata
SELECT 
  email,
  email_confirmed_at,
  CASE 
    WHEN email_confirmed_at IS NULL THEN 'EMAIL_NOT_CONFIRMED'
    ELSE 'EMAIL_CONFIRMED'
  END as email_status
FROM auth.users 
WHERE email_confirmed_at IS NULL;