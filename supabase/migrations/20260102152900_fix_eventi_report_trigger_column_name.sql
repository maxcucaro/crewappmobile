/*
  # Fix Trigger Sync Eventi - Nome Colonna Corretto
  
  ## Problema
  Il trigger sync_eventi_to_report() cerca la colonna "e.titolo"
  ma nella tabella crew_events la colonna si chiama "title"
  
  ## Correzione
  Aggiorna la funzione sync_eventi_to_report() per usare "e.title"
  invece di "e.titolo"
*/

CREATE OR REPLACE FUNCTION sync_eventi_to_report()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_nome_evento text;
  v_tipo_evento text;
  v_location text;
  v_check_in time;
  v_check_out time;
  v_minuti_lavorati int;
  v_ore_lavorate numeric;
BEGIN
  -- Solo se c'è end_time
  IF NEW.end_time IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Recupera info evento (CORRETTO: title invece di titolo)
  SELECT 
    e.title,
    e.tipo_evento,
    e.location
  INTO v_nome_evento, v_tipo_evento, v_location
  FROM crew_events e
  WHERE e.id = NEW.event_id;
  
  -- Usa valori rettificati se presenti
  v_check_in := COALESCE(NEW.rectified_start_time, NEW.start_time);
  v_check_out := COALESCE(NEW.rectified_end_time, NEW.end_time);
  
  -- Calcola ore lavorate
  IF v_check_in IS NOT NULL AND v_check_out IS NOT NULL THEN
    v_minuti_lavorati := EXTRACT(EPOCH FROM (v_check_out - v_check_in)) / 60;
    v_ore_lavorate := ROUND((v_minuti_lavorati::numeric / 60), 2);
  ELSE
    v_minuti_lavorati := 0;
    v_ore_lavorate := 0;
  END IF;
  
  -- UPSERT
  INSERT INTO report_turni_eventi (
    crew_id,
    event_id,
    timesheet_entry_id,
    data,
    nome_evento,
    tipo_evento,
    location,
    check_in,
    check_out,
    ore_lavorate,
    minuti_lavorati,
    benefit_diaria,
    benefit_pernottamento,
    benefit_trasferta,
    benefits_totale,
    auto_checkout,
    was_rectified,
    rectified_by,
    rectified_at,
    created_at,
    updated_at
  ) VALUES (
    NEW.crew_id,
    NEW.event_id,
    NEW.id,
    NEW.date,
    v_nome_evento,
    v_tipo_evento,
    v_location,
    v_check_in,
    v_check_out,
    v_ore_lavorate,
    v_minuti_lavorati,
    COALESCE(NEW.benefit_diaria, 0),
    COALESCE(NEW.benefit_pernottamento, 0),
    COALESCE(NEW.benefit_trasferta, 0),
    COALESCE(NEW.benefit_diaria, 0) + COALESCE(NEW.benefit_pernottamento, 0) + COALESCE(NEW.benefit_trasferta, 0),
    COALESCE(NEW.auto_checkout, false),
    COALESCE(NEW.is_rectified, false),
    NEW.rectified_by,
    NEW.rectified_at,
    now(),
    now()
  )
  ON CONFLICT (timesheet_entry_id)
  DO UPDATE SET
    crew_id = EXCLUDED.crew_id,
    event_id = EXCLUDED.event_id,
    data = EXCLUDED.data,
    nome_evento = EXCLUDED.nome_evento,
    tipo_evento = EXCLUDED.tipo_evento,
    location = EXCLUDED.location,
    check_in = EXCLUDED.check_in,
    check_out = EXCLUDED.check_out,
    ore_lavorate = EXCLUDED.ore_lavorate,
    minuti_lavorati = EXCLUDED.minuti_lavorati,
    benefit_diaria = EXCLUDED.benefit_diaria,
    benefit_pernottamento = EXCLUDED.benefit_pernottamento,
    benefit_trasferta = EXCLUDED.benefit_trasferta,
    benefits_totale = EXCLUDED.benefits_totale,
    auto_checkout = EXCLUDED.auto_checkout,
    was_rectified = EXCLUDED.was_rectified,
    rectified_by = EXCLUDED.rectified_by,
    rectified_at = EXCLUDED.rectified_at,
    updated_at = now();
  
  RETURN NEW;
END;
$$;
