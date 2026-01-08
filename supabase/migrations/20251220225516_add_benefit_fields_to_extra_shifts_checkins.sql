/*
  # Aggiungi campi benefit turno extra

  ## Descrizione
  Aggiunge alla tabella `extra_shifts_checkins` i campi per memorizzare 
  il benefit del turno extra quando il dipendente ha questa tariffa assegnata.

  ## 1. Modifiche
  
  ### Colonne aggiunte a `extra_shifts_checkins`:
  - `benefit_tariffa_id` (UUID, nullable): riferimento alla tariffa turno extra dalla tabella crew_tariffe
  - `benefit_importo_orario` (numeric, nullable): importo orario personalizzato del benefit turno extra
  
  ## 2. Logica di utilizzo
  
  Durante il check-in del turno extra:
  1. Il sistema verifica se il dipendente ha una tariffa per "turno extra" assegnata in crew_assegnazionetariffa
  2. Se presente, recupera l'ID della tariffa e l'importo (da tariffe_overrides, tariffe_personalizzate o crew_tariffe.importo)
  3. Salva benefit_tariffa_id e benefit_importo_orario nel record di check-in
  
  ## 3. Note
  - Le colonne sono nullable per non rompere i check-in esistenti
  - La logica applicativa è gestita dal frontend (ExtraCheckIn.tsx)
*/

-- Aggiungi colonna benefit_tariffa_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extra_shifts_checkins' 
      AND column_name = 'benefit_tariffa_id'
  ) THEN
    ALTER TABLE extra_shifts_checkins 
    ADD COLUMN benefit_tariffa_id uuid REFERENCES crew_tariffe(id);
    
    -- Aggiungi commento
    COMMENT ON COLUMN extra_shifts_checkins.benefit_tariffa_id IS 
    'ID della tariffa turno extra assegnata al dipendente (se presente)';
  END IF;
END $$;

-- Aggiungi colonna benefit_importo_orario
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extra_shifts_checkins' 
      AND column_name = 'benefit_importo_orario'
  ) THEN
    ALTER TABLE extra_shifts_checkins 
    ADD COLUMN benefit_importo_orario numeric(10,2);
    
    -- Aggiungi commento
    COMMENT ON COLUMN extra_shifts_checkins.benefit_importo_orario IS 
    'Importo orario del benefit turno extra (da contratto o personalizzato)';
  END IF;
END $$;

-- Aggiungi indice per performance su benefit_tariffa_id
CREATE INDEX IF NOT EXISTS idx_extra_shifts_benefit_tariffa 
ON extra_shifts_checkins(benefit_tariffa_id) 
WHERE benefit_tariffa_id IS NOT NULL;