/*
  # Popola Dati Storici Ferie, Permessi e Malattie per Commercialista
  
  1. Popolazione Dati
    - Popola crew_commercialista_dettaglio_giorni con tutte le richieste approvate di ferie/permessi
    - Popola crew_commercialista_dettaglio_giorni con tutte le malattie/infortuni
    - Gestisce correttamente range di date (un record per ogni giorno)
    - Distingue tra giornata intera e ore
  
  2. Aggiornamento Riepilogo
    - Aggiorna automaticamente crew_commercialista_mensile dopo il popolamento
    - Calcola correttamente giorni e ore per ferie, permessi e malattie
  
  3. Note
    - Popola solo dati dal 1 novembre 2025 in poi (come gli altri dati)
    - Usa ON CONFLICT per evitare duplicati
*/

-- =====================================================
-- STEP 1: Popola Ferie e Permessi Approvati
-- =====================================================

DO $$
DECLARE
  v_request RECORD;
  v_current_date date;
  v_tipo_giornata text;
  v_count integer := 0;
BEGIN
  -- Cicla tutte le richieste approvate dal 1 novembre 2025
  FOR v_request IN 
    SELECT 
      dipendente_id,
      tipo_richiesta,
      data_inizio,
      data_fine,
      ore_richieste,
      note,
      motivo
    FROM crew_richiesteferie_permessi
    WHERE stato = 'approvata'
      AND data_inizio >= '2025-11-01'
    ORDER BY data_inizio
  LOOP
    -- Determina tipo giornata
    IF v_request.tipo_richiesta = 'ferie' THEN
      IF COALESCE(v_request.ore_richieste, 0) > 0 THEN
        v_tipo_giornata := 'ferie_ore';
      ELSE
        v_tipo_giornata := 'ferie_giornata_intera';
      END IF;
    ELSE -- permesso
      IF COALESCE(v_request.ore_richieste, 0) > 0 THEN
        v_tipo_giornata := 'permesso_ore';
      ELSE
        v_tipo_giornata := 'permesso_giornata_intera';
      END IF;
    END IF;
    
    -- Inserisci un record per ogni giorno nel range
    v_current_date := v_request.data_inizio;
    WHILE v_current_date <= v_request.data_fine LOOP
      INSERT INTO crew_commercialista_dettaglio_giorni (
        crew_id,
        giorno,
        mese,
        anno,
        tipo_giornata,
        assenza_tipo,
        assenza_ore_richieste,
        assenza_note,
        benefit_giornaliero
      ) VALUES (
        v_request.dipendente_id,
        v_current_date,
        EXTRACT(MONTH FROM v_current_date)::int,
        EXTRACT(YEAR FROM v_current_date)::int,
        v_tipo_giornata,
        v_request.tipo_richiesta,
        v_request.ore_richieste,
        COALESCE(v_request.note, v_request.motivo),
        0
      )
      ON CONFLICT (crew_id, giorno, tipo_giornata) DO UPDATE SET
        assenza_tipo = EXCLUDED.assenza_tipo,
        assenza_ore_richieste = EXCLUDED.assenza_ore_richieste,
        assenza_note = EXCLUDED.assenza_note,
        updated_at = now();
      
      v_count := v_count + 1;
      v_current_date := v_current_date + INTERVAL '1 day';
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Popolati % record di ferie/permessi', v_count;
END $$;

-- =====================================================
-- STEP 2: Popola Malattie e Infortuni
-- =====================================================

DO $$
DECLARE
  v_malattia RECORD;
  v_current_date date;
  v_count integer := 0;
BEGIN
  -- Cicla tutte le malattie dal 1 novembre 2025
  FOR v_malattia IN 
    SELECT 
      dipendente_id,
      tipo,
      data_inizio,
      data_fine,
      note
    FROM crew_malattia_infortunio
    WHERE data_inizio >= '2025-11-01'
    ORDER BY data_inizio
  LOOP
    -- Inserisci un record per ogni giorno nel range
    v_current_date := v_malattia.data_inizio;
    WHILE v_current_date <= v_malattia.data_fine LOOP
      INSERT INTO crew_commercialista_dettaglio_giorni (
        crew_id,
        giorno,
        mese,
        anno,
        tipo_giornata,
        assenza_tipo,
        assenza_note,
        benefit_giornaliero
      ) VALUES (
        v_malattia.dipendente_id,
        v_current_date,
        EXTRACT(MONTH FROM v_current_date)::int,
        EXTRACT(YEAR FROM v_current_date)::int,
        'malattia',
        v_malattia.tipo,
        v_malattia.note,
        0
      )
      ON CONFLICT (crew_id, giorno, tipo_giornata) DO UPDATE SET
        assenza_tipo = EXCLUDED.assenza_tipo,
        assenza_note = EXCLUDED.assenza_note,
        updated_at = now();
      
      v_count := v_count + 1;
      v_current_date := v_current_date + INTERVAL '1 day';
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Popolati % record di malattie/infortuni', v_count;
END $$;

-- =====================================================
-- STEP 3: Aggiorna Riepilogo Mensile per Tutti i Mesi
-- =====================================================

DO $$
DECLARE
  v_month RECORD;
  v_count integer := 0;
BEGIN
  -- Per ogni combinazione crew_id + anno + mese presente nei dettagli
  FOR v_month IN 
    SELECT DISTINCT 
      crew_id,
      anno,
      mese
    FROM crew_commercialista_dettaglio_giorni
    WHERE anno >= 2025 AND mese >= 11
    ORDER BY anno, mese, crew_id
  LOOP
    PERFORM refresh_commercialista_mensile(
      v_month.crew_id,
      v_month.anno,
      v_month.mese
    );
    v_count := v_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Aggiornati % riepiloghi mensili', v_count;
END $$;
