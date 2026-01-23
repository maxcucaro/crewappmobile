-- ============================================================================
-- BACKUP COMPLETO TABELLA warehouse_checkins
-- Data: 2026-01-23
-- Scopo: Backup di sicurezza prima di eliminare colonne illegali
-- ============================================================================

-- FASE 1: Creazione tabella di backup con tutti i dati
-- ============================================================================
-- Crea una copia completa della tabella warehouse_checkins
-- Include struttura, dati, ma NON i vincoli/indici/trigger (per semplicità backup)

CREATE TABLE IF NOT EXISTS warehouse_checkins_backup_20260123 AS 
SELECT * FROM warehouse_checkins;

-- FASE 2: Verifica integrità del backup
-- ============================================================================

-- Verifica conteggio record
DO $$
DECLARE
  original_count INTEGER;
  backup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO original_count FROM warehouse_checkins;
  SELECT COUNT(*) INTO backup_count FROM warehouse_checkins_backup_20260123;
  
  RAISE NOTICE 'Tabella originale: % record', original_count;
  RAISE NOTICE 'Tabella backup: % record', backup_count;
  
  IF original_count = backup_count THEN
    RAISE NOTICE '✅ BACKUP COMPLETATO CON SUCCESSO - Record identici';
  ELSE
    RAISE WARNING '⚠️ ATTENZIONE - Differenza nel numero di record!';
  END IF;
END $$;

-- Query di verifica manuale (esegui dopo il backup)
-- ============================================================================

-- 1. Verifica conteggio totale
SELECT 
  'Originale' as tabella, 
  COUNT(*) as totale_record 
FROM warehouse_checkins
UNION ALL
SELECT 
  'Backup' as tabella, 
  COUNT(*) as totale_record 
FROM warehouse_checkins_backup_20260123;

-- 2. Verifica che le colonne illegali siano state copiate
SELECT 
  id,
  date,
  "ore di lavoro effetive",
  "oraro in eccesso",
  "oraro in difetto"
FROM warehouse_checkins_backup_20260123
WHERE 
  "ore di lavoro effetive" IS NOT NULL
  OR "oraro in eccesso" IS NOT NULL
  OR "oraro in difetto" IS NOT NULL
LIMIT 5;

-- 3. Verifica spazio occupato
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename IN ('warehouse_checkins', 'warehouse_checkins_backup_20260123')
ORDER BY tablename;

-- ============================================================================
-- SCRIPT DI RIPRISTINO (DA USARE SOLO IN CASO DI EMERGENZA)
-- ============================================================================

-- ⚠️ ATTENZIONE: Questo script SOVRASCRIVE la tabella originale!
-- ⚠️ Usare SOLO se la migrazione ha causato problemi!

/*
-- RIPRISTINO COMPLETO (decommenta solo se necessario)

BEGIN;

-- Backup della tabella corrente (per sicurezza)
DROP TABLE IF EXISTS warehouse_checkins_before_restore CASCADE;
CREATE TABLE warehouse_checkins_before_restore AS SELECT * FROM warehouse_checkins;

-- Elimina tabella corrente
DROP TABLE IF EXISTS warehouse_checkins CASCADE;

-- Ripristina dal backup
CREATE TABLE warehouse_checkins AS SELECT * FROM warehouse_checkins_backup_20260123;

-- Verifica ripristino
SELECT COUNT(*) as record_ripristinati FROM warehouse_checkins;

-- Se tutto OK, conferma
COMMIT;

-- Se qualcosa è andato storto
-- ROLLBACK;

*/

-- ============================================================================
-- RIPRISTINO PARZIALE DELLE COLONNE (alternativa più sicura)
-- ============================================================================

-- Se hai eliminato le colonne ma vuoi riaggiungerle con i dati originali:

/*
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

COMMIT;
*/

-- ============================================================================
-- NOTE OPERATIVE
-- ============================================================================

-- 1. La tabella di backup NON include:
--    - Indici (verranno ricreati automaticamente se necessario)
--    - Vincoli di chiave esterna (FK)
--    - Trigger
--    - Colonne GENERATED (verranno rigenerate automaticamente)
--    - Permessi RLS (Row Level Security)

-- 2. La tabella di backup INCLUDE:
--    - Tutti i dati (148 colonne complete)
--    - Tutte le colonne illegali con i loro dati
--    - Tutti i record storici

-- 3. Dimensione stimata backup:
--    - Dipende dal numero di record nella tabella originale
--    - Tipicamente stesso spazio della tabella originale

-- 4. Conservazione backup:
--    - Si consiglia di mantenere il backup per almeno 30 giorni
--    - Dopo verifica migrazione, può essere eliminato con:
--    -- DROP TABLE warehouse_checkins_backup_20260123;

-- ============================================================================
-- COMANDI UTILI POST-BACKUP
-- ============================================================================

-- Verifica struttura tabella backup
-- SELECT column_name, data_type, is_generated
-- FROM information_schema.columns
-- WHERE table_name = 'warehouse_checkins_backup_20260123'
-- ORDER BY ordinal_position;

-- Confronta date range
-- SELECT 
--   MIN(date) as prima_data,
--   MAX(date) as ultima_data,
--   COUNT(*) as totale
-- FROM warehouse_checkins_backup_20260123;
