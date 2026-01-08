/*
  # Fix vacation_leave_requests per usare auth.users
  
  ## Problema
  Il constraint puntava a public.users ma gli utenti sono in auth.users
  
  ## Soluzione
  Rimuove il constraint verso public.users e lo ricrea verso auth.users
*/

-- Rimuovi il constraint esistente
ALTER TABLE vacation_leave_requests 
DROP CONSTRAINT IF EXISTS vacation_leave_requests_crew_id_fkey;

-- Aggiungi nuovo constraint verso auth.users
ALTER TABLE vacation_leave_requests 
ADD CONSTRAINT vacation_leave_requests_crew_id_fkey 
FOREIGN KEY (crew_id) REFERENCES auth.users(id) ON DELETE CASCADE;