-- Query per estrarre tutti i dati del dipendente a8573ad8-308d-45b3-9581-d429f3e1d0a5

-- 1. Dati dalla tabella auth.users (Supabase Auth)
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  updated_at,
  last_sign_in_at,
  raw_user_meta_data,
  raw_app_meta_data
FROM auth.users 
WHERE id = 'a8573ad8-308d-45b3-9581-d429f3e1d0a5';

-- 2. Dati dalla tabella registration_requests (usando ID diretto)
SELECT *
FROM registration_requests 
WHERE id = 'a8573ad8-308d-45b3-9581-d429f3e1d0a5';

-- 3. Dati dalla tabella registration_requests (usando auth_user_id)
SELECT *
FROM registration_requests 
WHERE auth_user_id = 'a8573ad8-308d-45b3-9581-d429f3e1d0a5';

-- 4. Verifica se esiste in crew_members
SELECT *
FROM crew_members 
WHERE id = 'a8573ad8-308d-45b3-9581-d429f3e1d0a5';

-- 5. Verifica se esiste in regaziendasoftware
SELECT *
FROM regaziendasoftware 
WHERE auth_user_id = 'a8573ad8-308d-45b3-9581-d429f3e1d0a5';

-- 6. Query completa con JOIN per vedere tutte le relazioni
SELECT 
  rr.id as registration_id,
  rr.full_name,
  rr.email as reg_email,
  rr.status as reg_status,
  rr.auth_user_id,
  rr.parent_company_id,
  rr.tipologia_registrazione,
  au.email as auth_email,
  au.email_confirmed_at,
  au.created_at as auth_created,
  rs.ragione_sociale as company_name,
  rs.email as company_email
FROM registration_requests rr
LEFT JOIN auth.users au ON rr.auth_user_id = au.id
LEFT JOIN regaziendasoftware rs ON rr.parent_company_id = rs.id
WHERE rr.id = 'a8573ad8-308d-45b3-9581-d429f3e1d0a5' 
   OR rr.auth_user_id = 'a8573ad8-308d-45b3-9581-d429f3e1d0a5';

-- 7. Verifica eventi assegnati
SELECT 
  eca.*,
  e.title as event_title,
  e.start_date,
  e.company_id
FROM event_crew_assignments eca
JOIN events e ON eca.event_id = e.id
WHERE eca.crew_id = 'a8573ad8-308d-45b3-9581-d429f3e1d0a5'
   OR eca.auth_user_id = 'a8573ad8-308d-45b3-9581-d429f3e1d0a5';

-- 8. Verifica warehouse check-ins
SELECT *
FROM warehouse_checkins 
WHERE crew_id = 'a8573ad8-308d-45b3-9581-d429f3e1d0a5';

-- 9. Verifica timesheet entries
SELECT *
FROM timesheet_entries 
WHERE crew_id = 'a8573ad8-308d-45b3-9581-d429f3e1d0a5';