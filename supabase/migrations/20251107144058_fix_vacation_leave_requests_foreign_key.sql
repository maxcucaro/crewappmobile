/*
  # Fix vacation_leave_requests foreign key
  
  ## Modifiche
  
  1. Rimuove il constraint verso crew_members(id)
  2. Aggiunge constraint verso users(id) che corrisponde ad auth.uid()
  
  Questo permette agli utenti di creare richieste ferie/permessi
  usando direttamente il loro auth.uid() senza dover verificare
  l'esistenza in crew_members.
*/

-- Rimuovi il constraint esistente
ALTER TABLE vacation_leave_requests 
DROP CONSTRAINT IF EXISTS vacation_leave_requests_crew_id_fkey;

-- Aggiungi nuovo constraint verso users(id) che è auth.uid()
ALTER TABLE vacation_leave_requests 
ADD CONSTRAINT vacation_leave_requests_crew_id_fkey 
FOREIGN KEY (crew_id) REFERENCES users(id) ON DELETE CASCADE;

-- Verifica che le policy RLS siano corrette (già usano auth.uid())
-- Le policy esistenti sono già corrette perché usano auth.uid() = crew_id