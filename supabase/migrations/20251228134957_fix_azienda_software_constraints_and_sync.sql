/*
  # Fix azienda_software: rimuove constraint email UNIQUE e sincronizza dati

  1. Modifiche
    - Ricrea tutti i constraint TRANNE il vincolo UNIQUE su email
    - Una stessa azienda può avere più software, quindi la stessa email può apparire più volte
    - Aggiunge trigger per sincronizzazione automatica dei dati auth

  2. Constraint Ricreati
    - PRIMARY KEY su id
    - UNIQUE su (azienda_id, software_id)
    - FOREIGN KEY su auth_user_id, azienda_id, software_id
    - CHECK su stato

  3. Sicurezza
    - Mantiene tutti i dati esistenti
    - Non modifica i record, solo i constraint
    - Il trigger sync_azienda_auth_data() popolerà automaticamente i campi sui nuovi inserimenti
*/

-- 1. Ricrea i constraint base (senza UNIQUE su email)
DO $$ 
BEGIN
  -- PRIMARY KEY
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'azienda_software_pkey' 
    AND conrelid = 'azienda_software'::regclass
  ) THEN
    ALTER TABLE azienda_software ADD CONSTRAINT azienda_software_pkey PRIMARY KEY (id);
  END IF;

  -- UNIQUE su (azienda_id, software_id)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'uk_azienda_software_unique' 
    AND conrelid = 'azienda_software'::regclass
  ) THEN
    ALTER TABLE azienda_software ADD CONSTRAINT uk_azienda_software_unique UNIQUE (azienda_id, software_id);
  END IF;

  -- FOREIGN KEY auth_user_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'azienda_software_auth_user_id_fkey' 
    AND conrelid = 'azienda_software'::regclass
  ) THEN
    ALTER TABLE azienda_software ADD CONSTRAINT azienda_software_auth_user_id_fkey 
      FOREIGN KEY (auth_user_id) REFERENCES auth.users (id) ON DELETE SET NULL;
  END IF;

  -- FOREIGN KEY azienda_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_azienda_software_azienda' 
    AND conrelid = 'azienda_software'::regclass
  ) THEN
    ALTER TABLE azienda_software ADD CONSTRAINT fk_azienda_software_azienda 
      FOREIGN KEY (azienda_id) REFERENCES regaziendasoftware (id) ON DELETE CASCADE;
  END IF;

  -- FOREIGN KEY software_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_azienda_software_software' 
    AND conrelid = 'azienda_software'::regclass
  ) THEN
    ALTER TABLE azienda_software ADD CONSTRAINT fk_azienda_software_software 
      FOREIGN KEY (software_id) REFERENCES listasoftware (id) ON DELETE CASCADE;
  END IF;

  -- CHECK su stato
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_azienda_software_stato' 
    AND conrelid = 'azienda_software'::regclass
  ) THEN
    ALTER TABLE azienda_software ADD CONSTRAINT chk_azienda_software_stato 
      CHECK (stato = ANY (ARRAY['attivo'::text, 'sospeso'::text, 'scaduto'::text, 'cancellato'::text, 'prova'::text]));
  END IF;
END $$;

-- 2. Ricrea gli indici
CREATE INDEX IF NOT EXISTS idx_azienda_software_azienda_id ON azienda_software (azienda_id);
CREATE INDEX IF NOT EXISTS idx_azienda_software_software_id ON azienda_software (software_id);
CREATE INDEX IF NOT EXISTS idx_azienda_software_stato ON azienda_software (stato);
CREATE INDEX IF NOT EXISTS idx_azienda_software_data_registrazione ON azienda_software (data_registrazione);
CREATE INDEX IF NOT EXISTS idx_azienda_software_data_scadenza ON azienda_software (data_scadenza);
CREATE INDEX IF NOT EXISTS idx_azienda_software_lookup ON azienda_software (azienda_id, software_id, stato);
CREATE INDEX IF NOT EXISTS idx_azienda_software_nome ON azienda_software (software_nome);
CREATE INDEX IF NOT EXISTS idx_azienda_software_codice ON azienda_software (software_codice);
CREATE INDEX IF NOT EXISTS idx_azienda_software_nome_stato ON azienda_software (software_nome, stato);
CREATE INDEX IF NOT EXISTS idx_azienda_software_auth_user_id ON azienda_software (auth_user_id);

-- 3. Ricrea i trigger esistenti
DROP TRIGGER IF EXISTS auto_populate_azienda_nome_trigger ON azienda_software;
CREATE TRIGGER auto_populate_azienda_nome_trigger 
  BEFORE INSERT ON azienda_software 
  FOR EACH ROW EXECUTE FUNCTION auto_populate_azienda_nome();

DROP TRIGGER IF EXISTS sync_software_data_trigger ON azienda_software;
CREATE TRIGGER sync_software_data_trigger 
  BEFORE INSERT OR UPDATE ON azienda_software 
  FOR EACH ROW EXECUTE FUNCTION sync_software_data_in_azienda_software();

DROP TRIGGER IF EXISTS update_azienda_software_timestamp ON azienda_software;
CREATE TRIGGER update_azienda_software_timestamp 
  BEFORE UPDATE ON azienda_software 
  FOR EACH ROW EXECUTE FUNCTION update_azienda_software_updated_at();

-- 4. Trigger per sincronizzazione dati auth (già creato nella migrazione precedente)
DROP TRIGGER IF EXISTS sync_azienda_auth_data_trigger ON azienda_software;
CREATE TRIGGER sync_azienda_auth_data_trigger
  BEFORE INSERT OR UPDATE ON azienda_software
  FOR EACH ROW EXECUTE FUNCTION sync_azienda_auth_data();

-- Commento
COMMENT ON TABLE azienda_software IS 'Tabella che associa aziende e software. La stessa email può apparire più volte (una per software).';
