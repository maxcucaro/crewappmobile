/*
  # Aggiungi riferimento turno alla tabella warehouse_checkins

  1. Modifiche alla Tabella
    - Aggiungi colonna `shift_id` a `warehouse_checkins`
    - Collega al turno specifico tramite `crew_template_turni.id_template`
    - Mantieni compatibilità con dati esistenti

  2. Relazioni
    - `warehouse_checkins.shift_id` → `crew_template_turni.id_template`
    - Permette di sapere esattamente a quale turno si riferisce ogni check-in

  3. Indici
    - Indice per performance su `shift_id`
    - Indice composto per ricerche rapide

  4. Note
    - Colonna nullable per compatibilità con check-ins esistenti
    - Foreign key con CASCADE per pulizia automatica
*/

-- Aggiungi colonna shift_id alla tabella warehouse_checkins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_checkins' AND column_name = 'shift_id'
  ) THEN
    ALTER TABLE warehouse_checkins 
    ADD COLUMN shift_id uuid REFERENCES crew_template_turni(id_template) ON DELETE CASCADE;
  END IF;
END $$;

-- Aggiungi indice per performance
CREATE INDEX IF NOT EXISTS idx_warehouse_checkins_shift_id 
ON warehouse_checkins(shift_id);

-- Aggiungi indice composto per ricerche rapide
CREATE INDEX IF NOT EXISTS idx_warehouse_checkins_crew_shift_date 
ON warehouse_checkins(crew_id, shift_id, date);

-- Aggiungi commento alla colonna
COMMENT ON COLUMN warehouse_checkins.shift_id IS 'Riferimento al turno specifico dalla tabella crew_template_turni';