-- DEBUG COMPLETO: Turni ed Eventi Assegnati
-- Esegui queste query per verificare tutti i dati

-- 1. VERIFICA DATI DIPENDENTE
SELECT 
  'DIPENDENTE' as tipo_query,
  id,
  full_name,
  email,
  parent_company_id,
  tipologia_registrazione,
  status,
  auth_user_id
FROM registration_requests 
WHERE email = 'miao@io.it';

-- 2. VERIFICA AZIENDA DEL DIPENDENTE
SELECT 
  'AZIENDA_DIPENDENTE' as tipo_query,
  r.id as azienda_id,
  r.ragione_sociale,
  r.email,
  r.attivo
FROM regaziendasoftware r
JOIN registration_requests rr ON rr.parent_company_id = r.id
WHERE rr.email = 'miao@io.it';

-- 3. TUTTI GLI EVENTI DELL'AZIENDA
SELECT 
  'EVENTI_AZIENDA' as tipo_query,
  e.id,
  e.title,
  e.type,
  e.start_date,
  e.end_date,
  e.location,
  e.status,
  e.required_crew,
  e.company_id
FROM events e
JOIN registration_requests rr ON rr.parent_company_id = e.company_id
WHERE rr.email = 'miao@io.it'
ORDER BY e.start_date;

-- 4. EVENTI A CUI SEI ASSEGNATO
SELECT 
  'EVENTI_ASSEGNATI' as tipo_query,
  e.id,
  e.title,
  e.start_date,
  e.location,
  eca.crew_id,
  eca.auth_user_id,
  eca.crew_name
FROM events e
JOIN event_crew_assignments eca ON eca.event_id = e.id
JOIN registration_requests rr ON (eca.crew_id = rr.id OR eca.auth_user_id = rr.auth_user_id)
WHERE rr.email = 'miao@io.it'
ORDER BY e.start_date;

-- 5. TURNI MAGAZZINO PROGRAMMATI
SELECT 
  'TURNI_MAGAZZINO' as tipo_query,
  ws.id,
  ws.shift_name,
  ws.date,
  ws.start_time,
  ws.end_time,
  ws.status,
  ws.company_id,
  w.name as warehouse_name
FROM warehouse_shifts ws
JOIN warehouses w ON w.id = ws.warehouse_id
JOIN registration_requests rr ON rr.parent_company_id = ws.company_id
WHERE rr.email = 'miao@io.it'
ORDER BY ws.date;

-- 6. ASSEGNAZIONI TURNI MAGAZZINO
SELECT 
  'ASSEGNAZIONI_MAGAZZINO' as tipo_query,
  wsa.id,
  wsa.employee_id,
  wsa.employee_name,
  wsa.status,
  ws.shift_name,
  ws.date,
  ws.start_time,
  ws.end_time
FROM warehouse_shift_assignments wsa
JOIN warehouse_shifts ws ON ws.id = wsa.shift_id
JOIN registration_requests rr ON rr.id = wsa.employee_id
WHERE rr.email = 'miao@io.it'
ORDER BY ws.date;

-- 7. CHECK-INS GIÀ EFFETTUATI
SELECT 
  'CHECKINS_EFFETTUATI' as tipo_query,
  wc.id,
  wc.date,
  wc.check_in_time,
  wc.check_out_time,
  wc.status,
  w.name as warehouse_name
FROM warehouse_checkins wc
LEFT JOIN warehouses w ON w.id = wc.warehouse_id
JOIN registration_requests rr ON rr.auth_user_id = wc.crew_id
WHERE rr.email = 'miao@io.it'
ORDER BY wc.date DESC;

-- 8. CORSI ASSEGNATI
SELECT 
  'CORSI_ASSEGNATI' as tipo_query,
  cc.id,
  cc.titolo,
  cc.data_corso,
  cc.ora_inizio,
  cc.ora_fine,
  cc.luogo,
  cc.categoria,
  cac.stato_invito,
  r.ragione_sociale as azienda_nome
FROM crew_corsi cc
JOIN crew_assegnazionecorsi cac ON cac.corso_id = cc.id
JOIN registration_requests rr ON rr.id = cac.persona_id
JOIN regaziendasoftware r ON r.id = cc.azienda_id
WHERE rr.email = 'miao@io.it'
ORDER BY cc.data_corso;

-- 9. TIMESHEET ENTRIES
SELECT 
  'TIMESHEET_ENTRIES' as tipo_query,
  te.id,
  te.date,
  te.start_time,
  te.end_time,
  te.status,
  te.event_id
FROM timesheet_entries te
JOIN registration_requests rr ON rr.auth_user_id = te.crew_id
WHERE rr.email = 'miao@io.it'
ORDER BY te.date DESC;

-- 10. RIEPILOGO COMPLETO - TUTTO QUELLO CHE DOVRESTI VEDERE
WITH dipendente_info AS (
  SELECT 
    id as dipendente_id,
    auth_user_id,
    parent_company_id,
    full_name
  FROM registration_requests 
  WHERE email = 'miao@io.it'
)
SELECT 
  'OGGI' as periodo,
  'evento' as tipo,
  e.title as titolo,
  e.start_date as data,
  e.location as luogo,
  CASE WHEN eca.crew_id IS NOT NULL THEN 'SI' ELSE 'NO' END as assegnato,
  'events' as tabella_origine
FROM events e
CROSS JOIN dipendente_info di
LEFT JOIN event_crew_assignments eca ON (
  eca.event_id = e.id AND 
  (eca.crew_id = di.dipendente_id OR eca.auth_user_id = di.auth_user_id)
)
WHERE e.company_id = di.parent_company_id
  AND e.start_date = CURRENT_DATE

UNION ALL

SELECT 
  'OGGI' as periodo,
  'turno_magazzino' as tipo,
  ws.shift_name as titolo,
  ws.date as data,
  w.name as luogo,
  CASE WHEN wsa.employee_id IS NOT NULL THEN 'SI' ELSE 'NO' END as assegnato,
  'warehouse_shifts' as tabella_origine
FROM warehouse_shifts ws
CROSS JOIN dipendente_info di
JOIN warehouses w ON w.id = ws.warehouse_id
LEFT JOIN warehouse_shift_assignments wsa ON (
  wsa.shift_id = ws.id AND 
  wsa.employee_id = di.dipendente_id
)
WHERE ws.company_id = di.parent_company_id
  AND ws.date = CURRENT_DATE

UNION ALL

SELECT 
  'PROSSIMI_7_GIORNI' as periodo,
  'evento' as tipo,
  e.title as titolo,
  e.start_date as data,
  e.location as luogo,
  CASE WHEN eca.crew_id IS NOT NULL THEN 'SI' ELSE 'NO' END as assegnato,
  'events' as tabella_origine
FROM events e
CROSS JOIN dipendente_info di
LEFT JOIN event_crew_assignments eca ON (
  eca.event_id = e.id AND 
  (eca.crew_id = di.dipendente_id OR eca.auth_user_id = di.auth_user_id)
)
WHERE e.company_id = di.parent_company_id
  AND e.start_date BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 7

UNION ALL

SELECT 
  'PROSSIMI_7_GIORNI' as periodo,
  'corso' as tipo,
  cc.titolo as titolo,
  cc.data_corso as data,
  cc.luogo as luogo,
  'SI' as assegnato,
  'crew_corsi' as tabella_origine
FROM crew_corsi cc
CROSS JOIN dipendente_info di
JOIN crew_assegnazionecorsi cac ON cac.corso_id = cc.id
WHERE cac.persona_id = di.dipendente_id
  AND cc.data_corso BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 7

ORDER BY data, tipo;