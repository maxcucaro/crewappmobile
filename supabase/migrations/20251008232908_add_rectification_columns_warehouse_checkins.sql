/*
  # Add Time Rectification Support to Warehouse Check-ins

  ## Changes
  1. New Columns Added to `warehouse_checkins`:
    - `rectified_check_in_time` (timestamptz): Orario di entrata rettificato
    - `rectified_check_out_time` (timestamptz): Orario di uscita rettificato
    - `rectified_pausa_pranzo` (boolean): Pausa pranzo rettificata
    - `rectification_note` (text): Nota obbligatoria che spiega il motivo della rettifica
    - `rectified_by` (uuid): ID dell'utente che ha fatto la rettifica
    - `rectified_at` (timestamptz): Data e ora della rettifica
    - `rectified_total_hours` (numeric): Ore totali ricalcolate dopo rettifica
    - `overtime_requested` (boolean): Indica se sono stati richiesti straordinari

  ## Purpose
  - Permettere la rettifica degli orari di check-in e check-out
  - Tracciare chi e quando ha fatto la rettifica
  - Richiedere una nota obbligatoria per ogni rettifica
  - Supportare la richiesta di straordinari se le ore superano il turno previsto

  ## Security
  - Tutti i campi sono nullable (NULL di default)
  - Solo gli utenti autenticati possono modificare i propri record
*/

-- Add rectification columns to warehouse_checkins
ALTER TABLE warehouse_checkins
  ADD COLUMN IF NOT EXISTS rectified_check_in_time timestamptz,
  ADD COLUMN IF NOT EXISTS rectified_check_out_time timestamptz,
  ADD COLUMN IF NOT EXISTS rectified_pausa_pranzo boolean,
  ADD COLUMN IF NOT EXISTS rectification_note text,
  ADD COLUMN IF NOT EXISTS rectified_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS rectified_at timestamptz,
  ADD COLUMN IF NOT EXISTS rectified_total_hours numeric(10, 2),
  ADD COLUMN IF NOT EXISTS overtime_requested boolean DEFAULT false;

-- Create index for faster queries on rectified records
CREATE INDEX IF NOT EXISTS idx_warehouse_checkins_rectified 
  ON warehouse_checkins(rectified_at) 
  WHERE rectified_at IS NOT NULL;

-- Add constraint: if any rectification field is set, note must be present
CREATE OR REPLACE FUNCTION check_rectification_note()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.rectified_check_in_time IS NOT NULL OR 
      NEW.rectified_check_out_time IS NOT NULL OR 
      NEW.rectified_pausa_pranzo IS NOT NULL) AND 
     (NEW.rectification_note IS NULL OR trim(NEW.rectification_note) = '') THEN
    RAISE EXCEPTION 'La nota di rettifica è obbligatoria quando si modificano gli orari';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_rectification_note ON warehouse_checkins;
CREATE TRIGGER validate_rectification_note
  BEFORE INSERT OR UPDATE ON warehouse_checkins
  FOR EACH ROW
  EXECUTE FUNCTION check_rectification_note();