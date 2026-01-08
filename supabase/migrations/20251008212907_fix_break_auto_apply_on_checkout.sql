/*
  # Fix Break Auto-Apply on Checkout

  ## Summary
  Modifica il trigger calculate_warehouse_hours per applicare automaticamente
  la pausa di 60 minuti al momento del check-out se il dipendente non l'ha registrata.

  ## Logic
  1. Se break_start_time e break_end_time esistono:
     - Calcola break_minutes REALI (es. 1 minuto, 30 minuti, 90 minuti)
     - Set has_taken_break = true
     - Set break_auto_applied = false (registrata manualmente)
  
  2. Se al check-out la pausa non è stata registrata E pausa_pranzo = true:
     - Applica automaticamente 60 minuti
     - Set has_taken_break = true
     - Set break_auto_applied = true
  
  3. Calcola net_hours = total_hours - (break_minutes / 60)

  ## Example Cases

  ### Case 1: Pausa registrata di 1 minuto
  - Turno: 8 ore (09:00-17:00)
  - Break: 12:00-12:01 (1 minuto reale)
  - break_minutes: 1
  - net_hours: 7.98 (7 ore e 59 minuti)
  - Straordinario: +59 minuti rispetto alle 7 ore previste

  ### Case 2: Pausa dimenticata
  - Turno: 8 ore (09:00-17:00)
  - Break: NON registrato
  - break_minutes: 60 (auto-applicato)
  - break_auto_applied: true
  - net_hours: 7.00 (8 - 1)
  - Straordinario: 0 minuti
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
    -- Calculate REAL minutes between break start and end
    IF NEW.break_end_time >= NEW.break_start_time THEN
      NEW.break_minutes := EXTRACT(EPOCH FROM (NEW.break_end_time - NEW.break_start_time)) / 60;
    ELSE
      -- Handle break spanning midnight (rare but possible)
      NEW.break_minutes := EXTRACT(EPOCH FROM (NEW.break_end_time + interval '24 hours' - NEW.break_start_time)) / 60;
    END IF;
    
    -- Mark break as taken manually
    NEW.has_taken_break := true;
    NEW.break_auto_applied := false;
    
  -- AUTO-APPLY break on checkout if not registered and break is required
  ELSIF NEW.check_out_time IS NOT NULL AND NEW.pausa_pranzo = true AND NEW.has_taken_break = false THEN
    -- Apply standard 60 minutes break automatically
    NEW.break_minutes := 60;
    NEW.has_taken_break := true;
    NEW.break_auto_applied := true;
    NEW.break_modified_at := NOW();
    
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