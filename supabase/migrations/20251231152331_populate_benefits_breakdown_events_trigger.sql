/*
  # Popola automaticamente benefits_breakdown per eventi

  1. Funzione
    - `populate_event_benefits_breakdown()`: Popola `benefits_breakdown` e calcola `other_benefits_amount`
    - Legge i benefit storicizzati dall'assegnazione evento
    - Aggiorna `total_benefits` includendo i benefit storicizzati

  2. Trigger
    - Si attiva su INSERT e UPDATE di `timesheet_entries` quando `event_id` non è null
    - Popola automaticamente i benefit dettagliati

  3. Note
    - I benefit vengono presi da `crew_event_assegnazione.benefits_storicizzati`
    - Ogni benefit contiene id, nome_tariffa e importo personalizzato
    - `other_benefits_amount` = somma degli importi dei benefit storicizzati
    - `total_benefits` include meal_voucher, company_meal, diaria e other_benefits
*/

-- Funzione per popolare benefits_breakdown dagli eventi
CREATE OR REPLACE FUNCTION populate_event_benefits_breakdown()
RETURNS TRIGGER AS $$
DECLARE
  v_benefits_storicizzati jsonb;
  v_benefit jsonb;
  v_benefits_array jsonb := '[]'::jsonb;
  v_other_benefits_total numeric := 0;
  v_total_benefits numeric := 0;
BEGIN
  -- Solo per eventi (quando event_id è presente)
  IF NEW.event_id IS NOT NULL THEN
    
    -- Leggi i benefits_storicizzati dall'assegnazione evento
    SELECT benefits_storicizzati INTO v_benefits_storicizzati
    FROM crew_event_assegnazione
    WHERE evento_id = NEW.event_id
    AND dipendente_freelance_id = NEW.crew_id
    LIMIT 1;

    -- Se ci sono benefit storicizzati, elaborali
    IF v_benefits_storicizzati IS NOT NULL AND jsonb_array_length(v_benefits_storicizzati) > 0 THEN
      
      -- Costruisci l'array dei benefit e calcola il totale
      FOR v_benefit IN SELECT * FROM jsonb_array_elements(v_benefits_storicizzati)
      LOOP
        v_benefits_array := v_benefits_array || v_benefit;
        v_other_benefits_total := v_other_benefits_total + COALESCE((v_benefit->>'importo')::numeric, 0);
      END LOOP;

      -- Aggiorna benefits_breakdown e other_benefits_amount
      NEW.benefits_breakdown := v_benefits_array;
      NEW.other_benefits_amount := v_other_benefits_total;
    END IF;

    -- Calcola total_benefits (somma di tutti i benefit)
    v_total_benefits := 
      COALESCE(NEW.meal_voucher_amount, 0) +
      COALESCE(NEW.company_meal_cost, 0) +
      COALESCE(NEW.diaria_amount, 0) +
      COALESCE(NEW.other_benefits_amount, 0);

    NEW.total_benefits := v_total_benefits;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger esistente se presente
DROP TRIGGER IF EXISTS trigger_populate_event_benefits_breakdown ON timesheet_entries;

-- Crea trigger che si attiva su INSERT e UPDATE
CREATE TRIGGER trigger_populate_event_benefits_breakdown
  BEFORE INSERT OR UPDATE ON timesheet_entries
  FOR EACH ROW
  EXECUTE FUNCTION populate_event_benefits_breakdown();