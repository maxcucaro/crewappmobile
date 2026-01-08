/*
  # Add Break Tracking Columns to Warehouse Check-ins

  ## Summary
  Adds comprehensive break tracking functionality to warehouse_checkins table to record
  lunch breaks with GPS tracking and late entry management.

  ## New Columns Added
  
  ### Break Timing:
  - `break_start_time` (time) - Exact time when break started
  - `break_end_time` (time) - Exact time when break ended
  
  ### Break GPS Location:
  - `break_start_location` (jsonb) - GPS coordinates when break started
  - `break_end_location` (jsonb) - GPS coordinates when break ended
  
  ### Break Status Tracking:
  - `break_registered_late` (boolean, default false) - TRUE if break was registered after check-out
  - `break_modified_at` (timestamp) - Timestamp of when break was registered/modified
  - `break_auto_applied` (boolean, default false) - TRUE if system auto-applied break after 8 hours
  
  ## Business Logic
  
  1. **Normal Flow**: Employee clicks "Start Break" and "End Break" during shift
     - GPS and times are recorded in real-time
     - `break_registered_late = false`
  
  2. **Late Entry**: Employee forgets to register break, enters it within 8 hours after shift end
     - Times are recorded but NO GPS
     - `break_registered_late = true`
     - `break_modified_at` records when it was entered
  
  3. **Auto-Applied**: Employee doesn't enter break within 8 hours
     - System automatically applies standard break minutes (from shift template)
     - `break_auto_applied = true`
     - Times remain NULL
  
  ## Notes
  - Employees have 8 hours after shift end to manually enter break times
  - After 8 hours, system auto-applies the standard break duration
  - Admins can see indicators for late/auto-applied breaks for transparency
*/

-- Add break timing columns
ALTER TABLE warehouse_checkins 
ADD COLUMN IF NOT EXISTS break_start_time time without time zone,
ADD COLUMN IF NOT EXISTS break_end_time time without time zone;

-- Add break GPS location columns
ALTER TABLE warehouse_checkins 
ADD COLUMN IF NOT EXISTS break_start_location jsonb,
ADD COLUMN IF NOT EXISTS break_end_location jsonb;

-- Add break status tracking columns
ALTER TABLE warehouse_checkins 
ADD COLUMN IF NOT EXISTS break_registered_late boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS break_modified_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS break_auto_applied boolean DEFAULT false;

-- Add constraint to ensure break end time is after start time
ALTER TABLE warehouse_checkins 
ADD CONSTRAINT valid_break_times CHECK (
  (break_start_time IS NULL AND break_end_time IS NULL) OR
  (break_start_time IS NOT NULL AND break_end_time IS NOT NULL AND break_end_time > break_start_time)
);

-- Create index for querying breaks that need auto-application
CREATE INDEX IF NOT EXISTS idx_warehouse_checkins_break_pending 
ON warehouse_checkins(crew_id, date, has_checked_out, has_taken_break, pausa_pranzo)
WHERE has_checked_out = true AND has_taken_break = false AND pausa_pranzo = true;

-- Create index for break modification timestamp
CREATE INDEX IF NOT EXISTS idx_warehouse_checkins_break_modified 
ON warehouse_checkins(break_modified_at)
WHERE break_modified_at IS NOT NULL;