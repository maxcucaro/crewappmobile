/*
  # Aggiungi campi pasto a warehouse_checkins

  1. Nuovi Campi
    - `company_meal` (boolean) - Se ha richiesto pasto aziendale
    - `meal_voucher` (boolean) - Se ha richiesto buono pasto
    - `meal_cost` (numeric) - Costo del pasto aziendale (opzionale)
    - `meal_notes` (text) - Note sui pasti (opzionale)

  2. Valori Default
    - `company_meal` = false
    - `meal_voucher` = false
    - `meal_cost` = 0.00
    - `meal_notes` = null

  3. Compatibilità
    - Tutti i record esistenti avranno valori di default
    - Nessun impatto sui dati esistenti
*/

-- Aggiungi campo per pasto aziendale
ALTER TABLE warehouse_checkins 
ADD COLUMN IF NOT EXISTS company_meal boolean DEFAULT false;

-- Aggiungi campo per buono pasto
ALTER TABLE warehouse_checkins 
ADD COLUMN IF NOT EXISTS meal_voucher boolean DEFAULT false;

-- Aggiungi campo per costo pasto (opzionale)
ALTER TABLE warehouse_checkins 
ADD COLUMN IF NOT EXISTS meal_cost numeric(5,2) DEFAULT 0.00;

-- Aggiungi campo per note sui pasti (opzionale)
ALTER TABLE warehouse_checkins 
ADD COLUMN IF NOT EXISTS meal_notes text;

-- Aggiungi commenti per documentazione
COMMENT ON COLUMN warehouse_checkins.company_meal IS 'Se il dipendente ha richiesto pasto aziendale per questo turno';
COMMENT ON COLUMN warehouse_checkins.meal_voucher IS 'Se il dipendente ha richiesto buono pasto per questo turno';
COMMENT ON COLUMN warehouse_checkins.meal_cost IS 'Costo del pasto aziendale (se applicabile)';
COMMENT ON COLUMN warehouse_checkins.meal_notes IS 'Note aggiuntive sui pasti per questo turno';

-- Aggiungi constraint per validazione costo pasto
ALTER TABLE warehouse_checkins 
ADD CONSTRAINT check_meal_cost_positive 
CHECK (meal_cost >= 0);