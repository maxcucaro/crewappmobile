/*
  # Ricrea tabella corsi_formazione

  1. Elimina tabella esistente
  2. Ricrea tabella con struttura corretta
  3. Aggiunge RLS policies funzionanti
  4. Aggiunge indici per performance
*/

-- Elimina tabella esistente se esiste
DROP TABLE IF EXISTS corsi_formazione CASCADE;

-- Ricrea tabella corsi_formazione
CREATE TABLE corsi_formazione (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo text NOT NULL,
  descrizione text,
  id_azienda uuid NOT NULL REFERENCES regaziendasoftware(id) ON DELETE CASCADE,
  data date NOT NULL,
  ora_inizio time NOT NULL,
  ora_fine time NOT NULL,
  luogo text NOT NULL,
  istruttore text,
  obbligatorio boolean DEFAULT false,
  categoria text NOT NULL CHECK (categoria = ANY (ARRAY['sicurezza'::text, 'tecnico'::text, 'soft_skills'::text, 'certificazione'::text, 'altro'::text])),
  materiali text[],
  visibilita text NOT NULL DEFAULT 'pubblico' CHECK (visibilita = ANY (ARRAY['pubblico'::text, 'privato'::text])),
  stato text NOT NULL DEFAULT 'draft' CHECK (stato = ANY (ARRAY['draft'::text, 'published'::text, 'confirmed'::text, 'completed'::text])),
  confermato boolean DEFAULT false,
  data_creazione timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Abilita RLS
ALTER TABLE corsi_formazione ENABLE ROW LEVEL SECURITY;

-- Policy per SELECT - Aziende vedono i propri corsi, tecnici vedono corsi pubblici o a cui sono iscritti
CREATE POLICY "Aziende possono vedere i propri corsi"
  ON corsi_formazione
  FOR SELECT
  TO authenticated
  USING (id_azienda = auth.uid());

CREATE POLICY "Tecnici possono vedere corsi pubblici"
  ON corsi_formazione
  FOR SELECT
  TO authenticated
  USING (visibilita = 'pubblico');

-- Policy per INSERT - Solo aziende possono creare corsi
CREATE POLICY "Aziende possono creare corsi"
  ON corsi_formazione
  FOR INSERT
  TO authenticated
  WITH CHECK (id_azienda = auth.uid());

-- Policy per UPDATE - Solo aziende possono aggiornare i propri corsi
CREATE POLICY "Aziende possono aggiornare i propri corsi"
  ON corsi_formazione
  FOR UPDATE
  TO authenticated
  USING (id_azienda = auth.uid())
  WITH CHECK (id_azienda = auth.uid());

-- Policy per DELETE - Solo aziende possono eliminare i propri corsi
CREATE POLICY "Aziende possono eliminare i propri corsi"
  ON corsi_formazione
  FOR DELETE
  TO authenticated
  USING (id_azienda = auth.uid());

-- Indici per performance
CREATE INDEX idx_corsi_formazione_azienda ON corsi_formazione(id_azienda);
CREATE INDEX idx_corsi_formazione_data ON corsi_formazione(data);
CREATE INDEX idx_corsi_formazione_stato ON corsi_formazione(stato);
CREATE INDEX idx_corsi_formazione_visibilita ON corsi_formazione(visibilita);