/*
  # Auto-Apply Break After 8 Hours Function

  ## Summary
  Creates a database function that automatically applies the standard break duration
  to shifts where the employee didn't register their break within 8 hours of shift end.

  ## Function: auto_apply_missed_breaks()
  
  ### Purpose
  - Called periodically (e.g., every hour via cron job or scheduled task)
  - Finds completed shifts where:
    - Check-out was more than 8 hours ago
    - Shift requires break (pausa_pranzo = true)
    - Break was not registered (has_taken_break = false)
    - Break not already auto-applied
  - Automatically applies the standard break minutes from shift template
  
  ### Process
  1. Identifies eligible shifts
  2. Gets standard break duration from crew_template_turni
  3. Sets break_minutes to standard duration (default 60 if not specified)
  4. Marks break_auto_applied = true
  5. Marks has_taken_break = true
  6. Recalculates net_hours
  
  ### Returns
  - Count of records updated
  
  ## Usage
  This function should be called by:
  - A scheduled Edge Function (recommended)
  - A cron job
  - Admin panel "Process Pending Breaks" button
*/

CREATE OR REPLACE FUNCTION auto_apply_missed_breaks()
RETURNS integer AS $$
DECLARE
  updated_count integer := 0;
  break_record RECORD;
  standard_break_minutes integer;
BEGIN
  -- Find all shifts that need auto-applied breaks
  FOR break_record IN
    SELECT 
      wc.id,
      wc.check_out_time,
      wc.date,
      wc.total_hours,
      wc.shift_id,
      COALESCE(ct.durata_pausa_minuti, 60) as standard_break
    FROM warehouse_checkins wc
    LEFT JOIN crew_template_turni ct ON wc.shift_id = ct.id_template
    WHERE 
      wc.has_checked_out = true
      AND wc.pausa_pranzo = true
      AND wc.has_taken_break = false
      AND wc.break_auto_applied = false
      AND wc.check_out_time IS NOT NULL
      -- Check if more than 8 hours have passed since shift end
      AND (
        wc.date + wc.check_out_time + interval '8 hours' < NOW()
      )
  LOOP
    -- Get standard break minutes (default to 60 if not found)
    standard_break_minutes := break_record.standard_break;
    
    -- Update the record
    UPDATE warehouse_checkins
    SET 
      break_minutes = standard_break_minutes,
      break_auto_applied = true,
      has_taken_break = true,
      -- Recalculate net_hours
      net_hours = CASE 
        WHEN total_hours IS NOT NULL 
        THEN total_hours - (standard_break_minutes::numeric / 60)
        ELSE NULL
      END,
      break_modified_at = NOW()
    WHERE id = break_record.id;
    
    updated_count := updated_count + 1;
  END LOOP;
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (for admin panel)
GRANT EXECUTE ON FUNCTION auto_apply_missed_breaks() TO authenticated;

-- Add comment
COMMENT ON FUNCTION auto_apply_missed_breaks() IS 
'Automatically applies standard break duration to shifts where break was not registered within 8 hours of shift end';


/*
  # Helper Function: Check if Break Entry Window is Still Open
  
  ## Purpose
  Utility function to check if an employee can still manually enter break times
  for a specific check-in record.
  
  ## Returns
  - TRUE if within 8-hour window
  - FALSE if window has closed
*/

CREATE OR REPLACE FUNCTION can_enter_break(checkin_id uuid)
RETURNS boolean AS $$
DECLARE
  checkin_record RECORD;
BEGIN
  SELECT 
    date,
    check_out_time,
    has_checked_out,
    break_auto_applied
  INTO checkin_record
  FROM warehouse_checkins
  WHERE id = checkin_id;
  
  -- If not found or not checked out yet, return true
  IF NOT FOUND OR NOT checkin_record.has_checked_out THEN
    RETURN true;
  END IF;
  
  -- If already auto-applied, can't modify
  IF checkin_record.break_auto_applied THEN
    RETURN false;
  END IF;
  
  -- Check if within 8-hour window
  RETURN (
    checkin_record.date + checkin_record.check_out_time + interval '8 hours' >= NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION can_enter_break(uuid) TO authenticated;

COMMENT ON FUNCTION can_enter_break(uuid) IS 
'Checks if an employee can still manually enter break times for a given check-in (within 8-hour window)';


/*
  # Helper Function: Get Pending Break Entry Count for Employee
  
  ## Purpose
  Returns the number of completed shifts where the employee still needs to enter break info.
  Useful for dashboard notifications.
  
  ## Parameters
  - employee_id: UUID of the crew member
  
  ## Returns
  - Count of shifts awaiting break entry
*/

CREATE OR REPLACE FUNCTION get_pending_break_count(employee_id uuid)
RETURNS integer AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM warehouse_checkins
    WHERE 
      crew_id = employee_id
      AND has_checked_out = true
      AND pausa_pranzo = true
      AND has_taken_break = false
      AND break_auto_applied = false
      AND can_enter_break(id) = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_pending_break_count(uuid) TO authenticated;

COMMENT ON FUNCTION get_pending_break_count(uuid) IS 
'Returns count of shifts where employee still needs to enter break info (within 8-hour window)';