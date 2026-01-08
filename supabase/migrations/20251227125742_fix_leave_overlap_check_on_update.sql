/*
  # Fix leave overlap check for updates
  
  1. Problem
    - When updating an existing leave request, the overlap check was comparing against itself
    - This caused false positive overlap errors when modifying existing requests
  
  2. Solution
    - Fix the overlap check to properly exclude the current record during UPDATE operations
    - Use TG_OP to distinguish between INSERT and UPDATE operations
*/

CREATE OR REPLACE FUNCTION check_leave_date_overlap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  overlap_count integer;
BEGIN
  -- Check for overlapping dates for the same employee
  -- Only check approved leave requests (excluding the current record if updating)
  SELECT COUNT(*)
  INTO overlap_count
  FROM crew_richiesteferie_permessi
  WHERE dipendente_id = NEW.dipendente_id
    AND stato = 'approvata'
    -- For UPDATE: exclude the current record by comparing OLD.id
    -- For INSERT: NEW.id won't match any existing records
    AND CASE 
      WHEN TG_OP = 'UPDATE' THEN id != OLD.id
      ELSE id != NEW.id
    END
    AND (
      (NEW.data_inizio BETWEEN data_inizio AND data_fine)
      OR (NEW.data_fine BETWEEN data_inizio AND data_fine)
      OR (data_inizio BETWEEN NEW.data_inizio AND NEW.data_fine)
      OR (data_fine BETWEEN NEW.data_inizio AND NEW.data_fine)
    );

  IF overlap_count > 0 THEN
    RAISE EXCEPTION 'Sovrapposizione date: Il dipendente ha già ferie/permessi approvati in questo periodo. Controlla le date e riprova.';
  END IF;

  RETURN NEW;
END;
$$;
