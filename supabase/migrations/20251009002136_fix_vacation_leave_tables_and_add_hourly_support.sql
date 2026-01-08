/*
  # Fix tabelle ferie e permessi + supporto ore
  
  ## Modifiche
  
  1. Modifica crew_ferie e crew_richieste_permessi per usare auth_user_id
  2. Modifica crew_richieste_permessi per supportare richieste orarie:
     - Aggiunge ora_inizio e ora_fine
     - Rimuove vincolo che richiede data_fine (per permessi di un solo giorno)
     - Modifica ore_richieste per essere calcolato automaticamente
  
  3. Aggiorna trigger per gestire ore correttamente
*/

-- Drop le tabelle esistenti e ricreale con la struttura corretta
DROP TABLE IF EXISTS crew_ferie CASCADE;
DROP TABLE IF EXISTS crew_richieste_permessi CASCADE;

-- Tabella crew_ferie (Richieste Ferie)
CREATE TABLE crew_ferie (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  azienda_id UUID NOT NULL REFERENCES regaziendasoftware(id) ON DELETE CASCADE,
  dipendente_id UUID NOT NULL,
  data_inizio DATE NOT NULL,
  data_fine DATE NOT NULL,
  giorni_richiesti INTEGER NOT NULL,
  giorni_residui_al_momento NUMERIC DEFAULT 0,
  motivo TEXT,
  stato TEXT DEFAULT 'in_attesa' CHECK (stato IN ('in_attesa', 'approvata', 'rifiutata')),
  approvato_da UUID,
  approvato_il TIMESTAMPTZ,
  motivo_rifiuto TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabella crew_richieste_permessi (Richieste Permessi) - Con supporto ore
CREATE TABLE crew_richieste_permessi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  azienda_id UUID NOT NULL REFERENCES regaziendasoftware(id) ON DELETE CASCADE,
  dipendente_id UUID NOT NULL,
  data DATE NOT NULL,
  ora_inizio TIME NOT NULL,
  ora_fine TIME NOT NULL,
  ore_richieste NUMERIC NOT NULL,
  ore_residue_al_momento NUMERIC DEFAULT 0,
  motivo TEXT,
  stato TEXT DEFAULT 'in_attesa' CHECK (stato IN ('in_attesa', 'approvata', 'rifiutata')),
  approvato_da UUID,
  approvato_il TIMESTAMPTZ,
  motivo_rifiuto TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE crew_ferie ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_richieste_permessi ENABLE ROW LEVEL SECURITY;

-- RLS Policies per crew_ferie
CREATE POLICY "Dipendenti possono leggere le proprie richieste ferie"
  ON crew_ferie FOR SELECT
  TO authenticated
  USING (dipendente_id = auth.uid());

CREATE POLICY "Dipendenti possono creare richieste ferie"
  ON crew_ferie FOR INSERT
  TO authenticated
  WITH CHECK (dipendente_id = auth.uid());

CREATE POLICY "Admin possono leggere tutte le richieste ferie"
  ON crew_ferie FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM registration_requests
      WHERE auth_user_id = auth.uid() AND registration_type_nome = 'Admin'
    )
  );

CREATE POLICY "Admin possono aggiornare richieste ferie"
  ON crew_ferie FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM registration_requests
      WHERE auth_user_id = auth.uid() AND registration_type_nome = 'Admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM registration_requests
      WHERE auth_user_id = auth.uid() AND registration_type_nome = 'Admin'
    )
  );

-- RLS Policies per crew_richieste_permessi
CREATE POLICY "Dipendenti possono leggere le proprie richieste permessi"
  ON crew_richieste_permessi FOR SELECT
  TO authenticated
  USING (dipendente_id = auth.uid());

CREATE POLICY "Dipendenti possono creare richieste permessi"
  ON crew_richieste_permessi FOR INSERT
  TO authenticated
  WITH CHECK (dipendente_id = auth.uid());

CREATE POLICY "Admin possono leggere tutte le richieste permessi"
  ON crew_richieste_permessi FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM registration_requests
      WHERE auth_user_id = auth.uid() AND registration_type_nome = 'Admin'
    )
  );

CREATE POLICY "Admin possono aggiornare richieste permessi"
  ON crew_richieste_permessi FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM registration_requests
      WHERE auth_user_id = auth.uid() AND registration_type_nome = 'Admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM registration_requests
      WHERE auth_user_id = auth.uid() AND registration_type_nome = 'Admin'
    )
  );

-- Trigger per auto-popolare giorni_residui_al_momento nelle richieste ferie
CREATE OR REPLACE FUNCTION populate_ferie_residue()
RETURNS TRIGGER AS $$
BEGIN
  SELECT COALESCE(ferie_residue, 0)
  INTO NEW.giorni_residui_al_momento
  FROM crew_saldi_ferie_permessi
  WHERE dipendente_id = NEW.dipendente_id
    AND anno = EXTRACT(YEAR FROM NEW.data_inizio)::INTEGER;
  
  IF NEW.giorni_residui_al_momento IS NULL THEN
    NEW.giorni_residui_al_momento := 0;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_insert_crew_ferie
  BEFORE INSERT ON crew_ferie
  FOR EACH ROW
  EXECUTE FUNCTION populate_ferie_residue();

-- Trigger per calcolare ore_richieste e popolare ore_residue_al_momento
CREATE OR REPLACE FUNCTION populate_permessi_residui_and_calculate_hours()
RETURNS TRIGGER AS $$
DECLARE
  ore_calcolate NUMERIC;
BEGIN
  -- Calcola ore richieste dalla differenza tra ora_fine e ora_inizio
  ore_calcolate := EXTRACT(EPOCH FROM (NEW.ora_fine - NEW.ora_inizio)) / 3600;
  NEW.ore_richieste := ore_calcolate;
  
  -- Recupera permessi residui dal saldo corrente
  SELECT COALESCE(permessi_residui, 0)
  INTO NEW.ore_residue_al_momento
  FROM crew_saldi_ferie_permessi
  WHERE dipendente_id = NEW.dipendente_id
    AND anno = EXTRACT(YEAR FROM NEW.data)::INTEGER;
  
  IF NEW.ore_residue_al_momento IS NULL THEN
    NEW.ore_residue_al_momento := 0;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_insert_crew_richieste_permessi
  BEFORE INSERT ON crew_richieste_permessi
  FOR EACH ROW
  EXECUTE FUNCTION populate_permessi_residui_and_calculate_hours();

-- Trigger per aggiornare saldi quando ferie vengono approvate
CREATE OR REPLACE FUNCTION update_saldi_on_ferie_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stato = 'approvata' AND OLD.stato != 'approvata' THEN
    UPDATE crew_saldi_ferie_permessi
    SET 
      ferie_godute = COALESCE(ferie_godute, 0) + NEW.giorni_richiesti,
      ferie_residue = COALESCE(ferie_totali, 0) - (COALESCE(ferie_godute, 0) + NEW.giorni_richiesti),
      updated_at = now()
    WHERE dipendente_id = NEW.dipendente_id
      AND anno = EXTRACT(YEAR FROM NEW.data_inizio)::INTEGER;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_update_crew_ferie_approval
  AFTER UPDATE ON crew_ferie
  FOR EACH ROW
  WHEN (NEW.stato = 'approvata' AND OLD.stato != 'approvata')
  EXECUTE FUNCTION update_saldi_on_ferie_approval();

-- Trigger per aggiornare saldi quando permessi vengono approvati
CREATE OR REPLACE FUNCTION update_saldi_on_permessi_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stato = 'approvata' AND OLD.stato != 'approvata' THEN
    UPDATE crew_saldi_ferie_permessi
    SET 
      permessi_goduti = COALESCE(permessi_goduti, 0) + NEW.ore_richieste,
      permessi_residui = COALESCE(permessi_totali, 0) - (COALESCE(permessi_goduti, 0) + NEW.ore_richieste),
      updated_at = now()
    WHERE dipendente_id = NEW.dipendente_id
      AND anno = EXTRACT(YEAR FROM NEW.data)::INTEGER;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_update_crew_richieste_permessi_approval
  AFTER UPDATE ON crew_richieste_permessi
  FOR EACH ROW
  WHEN (NEW.stato = 'approvata' AND OLD.stato != 'approvata')
  EXECUTE FUNCTION update_saldi_on_permessi_approval();

-- Index per performance
CREATE INDEX IF NOT EXISTS idx_crew_ferie_dipendente ON crew_ferie(dipendente_id);
CREATE INDEX IF NOT EXISTS idx_crew_ferie_stato ON crew_ferie(stato);
CREATE INDEX IF NOT EXISTS idx_crew_ferie_data_inizio ON crew_ferie(data_inizio);
CREATE INDEX IF NOT EXISTS idx_crew_richieste_permessi_dipendente ON crew_richieste_permessi(dipendente_id);
CREATE INDEX IF NOT EXISTS idx_crew_richieste_permessi_stato ON crew_richieste_permessi(stato);
CREATE INDEX IF NOT EXISTS idx_crew_richieste_permessi_data ON crew_richieste_permessi(data);