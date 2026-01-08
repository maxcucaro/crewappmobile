/*
  # Update Break Calculation Trigger

  ## Summary
  Updates the calculate_warehouse_hours trigger function to automatically calculate
  break_minutes when break_start_time and break_end_time are provided.

  ## Changes
  - Automatically calculates break_minutes from break_start_time and break_end_time
  - Updates has_taken_break flag when break times are set
  - Preserves existing logic for manual break_minutes entry
  
  ## Logic
  1. If break_start_time and break_end_time are both set:
     - Calculate break_minutes automatically
     - Set has_taken_break = true
  2. If only break_minutes is set (backward compatibility):
     - Use the manual value
     - Set has_taken_break = true if > 0
  3. Calculate net_hours = total_hours - (break_minutes / 60)
*/

CREATE OR REPLACE FUNCTION calculate_warehouse_hours()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate total hours if check_out_time is set
  IF NEW.check_out_time IS NOT NULL AND NEW.check_in_time IS NOT NULL THEN
    -- Handle time spanning midnight
    IF NEW.check_out_time >= NEW.check_in_time THEN
      NEW.total_hours := EXTRACT(EPOCH FROM (NEW.check_out_time - NEW.check_in_time)) / 3600;
    ELSE
      NEW.total_hours := EXTRACT(EPOCH FROM (NEW.check_out_time + interval '24 hours' - NEW.check_in_time)) / 3600;
    END IF;
  END IF;

  -- Calculate break_minutes from break times if both are set
  IF NEW.break_start_time IS NOT NULL AND NEW.break_end_time IS NOT NULL THEN
    -- Calculate minutes between break start and end
    IF NEW.break_end_time >= NEW.break_start_time THEN
      NEW.break_minutes := EXTRACT(EPOCH FROM (NEW.break_end_time - NEW.break_start_time)) / 60;
    ELSE
      -- Handle break spanning midnight (rare but possible)
      NEW.break_minutes := EXTRACT(EPOCH FROM (NEW.break_end_time + interval '24 hours' - NEW.break_start_time)) / 60;
    END IF;
    
    -- Mark break as taken
    NEW.has_taken_break := true;
  ELSIF NEW.break_minutes > 0 THEN
    -- Backward compatibility: if break_minutes is set manually
    NEW.has_taken_break := true;
  END IF;

  -- Ensure break_minutes is never null
  IF NEW.break_minutes IS NULL THEN
    NEW.break_minutes := 0;
  END IF;

  -- Calculate net hours (total hours minus break)
  IF NEW.total_hours IS NOT NULL THEN
    NEW.net_hours := NEW.total_hours - (NEW.break_minutes::numeric / 60);
    
    -- Ensure net_hours is never negative
    IF NEW.net_hours < 0 THEN
      NEW.net_hours := 0;
    END IF;
  END IF;

  -- Update status to completed when check_out is done
  IF NEW.check_out_time IS NOT NULL AND NEW.status = 'active' THEN
    NEW.status := 'completed';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;