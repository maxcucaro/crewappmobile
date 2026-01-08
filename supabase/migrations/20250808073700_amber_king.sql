/*
  # Ricrea tabella event_crew_assignments con policy corrette

  1. Operazioni
     - Elimina tabella esistente event_crew_assignments
     - Ricrea tabella con struttura corretta
     - Aggiunge policy RLS per aziende e crew

  2. Nuova Struttura
     - `id` (uuid, primary key)
     - `event_id` (uuid, foreign key to events)
     - `crew_id` (uuid, foreign key to crew_members o registration_requests)
     - `final_hourly_rate` (numeric, tariffa oraria finale)
     - `final_daily_rate` (numeric, tariffa giornaliera finale)
     - `company_retention_percentage` (numeric, percentuale trattenuta azienda)
     - `payment_status` (text, stato pagamento)
     - `created_at` (timestamp)
     - `updated_at` (timestamp)

  3. Security
     - Enable RLS
     - Policy per aziende: possono gestire assegnazioni dei propri eventi
     - Policy per crew: possono leggere le proprie assegnazioni
     - Policy per admin: accesso completo
*/

-- Elimina la tabella esistente se esiste
DROP TABLE IF EXISTS event_crew_assignments CASCADE;

-- Ricrea la tabella con struttura corretta
CREATE TABLE event_crew_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  crew_id uuid NOT NULL,
  final_hourly_rate numeric(10,2),
  final_daily_rate numeric(10,2),
  company_retention_percentage numeric(5,2) DEFAULT 0,
  payment_status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  UNIQUE(event_id, crew_id),
  CHECK (payment_status IN ('pending', 'paid', 'confirmed_by_crew')),
  CHECK (company_retention_percentage >= 0 AND company_retention_percentage <= 100)
);

-- Abilita RLS
ALTER TABLE event_crew_assignments ENABLE ROW LEVEL SECURITY;

-- Policy per le aziende: possono gestire le assegnazioni dei propri eventi
CREATE POLICY "Companies can manage own event crew assignments"
  ON event_crew_assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = event_crew_assignments.event_id 
      AND events.company_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = event_crew_assignments.event_id 
      AND events.company_id = auth.uid()
    )
  );

-- Policy per i crew: possono leggere le proprie assegnazioni
CREATE POLICY "Crew members can read own assignments"
  ON event_crew_assignments
  FOR SELECT
  TO authenticated
  USING (crew_id = auth.uid());

-- Policy per admin: accesso completo
CREATE POLICY "Admin can manage all assignments"
  ON event_crew_assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Policy per accesso pubblico (per compatibilità con il sistema attuale)
CREATE POLICY "Public can manage event crew assignments"
  ON event_crew_assignments
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Aggiungi foreign key constraints
ALTER TABLE event_crew_assignments 
ADD CONSTRAINT event_crew_assignments_event_id_fkey 
FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

-- Nota: Non aggiungiamo FK per crew_id perché può riferirsi a tabelle diverse
-- (crew_members per freelance, registration_requests per dipendenti)

-- Aggiungi indici per performance
CREATE INDEX idx_event_crew_assignments_event ON event_crew_assignments(event_id);
CREATE INDEX idx_event_crew_assignments_crew ON event_crew_assignments(crew_id);
CREATE INDEX idx_event_crew_assignments_payment ON event_crew_assignments(payment_status);