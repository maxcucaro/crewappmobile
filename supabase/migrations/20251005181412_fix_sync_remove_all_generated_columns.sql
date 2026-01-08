/*
  # Fix trigger: rimuovi tutte le colonne generate

  ## Colonne generate in crew_turni_completati
  1. turno_completato - si calcola automaticamente da: (check_in_turno IS NOT NULL AND check_out_turno IS NOT NULL)
  2. conteggio_ore - si calcola automaticamente da: EXTRACT(epoch FROM (check_out_turno - check_in_turno)) / 3600.0

  ## Soluzione
  - Rimuovi sia turno_completato che conteggio_ore dalla funzione del trigger
  - Entrambe le colonne si popolano automaticamente quando inseriamo i timestamp
*/

CREATE OR REPLACE FUNCTION sync_warehouse_checkout_to_completed_shifts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_turno_id uuid;
  v_nome_turno text;
  v_azienda_id uuid;
  v_nome_azienda text;
  v_nome_dipendente text;
  v_check_in_timestamp timestamptz;
  v_check_out_timestamp timestamptz;
BEGIN
  -- Solo se è stato fatto check-out (check_out_time non era impostato e ora lo è)
  IF NEW.check_out_time IS NOT NULL 
     AND NEW.status = 'completed' 
     AND (OLD.check_out_time IS NULL OR OLD.status != 'completed') THEN
    
    -- Recupera dati dal turno assegnato
    SELECT 
      cat.turno_id,
      COALESCE(NEW.nome_turno, cat.nome_turno, 'Turno Magazzino'),
      rr.parent_company_id,
      ras.ragione_sociale,
      rr.full_name
    INTO
      v_turno_id,
      v_nome_turno,
      v_azienda_id,
      v_nome_azienda,
      v_nome_dipendente
    FROM crew_assegnazione_turni cat
    LEFT JOIN registration_requests rr ON rr.auth_user_id = NEW.crew_id
    LEFT JOIN regaziendasoftware ras ON ras.id = rr.parent_company_id
    WHERE cat.dipendente_id = NEW.crew_id
      AND cat.data_turno = NEW.date
    LIMIT 1;

    -- Se non troviamo dati, usa valori di default
    IF v_turno_id IS NULL THEN
      v_turno_id := gen_random_uuid();
      v_nome_turno := 'Turno Magazzino';
    END IF;

    IF v_azienda_id IS NULL THEN
      -- Prova a recuperare l'azienda dal profilo del dipendente
      SELECT parent_company_id, full_name 
      INTO v_azienda_id, v_nome_dipendente
      FROM registration_requests 
      WHERE auth_user_id = NEW.crew_id;
      
      IF v_azienda_id IS NOT NULL THEN
        SELECT ragione_sociale INTO v_nome_azienda
        FROM regaziendasoftware WHERE id = v_azienda_id;
      END IF;
    END IF;

    -- Costruisci timestamp completi per check-in e check-out
    v_check_in_timestamp := (NEW.date || ' ' || NEW.check_in_time)::timestamptz;
    v_check_out_timestamp := (NEW.date || ' ' || NEW.check_out_time)::timestamptz;

    -- Inserisci o aggiorna il record in crew_turni_completati
    -- turno_completato e conteggio_ore si generano automaticamente dai timestamp
    INSERT INTO crew_turni_completati (
      turno_id,
      nome_turno,
      giorno_turno,
      azienda_id,
      nome_azienda,
      dipendente_id,
      nome_dipendente,
      check_in_turno,
      check_out_turno,
      buoni_pasto_assegnato,
      pasto_aziendale_usufruito,
      created_at,
      updated_at
    ) VALUES (
      v_turno_id,
      v_nome_turno,
      NEW.date,
      v_azienda_id,
      COALESCE(v_nome_azienda, 'N/D'),
      NEW.crew_id,
      COALESCE(v_nome_dipendente, 'N/D'),
      v_check_in_timestamp,
      v_check_out_timestamp,
      COALESCE(NEW.meal_voucher, false),
      COALESCE(NEW.company_meal, false),
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
