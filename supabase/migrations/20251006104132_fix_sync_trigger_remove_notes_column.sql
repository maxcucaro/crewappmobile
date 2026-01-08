/*
  # Fix sync trigger - Remove non-existent notes column

  ## Problem
  - The trigger tries to insert into a "note" column that doesn't exist
  - This causes checkout to fail with: "column note of relation crew_turni_completati does not exist"

  ## Solution
  - Remove the "note" column from the INSERT statement
  - The crew_turni_completati table doesn't have a notes column

  ## Changes
  - Remove references to NEW.notes in the trigger function
*/

CREATE OR REPLACE FUNCTION sync_warehouse_checkout_to_completed_shifts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome_dipendente text;
  v_azienda_id uuid;
  v_nome_azienda text;
BEGIN
  -- Solo se è stato fatto check-out (check_out_time non era impostato e ora lo è)
  IF NEW.check_out_time IS NOT NULL 
     AND NEW.status = 'completed' 
     AND (OLD.check_out_time IS NULL OR OLD.status != 'completed') THEN
    
    -- Ottieni il nome del dipendente dalla tabella corretta
    SELECT CONCAT(first_name, ' ', last_name)
    INTO v_nome_dipendente
    FROM crew_members
    WHERE id = NEW.crew_id;
    
    -- Ottieni azienda_id e nome azienda dal warehouse
    SELECT w.company_id, c.name
    INTO v_azienda_id, v_nome_azienda
    FROM warehouses w
    LEFT JOIN companies c ON w.company_id = c.id
    WHERE w.id = NEW.warehouse_id;
    
    -- Inserisci o aggiorna il record in crew_turni_completati (senza note)
    INSERT INTO crew_turni_completati (
      dipendente_id,
      turno_id,
      giorno_turno,
      check_in_turno,
      check_out_turno,
      buoni_pasto_assegnato,
      pasto_aziendale_usufruito,
      nome_dipendente,
      azienda_id,
      nome_azienda,
      created_at,
      updated_at
    ) VALUES (
      NEW.crew_id,
      NULL, -- Warehouse shifts don't have turno_id in crew_assegnazione_turni
      NEW.date,
      NEW.check_in_time,
      NEW.check_out_time,
      COALESCE(NEW.meal_voucher, false),
      COALESCE(NEW.company_meal, false),
      v_nome_dipendente,
      v_azienda_id,
      v_nome_azienda,
      NOW(),
      NOW()
    )
    ON CONFLICT (dipendente_id, giorno_turno) 
    DO UPDATE SET
      check_out_turno = EXCLUDED.check_out_turno,
      buoni_pasto_assegnato = EXCLUDED.buoni_pasto_assegnato,
      pasto_aziendale_usufruito = EXCLUDED.pasto_aziendale_usufruito,
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;