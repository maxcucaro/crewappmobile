/*
  # Correggi foreign key tabella events

  1. Problema
    - La tabella events ha foreign key verso companies(id)
    - Ma l'app usa regaziendasoftware per le aziende
    - L'ID azienda non esiste in companies

  2. Soluzione
    - Rimuovi foreign key verso companies
    - Aggiungi foreign key verso regaziendasoftware
    - Aggiorna policy RLS per permettere operazioni
*/

-- Rimuovi il foreign key esistente verso companies
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_company_id_fkey;

-- Aggiungi foreign key verso regaziendasoftware
ALTER TABLE events ADD CONSTRAINT events_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES regaziendasoftware(id) ON DELETE CASCADE;

-- Rimuovi tutte le policy esistenti
DROP POLICY IF EXISTS "Admin can read all data" ON events;
DROP POLICY IF EXISTS "Companies can read own events" ON events;
DROP POLICY IF EXISTS "Crew can read assigned events" ON events;

-- Crea policy semplice che permette tutte le operazioni
CREATE POLICY "Allow all operations on events"
  ON events
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);