/*
  # Add Checkout Location Column

  ## Problema
  La location del check-out non veniva salvata, solo quella del check-in.

  ## Modifica
  - Aggiunge colonna `checkout_location` di tipo JSONB per salvare GPS checkout
  - Include: latitude, longitude, address, accuracy, timestamp

  ## Note
  Questo permette di tracciare la posizione GPS sia al check-in che al check-out
*/

-- Aggiungi colonna checkout_location
ALTER TABLE warehouse_checkins 
ADD COLUMN IF NOT EXISTS checkout_location JSONB;