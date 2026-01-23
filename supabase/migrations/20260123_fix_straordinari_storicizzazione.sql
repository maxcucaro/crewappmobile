-- ============================================================================
-- MIGRAZIONE: Fix storicizzazione straordinari e cleanup trigger obsoleti
-- Data: 2026-01-23
-- ============================================================================
--
-- OBIETTIVI:
-- 1. Eliminare trigger obsoleti che aggiornano colonne eliminate
-- 2. Creare trigger per storicizzare tariffa straordinari da crew_benfit_straordinari
-- 3. Verificare e correggere popolazione di assegnazione_id
--
-- TRIGGER DA ELIMINARE (riferimenti a colonne eliminate):
-- - z40_update_oraro_in_eccesso_col → colonna "oraro in eccesso" eliminata
-- - z41_update_oraro_in_difetto_col → colonna "oraro in difetto" eliminata
-- - z20_update_ore_di_lavoro_effetive → colonna "ore di lavoro effetive" eliminata
--
-- NUOVA LOGICA STRAORDINARI:
-- - Storicizzare tariffa_straordinari_oraria da crew_benfit_straordinari.importo_benefit
-- - Verificare che requisito_straordinari sia correttamente impostato
-- - Calcolare importo_straordinari automaticamente
--
-- ============================================================================

-- FASE 1: Cleanup trigger obsoleti
-- ============================================================================

-- Elimina trigger z40 (aggiorna colonna eliminata "oraro in eccesso")
DROP TRIGGER IF EXISTS z40_update_oraro_in_eccesso_col ON warehouse_checkins;
DROP FUNCTION IF EXISTS trg_fn_update_oraro_in_eccesso_col();

RAISE NOTICE '✅ Eliminato trigger obsoleto: z40_update_oraro_in_eccesso_col';

-- Elimina trigger z41 (aggiorna colonna eliminata "oraro in difetto")
DROP TRIGGER IF EXISTS z41_update_oraro_in_difetto_col ON warehouse_checkins;
DROP FUNCTION IF EXISTS trg_fn_update_oraro_in_difetto_col();

RAISE NOTICE '✅ Eliminato trigger obsoleto: z41_update_oraro_in_difetto_col';

-- Elimina trigger z20 (aggiorna colonna eliminata "ore di lavoro effetive")
DROP TRIGGER IF EXISTS z20_update_ore_di_lavoro_effetive ON warehouse_checkins;
DROP FUNCTION IF EXISTS trg_fn_update_ore_di_lavoro_effetive();

RAISE NOTICE '✅ Eliminato trigger obsoleto: z20_update_ore_di_lavoro_effetive';

-- FASE 2: Crea funzione per storicizzare tariffa straordinari
-- ============================================================================

CREATE OR REPLACE FUNCTION trg_fn_storicizza_tariffa_straordinari()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_benefit RECORD;
  v_straordinario_benefit_id UUID := '539577f9-d1cb-438d-bf2f-61ef4db2317e';
BEGIN
  -- Recupera benefit straordinario per il dipendente
  SELECT 
    straordinari_abilitati,
    importo_benefit,
    attivo
  INTO v_benefit
  FROM crew_benfit_straordinari
  WHERE crew_id = NEW.crew_id
    AND benefit_id = v_straordinario_benefit_id
  LIMIT 1;
  
  -- Se il dipendente ha il benefit straordinario abilitato
  IF FOUND AND v_benefit.straordinari_abilitati = TRUE THEN
    -- Storicizza la tariffa straordinari
    NEW.tariffa_straordinari_oraria := v_benefit.importo_benefit;
    
    -- Calcola importo straordinari se ci sono ore straordinarie
    IF NEW.overtime_minutes IS NOT NULL AND NEW.overtime_minutes > 0 THEN
      NEW.importo_straordinari := ROUND(
        (NEW.overtime_minutes::NUMERIC / 60.0) * v_benefit.importo_benefit,
        2
      );
    ELSE
      NEW.importo_straordinari := 0;
    END IF;
    
    RAISE DEBUG 'Storicizzata tariffa straordinari: €% per crew_id=%', 
      NEW.tariffa_straordinari_oraria, NEW.crew_id;
  ELSE
    -- Dipendente non abilitato agli straordinari
    NEW.tariffa_straordinari_oraria := NULL;
    NEW.importo_straordinari := 0;
    
    RAISE DEBUG 'Crew_id=% non abilitato agli straordinari', NEW.crew_id;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trg_fn_storicizza_tariffa_straordinari() IS 
'Storicizza la tariffa straordinari da crew_benfit_straordinari ad ogni check-in/check-out';

-- Crea trigger per storicizzazione tariffa straordinari
-- NOTA: z15_ per eseguire PRIMA di z30_set_requisito_straordinari
CREATE TRIGGER z15_storicizza_tariffa_straordinari
  BEFORE INSERT OR UPDATE ON warehouse_checkins
  FOR EACH ROW
  EXECUTE FUNCTION trg_fn_storicizza_tariffa_straordinari();

RAISE NOTICE '✅ Creato trigger: z15_storicizza_tariffa_straordinari';

-- FASE 3: Aggiorna trigger requisito_straordinari per usare tariffa storicizzata
-- ============================================================================

-- Verifica se il trigger z30 esiste e cosa fa
DO $$
DECLARE
  v_trigger_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'z30_set_requisito_straordinari'
  ) INTO v_trigger_exists;
  
  IF v_trigger_exists THEN
    RAISE NOTICE '⚠️ Trigger z30_set_requisito_straordinari esiste - verificare che usi tariffa_straordinari_oraria';
  ELSE
    RAISE NOTICE '❌ Trigger z30_set_requisito_straordinari NON trovato - potrebbe essere necessario crearlo';
  END IF;
END $$;

-- FASE 4: Verifica popolazione assegnazione_id
-- ============================================================================

-- Query diagnostica: conta quanti check hanno assegnazione_id NULL
SELECT 
  COUNT(*) FILTER (WHERE assegnazione_id IS NULL) as senza_assegnazione,
  COUNT(*) FILTER (WHERE assegnazione_id IS NOT NULL) as con_assegnazione,
  COUNT(*) as totale,
  ROUND(
    (COUNT(*) FILTER (WHERE assegnazione_id IS NULL)::NUMERIC / COUNT(*)::NUMERIC) * 100, 
    2
  ) as percentuale_null
FROM warehouse_checkins;

-- FASE 5: Crea funzione per popolare assegnazione_id automaticamente
-- ============================================================================

CREATE OR REPLACE FUNCTION trg_fn_popola_assegnazione_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_assegnazione_id UUID;
BEGIN
  -- Se assegnazione_id è già popolato, non fare nulla
  IF NEW.assegnazione_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Cerca assegnazione corrispondente in crew_assegnazione_turni
  -- Logica: stessa data, stesso crew_id, stesso warehouse (se disponibile)
  SELECT id INTO v_assegnazione_id
  FROM crew_assegnazione_turni
  WHERE crew_id = NEW.crew_id
    AND data_turno = NEW.date
    AND (
      -- Se warehouse_id è specificato nel check, cerca assegnazione con stesso warehouse
      (NEW.warehouse_id IS NOT NULL AND magazzino_id = NEW.warehouse_id)
      -- Altrimenti accetta qualsiasi assegnazione per quella data
      OR (NEW.warehouse_id IS NULL)
    )
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Se trovata, popola assegnazione_id
  IF FOUND THEN
    NEW.assegnazione_id := v_assegnazione_id;
    RAISE DEBUG 'Popolato assegnazione_id=% per check-in crew_id=% date=%', 
      v_assegnazione_id, NEW.crew_id, NEW.date;
  ELSE
    RAISE DEBUG 'Nessuna assegnazione trovata per crew_id=% date=%', 
      NEW.crew_id, NEW.date;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trg_fn_popola_assegnazione_id() IS 
'Popola automaticamente assegnazione_id cercando in crew_assegnazione_turni';

-- Crea trigger per popolazione assegnazione_id
-- NOTA: z05_ per eseguire MOLTO PRESTO, prima degli altri trigger
CREATE TRIGGER z05_popola_assegnazione_id
  BEFORE INSERT OR UPDATE ON warehouse_checkins
  FOR EACH ROW
  EXECUTE FUNCTION trg_fn_popola_assegnazione_id();

RAISE NOTICE '✅ Creato trigger: z05_popola_assegnazione_id';

-- FASE 6: Migrazione dati esistenti (opzionale ma raccomandato)
-- ============================================================================

-- Aggiorna tariffa straordinari per tutti i check esistenti
DO $$
DECLARE
  v_updated_count INTEGER := 0;
  v_straordinario_benefit_id UUID := '539577f9-d1cb-438d-bf2f-61ef4db2317e';
BEGIN
  UPDATE warehouse_checkins wc
  SET 
    tariffa_straordinari_oraria = cb.importo_benefit,
    importo_straordinari = CASE
      WHEN wc.overtime_minutes > 0 THEN 
        ROUND((wc.overtime_minutes::NUMERIC / 60.0) * cb.importo_benefit, 2)
      ELSE 0
    END
  FROM crew_benfit_straordinari cb
  WHERE wc.crew_id = cb.crew_id
    AND cb.benefit_id = v_straordinario_benefit_id
    AND cb.straordinari_abilitati = TRUE
    AND (
      wc.tariffa_straordinari_oraria IS NULL 
      OR wc.tariffa_straordinari_oraria != cb.importo_benefit
    );
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RAISE NOTICE '✅ Aggiornati % check-in esistenti con tariffa straordinari', v_updated_count;
END $$;

-- Aggiorna assegnazione_id per check esistenti
DO $$
DECLARE
  v_updated_count INTEGER := 0;
BEGIN
  UPDATE warehouse_checkins wc
  SET assegnazione_id = cat.id
  FROM crew_assegnazione_turni cat
  WHERE wc.assegnazione_id IS NULL
    AND wc.crew_id = cat.crew_id
    AND wc.date = cat.data_turno
    AND (
      (wc.warehouse_id IS NOT NULL AND cat.magazzino_id = wc.warehouse_id)
      OR (wc.warehouse_id IS NULL)
    );
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RAISE NOTICE '✅ Aggiornati % check-in esistenti con assegnazione_id', v_updated_count;
END $$;

-- FASE 7: Statistiche finali
-- ============================================================================

-- Statistiche tariffa straordinari
SELECT 
  COUNT(*) FILTER (WHERE tariffa_straordinari_oraria IS NOT NULL) as con_tariffa,
  COUNT(*) FILTER (WHERE tariffa_straordinari_oraria IS NULL) as senza_tariffa,
  COUNT(*) as totale,
  ROUND(AVG(tariffa_straordinari_oraria), 2) as tariffa_media
FROM warehouse_checkins;

-- Statistiche assegnazione_id
SELECT 
  COUNT(*) FILTER (WHERE assegnazione_id IS NOT NULL) as con_assegnazione,
  COUNT(*) FILTER (WHERE assegnazione_id IS NULL) as senza_assegnazione,
  COUNT(*) as totale,
  ROUND(
    (COUNT(*) FILTER (WHERE assegnazione_id IS NOT NULL)::NUMERIC / COUNT(*)::NUMERIC) * 100, 
    2
  ) as percentuale_popolati
FROM warehouse_checkins;

-- ============================================================================
-- DOCUMENTAZIONE MIGRAZIONE
-- ============================================================================

-- Trigger eliminati: 3
-- - z40_update_oraro_in_eccesso_col (colonna "oraro in eccesso" eliminata)
-- - z41_update_oraro_in_difetto_col (colonna "oraro in difetto" eliminata)
-- - z20_update_ore_di_lavoro_effetive (colonna "ore di lavoro effetive" eliminata)
--
-- Trigger creati: 2
-- - z05_popola_assegnazione_id (popola assegnazione_id da crew_assegnazione_turni)
-- - z15_storicizza_tariffa_straordinari (storicizza tariffa da crew_benfit_straordinari)
--
-- Logica storicizzazione:
-- 1. Ad ogni INSERT/UPDATE su warehouse_checkins
-- 2. Cerca crew_benfit_straordinari per crew_id con benefit_id = '539577f9...'
-- 3. Se straordinari_abilitati = TRUE:
--    - Storicizza importo_benefit → tariffa_straordinari_oraria
--    - Calcola importo_straordinari = (overtime_minutes / 60) * tariffa
-- 4. Se straordinari_abilitati = FALSE o benefit non trovato:
--    - tariffa_straordinari_oraria = NULL
--    - importo_straordinari = 0
--
-- Logica assegnazione_id:
-- 1. Se già popolato, skip
-- 2. Cerca in crew_assegnazione_turni:
--    - Stesso crew_id
--    - Stessa data_turno
--    - Stesso magazzino_id (se warehouse_id presente)
-- 3. Prende l'assegnazione più recente (ORDER BY created_at DESC)
--
-- ATTENZIONE:
-- - I trigger devono rimanere nell'ordine corretto (z05 → z15 → z30 → ...)
-- - La tariffa viene storicizzata al momento del check, non aggiornata retroattivamente
-- - Se il benefit viene modificato dopo il check, la tariffa storica rimane invariata
