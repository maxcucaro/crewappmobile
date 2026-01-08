-- Query per verificare gli utenti esistenti nel database

-- 1. Controlla utenti in registration_requests
SELECT 
    id,
    email,
    full_name,
    company_name,
    status,
    auth_user_id,
    temp_password,
    password_definitiva,
    primo_accesso,
    created_at
FROM registration_requests 
WHERE status = 'approved'
ORDER BY created_at DESC;

-- 2. Controlla utenti in auth.users (Supabase Auth)
SELECT 
    id,
    email,
    created_at,
    email_confirmed_at,
    last_sign_in_at
FROM auth.users 
ORDER BY created_at DESC;

-- 3. Verifica corrispondenza tra le due tabelle
SELECT 
    rr.email as reg_email,
    rr.status,
    rr.auth_user_id,
    au.email as auth_email,
    au.id as auth_id,
    CASE 
        WHEN rr.auth_user_id = au.id THEN 'MATCH'
        ELSE 'NO_MATCH'
    END as correspondence
FROM registration_requests rr
LEFT JOIN auth.users au ON rr.auth_user_id = au.id
WHERE rr.status = 'approved';

-- 4. Controlla se ci sono utenti auth senza corrispondenza in registration_requests
SELECT 
    au.id,
    au.email,
    au.created_at,
    'ORPHAN_AUTH_USER' as status
FROM auth.users au
LEFT JOIN registration_requests rr ON au.id = rr.auth_user_id
WHERE rr.id IS NULL;