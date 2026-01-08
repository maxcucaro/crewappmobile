/*
  # Fix sync trigger - Correct company column name

  ## Problem
  - The trigger references `c.nome` but the column is actually `c.name`
  - This causes checkout to fail with: "column c.nome does not exist"

  ## Solution
  - Replace `c.nome` with `c.name` in the trigger function

  ## Changes
  - Update the function to use the correct column name for companies table
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
    
    -- Ottieni azienda_id e nome azienda dal warehouse (usa c.name invece di c.nome)
    SELECT w.company_id, c.name
    INTO v_azienda_id, v_nome_azienda
    FROM warehouses w
    LEFT JOIN companies c ON w.company_id = c.id
    WHERE w.id = NEW.warehouse_id;
    
    -- Inserisci o aggiorna il record in crew_turni_completati
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
      note,
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
      NEW.notes,
      NOW(),
      NOW()
    )
    ON CONFLICT (dipendente_id, giorno_turno) 
    DO UPDATE SET
      check_out_turno = EXCLUDED.check_out_turno,
      buoni_pasto_assegnato = EXCLUDED.buoni_pasto_assegnato,
      pasto_aziendale_usufruito = EXCLUDED.pasto_aziendale_usufruito,
      note = EXCLUDED.note,
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;