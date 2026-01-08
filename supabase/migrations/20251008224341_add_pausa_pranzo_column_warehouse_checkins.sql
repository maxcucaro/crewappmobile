/*
  # Aggiunge colonna pausa_pranzo a warehouse_checkins

  ## Modifiche
  - Aggiunge colonna `pausa_pranzo` (boolean) alla tabella `warehouse_checkins`
  - Default: false
  - Nullable: true per retrocompatibilità

  ## Motivo
  I trigger `calculate_warehouse_hours_trigger` e `populate_shift_info_trigger` 
  si aspettano questa colonna per applicare automaticamente la pausa pranzo di 60 minuti
  quando richiesta dal turno.
*/

-- Aggiungi colonna pausa_pranzo
ALTER TABLE warehouse_checkins 
ADD COLUMN IF NOT EXISTS pausa_pranzo boolean DEFAULT false;

-- Aggiorna commento colonna
COMMENT ON COLUMN warehouse_checkins.pausa_pranzo IS 'Indica se per questo turno è prevista pausa pranzo automatica';
