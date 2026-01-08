-- Query per controllare password utente in auth.users
-- Sostituisci 'TUA_EMAIL_QUI' con la tua email

SELECT 
  id,
  email,
  encrypted_password IS NOT NULL as has_password,
  email_confirmed_at IS NOT NULL as email_confirmed,
  created_at,
  updated_at,
  last_sign_in_at,
  email_confirmed_at,
  phone_confirmed_at,
  confirmed_at,
  recovery_sent_at,
  invited_at,
  action_link,
  email_change,
  email_change_sent_at,
  email_change_confirm_status,
  banned_until,
  deleted_at,
  is_sso_user,
  raw_app_meta_data,
  raw_user_meta_data
FROM auth.users 
WHERE email = 'TUA_EMAIL_QUI';

-- Query alternativa per vedere tutti gli utenti
SELECT 
  id,
  email,
  encrypted_password IS NOT NULL as has_password,
  email_confirmed_at IS NOT NULL as email_confirmed,
  created_at,
  last_sign_in_at
FROM auth.users 
ORDER BY created_at DESC;