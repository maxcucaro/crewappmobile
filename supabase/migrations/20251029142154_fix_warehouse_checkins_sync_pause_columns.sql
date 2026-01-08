/*
  # Sincronizzazione Colonne Pausa Pranzo - Warehouse Checkins
  
  ## Obiettivo
  Sincronizzare le colonne duplicate per la pausa pranzo senza perdere dati esistenti:
  - `has_taken_break` → `pausa_pranzo` (sincronizzazione boolean)
  - `break_minutes` → `pausa_pranzo_minuti` (sincronizzazione minuti)
  
  ## Cambiamenti
  
  1. **Sincronizzazione Dati Esistenti**
     - Copia `has_taken_break` in `pausa_pranzo` dove non è già impostato
     - Copia `break_minutes` in `pausa_pranzo_minuti` dove non è già impostato
  
  2. **Trigger di Sincronizzazione Automatica**
     - Quando viene aggiornato `has_taken_break` → aggiorna anche `pausa_pranzo`
     - Quando viene aggiornato `pausa_pranzo` → aggiorna anche `has_taken_break`
     - Quando viene aggiornato `break_minutes` → aggiorna anche `pausa_pranzo_minuti`
     - Quando viene aggiornato `pausa_pranzo_minuti` → aggiorna anche `break_minutes`
  
  ## Note Importanti
  - NON elimina colonne esistenti per evitare rotture
  - Mantiene compatibilità con codice esistente
  - Sincronizzazione bidirezionale per sicurezza
*/

-- 1. SINCRONIZZAZIONE DATI ESISTENTI

-- Sincronizza has_taken_break → pausa_pranzo
UPDATE warehouse_checkins
SET pausa_pranzo = has_taken_break
WHERE has_taken_break IS NOT NULL 
  AND (pausa_pranzo IS NULL OR pausa_pranzo != has_taken_break);

-- Sincronizza break_minutes → pausa_pranzo_minuti
UPDATE warehouse_checkins
SET pausa_pranzo_minuti = break_minutes
WHERE break_minutes IS NOT NULL 
  AND break_minutes > 0
  AND (pausa_pranzo_minuti IS NULL OR pausa_pranzo_minuti = 0);

-- 2. FUNZIONE DI SINCRONIZZAZIONE AUTOMATICA

CREATE OR REPLACE FUNCTION sync_warehouse_checkins_pause_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Sincronizza has_taken_break ↔ pausa_pranzo
  IF NEW.has_taken_break IS DISTINCT FROM OLD.has_taken_break THEN
    NEW.pausa_pranzo := NEW.has_taken_break;
  ELSIF NEW.pausa_pranzo IS DISTINCT FROM OLD.pausa_pranzo THEN
    NEW.has_taken_break := NEW.pausa_pranzo;
  END IF;
  
  -- Sincronizza break_minutes ↔ pausa_pranzo_minuti
  IF NEW.break_minutes IS DISTINCT FROM OLD.break_minutes THEN
    NEW.pausa_pranzo_minuti := NEW.break_minutes;
  ELSIF NEW.pausa_pranzo_minuti IS DISTINCT FROM OLD.pausa_pranzo_minuti THEN
    NEW.break_minutes := NEW.pausa_pranzo_minuti;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. TRIGGER PER SINCRONIZZAZIONE AUTOMATICA

DROP TRIGGER IF EXISTS trigger_sync_warehouse_pause_columns ON warehouse_checkins;

CREATE TRIGGER trigger_sync_warehouse_pause_columns
  BEFORE INSERT OR UPDATE ON warehouse_checkins
  FOR EACH ROW
  EXECUTE FUNCTION sync_warehouse_checkins_pause_columns();

-- 4. COMMENTO SULLE COLONNE

COMMENT ON COLUMN warehouse_checkins.has_taken_break IS 'LEGACY: Sincronizzato automaticamente con pausa_pranzo. Usare pausa_pranzo nelle nuove query.';
COMMENT ON COLUMN warehouse_checkins.break_minutes IS 'LEGACY: Sincronizzato automaticamente con pausa_pranzo_minuti. Usare pausa_pranzo_minuti nelle nuove query.';
COMMENT ON COLUMN warehouse_checkins.pausa_pranzo IS 'Indica se il dipendente ha effettuato la pausa pranzo (sincronizzato con has_taken_break)';
COMMENT ON COLUMN warehouse_checkins.pausa_pranzo_minuti IS 'Durata effettiva della pausa pranzo in minuti (sincronizzato con break_minutes)';
