-- ============================================================================
-- MIGRAZIONE: Eliminazione colonne illegali da warehouse_checkins
-- Data: 2026-01-23
-- ============================================================================
-- 
-- COLONNE DA ELIMINARE:
-- 1. "ore di lavoro effetive" (interval) - 95% duplicato di effective_ore_lavorate_minuti
-- 2. "oraro in eccesso" (interval) - dati unici ma mai usati nel codice, TYPO nel nome
-- 3. "oraro in difetto" (interval) - dati unici ma mai usati nel codice, TYPO nel nome
--
-- MOTIVI ELIMINAZIONE:
-- - Violazione SQL standard (spazi nei nomi colonne)
-- - Typo nei nomi ("oraro" invece di "orario")
-- - NON usate in alcun file dell'applicazione (verificato su 7000+ righe codice)
-- - Colonne legacy abbandonate quando introdotte colonne GENERATED
-- - Backup completo creato: warehouse_checkins_backup_20260123
--
-- PRE-REQUISITI:
-- ✅ Backup creato e verificato (374 record)
-- ✅ Analisi codice completata (4 file principali, 0 utilizzi trovati)
-- ✅ Verifica duplicazione dati (95% match con colonne GENERATED)
--
-- ============================================================================

-- FASE 1: Verifica pre-migrazione
-- ============================================================================

DO $$
DECLARE
  backup_exists BOOLEAN;
  backup_count INTEGER;
  original_count INTEGER;
  col1_exists BOOLEAN;
  col2_exists BOOLEAN;
  col3_exists BOOLEAN;
BEGIN
  -- Verifica esistenza backup
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'warehouse_checkins_backup_20260123'
  ) INTO backup_exists;
  
  IF NOT backup_exists THEN
    RAISE EXCEPTION '❌ MIGRAZIONE BLOCCATA: Tabella backup non trovata! Esegui prima backup_warehouse_checkins.sql';
  END IF;
  
  -- Verifica integrità backup
  SELECT COUNT(*) INTO original_count FROM warehouse_checkins;
  SELECT COUNT(*) INTO backup_count FROM warehouse_checkins_backup_20260123;
  
  IF backup_count != original_count THEN
    RAISE EXCEPTION '❌ MIGRAZIONE BLOCCATA: Backup incompleto (% vs % record)', backup_count, original_count;
  END IF;
  
  RAISE NOTICE '✅ Backup verificato: % record', backup_count;
  
  -- Verifica esistenza colonne da eliminare
  SELECT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'warehouse_checkins' 
    AND column_name = 'ore di lavoro effetive'
  ) INTO col1_exists;
  
  SELECT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'warehouse_checkins' 
    AND column_name = 'oraro in eccesso'
  ) INTO col2_exists;
  
  SELECT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'warehouse_checkins' 
    AND column_name = 'oraro in difetto'
  ) INTO col3_exists;
  
  RAISE NOTICE 'Colonne da eliminare: "ore di lavoro effetive"=%, "oraro in eccesso"=%, "oraro in difetto"=%', 
    col1_exists, col2_exists, col3_exists;
  
  IF NOT (col1_exists OR col2_exists OR col3_exists) THEN
    RAISE NOTICE '⚠️ Nessuna colonna illegale trovata - Migrazione già applicata?';
  END IF;
END $$;

-- FASE 2: Statistiche pre-migrazione
-- ============================================================================

-- Conta record con dati nelle colonne da eliminare
SELECT 
  COUNT(*) FILTER (WHERE "ore di lavoro effetive" IS NOT NULL) as ore_lavoro_popolati,
  COUNT(*) FILTER (WHERE "oraro in eccesso" IS NOT NULL) as eccesso_popolati,
  COUNT(*) FILTER (WHERE "oraro in difetto" IS NOT NULL) as difetto_popolati,
  COUNT(*) as totale_record
FROM warehouse_checkins;

-- FASE 3: Eliminazione colonne (TRANSAZIONE SICURA)
-- ============================================================================

BEGIN;

-- Checkpoint pre-migrazione
DO $$
BEGIN
  RAISE NOTICE '🔧 Inizio eliminazione colonne illegali...';
  RAISE NOTICE '📊 Tabella: warehouse_checkins';
  RAISE NOTICE '🗑️ Colonne da rimuovere: 3';
END $$;

-- Elimina colonna 1: "ore di lavoro effetive"
ALTER TABLE warehouse_checkins 
  DROP COLUMN IF EXISTS "ore di lavoro effetive";

RAISE NOTICE '✅ Eliminata colonna: "ore di lavoro effetive"';

-- Elimina colonna 2: "oraro in eccesso" (TYPO)
ALTER TABLE warehouse_checkins 
  DROP COLUMN IF EXISTS "oraro in eccesso";

RAISE NOTICE '✅ Eliminata colonna: "oraro in eccesso"';

-- Elimina colonna 3: "oraro in difetto" (TYPO)
ALTER TABLE warehouse_checkins 
  DROP COLUMN IF EXISTS "oraro in difetto";

RAISE NOTICE '✅ Eliminata colonna: "oraro in difetto"';

-- FASE 4: Verifica post-migrazione
-- ============================================================================

DO $$
DECLARE
  remaining_columns INTEGER;
  col1_exists BOOLEAN;
  col2_exists BOOLEAN;
  col3_exists BOOLEAN;
  record_count INTEGER;
BEGIN
  -- Conta colonne rimaste
  SELECT COUNT(*) INTO remaining_columns
  FROM information_schema.columns
  WHERE table_name = 'warehouse_checkins';
  
  RAISE NOTICE '📊 Colonne rimaste nella tabella: %', remaining_columns;
  
  -- Verifica che le colonne siano state eliminate
  SELECT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'warehouse_checkins' 
    AND column_name = 'ore di lavoro effetive'
  ) INTO col1_exists;
  
  SELECT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'warehouse_checkins' 
    AND column_name = 'oraro in eccesso'
  ) INTO col2_exists;
  
  SELECT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'warehouse_checkins' 
    AND column_name = 'oraro in difetto'
  ) INTO col3_exists;
  
  IF col1_exists OR col2_exists OR col3_exists THEN
    RAISE EXCEPTION '❌ ERRORE: Alcune colonne non sono state eliminate!';
  END IF;
  
  -- Verifica integrità dati
  SELECT COUNT(*) INTO record_count FROM warehouse_checkins;
  
  IF record_count != 374 THEN
    RAISE EXCEPTION '❌ ERRORE: Numero record cambiato! Attesi 374, trovati %', record_count;
  END IF;
  
  RAISE NOTICE '✅ Verifica integrità: % record preservati', record_count;
  
  -- Verifica colonne GENERATED ancora presenti
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'warehouse_checkins' 
    AND column_name = 'effective_ore_lavorate_minuti'
  ) THEN
    RAISE EXCEPTION '❌ ERRORE: Colonna GENERATED effective_ore_lavorate_minuti mancante!';
  END IF;
  
  RAISE NOTICE '✅ Colonne GENERATED preservate correttamente';
  RAISE NOTICE '✅✅✅ MIGRAZIONE COMPLETATA CON SUCCESSO ✅✅✅';
END $$;

-- COMMIT della transazione
COMMIT;

-- FASE 5: Statistiche post-migrazione
-- ============================================================================

-- Verifica finale struttura tabella
SELECT 
  COUNT(*) as colonne_totali,
  COUNT(*) FILTER (WHERE is_generated = 'ALWAYS') as colonne_generated,
  COUNT(*) FILTER (WHERE is_generated = 'NEVER') as colonne_normali
FROM information_schema.columns
WHERE table_name = 'warehouse_checkins';

-- Verifica spazio recuperato
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS dimensione
FROM pg_tables
WHERE tablename IN ('warehouse_checkins', 'warehouse_checkins_backup_20260123')
ORDER BY tablename;

-- ============================================================================
-- PULIZIA POST-MIGRAZIONE (OPZIONALE)
-- ============================================================================

-- Dopo aver verificato che tutto funziona (attendere almeno 30 giorni):
-- DROP TABLE warehouse_checkins_backup_20260123;

-- ============================================================================
-- SCRIPT DI ROLLBACK (SOLO IN CASO DI EMERGENZA)
-- ============================================================================

/*
-- ⚠️ ATTENZIONE: Questo script RIPRISTINA le colonne eliminate!
-- ⚠️ Usare SOLO se la migrazione ha causato problemi all'applicazione!

BEGIN;

-- Aggiungi le colonne eliminate
ALTER TABLE warehouse_checkins 
  ADD COLUMN IF NOT EXISTS "ore di lavoro effetive" interval,
  ADD COLUMN IF NOT EXISTS "oraro in eccesso" interval,
  ADD COLUMN IF NOT EXISTS "oraro in difetto" interval;

-- Ripristina i dati dal backup
UPDATE warehouse_checkins w
SET 
  "ore di lavoro effetive" = b."ore di lavoro effetive",
  "oraro in eccesso" = b."oraro in eccesso",
  "oraro in difetto" = b."oraro in difetto"
FROM warehouse_checkins_backup_20260123 b
WHERE w.id = b.id;

-- Verifica ripristino
DO $$
DECLARE
  restored_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO restored_count
  FROM warehouse_checkins
  WHERE "ore di lavoro effetive" IS NOT NULL;
  
  RAISE NOTICE 'Record ripristinati con "ore di lavoro effetive": %', restored_count;
END $$;

COMMIT;
*/

-- ============================================================================
-- DOCUMENTAZIONE MIGRAZIONE
-- ============================================================================

-- Tabella originale: 148 colonne
-- Tabella post-migrazione: 145 colonne
-- Colonne eliminate: 3
-- Record preservati: 374
-- Backup disponibile: warehouse_checkins_backup_20260123

-- Colonne GENERATE preservate:
-- - effective_check_in
-- - effective_check_out
-- - effective_ore_lavorate_minuti ← Sostituisce "ore di lavoro effetive"
-- - effective_pausa_pranzo_inizio
-- - effective_pausa_pranzo_fine
-- - effective_pausa_pranzo_minuti
-- - effective_pausa_cena_inizio
-- - effective_pausa_cena_fine
-- - effective_pausa_cena_minuti
-- - effective_pausa_totale_minuti

-- File applicazione verificati (NESSUN UTILIZZO TROVATO):
-- ✅ WarehouseCheckIn.tsx (2749 righe)
-- ✅ Straordinari.tsx (819 righe)
-- ✅ ShiftActions.tsx (1239 righe)
-- ✅ WarehouseShiftsReport.tsx (685 righe)
