-- Query per verificare tutti gli utenti nel database

-- 1. Utenti in auth.users (tabella autenticazione Supabase)
SELECT 
  'AUTH_USERS' as tabella,
  id,
  email,
  created_at,
  email_confirmed_at,
  last_sign_in_at
FROM auth.users 
ORDER BY created_at DESC;

-- 2. Utenti in registration_requests
SELECT 
  'REGISTRATION_REQUESTS' as tabella,
  id,
  email,
  auth_user_id,
  status,
  tipologia_registrazione,
  created_at
FROM registration_requests 
ORDER BY created_at DESC;

-- 3. Verifica corrispondenza tra auth.users e registration_requests
SELECT 
  au.email as auth_email,
  au.id as auth_id,
  rr.email as reg_email,
  rr.id as reg_id,
  rr.auth_user_id,
  rr.status,
  CASE 
    WHEN rr.auth_user_id IS NULL THEN 'MISSING_AUTH_LINK'
    WHEN rr.auth_user_id != au.id THEN 'MISMATCHED_AUTH_ID'
    ELSE 'LINKED_CORRECTLY'
  END as link_status
FROM auth.users au
LEFT JOIN registration_requests rr ON au.id = rr.auth_user_id
ORDER BY au.created_at DESC;

-- 4. Utenti orfani in registration_requests (senza corrispondenza in auth.users)
SELECT 
  'ORPHAN_REGISTRATION' as tipo,
  rr.email,
  rr.id,
  rr.auth_user_id,
  rr.status
FROM registration_requests rr
LEFT JOIN auth.users au ON rr.auth_user_id = au.id
WHERE au.id IS NULL;