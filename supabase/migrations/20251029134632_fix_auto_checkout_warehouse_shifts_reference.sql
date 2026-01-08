/*
  # Fix Auto-Checkout: Correggi riferimento tabella warehouse_shifts
  
  1. Problema
    - La funzione `set_expected_end_time()` fa riferimento a `warehouse_shifts` che non esiste
    - La tabella corretta è `crew_assegnazione_turni`
  
  2. Soluzione
    - Ricreare la funzione `set_expected_end_time()` con il riferimento corretto
    - Usare `crew_assegnazione_turni` invece di `warehouse_shifts`
*/

-- Ricrea la funzione con il riferimento corretto alla tabella
CREATE OR REPLACE FUNCTION set_expected_end_time()
RETURNS TRIGGER AS $$
BEGIN
  -- Cerca il turno assegnato per questo dipendente e magazzino nella data del check-in
  SELECT cat.ora_fine_turno INTO NEW.expected_end_time
  FROM crew_assegnazione_turni cat
  WHERE cat.dipendente_id = NEW.crew_id
    AND cat.data_turno = NEW.date
  LIMIT 1;
  
  -- Se non trova un turno specifico, usa un orario di default (18:00)
  IF NEW.expected_end_time IS NULL THEN
    NEW.expected_end_time := '18:00:00'::time;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Commento sulla funzione
COMMENT ON FUNCTION set_expected_end_time() IS 'Imposta l''orario di fine turno previsto al check-in, recuperandolo da crew_assegnazione_turni';
