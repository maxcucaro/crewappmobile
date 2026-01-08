/*
  # Allow NULL turno_id in crew_turni_completati

  ## Problem
  - `turno_id` column is NOT NULL
  - Warehouse shifts don't have corresponding records in `crew_assegnazione_turni`
  - This prevents warehouse checkout from syncing to completed shifts

  ## Solution
  - Alter `turno_id` column to allow NULL values
  - This allows warehouse shifts to be tracked without requiring a `crew_assegnazione_turni` record

  ## Changes
  - ALTER TABLE crew_turni_completati to make turno_id nullable
*/

ALTER TABLE crew_turni_completati 
ALTER COLUMN turno_id DROP NOT NULL;