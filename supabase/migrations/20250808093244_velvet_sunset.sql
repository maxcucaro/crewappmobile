/*
  # Ricrea tabella iscrizioni_corsi con foreign key corrette

  1. Elimina e ricrea tabella iscrizioni_corsi
  2. Foreign key corrette verso corsi_formazione e tecnici
  3. RLS policies aggiornate con auth.uid()
  4. Indici per performance
*/

-- Elimina la tabella esistente se presente
DROP TABLE IF EXISTS iscrizioni_corsi CASCADE;

-- Ricrea la tabella iscrizioni_corsi con foreign key corrette
CREATE TABLE IF NOT EXISTS iscrizioni_corsi (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_corso uuid NOT NULL,
  id_tecnico uuid NOT NULL,
  stato text DEFAULT 'invitato'::text,
  certificato_emesso boolean DEFAULT false,
  url_certificato text,
  data_invito timestamptz DEFAULT now(),
  data_registrazione timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT iscrizioni_corsi_stato_check 
    CHECK (stato = ANY (ARRAY['invitato'::text, 'registrato'::text, 'confermato'::text, 'partecipato'::text, 'non_presentato'::text, 'annullato'::text])),
  
  -- Unique constraint per evitare iscrizioni duplicate
  CONSTRAINT iscrizioni_corsi_id_corso_id_tecnico_key 
    UNIQUE (id_corso, id_tecnico)
);

-- Aggiungi foreign key verso corsi_formazione
ALTER TABLE iscrizioni_corsi 
ADD CONSTRAINT iscrizioni_corsi_id_corso_fkey 
FOREIGN KEY (id_corso) REFERENCES corsi_formazione(id) ON DELETE CASCADE;

-- Aggiungi foreign key verso tecnici
ALTER TABLE iscrizioni_corsi 
ADD CONSTRAINT iscrizioni_corsi_id_tecnico_fkey 
FOREIGN KEY (id_tecnico) REFERENCES tecnici(id) ON DELETE CASCADE;

-- Abilita RLS
ALTER TABLE iscrizioni_corsi ENABLE ROW LEVEL SECURITY;

-- Policy per amministratori
CREATE POLICY "Amministratore può leggere tutti i dati"
  ON iscrizioni_corsi
  FOR SELECT
  TO public
  USING (
    (current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text = 'admin'::text
  );

-- Policy per aziende - possono gestire iscrizioni ai propri corsi
CREATE POLICY "Aziende possono gestire iscrizioni ai propri corsi"
  ON iscrizioni_corsi
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM corsi_formazione 
      WHERE corsi_formazione.id = iscrizioni_corsi.id_corso 
      AND corsi_formazione.id_azienda = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM corsi_formazione 
      WHERE corsi_formazione.id = iscrizioni_corsi.id_corso 
      AND corsi_formazione.id_azienda = auth.uid()
    )
  );

-- Policy per tecnici - possono leggere le proprie iscrizioni
CREATE POLICY "Tecnici possono leggere proprie iscrizioni corsi"
  ON iscrizioni_corsi
  FOR SELECT
  TO authenticated
  USING (id_tecnico = auth.uid());

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_iscrizioni_corsi_corso ON iscrizioni_corsi(id_corso);
CREATE INDEX IF NOT EXISTS idx_iscrizioni_corsi_tecnico ON iscrizioni_corsi(id_tecnico);
CREATE INDEX IF NOT EXISTS idx_iscrizioni_corsi_stato ON iscrizioni_corsi(stato);
CREATE INDEX IF NOT EXISTS idx_iscrizioni_corsi_data_invito ON iscrizioni_corsi(data_invito);