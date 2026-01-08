/*
  # Fix Notification Triggers - Correct Field Name

  ## Problem
  The notification triggers in `20251030105515_create_notification_action_triggers.sql` 
  reference `NEW.turno_id` which does not exist in the `warehouse_checkins` table.
  
  The correct field name is `shift_id` (not `turno_id`).

  ## Changes
  1. Update `mark_warehouse_checkin_notification_complete()` function
     - Change `NEW.turno_id` to `NEW.shift_id`
  
  2. Update `mark_warehouse_checkout_notification_complete()` function
     - Change `NEW.turno_id` to `NEW.shift_id`

  ## Security
  - No RLS changes
  - Only fixes trigger logic
*/

-- ==========================================
-- TRIGGER: CHECK-IN MAGAZZINO (FIXED)
-- ==========================================

CREATE OR REPLACE FUNCTION mark_warehouse_checkin_notification_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Se è stato fatto check-in, segna le notifiche pre-shift come completate
  IF NEW.check_in_time IS NOT NULL AND (OLD IS NULL OR OLD.check_in_time IS NULL) THEN
    -- Ottieni user_id dal turno (usando shift_id invece di turno_id)
    SELECT dipendente_id INTO v_user_id
    FROM crew_assegnazione_turni 
    WHERE id = NEW.shift_id;
    
    IF v_user_id IS NOT NULL THEN
      UPDATE notification_logs
      SET 
        action_taken = true,
        action_taken_at = NOW()
      WHERE 
        user_id = v_user_id
        AND shift_id = NEW.shift_id
        AND shift_type = 'warehouse'
        AND notification_type IN ('pre_shift_10', 'pre_shift_0', 'pre_shift_minus10')
        AND action_taken = false;
      
      RAISE NOTICE 'Notifiche pre-shift magazzino segnate come completate per user %', v_user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- TRIGGER: CHECK-OUT MAGAZZINO (FIXED)
-- ==========================================

CREATE OR REPLACE FUNCTION mark_warehouse_checkout_notification_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Se è stato fatto check-out, segna le notifiche post-shift come completate
  IF NEW.check_out_time IS NOT NULL AND (OLD IS NULL OR OLD.check_out_time IS NULL) THEN
    -- Ottieni user_id dal turno (usando shift_id invece di turno_id)
    SELECT dipendente_id INTO v_user_id
    FROM crew_assegnazione_turni 
    WHERE id = NEW.shift_id;
    
    IF v_user_id IS NOT NULL THEN
      UPDATE notification_logs
      SET 
        action_taken = true,
        action_taken_at = NOW()
      WHERE 
        user_id = v_user_id
        AND shift_id = NEW.shift_id
        AND shift_type = 'warehouse'
        AND notification_type IN ('post_shift_10', 'post_shift_20', 'post_shift_30')
        AND action_taken = false;
      
      RAISE NOTICE 'Notifiche post-shift magazzino segnate come completate per user %', v_user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commenti
COMMENT ON FUNCTION mark_warehouse_checkin_notification_complete IS 'Segna notifiche pre-shift magazzino come completate dopo check-in (field corrected: shift_id)';
COMMENT ON FUNCTION mark_warehouse_checkout_notification_complete IS 'Segna notifiche post-shift magazzino come completate dopo check-out (field corrected: shift_id)';
