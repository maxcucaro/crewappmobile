/*
  # Espansione Sistema Tariffari Flessibile

  1. Nuove Tabelle
    - `rate_templates` - Template tariffari con categorie flessibili
    - `rate_conditions` - Condizioni di applicazione (giorni festivi, ruoli, etc.)
    - `employee_rate_assignments` - Assegnazione multipla template ai dipendenti
    - `rate_calculations` - Calcoli automatici per eventi

  2. Nuovi Enum Types
    - `rate_category_type` - Categorie tariffari (stipendio, straordinario, bonus, etc.)
    - `condition_type` - Tipi di condizioni (giorno_festivo, ruolo, tipo_evento, etc.)
    - `calculation_status` - Stati calcolo (pending, calculated, paid)

  3. Security
    - Enable RLS su tutte le nuove tabelle
    - Policy per aziende e dipendenti
*/

-- Crea nuovi enum types
CREATE TYPE rate_category_type AS ENUM (
  'stipendio_base',
  'straordinario_festivo', 
  'straordinario_trasferta',
  'straordinario_notturno',
  'bonus_responsabile',
  'bonus_autista',
  'bonus_guida_automezzo',
  'indennita_trasferta',
  'indennita_reperibilita',
  'rimborso_chilometrico',
  'altro'
);

CREATE TYPE condition_type AS ENUM (
  'giorno_festivo',
  'giorno_feriale',
  'orario_notturno',
  'tipo_evento_magazzino',
  'tipo_evento_trasferta',
  'ruolo_responsabile',
  'ruolo_autista',
  'ruolo_tecnico_audio',
  'ruolo_tecnico_luci',
  'ruolo_tecnico_video',
  'ore_minime',
  'giorni_consecutivi',
  'altro'
);

CREATE TYPE calculation_status AS ENUM (
  'pending',
  'calculated', 
  'approved',
  'paid',
  'cancelled'
);

-- Tabella template tariffari flessibili
CREATE TABLE IF NOT EXISTS rate_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  azienda_id uuid NOT NULL REFERENCES regaziendasoftware(id) ON DELETE CASCADE,
  nome_template text NOT NULL,
  descrizione text,
  categoria rate_category_type NOT NULL,
  tipo_calcolo text NOT NULL CHECK (tipo_calcolo IN ('orario', 'giornaliero', 'mensile', 'fisso')),
  
  -- Valori tariffari
  tariffa_oraria numeric(10,2),
  tariffa_giornaliera numeric(10,2), 
  stipendio_mensile numeric(10,2),
  importo_fisso numeric(10,2),
  
  -- Moltiplicatori per straordinari
  moltiplicatore numeric(3,2) DEFAULT 1.0,
  
  -- Benefit inclusi
  include_buoni_pasto boolean DEFAULT false,
  numero_buoni_pasto integer DEFAULT 0,
  include_bonus_extra boolean DEFAULT false,
  importo_bonus_extra numeric(10,2) DEFAULT 0,
  include_rimborso_spese boolean DEFAULT false,
  
  -- Configurazione
  attivo boolean DEFAULT true,
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT check_tariffa_values CHECK (
    (tipo_calcolo = 'orario' AND tariffa_oraria IS NOT NULL) OR
    (tipo_calcolo = 'giornaliero' AND tariffa_giornaliera IS NOT NULL) OR  
    (tipo_calcolo = 'mensile' AND stipendio_mensile IS NOT NULL) OR
    (tipo_calcolo = 'fisso' AND importo_fisso IS NOT NULL)
  )
);

-- Tabella condizioni di applicazione
CREATE TABLE IF NOT EXISTS rate_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES rate_templates(id) ON DELETE CASCADE,
  tipo_condizione condition_type NOT NULL,
  valore_condizione text, -- es. "responsabile", ">=8", "magazzino"
  descrizione text,
  obbligatoria boolean DEFAULT true, -- se false, è opzionale
  created_at timestamptz DEFAULT now()
);

-- Tabella assegnazione template ai dipendenti
CREATE TABLE IF NOT EXISTS employee_rate_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  azienda_id uuid NOT NULL REFERENCES regaziendasoftware(id) ON DELETE CASCADE,
  dipendente_id uuid NOT NULL REFERENCES registration_requests(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES rate_templates(id) ON DELETE CASCADE,
  
  -- Override specifici per questo dipendente (opzionali)
  tariffa_personalizzata numeric(10,2),
  moltiplicatore_personalizzato numeric(3,2),
  note_personalizzate text,
  
  -- Validità
  data_inizio date DEFAULT CURRENT_DATE,
  data_fine date, -- NULL = illimitato
  attivo boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(dipendente_id, template_id, data_inizio)
);

-- Tabella calcoli automatici per eventi
CREATE TABLE IF NOT EXISTS rate_calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  azienda_id uuid NOT NULL REFERENCES regaziendasoftware(id) ON DELETE CASCADE,
  dipendente_id uuid NOT NULL REFERENCES registration_requests(id) ON DELETE CASCADE,
  evento_id uuid REFERENCES events(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES rate_templates(id) ON DELETE CASCADE,
  
  -- Dettagli calcolo
  data_lavoro date NOT NULL,
  ore_lavorate numeric(5,2),
  giorni_lavorati numeric(3,1),
  condizioni_verificate text[], -- array delle condizioni che si sono verificate
  
  -- Importi calcolati
  importo_base numeric(10,2) NOT NULL DEFAULT 0,
  importo_straordinari numeric(10,2) DEFAULT 0,
  importo_bonus numeric(10,2) DEFAULT 0,
  importo_totale numeric(10,2) NOT NULL DEFAULT 0,
  
  -- Stato
  stato calculation_status DEFAULT 'pending',
  note_calcolo text,
  calcolato_da uuid REFERENCES auth.users(id),
  calcolato_il timestamptz DEFAULT now(),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_rate_templates_azienda ON rate_templates(azienda_id);
CREATE INDEX IF NOT EXISTS idx_rate_templates_categoria ON rate_templates(categoria);
CREATE INDEX IF NOT EXISTS idx_rate_conditions_template ON rate_conditions(template_id);
CREATE INDEX IF NOT EXISTS idx_employee_assignments_dipendente ON employee_rate_assignments(dipendente_id);
CREATE INDEX IF NOT EXISTS idx_employee_assignments_template ON employee_rate_assignments(template_id);
CREATE INDEX IF NOT EXISTS idx_rate_calculations_dipendente ON rate_calculations(dipendente_id);
CREATE INDEX IF NOT EXISTS idx_rate_calculations_evento ON rate_calculations(evento_id);
CREATE INDEX IF NOT EXISTS idx_rate_calculations_data ON rate_calculations(data_lavoro);

-- Enable RLS
ALTER TABLE rate_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_rate_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_calculations ENABLE ROW LEVEL SECURITY;

-- RLS Policies per rate_templates
CREATE POLICY "Aziende possono gestire i propri template"
  ON rate_templates
  FOR ALL
  TO authenticated
  USING (azienda_id = auth.uid())
  WITH CHECK (azienda_id = auth.uid());

CREATE POLICY "Dipendenti possono leggere template assegnati"
  ON rate_templates
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT template_id 
      FROM employee_rate_assignments 
      WHERE dipendente_id = auth.uid() AND attivo = true
    )
  );

-- RLS Policies per rate_conditions
CREATE POLICY "Aziende possono gestire condizioni dei propri template"
  ON rate_conditions
  FOR ALL
  TO authenticated
  USING (
    template_id IN (
      SELECT id FROM rate_templates WHERE azienda_id = auth.uid()
    )
  )
  WITH CHECK (
    template_id IN (
      SELECT id FROM rate_templates WHERE azienda_id = auth.uid()
    )
  );

-- RLS Policies per employee_rate_assignments
CREATE POLICY "Aziende possono gestire assegnazioni dei propri dipendenti"
  ON employee_rate_assignments
  FOR ALL
  TO authenticated
  USING (azienda_id = auth.uid())
  WITH CHECK (azienda_id = auth.uid());

CREATE POLICY "Dipendenti possono leggere le proprie assegnazioni"
  ON employee_rate_assignments
  FOR SELECT
  TO authenticated
  USING (dipendente_id = auth.uid());

-- RLS Policies per rate_calculations
CREATE POLICY "Aziende possono gestire calcoli dei propri dipendenti"
  ON rate_calculations
  FOR ALL
  TO authenticated
  USING (azienda_id = auth.uid())
  WITH CHECK (azienda_id = auth.uid());

CREATE POLICY "Dipendenti possono leggere i propri calcoli"
  ON rate_calculations
  FOR SELECT
  TO authenticated
  USING (dipendente_id = auth.uid());

-- Funzione per aggiornare timestamp
CREATE OR REPLACE FUNCTION update_rate_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_employee_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_rate_calculations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger per aggiornare timestamp
CREATE TRIGGER update_rate_templates_timestamp
  BEFORE UPDATE ON rate_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_rate_templates_updated_at();

CREATE TRIGGER update_employee_assignments_timestamp
  BEFORE UPDATE ON employee_rate_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_employee_assignments_updated_at();

CREATE TRIGGER update_rate_calculations_timestamp
  BEFORE UPDATE ON rate_calculations
  FOR EACH ROW
  EXECUTE FUNCTION update_rate_calculations_updated_at();