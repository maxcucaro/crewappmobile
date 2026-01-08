/*
  # Aggiungi tutti i campi obbligatori al trigger

  ## Problema
  - Il trigger non popola turno_id, nome_turno, azienda_id, nome_azienda, nome_dipendente
  - Questi campi sono NOT NULL e causano errore durante INSERT

  ## Soluzione
  - Recupera i dati mancanti tramite JOIN con le tabelle correlate
  - Popola tutti i campi obbligatori nel trigger
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
    
    -- Recupera informazioni dipendente
    SELECT full_name INTO v_nome_dipendente
    FROM registration_requests
    WHERE id = NEW.crew_id;

    -- Recupera informazioni azienda dal magazzino
    SELECT w.company_id, c.name INTO v_azienda_id, v_nome_azienda
    FROM crew_template_turni ct
    JOIN warehouses w ON w.id = ct.warehouse_id
    LEFT JOIN companies c ON c.id = w.company_id
    WHERE ct.id_template = NEW.shift_id;

    -- Inserisci o aggiorna il record in crew_turni_completati
    INSERT INTO crew_turni_completati (
      turno_id,
      nome_turno,
      dipendente_id,
      nome_dipendente,
      azienda_id,
      nome_azienda,
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
      NEW.shift_id,
      COALESCE(NEW.nome_turno, 'Turno Magazzino'),
      NEW.crew_id,
      COALESCE(v_nome_dipendente, 'Nome non disponibile'),
      COALESCE(v_azienda_id, '00000000-0000-0000-0000-000000000000'::uuid),
      COALESCE(v_nome_azienda, 'Azienda non disponibile'),
      NEW.date,
      true,
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
