/*
  # Debug completo per turni ed eventi del dipendente a8573ad8-308d-45b3-9581-d429f3e1d0a5

  Esegui queste query una per una per capire dove sono i dati
*/

-- 1. VERIFICA DATI DIPENDENTE
SELECT 
  id,
  full_name,
  email,
  parent_company_id,
  tipologia_registrazione,
  status,
  auth_user_id,
  created_at
FROM registration_requests 
WHERE id = 'a8573ad8-308d-45b3-9581-d429f3e1d0a5' 
   OR auth_user_id = 'a8573ad8-308d-45b3-9581-d429f3e1d0a5';

-- 2. VERIFICA AZIENDA DI APPARTENENZA
SELECT 
  r.id as dipendente_id,
  r.full_name,
  r.parent_company_id,
  a.ragione_sociale as nome_azienda,
  a.email as email_azienda,
  a.attivo as azienda_attiva
FROM registration_requests r
LEFT JOIN regaziendasoftware a ON r.parent_company_id = a.id
WHERE r.id = 'a8573ad8-308d-45b3-9581-d429f3e1d0a5';

-- 3. CERCA EVENTI DELL'AZIENDA (ultimi 30 giorni)
SELECT 
  e.id,
  e.title,
  e.type,
  e.start_date,
  e.end_date,
  e.location,
  e.status,
  e.company_id,
  r.ragione_sociale as nome_azienda,
  e.required_crew,
  e.is_confirmed
FROM events e
LEFT JOIN regaziendasoftware r ON e.company_id = r.id
WHERE e.company_id = 'fff76106-4162-492e-9913-da6c4767b7b6'  -- parent_company_id del dipendente
  AND e.start_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY e.start_date ASC;

-- 4. CERCA ASSEGNAZIONI EVENTI PER QUESTO DIPENDENTE
SELECT 
  eca.id,
  eca.event_id,
  eca.crew_id,
  eca.auth_user_id,
  eca.crew_name,
  eca.final_hourly_rate,
  eca.payment_status,
  e.title as evento_titolo,
  e.start_date,
  e.company_id
FROM event_crew_assignments eca
LEFT JOIN events e ON eca.event_id = e.id
WHERE eca.crew_id = 'a8573ad8-308d-45b3-9581-d429f3e1d0a5'
   OR eca.auth_user_id = 'a8573ad8-308d-45b3-9581-d429f3e1d0a5';

-- 5. CERCA TURNI MAGAZZINO PROGRAMMATI (warehouse_shifts)
SELECT 
  ws.id,
  ws.shift_name,
  ws.date,
  ws.start_time,
  ws.end_time,
  ws.company_id,
  ws.warehouse_id,
  ws.status,
  w.name as warehouse_name,
  r.ragione_sociale as nome_azienda
FROM warehouse_shifts ws
LEFT JOIN warehouses w ON ws.warehouse_id = w.id
LEFT JOIN regaziendasoftware r ON ws.company_id = r.id
WHERE ws.company_id = 'fff76106-4162-492e-9913-da6c4767b7b6'  -- azienda del dipendente
  AND ws.date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY ws.date ASC;

-- 6. CERCA ASSEGNAZIONI TURNI MAGAZZINO PER QUESTO DIPENDENTE
SELECT 
  wsa.id,
  wsa.shift_id,
  wsa.employee_id,
  wsa.employee_name,
  wsa.role,
  wsa.status,
  wsa.check_in_time,
  wsa.check_out_time,
  ws.shift_name,
  ws.date,
  ws.start_time,
  ws.end_time,
  w.name as warehouse_name
FROM warehouse_shift_assignments wsa
LEFT JOIN warehouse_shifts ws ON wsa.shift_id = ws.id
LEFT JOIN warehouses w ON ws.warehouse_id = w.id
WHERE wsa.employee_id = 'a8573ad8-308d-45b3-9581-d429f3e1d0a5';

-- 7. CERCA CHECK-INS MAGAZZINO EFFETTUATI
SELECT 
  wc.id,
  wc.warehouse_id,
  wc.crew_id,
  wc.date,
  wc.check_in_time,
  wc.check_out_time,
  wc.status,
  w.name as warehouse_name,
  w.company_id
FROM warehouse_checkins wc
LEFT JOIN warehouses w ON wc.warehouse_id = w.id
WHERE wc.crew_id = 'a8573ad8-308d-45b3-9581-d429f3e1d0a5'
ORDER BY wc.date DESC;

-- 8. CERCA CORSI DI FORMAZIONE ASSEGNATI
SELECT 
  ca.id,
  ca.corso_id,
  ca.persona_id,
  ca.persona_nome,
  ca.stato_invito,
  cc.titolo,
  cc.data_corso,
  cc.ora_inizio,
  cc.ora_fine,
  cc.luogo,
  cc.categoria,
  cc.stato as corso_stato,
  r.ragione_sociale as nome_azienda
FROM crew_assegnazionecorsi ca
LEFT JOIN crew_corsi cc ON ca.corso_id = cc.id
LEFT JOIN regaziendasoftware r ON cc.azienda_id = r.id
WHERE ca.persona_id = 'a8573ad8-308d-45b3-9581-d429f3e1d0a5'
  AND cc.data_corso >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY cc.data_corso ASC;

-- 9. TIMESHEET ENTRIES DEL DIPENDENTE
SELECT 
  te.id,
  te.crew_id,
  te.event_id,
  te.date,
  te.start_time,
  te.end_time,
  te.total_hours,
  te.status,
  te.payment_status,
  e.title as evento_titolo
FROM timesheet_entries te
LEFT JOIN events e ON te.event_id = e.id
WHERE te.crew_id = 'a8573ad8-308d-45b3-9581-d429f3e1d0a5'
ORDER BY te.date DESC;

-- 10. RIEPILOGO COMPLETO - TUTTO QUELLO CHE DOVREBBE VEDERE OGGI
SELECT 
  'evento' as tipo,
  e.id,
  e.title as nome,
  e.start_date as data,
  e.location as luogo,
  e.type as sottotipo,
  CASE 
    WHEN eca.crew_id IS NOT NULL OR eca.auth_user_id IS NOT NULL THEN 'assegnato'
    ELSE 'non_assegnato'
  END as stato_assegnazione
FROM events e
LEFT JOIN event_crew_assignments eca ON e.id = eca.event_id 
  AND (eca.crew_id = 'a8573ad8-308d-45b3-9581-d429f3e1d0a5' OR eca.auth_user_id = 'a8573ad8-308d-45b3-9581-d429f3e1d0a5')
WHERE e.company_id = 'fff76106-4162-492e-9913-da6c4767b7b6'
  AND e.start_date >= CURRENT_DATE
  AND e.start_date <= CURRENT_DATE + INTERVAL '7 days'

UNION ALL

SELECT 
  'turno_magazzino' as tipo,
  ws.id,
  ws.shift_name as nome,
  ws.date::text as data,
  w.name as luogo,
  ws.shift_type as sottotipo,
  CASE 
    WHEN wsa.employee_id IS NOT NULL THEN 'assegnato'
    ELSE 'non_assegnato'
  END as stato_assegnazione
FROM warehouse_shifts ws
LEFT JOIN warehouses w ON ws.warehouse_id = w.id
LEFT JOIN warehouse_shift_assignments wsa ON ws.id = wsa.shift_id 
  AND wsa.employee_id = 'a8573ad8-308d-45b3-9581-d429f3e1d0a5'
WHERE ws.company_id = 'fff76106-4162-492e-9913-da6c4767b7b6'
  AND ws.date >= CURRENT_DATE
  AND ws.date <= CURRENT_DATE + INTERVAL '7 days'

UNION ALL

SELECT 
  'corso' as tipo,
  cc.id,
  cc.titolo as nome,
  cc.data_corso::text as data,
  cc.luogo,
  cc.categoria as sottotipo,
  CASE 
    WHEN ca.persona_id IS NOT NULL THEN 'iscritto'
    ELSE 'non_iscritto'
  END as stato_assegnazione
FROM crew_corsi cc
LEFT JOIN crew_assegnazionecorsi ca ON cc.id = ca.corso_id 
  AND ca.persona_id = 'a8573ad8-308d-45b3-9581-d429f3e1d0a5'
WHERE cc.azienda_id = 'fff76106-4162-492e-9913-da6c4767b7b6'
  AND cc.data_corso >= CURRENT_DATE
  AND cc.data_corso <= CURRENT_DATE + INTERVAL '7 days'

ORDER BY data ASC;