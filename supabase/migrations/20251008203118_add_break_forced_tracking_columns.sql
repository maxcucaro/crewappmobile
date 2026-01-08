/*
  # Aggiungi colonne tracking forzature pausa

  1. Modifiche
    - Aggiungi colonne per tracciare forzature pausa inizio/fine
    - `break_start_forced` (boolean) - Flag per pausa iniziata senza GPS
    - `break_end_forced` (boolean) - Flag per pausa terminata senza GPS
    - `break_start_gps_error` (text) - Motivo errore GPS inizio pausa
    - `break_end_gps_error` (text) - Motivo errore GPS fine pausa
    
  2. Note Importanti
    - Queste colonne servono per tracciare quando un dipendente forza l'inizio/fine pausa senza GPS
    - Le aziende possono monitorare questi eventi per identificare comportamenti sospetti
    - Default NULL per retrocompatibilità
*/

-- Aggiungi colonne per tracking forzature pausa
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_checkins' AND column_name = 'break_start_forced'
  ) THEN
    ALTER TABLE warehouse_checkins ADD COLUMN break_start_forced boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_checkins' AND column_name = 'break_end_forced'
  ) THEN
    ALTER TABLE warehouse_checkins ADD COLUMN break_end_forced boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_checkins' AND column_name = 'break_start_gps_error'
  ) THEN
    ALTER TABLE warehouse_checkins ADD COLUMN break_start_gps_error text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_checkins' AND column_name = 'break_end_gps_error'
  ) THEN
    ALTER TABLE warehouse_checkins ADD COLUMN break_end_gps_error text;
  END IF;
END $$;