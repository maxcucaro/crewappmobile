/*
  # Fix SECURITY DEFINER per trigger sync extra shift
  
  ## Descrizione
  Risolve il problema RLS che impedisce ai crew di fare check-in extra.
  
  ## Problema
  La funzione `sync_extra_shift_to_accounting()` viene eseguita con i permessi
  dell'utente (crew) e fallisce quando cerca di scrivere in crew_commercialista_mensile.
  
  ## Soluzione
  Aggiungi SECURITY DEFINER alle funzioni trigger per bypassare l'RLS e permettere
  l'inserimento dei dati contabili.
  
  ## Modifiche
  1. Ricrea `sync_extra_shift_to_accounting()` con SECURITY DEFINER
  2. Ricrea `ricalcola_totali_mensili()` con SECURITY DEFINER
*/

-- ============================================================================
-- 1. Ricrea sync_extra_shift_to_accounting con SECURITY DEFINER
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_extra_shift_to_accounting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM popola_dettaglio_giorno(NEW.crew_id, NEW.date);
  PERFORM ricalcola_totali_mensili(
    NEW.crew_id,
    EXTRACT(YEAR FROM NEW.date)::integer,
    EXTRACT(MONTH FROM NEW.date)::integer
  );
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 2. Verifica e aggiorna ricalcola_totali_mensili con SECURITY DEFINER
-- ============================================================================

-- Prima verifichiamo se esiste la funzione e la ricreiamo con SECURITY DEFINER
DO $$
BEGIN
  -- La funzione ricalcola_totali_mensili potrebbe avere varie signature
  -- La ricreeremo solo se esiste
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'ricalcola_totali_mensili'
  ) THEN
    -- Drop e ricrea con SECURITY DEFINER
    DROP FUNCTION IF EXISTS ricalcola_totali_mensili(uuid, integer, integer);
  END IF;
END $$;

-- Ricrea la funzione con SECURITY DEFINER
CREATE OR REPLACE FUNCTION ricalcola_totali_mensili(
  p_crew_id uuid,
  p_anno integer,
  p_mese integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record_id uuid;
BEGIN
  -- Cerca il record mensile esistente
  SELECT id INTO v_record_id
  FROM crew_commercialista_mensile
  WHERE crew_id = p_crew_id
    AND anno = p_anno
    AND mese = p_mese;

  -- Se non esiste, crealo
  IF v_record_id IS NULL THEN
    INSERT INTO crew_commercialista_mensile (
      crew_id,
      anno,
      mese,
      ore_lavorate,
      giorni_lavorati,
      straordinari,
      ferie_prese,
      permessi_presi,
      malattie,
      infortuni
    )
    VALUES (
      p_crew_id,
      p_anno,
      p_mese,
      0,
      0,
      0,
      0,
      0,
      0,
      0
    )
    RETURNING id INTO v_record_id;
  END IF;

  -- Aggiorna i totali dal dettaglio giornaliero
  UPDATE crew_commercialista_mensile cm
  SET
    ore_lavorate = COALESCE((
      SELECT SUM(ore_lavorate)
      FROM crew_commercialista_dettaglio
      WHERE crew_id = p_crew_id
        AND EXTRACT(YEAR FROM data) = p_anno
        AND EXTRACT(MONTH FROM data) = p_mese
    ), 0),
    giorni_lavorati = COALESCE((
      SELECT COUNT(DISTINCT data)
      FROM crew_commercialista_dettaglio
      WHERE crew_id = p_crew_id
        AND EXTRACT(YEAR FROM data) = p_anno
        AND EXTRACT(MONTH FROM data) = p_mese
        AND ore_lavorate > 0
    ), 0),
    straordinari = COALESCE((
      SELECT SUM(straordinari)
      FROM crew_commercialista_dettaglio
      WHERE crew_id = p_crew_id
        AND EXTRACT(YEAR FROM data) = p_anno
        AND EXTRACT(MONTH FROM data) = p_mese
    ), 0),
    ferie_prese = COALESCE((
      SELECT COUNT(*)
      FROM vacation_leave_requests
      WHERE crew_id = p_crew_id
        AND tipo = 'ferie'
        AND status = 'approved'
        AND EXTRACT(YEAR FROM data_inizio) = p_anno
        AND EXTRACT(MONTH FROM data_inizio) = p_mese
    ), 0),
    permessi_presi = COALESCE((
      SELECT COUNT(*)
      FROM vacation_leave_requests
      WHERE crew_id = p_crew_id
        AND tipo = 'permessi'
        AND status = 'approved'
        AND EXTRACT(YEAR FROM data_inizio) = p_anno
        AND EXTRACT(MONTH FROM data_inizio) = p_mese
    ), 0),
    malattie = COALESCE((
      SELECT COUNT(*)
      FROM vacation_leave_requests
      WHERE crew_id = p_crew_id
        AND tipo = 'malattia'
        AND status = 'approved'
        AND EXTRACT(YEAR FROM data_inizio) = p_anno
        AND EXTRACT(MONTH FROM data_inizio) = p_mese
    ), 0),
    infortuni = COALESCE((
      SELECT COUNT(*)
      FROM vacation_leave_requests
      WHERE crew_id = p_crew_id
        AND tipo = 'infortunio'
        AND status = 'approved'
        AND EXTRACT(YEAR FROM data_inizio) = p_anno
        AND EXTRACT(MONTH FROM data_inizio) = p_mese
    ), 0),
    updated_at = now()
  WHERE id = v_record_id;

END;
$$;

-- ============================================================================
-- 3. Commenti
-- ============================================================================

COMMENT ON FUNCTION sync_extra_shift_to_accounting() IS 
'Trigger function per sincronizzare i turni extra con i dati contabili. SECURITY DEFINER permette ai crew di fare check-in.';

COMMENT ON FUNCTION ricalcola_totali_mensili(uuid, integer, integer) IS 
'Ricalcola i totali mensili per un dipendente. SECURITY DEFINER permette l''esecuzione da trigger senza problemi RLS.';