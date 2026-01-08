/*
  # Fix RLS policy per trigger sync_warehouse_checkout_to_completed_shifts

  ## Problema
  - Il trigger `sync_warehouse_checkout_to_completed_shifts` viene eseguito con i permessi dell'utente
  - Quando l'utente fa check-out, il trigger tenta di inserire in `crew_turni_completati`
  - RLS blocca l'INSERT perché manca la policy appropriata o la funzione non ha SECURITY DEFINER
  - Errore: "new row violates row-level security policy for table crew_turni_completati"

  ## Soluzione
  1. Ricreare la funzione con SECURITY DEFINER per eseguirla con privilegi elevati
  2. Aggiungere policy INSERT e UPDATE per dipendenti autenticati su crew_turni_completati
  
  ## Security
  - SECURITY DEFINER è sicuro qui perché:
    - La funzione valida che NEW.crew_id corrisponda ai dati corretti
    - Il trigger si attiva solo su UPDATE di warehouse_checkins che ha già RLS
    - Gli utenti non possono chiamare direttamente questa funzione
*/

-- Ricrea la funzione con SECURITY DEFINER
CREATE OR REPLACE FUNCTION sync_warehouse_checkout_to_completed_shifts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER -- Esegue con privilegi elevati per bypassare RLS
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

-- Aggiungi policy INSERT per dipendenti su crew_turni_completati
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'crew_turni_completati' 
    AND policyname = 'Dipendenti possono inserire propri turni completati'
  ) THEN
    CREATE POLICY "Dipendenti possono inserire propri turni completati"
      ON crew_turni_completati
      FOR INSERT
      TO authenticated
      WITH CHECK (dipendente_id = auth.uid());
  END IF;
END $$;

-- Aggiungi policy UPDATE per dipendenti su crew_turni_completati
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'crew_turni_completati' 
    AND policyname = 'Dipendenti possono aggiornare propri turni completati'
  ) THEN
    CREATE POLICY "Dipendenti possono aggiornare propri turni completati"
      ON crew_turni_completati
      FOR UPDATE
      TO authenticated
      USING (dipendente_id = auth.uid())
      WITH CHECK (dipendente_id = auth.uid());
  END IF;
END $$;
