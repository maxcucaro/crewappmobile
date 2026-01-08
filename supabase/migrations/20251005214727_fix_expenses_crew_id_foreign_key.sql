/*
  # Fix Foreign Key expenses.crew_id

  1. Problema
    - La foreign key `expenses_crew_id_fkey` punta a `crew_members.id`
    - Ma i dipendenti sono registrati in `registration_requests` (con auth_user_id)
    - Questo causa errori quando i dipendenti inviano note spese

  2. Soluzione
    - Rimuove la foreign key esistente che punta a crew_members
    - Aggiunge una nuova foreign key che punta a auth.users(id)
    - Questo permette ai dipendenti di creare note spese usando il loro auth.uid()

  3. Note
    - Non elimina dati esistenti
    - Mantiene tutte le policy RLS esistenti
    - Compatibile con il codice attuale
*/

-- 1. Rimuovi la foreign key esistente
ALTER TABLE expenses 
DROP CONSTRAINT IF EXISTS expenses_crew_id_fkey;

-- 2. Aggiungi nuova foreign key che punta a auth.users
ALTER TABLE expenses 
ADD CONSTRAINT expenses_crew_id_fkey 
FOREIGN KEY (crew_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- 3. Aggiungi commento per documentazione
COMMENT ON COLUMN expenses.crew_id IS 'ID dell''utente autenticato (auth.users.id) che ha creato la nota spesa';
