/*
  # Create crew_turni_completati table

  1. New Tables
    - `crew_turni_completati`
      - `id` (uuid, primary key)
      - `id_turno` (uuid, foreign key to crew_assegnazione_turni)
      - `nome_turno` (text)
      - `giorno_turno` (date)
      - `id_azienda` (uuid, foreign key to regaziendasoftware)
      - `nome_azienda` (text)
      - `id_dipendente` (uuid, foreign key to registration_requests)
      - `nome_dipendente` (text)
      - `check_in_turno` (time)
      - `check_out_turno` (time)
      - `turno_completato` (boolean, computed from check_in and check_out)
      - `conteggio_ore` (interval, computed from check_in and check_out times)
      - `buoni_pasto_assegnato` (boolean)
      - `pasto_aziendale_usufruito` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `crew_turni_completati` table
    - Add policies for companies to manage their own shift completions
    - Add policies for employees to read their own shift completions
</sql>

CREATE TABLE IF NOT EXISTS crew_turni_completati (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_turno uuid NOT NULL,
  nome_turno text NOT NULL,
  giorno_turno date NOT NULL,
  id_azienda uuid NOT NULL,
  nome_azienda text NOT NULL,
  id_dipendente uuid NOT NULL,
  nome_dipendente text NOT NULL,
  check_in_turno time,
  check_out_turno time,
  turno_completato boolean GENERATED ALWAYS AS (
    check_in_turno IS NOT NULL AND check_out_turno IS NOT NULL
  ) STORED,
  conteggio_ore interval GENERATED ALWAYS AS (
    CASE 
      WHEN check_in_turno IS NOT NULL AND check_out_turno IS NOT NULL 
      THEN (check_out_turno - check_in_turno)
      ELSE NULL
    END
  ) STORED,
  buoni_pasto_assegnato boolean DEFAULT false,
  pasto_aziendale_usufruito boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE crew_turni_completati ENABLE ROW LEVEL SECURITY;

-- Policies for companies to manage their own shift completions
CREATE POLICY "Companies can manage own shift completions"
  ON crew_turni_completati
  FOR ALL
  TO authenticated
  USING (
    id_azienda IN (
      SELECT r.id
      FROM regaziendasoftware r
      WHERE (
        (r.auth_user_id = uid()) OR 
        (r.email = (SELECT users.email FROM auth.users WHERE users.id = uid())::text) OR 
        (r.id = uid())
      ) AND r.attivo = true
    )
  )
  WITH CHECK (
    id_azienda IN (
      SELECT r.id
      FROM regaziendasoftware r
      WHERE (
        (r.auth_user_id = uid()) OR 
        (r.email = (SELECT users.email FROM auth.users WHERE users.id = uid())::text) OR 
        (r.id = uid())
      ) AND r.attivo = true
    )
  );

-- Policies for employees to read their own shift completions
CREATE POLICY "Employees can read own shift completions"
  ON crew_turni_completati
  FOR SELECT
  TO authenticated
  USING (id_dipendente = uid());

-- Foreign key constraints
ALTER TABLE crew_turni_completati 
ADD CONSTRAINT fk_crew_turni_completati_turno 
FOREIGN KEY (id_turno) REFERENCES crew_assegnazione_turni(id) ON DELETE CASCADE;

ALTER TABLE crew_turni_completati 
ADD CONSTRAINT fk_crew_turni_completati_azienda 
FOREIGN KEY (id_azienda) REFERENCES regaziendasoftware(id) ON DELETE CASCADE;

ALTER TABLE crew_turni_completati 
ADD CONSTRAINT fk_crew_turni_completati_dipendente 
FOREIGN KEY (id_dipendente) REFERENCES registration_requests(id) ON DELETE CASCADE;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_crew_turni_completati_dipendente 
ON crew_turni_completati(id_dipendente);

CREATE INDEX IF NOT EXISTS idx_crew_turni_completati_azienda 
ON crew_turni_completati(id_azienda);

CREATE INDEX IF NOT EXISTS idx_crew_turni_completati_giorno 
ON crew_turni_completati(giorno_turno);

CREATE INDEX IF NOT EXISTS idx_crew_turni_completati_completato 
ON crew_turni_completati(turno_completato);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_crew_turni_completati_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_crew_turni_completati_timestamp
  BEFORE UPDATE ON crew_turni_completati
  FOR EACH ROW
  EXECUTE FUNCTION update_crew_turni_completati_updated_at();