/*
  # Fix uid() function error in corsi_formazione table

  1. Drop and recreate table with correct auth.uid() function
  2. Security
    - Enable RLS on `corsi_formazione` table
    - Add policy for companies to manage own courses
    - Add policy for crew to read courses they're enrolled in or public courses
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
  ora_inizio time without time zone NOT NULL,
  ora_fine time without time zone NOT NULL,
  luogo text NOT NULL,
  istruttore text,
  obbligatorio boolean DEFAULT false,
  categoria text NOT NULL,
  materiali text[],
  visibilita text NOT NULL DEFAULT 'pubblico',
  stato text NOT NULL DEFAULT 'draft',
  confermato boolean DEFAULT false,
  data_creazione timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT corsi_formazione_categoria_check CHECK (
    categoria = ANY (ARRAY['sicurezza'::text, 'tecnico'::text, 'soft_skills'::text, 'certificazione'::text, 'altro'::text])
  ),
  CONSTRAINT corsi_formazione_visibilita_check CHECK (
    visibilita = ANY (ARRAY['pubblico'::text, 'privato'::text])
  ),
  CONSTRAINT corsi_formazione_stato_check CHECK (
    stato = ANY (ARRAY['draft'::text, 'published'::text, 'confirmed'::text, 'completed'::text])
  ),
  CONSTRAINT corsi_formazione_id_azienda_fkey FOREIGN KEY (id_azienda) 
    REFERENCES regaziendasoftware(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.corsi_formazione ENABLE ROW LEVEL SECURITY;

-- Create policies with correct auth.uid() function
CREATE POLICY "Aziende possono gestire propri corsi formazione"
  ON public.corsi_formazione
  FOR ALL
  TO authenticated
  USING (id_azienda = auth.uid())
  WITH CHECK (id_azienda = auth.uid());

CREATE POLICY "Crew possono leggere corsi pubblici o a cui sono iscritti"
  ON public.corsi_formazione
  FOR SELECT
  TO authenticated
  USING (
    visibilita = 'pubblico'::text 
    OR 
    EXISTS (
      SELECT 1 FROM iscrizioni_corsi 
      WHERE iscrizioni_corsi.id_corso = corsi_formazione.id 
      AND iscrizioni_corsi.id_tecnico = auth.uid()
    )
  );

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_corsi_formazione_azienda ON public.corsi_formazione(id_azienda);
CREATE INDEX IF NOT EXISTS idx_corsi_formazione_data ON public.corsi_formazione(data);
CREATE INDEX IF NOT EXISTS idx_corsi_formazione_stato ON public.corsi_formazione(stato);
CREATE INDEX IF NOT EXISTS idx_corsi_formazione_visibilita ON public.corsi_formazione(visibilita);