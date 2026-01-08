/*
  # Add company and course title columns to course assignments

  1. Changes
    - Add `azienda_id` column to track which company the assignment belongs to
    - Add `corso_titolo` column to store course title for faster queries
    - Add foreign key constraint to link to companies table
    - Update existing records to populate azienda_id from corso_id

  2. Data Migration
    - Populate azienda_id from existing corso relationships
*/

-- Add azienda_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'crew_assegnazionecorsi' AND column_name = 'azienda_id'
  ) THEN
    ALTER TABLE crew_assegnazionecorsi ADD COLUMN azienda_id uuid;
  END IF;
END $$;

-- Add corso_titolo column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'crew_assegnazionecorsi' AND column_name = 'corso_titolo'
  ) THEN
    ALTER TABLE crew_assegnazionecorsi ADD COLUMN corso_titolo text;
  END IF;
END $$;

-- Populate azienda_id from crew_corsi table for existing records
UPDATE crew_assegnazionecorsi ca
SET azienda_id = cc.azienda_id
FROM crew_corsi cc
WHERE ca.corso_id = cc.id
AND ca.azienda_id IS NULL;

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'crew_assegnazionecorsi_azienda_id_fkey'
    AND table_name = 'crew_assegnazionecorsi'
  ) THEN
    ALTER TABLE crew_assegnazionecorsi
    ADD CONSTRAINT crew_assegnazionecorsi_azienda_id_fkey
    FOREIGN KEY (azienda_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_crew_assegnazionecorsi_azienda_id
ON crew_assegnazionecorsi(azienda_id);

CREATE INDEX IF NOT EXISTS idx_crew_assegnazionecorsi_corso_id_azienda_id
ON crew_assegnazionecorsi(corso_id, azienda_id);
