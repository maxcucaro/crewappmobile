/*
  # Sincronizza check-out magazzino con turni completati

  ## Problema
  - Quando un dipendente fa check-out dal magazzino, il record in `warehouse_checkins` viene aggiornato
  - Ma la tabella `crew_turni_completati` non viene popolata automaticamente
  - Questo causa il conteggio errato di "Turni Completati" nella dashboard

  ## Soluzione
  - Crea un trigger AFTER UPDATE su `warehouse_checkins`
  - Quando viene impostato `check_out_time` e `status = 'completed'`, inserisci/aggiorna un record in `crew_turni_completati`
  - Questo mantiene sincronizzate le due tabelle

  ## Funzione
  - `sync_warehouse_checkout_to_completed_shifts()`: Popola `crew_turni_completati` quando viene fatto check-out

  ## Trigger
  - `sync_warehouse_checkout_trigger`: Si attiva AFTER UPDATE su `warehouse_checkins`
*/

-- Funzione che sincronizza il check-out con crew_turni_completati
CREATE OR REPLACE FUNCTION sync_warehouse_checkout_to_completed_shifts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Solo se è stato fatto check-out (check_out_time non era impostato e ora lo è)
  IF NEW.check_out_time IS NOT NULL 
     AND NEW.status = 'completed' 
     AND (OLD.check_out_time IS NULL OR OLD.status != 'completed') THEN
    
    -- Inserisci o aggiorna il record in crew_turni_completati
    INSERT INTO crew_turni_completati (
      dipendente_id,
      giorno_turno,
      turno_completato,
      orario_check_in,
      orario_check_out,
      ore_lavorate,
      buoni_pasto_assegnato,
      pasto_aziendale_usufruito,
      note,
      created_at,
      updated_at
    ) VALUES (
      NEW.crew_id,
      NEW.date,
      true,
      NEW.check_in_time,
      NEW.check_out_time,
      NEW.net_hours,
      COALESCE(NEW.meal_voucher, false),
      COALESCE(NEW.company_meal, false),
      NEW.notes,
      NOW(),
      NOW()
    )
    ON CONFLICT (dipendente_id, giorno_turno) 
    DO UPDATE SET
      turno_completato = true,
      orario_check_out = EXCLUDED.orario_check_out,
      ore_lavorate = EXCLUDED.ore_lavorate,
      buoni_pasto_assegnato = EXCLUDED.buoni_pasto_assegnato,
      pasto_aziendale_usufruito = EXCLUDED.pasto_aziendale_usufruito,
      note = EXCLUDED.note,
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;

-- Crea il trigger AFTER UPDATE
DROP TRIGGER IF EXISTS sync_warehouse_checkout_trigger ON warehouse_checkins;

CREATE TRIGGER sync_warehouse_checkout_trigger
  AFTER UPDATE ON warehouse_checkins
  FOR EACH ROW
  EXECUTE FUNCTION sync_warehouse_checkout_to_completed_shifts();
