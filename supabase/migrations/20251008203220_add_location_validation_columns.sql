/*
  # Aggiungi colonne validazione posizione

  1. Nuove Colonne
    - `location_alert` (boolean) - Flag quando check-in/out è lontano dal magazzino (>1km)
    - `distance_from_warehouse` (numeric) - Distanza effettiva in metri dal magazzino
    - `checkout_location_alert` (boolean) - Flag per check-out lontano dal magazzino
    - `checkout_distance_from_warehouse` (numeric) - Distanza check-out in metri
    
  2. Note Importanti
    - Queste colonne permettono di identificare comportamenti sospetti
    - Alert automatico se distanza > 1000 metri
    - Le aziende possono monitorare check-in/out sospetti
    - NULL se la validazione non è disponibile (es. magazzino senza coordinate)
    
  3. Sicurezza
    - Nessun RLS: solo sistema può scrivere, azienda può leggere
*/

-- Aggiungi colonne validazione posizione check-in
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_checkins' AND column_name = 'location_alert'
  ) THEN
    ALTER TABLE warehouse_checkins ADD COLUMN location_alert boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_checkins' AND column_name = 'distance_from_warehouse'
  ) THEN
    ALTER TABLE warehouse_checkins ADD COLUMN distance_from_warehouse numeric(10, 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_checkins' AND column_name = 'checkout_location_alert'
  ) THEN
    ALTER TABLE warehouse_checkins ADD COLUMN checkout_location_alert boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_checkins' AND column_name = 'checkout_distance_from_warehouse'
  ) THEN
    ALTER TABLE warehouse_checkins ADD COLUMN checkout_distance_from_warehouse numeric(10, 2);
  END IF;
END $$;

-- Aggiungi colonne GPS ai magazzini se non esistono
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouses' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE warehouses ADD COLUMN latitude numeric(10, 8);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouses' AND column_name = 'longitude'
  ) THEN
    ALTER TABLE warehouses ADD COLUMN longitude numeric(11, 8);
  END IF;
END $$;