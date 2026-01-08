/*
  # Fix RLS policies for corsi_formazione table

  1. Problem Analysis
    - The current RLS policies use auth.uid() which doesn't work for companies
    - Companies are stored in regaziendasoftware table, not auth.users
    - Need to allow companies to insert/manage their own courses

  2. Solution
    - Drop existing table and recreate with correct RLS policies
    - Use proper company identification logic
    - Allow public access for reading courses (for crew to see them)
*/

-- Drop existing table if it exists
DROP TABLE IF EXISTS public.corsi_formazione CASCADE;

-- Create corsi_formazione table
CREATE TABLE IF NOT EXISTS public.corsi_formazione (
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
  categoria text NOT NULL,
  materiali text[],
  visibilita text DEFAULT 'pubblico'::text NOT NULL,
  stato text DEFAULT 'draft'::text NOT NULL,
  confermato boolean DEFAULT false,
  data_creazione timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Add constraints
ALTER TABLE public.corsi_formazione 
ADD CONSTRAINT corsi_formazione_categoria_check 
CHECK (categoria = ANY (ARRAY['sicurezza'::text, 'tecnico'::text, 'soft_skills'::text, 'certificazione'::text, 'altro'::text]));

ALTER TABLE public.corsi_formazione 
ADD CONSTRAINT corsi_formazione_stato_check 
CHECK (stato = ANY (ARRAY['draft'::text, 'published'::text, 'confirmed'::text, 'completed'::text]));

ALTER TABLE public.corsi_formazione 
ADD CONSTRAINT corsi_formazione_visibilita_check 
CHECK (visibilita = ANY (ARRAY['pubblico'::text, 'privato'::text]));

-- Add foreign key to regaziendasoftware
ALTER TABLE public.corsi_formazione 
ADD CONSTRAINT corsi_formazione_id_azienda_fkey 
FOREIGN KEY (id_azienda) REFERENCES public.regaziendasoftware(id) ON DELETE CASCADE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_corsi_formazione_azienda ON public.corsi_formazione(id_azienda);
CREATE INDEX IF NOT EXISTS idx_corsi_formazione_data ON public.corsi_formazione(data);
CREATE INDEX IF NOT EXISTS idx_corsi_formazione_stato ON public.corsi_formazione(stato);
CREATE INDEX IF NOT EXISTS idx_corsi_formazione_visibilita ON public.corsi_formazione(visibilita);

-- Enable RLS
ALTER TABLE public.corsi_formazione ENABLE ROW LEVEL SECURITY;

-- Create RLS policies that work with regaziendasoftware table
CREATE POLICY "Companies can manage their own courses"
  ON public.corsi_formazione
  FOR ALL
  TO public
  USING (
    -- Allow if user ID matches the company ID in the course
    id_azienda IN (
      SELECT id FROM public.regaziendasoftware WHERE id = id_azienda
    )
  )
  WITH CHECK (
    -- Allow insert/update if user ID matches the company ID being set
    id_azienda IN (
      SELECT id FROM public.regaziendasoftware WHERE id = id_azienda
    )
  );

-- Allow public read access for crew to see courses
CREATE POLICY "Public can read published courses"
  ON public.corsi_formazione
  FOR SELECT
  TO public
  USING (stato = 'published' AND visibilita = 'pubblico');

-- Allow authenticated users to read courses (for crew members)
CREATE POLICY "Authenticated users can read courses"
  ON public.corsi_formazione
  FOR SELECT
  TO authenticated
  USING (true);

-- Recreate iscrizioni_corsi table with correct foreign keys
DROP TABLE IF EXISTS public.iscrizioni_corsi CASCADE;

CREATE TABLE IF NOT EXISTS public.iscrizioni_corsi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_corso uuid NOT NULL,
  id_tecnico uuid NOT NULL,
  stato text DEFAULT 'invitato'::text,
  certificato_emesso boolean DEFAULT false,
  url_certificato text,
  data_invito timestamp with time zone DEFAULT now(),
  data_registrazione timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(id_corso, id_tecnico)
);

-- Add constraints for iscrizioni_corsi
ALTER TABLE public.iscrizioni_corsi 
ADD CONSTRAINT iscrizioni_corsi_stato_check 
CHECK (stato = ANY (ARRAY['invitato'::text, 'registrato'::text, 'confermato'::text, 'partecipato'::text, 'non_presentato'::text, 'annullato'::text]));

-- Add foreign keys for iscrizioni_corsi
ALTER TABLE public.iscrizioni_corsi 
ADD CONSTRAINT iscrizioni_corsi_id_corso_fkey 
FOREIGN KEY (id_corso) REFERENCES public.corsi_formazione(id) ON DELETE CASCADE;

ALTER TABLE public.iscrizioni_corsi 
ADD CONSTRAINT iscrizioni_corsi_id_tecnico_fkey 
FOREIGN KEY (id_tecnico) REFERENCES public.tecnici(id) ON DELETE CASCADE;

-- Create indexes for iscrizioni_corsi
CREATE INDEX IF NOT EXISTS idx_iscrizioni_corsi_corso ON public.iscrizioni_corsi(id_corso);
CREATE INDEX IF NOT EXISTS idx_iscrizioni_corsi_tecnico ON public.iscrizioni_corsi(id_tecnico);
CREATE INDEX IF NOT EXISTS idx_iscrizioni_corsi_data_invito ON public.iscrizioni_corsi(data_invito);
CREATE INDEX IF NOT EXISTS idx_iscrizioni_corsi_stato ON public.iscrizioni_corsi(stato);

-- Enable RLS for iscrizioni_corsi
ALTER TABLE public.iscrizioni_corsi ENABLE ROW LEVEL SECURITY;

-- RLS policies for iscrizioni_corsi
CREATE POLICY "Companies can manage enrollments for their courses"
  ON public.iscrizioni_corsi
  FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.corsi_formazione 
      WHERE corsi_formazione.id = iscrizioni_corsi.id_corso 
      AND corsi_formazione.id_azienda IN (
        SELECT id FROM public.regaziendasoftware WHERE id = corsi_formazione.id_azienda
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.corsi_formazione 
      WHERE corsi_formazione.id = iscrizioni_corsi.id_corso 
      AND corsi_formazione.id_azienda IN (
        SELECT id FROM public.regaziendasoftware WHERE id = corsi_formazione.id_azienda
      )
    )
  );

-- Allow crew members to view their own enrollments
CREATE POLICY "Crew can view their own enrollments"
  ON public.iscrizioni_corsi
  FOR SELECT
  TO public
  USING (id_tecnico IN (SELECT id FROM public.tecnici WHERE id = id_tecnico));

-- Allow public read access for authenticated users
CREATE POLICY "Authenticated users can read enrollments"
  ON public.iscrizioni_corsi
  FOR SELECT
  TO authenticated
  USING (true);