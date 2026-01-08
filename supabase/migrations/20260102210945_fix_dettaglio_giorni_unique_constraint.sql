/*
  # Fix unique constraint on crew_commercialista_dettaglio_giorni
  
  1. Changes
    - Drop old constraint with tipo_giornata
    - Add new constraint only on (crew_id, giorno)
    
  2. Why
    - A crew member can only have ONE record per day
    - The tipo_giornata should not be part of the unique constraint
    - This allows ON CONFLICT to work properly
*/

-- Drop old constraint
ALTER TABLE crew_commercialista_dettaglio_giorni
DROP CONSTRAINT IF EXISTS crew_commercialista_dettaglio_giorni_unique_day_type;

-- Add correct constraint
ALTER TABLE crew_commercialista_dettaglio_giorni
ADD CONSTRAINT crew_commercialista_dettaglio_giorni_crew_day_unique
UNIQUE (crew_id, giorno);
