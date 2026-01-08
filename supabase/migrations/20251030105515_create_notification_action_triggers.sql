/*
  # Trigger per Segnare Notifiche Come Completate

  1. Trigger per Check-in Magazzino
    - Quando dipendente fa check-in magazzino, segna notifiche pre-shift come completate

  2. Trigger per Check-out Magazzino
    - Quando dipendente fa check-out magazzino, segna notifiche post-shift come completate

  Questo permette al sistema di notifiche di sapere che il dipendente ha risposto
  e quindi bloccare l'invio di ulteriori notifiche.
*/

-- ==========================================
-- TRIGGER: CHECK-IN MAGAZZINO
-- ==========================================

CREATE OR REPLACE FUNCTION mark_warehouse_checkin_notification_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Se è stato fatto check-in, segna le notifiche pre-shift come completate
  IF NEW.check_in_time IS NOT NULL AND (OLD IS NULL OR OLD.check_in_time IS NULL) THEN
    -- Ottieni user_id dal turno
    SELECT dipendente_id INTO v_user_id
    FROM crew_assegnazione_turni 
    WHERE id = NEW.turno_id;
    
    IF v_user_id IS NOT NULL THEN
      UPDATE notification_logs
      SET 
        action_taken = true,
        action_taken_at = NOW()
      WHERE 
        user_id = v_user_id
        AND shift_id = NEW.turno_id
        AND shift_type = 'warehouse'
        AND notification_type IN ('pre_shift_10', 'pre_shift_0', 'pre_shift_minus10')
        AND action_taken = false;
      
      RAISE NOTICE 'Notifiche pre-shift magazzino segnate come completate per user %', v_user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_mark_warehouse_checkin_complete ON warehouse_checkins;
CREATE TRIGGER trigger_mark_warehouse_checkin_complete
  AFTER INSERT OR UPDATE ON warehouse_checkins
  FOR EACH ROW
  EXECUTE FUNCTION mark_warehouse_checkin_notification_complete();

-- ==========================================
-- TRIGGER: CHECK-OUT MAGAZZINO
-- ==========================================

CREATE OR REPLACE FUNCTION mark_warehouse_checkout_notification_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Se è stato fatto check-out, segna le notifiche post-shift come completate
  IF NEW.check_out_time IS NOT NULL AND (OLD IS NULL OR OLD.check_out_time IS NULL) THEN
    -- Ottieni user_id dal turno
    SELECT dipendente_id INTO v_user_id
    FROM crew_assegnazione_turni 
    WHERE id = NEW.turno_id;
    
    IF v_user_id IS NOT NULL THEN
      UPDATE notification_logs
      SET 
        action_taken = true,
        action_taken_at = NOW()
      WHERE 
        user_id = v_user_id
        AND shift_id = NEW.turno_id
        AND shift_type = 'warehouse'
        AND notification_type IN ('post_shift_10', 'post_shift_20', 'post_shift_30')
        AND action_taken = false;
      
      RAISE NOTICE 'Notifiche post-shift magazzino segnate come completate per user %', v_user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_mark_warehouse_checkout_complete ON warehouse_checkins;
CREATE TRIGGER trigger_mark_warehouse_checkout_complete
  AFTER INSERT OR UPDATE ON warehouse_checkins
  FOR EACH ROW
  EXECUTE FUNCTION mark_warehouse_checkout_notification_complete();

-- Commenti
COMMENT ON FUNCTION mark_warehouse_checkin_notification_complete IS 'Segna notifiche pre-shift magazzino come completate dopo check-in';
COMMENT ON FUNCTION mark_warehouse_checkout_notification_complete IS 'Segna notifiche post-shift magazzino come completate dopo check-out';
