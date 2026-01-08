-- Query per controllare password in auth.users
-- ATTENZIONE: Questa query accede alla tabella auth.users che è protetta

-- Metodo 1: Controlla se l'utente esiste e ha password impostata
SELECT 
  id,
  email,
  encrypted_password IS NOT NULL as has_password,
  email_confirmed_at IS NOT NULL as email_confirmed,
  created_at,
  updated_at,
  last_sign_in_at
FROM auth.users 
WHERE email = 'massimiliano@cucaro.it';

-- Metodo 2: Se hai accesso come service_role, puoi vedere più dettagli
SELECT 
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  phone_confirmed_at,
  confirmation_sent_at,
  recovery_sent_at,
  email_change_sent_at,
  new_email,
  invited_at,
  action_link,
  email_change,
  email_change_token_current,
  email_change_token_new,
  recovery_token,
  aud,
  role,
  created_at,
  updated_at,
  instance_id,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  phone,
  phone_change,
  phone_change_token,
  phone_change_sent_at,
  confirmed_at,
  email_change_confirm_status,
  banned_until,
  reauthentication_token,
  reauthentication_sent_at,
  is_sso_user,
  deleted_at
FROM auth.users 
WHERE email IN ('massimiliano@cucaro.it', 'miao@io.it');

-- Metodo 3: Controlla tutti gli utenti auth
SELECT 
  email,
  encrypted_password IS NOT NULL as has_password,
  email_confirmed_at IS NOT NULL as email_confirmed,
  created_at
FROM auth.users 
ORDER BY created_at DESC;