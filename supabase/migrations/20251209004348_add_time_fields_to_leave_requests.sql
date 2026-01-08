/*
  # Add time fields to crew_richiesteferie_permessi
  
  1. Changes
    - Add `orario_inizio` time field for leave request start time
    - Add `orario_fine` time field for leave request end time
    - Add `ore_richieste` numeric field to store hours requested (for permits)
  
  2. Purpose
    - Properly handle leave requests (permessi) with specific time ranges
    - Separate time information from the reason field
    - Calculate hours for permits instead of days
*/

-- Add time fields to crew_richiesteferie_permessi
DO $$
BEGIN
  -- Add orario_inizio column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'crew_richiesteferie_permessi' AND column_name = 'orario_inizio'
  ) THEN
    ALTER TABLE crew_richiesteferie_permessi 
    ADD COLUMN orario_inizio time;
  END IF;

  -- Add orario_fine column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'crew_richiesteferie_permessi' AND column_name = 'orario_fine'
  ) THEN
    ALTER TABLE crew_richiesteferie_permessi 
    ADD COLUMN orario_fine time;
  END IF;

  -- Add ore_richieste column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'crew_richiesteferie_permessi' AND column_name = 'ore_richieste'
  ) THEN
    ALTER TABLE crew_richiesteferie_permessi 
    ADD COLUMN ore_richieste numeric(5,2) DEFAULT 0;
  END IF;
END $$;