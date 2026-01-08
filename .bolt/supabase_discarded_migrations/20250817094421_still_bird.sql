/*
  # Aggiungi turni magazzino di esempio

  1. Nuovi Dati
    - Turni di magazzino per dipendenti esistenti
    - Date del mese corrente e futuro
    - Orari standard di lavoro

  2. Tabelle Interessate
    - `crew_assegnazione_turni` - Inserimento turni di esempio
*/

-- Inserisci turni magazzino di esempio per i dipendenti esistenti
INSERT INTO crew_assegnazione_turni (
  id,
  dipendente_id,
  dipendente_nome,
  turno_id,
  ora_inizio_turno,
  ora_fine_turno,
  nome_magazzino,
  data_turno,
  azienda_id,
  nome_azienda,
  created_at,
  updated_at
) VALUES 
-- Turni per gennaio 2025
(
  gen_random_uuid(),
  (SELECT id FROM registration_requests WHERE email = 'mario.rossi@example.com' LIMIT 1),
  'Mario Rossi',
  gen_random_uuid(),
  '09:00',
  '17:00',
  'Magazzino Centrale',
  '2025-01-20',
  (SELECT parent_company_id FROM registration_requests WHERE email = 'mario.rossi@example.com' LIMIT 1),
  'Massimiliano Cucaro',
  now(),
  now()
),
(
  gen_random_uuid(),
  (SELECT id FROM registration_requests WHERE email = 'mario.rossi@example.com' LIMIT 1),
  'Mario Rossi',
  gen_random_uuid(),
  '08:30',
  '16:30',
  'Magazzino Nord',
  '2025-01-25',
  (SELECT parent_company_id FROM registration_requests WHERE email = 'mario.rossi@example.com' LIMIT 1),
  'Massimiliano Cucaro',
  now(),
  now()
),
-- Turni per febbraio 2025
(
  gen_random_uuid(),
  (SELECT id FROM registration_requests WHERE email = 'mario.rossi@example.com' LIMIT 1),
  'Mario Rossi',
  gen_random_uuid(),
  '09:00',
  '17:00',
  'Magazzino Centrale',
  '2025-02-05',
  (SELECT parent_company_id FROM registration_requests WHERE email = 'mario.rossi@example.com' LIMIT 1),
  'Massimiliano Cucaro',
  now(),
  now()
),
(
  gen_random_uuid(),
  (SELECT id FROM registration_requests WHERE email = 'mario.rossi@example.com' LIMIT 1),
  'Mario Rossi',
  gen_random_uuid(),
  '10:00',
  '18:00',
  'Magazzino Sud',
  '2025-02-12',
  (SELECT parent_company_id FROM registration_requests WHERE email = 'mario.rossi@example.com' LIMIT 1),
  'Massimiliano Cucaro',
  now(),
  now()
),
-- Turni per marzo 2025
(
  gen_random_uuid(),
  (SELECT id FROM registration_requests WHERE email = 'mario.rossi@example.com' LIMIT 1),
  'Mario Rossi',
  gen_random_uuid(),
  '09:00',
  '17:00',
  'Magazzino Centrale',
  '2025-03-10',
  (SELECT parent_company_id FROM registration_requests WHERE email = 'mario.rossi@example.com' LIMIT 1),
  'Massimiliano Cucaro',
  now(),
  now()
),
-- Aggiungi anche per Giulia Bianchi se esiste
(
  gen_random_uuid(),
  (SELECT id FROM registration_requests WHERE email = 'giulia.bianchi@example.com' LIMIT 1),
  'Giulia Bianchi',
  gen_random_uuid(),
  '09:00',
  '17:00',
  'Magazzino Centrale',
  '2025-01-22',
  (SELECT parent_company_id FROM registration_requests WHERE email = 'giulia.bianchi@example.com' LIMIT 1),
  'Massimiliano Cucaro',
  now(),
  now()
),
(
  gen_random_uuid(),
  (SELECT id FROM registration_requests WHERE email = 'giulia.bianchi@example.com' LIMIT 1),
  'Giulia Bianchi',
  gen_random_uuid(),
  '08:00',
  '16:00',
  'Magazzino Nord',
  '2025-02-15',
  (SELECT parent_company_id FROM registration_requests WHERE email = 'giulia.bianchi@example.com' LIMIT 1),
  'Massimiliano Cucaro',
  now(),
  now()
);