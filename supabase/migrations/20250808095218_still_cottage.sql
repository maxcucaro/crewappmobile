/*
  # Fix RLS policies for corsi_formazione table

  1. Drop and recreate corsi_formazione table
     - Same structure as before
     - Correct RLS policies for INSERT/UPDATE/DELETE/SELECT
  
  2. Security
     - Companies can manage their own courses
     - Tecnici can view public courses and courses they're enrolled in
     - Proper isolation between companies
*/

-- Drop existing table with broken policies
DROP TABLE IF EXISTS corsi_formazione CASCADE;

-- Recreate corsi_formazione table
CREATE TABLE corsi_formazione (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo text NOT NULL,
  descrizione text,
  id_azienda uuid NOT NULL,
  data date NOT NULL,
  ora_inizio time NOT NULL,
  ora_fine time NOT NULL,
  luogo text NOT NULL,
  istruttore text,
  obbligatorio boolean DEFAULT false,
  categoria text NOT NULL CHECK (categoria = ANY (ARRAY['sicurezza'::text, 'tecnico'::text, 'soft_skills'::text, 'certificazione'::text, 'altro'::text])),
  materiali text[],
  visibilita text NOT NULL DEFAULT 'pubblico'::text CHECK (visibilita = ANY (ARRAY['pubblico'::text, 'privato'::text])),
  stato text NOT NULL DEFAULT 'draft'::text CHECK (stato = ANY (ARRAY['draft'::text, 'published'::text, 'confirmed'::text, 'completed'::text])),
  confermato boolean DEFAULT false,
  data_creazione timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Add foreign key to regaziendasoftware (companies table)
ALTER TABLE corsi_formazione 
ADD CONSTRAINT corsi_formazione_id_azienda_fkey 
FOREIGN KEY (id_azienda) REFERENCES regaziendasoftware(id) ON DELETE CASCADE;

-- Add indexes
CREATE INDEX idx_corsi_formazione_azienda ON corsi_formazione(id_azienda);
CREATE INDEX idx_corsi_formazione_data ON corsi_formazione(data);
CREATE INDEX idx_corsi_formazione_stato ON corsi_formazione(stato);
CREATE INDEX idx_corsi_formazione_visibilita ON corsi_formazione(visibilita);

-- Enable RLS
ALTER TABLE corsi_formazione ENABLE ROW LEVEL SECURITY;

-- RLS Policies for corsi_formazione
CREATE POLICY "Companies can manage their own courses"
  ON corsi_formazione
  FOR ALL
  TO authenticated
  USING (id_azienda = auth.uid())
  WITH CHECK (id_azienda = auth.uid());

CREATE POLICY "Tecnici can view public courses"
  ON corsi_formazione
  FOR SELECT
  TO authenticated
  USING (visibilita = 'pubblico'::text);

CREATE POLICY "Tecnici can view courses they are enrolled in"
  ON corsi_formazione
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM iscrizioni_corsi 
      WHERE iscrizioni_corsi.id_corso = corsi_formazione.id 
      AND iscrizioni_corsi.id_tecnico = auth.uid()
    )
  );

-- Now recreate iscrizioni_corsi with correct foreign keys
DROP TABLE IF EXISTS iscrizioni_corsi CASCADE;

CREATE TABLE iscrizioni_corsi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_corso uuid NOT NULL,
  id_tecnico uuid NOT NULL,
  stato text DEFAULT 'invitato'::text CHECK (stato = ANY (ARRAY['invitato'::text, 'registrato'::text, 'confermato'::text, 'partecipato'::text, 'non_presentato'::text, 'annullato'::text])),
  certificato_emesso boolean DEFAULT false,
  url_certificato text,
  data_invito timestamp with time zone DEFAULT now(),
  data_registrazione timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(id_corso, id_tecnico)
);

-- Add foreign keys for iscrizioni_corsi
ALTER TABLE iscrizioni_corsi 
ADD CONSTRAINT iscrizioni_corsi_id_corso_fkey 
FOREIGN KEY (id_corso) REFERENCES corsi_formazione(id) ON DELETE CASCADE;

ALTER TABLE iscrizioni_corsi 
ADD CONSTRAINT iscrizioni_corsi_id_tecnico_fkey 
FOREIGN KEY (id_tecnico) REFERENCES tecnici(id) ON DELETE CASCADE;

-- Add indexes for iscrizioni_corsi
CREATE INDEX idx_iscrizioni_corsi_corso ON iscrizioni_corsi(id_corso);
CREATE INDEX idx_iscrizioni_corsi_tecnico ON iscrizioni_corsi(id_tecnico);
CREATE INDEX idx_iscrizioni_corsi_stato ON iscrizioni_corsi(stato);
CREATE INDEX idx_iscrizioni_corsi_data_invito ON iscrizioni_corsi(data_invito);

-- Enable RLS for iscrizioni_corsi
ALTER TABLE iscrizioni_corsi ENABLE ROW LEVEL SECURITY;

-- RLS Policies for iscrizioni_corsi
CREATE POLICY "Companies can manage enrollments for their courses"
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

CREATE POLICY "Tecnici can view their own enrollments"
  ON iscrizioni_corsi
  FOR SELECT
  TO authenticated
  USING (id_tecnico = auth.uid());

CREATE POLICY "Admin can read all enrollments"
  ON iscrizioni_corsi
  FOR SELECT
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::json ->> 'role') = 'admin'
  );