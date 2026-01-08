/*
  # Disabilita trigger di sincronizzazione contabile rotti
  
  ## Problema
  I trigger che sincronizzano extra_shifts_checkins con crew_commercialista_mensile
  stanno causando errori perché cercano colonne (anno/mese) che non esistono.
  
  ## Soluzione
  Disabilitare completamente questi trigger per far tornare l'app funzionante.
  La sincronizzazione contabile può essere fatta manualmente o con un processo separato.
  
  ## Trigger disabilitati
  - trigger_sync_extra_shift
  - trigger_sync_extra_shifts
*/

-- Disabilita i trigger di sincronizzazione su extra_shifts_checkins
DROP TRIGGER IF EXISTS trigger_sync_extra_shift ON extra_shifts_checkins;
DROP TRIGGER IF EXISTS trigger_sync_extra_shifts ON extra_shifts_checkins;

-- Opzionalmente, mantieni le funzioni commentate per riferimento futuro
-- ma non le usiamo più automaticamente
COMMENT ON FUNCTION sync_extra_shift_to_accounting() IS 
'DISABILITATA: Trigger di sync che causava errori RLS. Non più usata automaticamente.';

COMMENT ON FUNCTION sync_extra_shifts_to_accounting() IS 
'DISABILITATA: Trigger di sync che causava errori RLS. Non più usata automaticamente.';