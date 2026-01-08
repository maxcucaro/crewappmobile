/*
  # Add Break Time Fields to Rectification

  ## Changes
  1. Add columns to `warehouse_checkins`:
    - `rectified_break_start` (time): Orario inizio pausa pranzo rettificato
    - `rectified_break_end` (time): Orario fine pausa pranzo rettificato

  ## Purpose
  - Permettere la specifica degli orari precisi della pausa pranzo
  - Calcolare automaticamente la durata della pausa
  - Tracciare con precisione le pause nella rettifica
*/

-- Add break time fields for rectification
ALTER TABLE warehouse_checkins
  ADD COLUMN IF NOT EXISTS rectified_break_start time,
  ADD COLUMN IF NOT EXISTS rectified_break_end time;