/*
  # Aggiungi campi per rettifiche orari

  1. Modifiche alla tabella `timesheet_entries`
    - Aggiungi colonna `is_rectified` (boolean) - indica se l'orario è stato rettificato manualmente
    - Aggiungi colonna `rectified_by` (uuid) - ID dell'utente che ha fatto la rettifica
    - Aggiungi colonna `rectified_at` (timestamptz) - quando è stata fatta la rettifica
    - Aggiungi colonna `rectification_notes` (text) - note sulla rettifica

  2. Note
    - Questi campi permettono di tracciare le rettifiche manuali degli orari
    - Utile quando un dipendente dimentica di fare check-in/out
    - La rettifica deve essere visibile e tracciabile per audit
*/

-- Aggiungi campi per rettifiche alla tabella timesheet_entries
DO $$
BEGIN
  -- Campo: è una rettifica?
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'timesheet_entries' AND column_name = 'is_rectified'
  ) THEN
    ALTER TABLE timesheet_entries ADD COLUMN is_rectified boolean DEFAULT false NOT NULL;
  END IF;

  -- Campo: chi ha fatto la rettifica
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'timesheet_entries' AND column_name = 'rectified_by'
  ) THEN
    ALTER TABLE timesheet_entries ADD COLUMN rectified_by uuid REFERENCES auth.users(id);
  END IF;

  -- Campo: quando è stata fatta la rettifica
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'timesheet_entries' AND column_name = 'rectified_at'
  ) THEN
    ALTER TABLE timesheet_entries ADD COLUMN rectified_at timestamptz;
  END IF;

  -- Campo: note sulla rettifica
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'timesheet_entries' AND column_name = 'rectification_notes'
  ) THEN
    ALTER TABLE timesheet_entries ADD COLUMN rectification_notes text;
  END IF;
END $$;

-- Crea indice per query su rettifiche
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_rectified 
ON timesheet_entries(is_rectified) 
WHERE is_rectified = true;