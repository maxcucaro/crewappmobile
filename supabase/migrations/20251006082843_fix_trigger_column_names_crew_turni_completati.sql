/*
  # Fix nomi colonne nel trigger sync_warehouse_checkout_to_completed_shifts

  ## Problema
  - Il trigger usa nomi di colonne errati: orario_check_in, orario_check_out, ore_lavorate
  - I nomi corretti sono: check_in_turno, check_out_turno, conteggio_ore
  - Errore: "column orario_check_in of relation crew_turni_completati does not exist"

  ## Soluzione
  - Correggi i nomi delle colonne nel trigger per corrispondere allo schema reale
  - check_in_time e check_out_time sono TIME, ma check_in_turno/check_out_turno sono TIMESTAMP
  - Dobbiamo combinare date + time per creare un timestamp corretto
*/

-- Ricrea la funzione con i nomi di colonne corretti
CREATE OR REPLACE FUNCTION sync_warehouse_checkout_to_completed_shifts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
      check_in_turno,
      check_out_turno,
      conteggio_ore,
      buoni_pasto_assegnato,
      pasto_aziendale_usufruito,
      created_at,
      updated_at
    ) VALUES (
      NEW.crew_id,
      NEW.date,
      true,
      -- Combina date + time per creare timestamp
      (NEW.date || ' ' || NEW.check_in_time)::timestamp with time zone,
      (NEW.date || ' ' || NEW.check_out_time)::timestamp with time zone,
      NEW.net_hours,
      COALESCE(NEW.meal_voucher, false),
      COALESCE(NEW.company_meal, false),
      NOW(),
      NOW()
    )
    ON CONFLICT (dipendente_id, giorno_turno) 
    DO UPDATE SET
      turno_completato = true,
      check_out_turno = EXCLUDED.check_out_turno,
      conteggio_ore = EXCLUDED.conteggio_ore,
      buoni_pasto_assegnato = EXCLUDED.buoni_pasto_assegnato,
      pasto_aziendale_usufruito = EXCLUDED.pasto_aziendale_usufruito,
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;
