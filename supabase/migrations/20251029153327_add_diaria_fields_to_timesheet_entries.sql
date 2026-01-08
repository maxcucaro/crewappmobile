/*
  # Add diaria benefit fields to timesheet_entries

  ## Changes
  
  1. New Columns Added to `timesheet_entries`:
    - `diaria_type` (text) - Type of daily allowance: 'nessuna', 'evento', 'trasferta'
    - `diaria_amount` (numeric) - Amount of daily allowance in euros
    - `other_benefits_amount` (numeric) - Sum of other custom benefits
    - `total_benefits` (numeric) - Total of all benefits (meal + diaria + others)
  
  ## Purpose
  
  These fields store the benefit amounts calculated at checkout time, ensuring:
  - Immutable historical records
  - Accurate payroll calculations even if benefit rates change in the future
  - Simple queries without complex JOINs or recalculations
  
  ## Notes
  
  - All amounts default to 0
  - `diaria_type` is constrained to valid values only
  - These fields are populated by the EventCheckIn component at checkout
*/

-- Add diaria type field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'timesheet_entries' AND column_name = 'diaria_type'
  ) THEN
    ALTER TABLE timesheet_entries 
      ADD COLUMN diaria_type TEXT DEFAULT 'nessuna'
      CHECK (diaria_type IN ('nessuna', 'evento', 'trasferta'));
  END IF;
END $$;

-- Add diaria amount field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'timesheet_entries' AND column_name = 'diaria_amount'
  ) THEN
    ALTER TABLE timesheet_entries 
      ADD COLUMN diaria_amount NUMERIC(10,2) DEFAULT 0
      CHECK (diaria_amount >= 0);
  END IF;
END $$;

-- Add other benefits amount field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'timesheet_entries' AND column_name = 'other_benefits_amount'
  ) THEN
    ALTER TABLE timesheet_entries 
      ADD COLUMN other_benefits_amount NUMERIC(10,2) DEFAULT 0
      CHECK (other_benefits_amount >= 0);
  END IF;
END $$;

-- Add total benefits field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'timesheet_entries' AND column_name = 'total_benefits'
  ) THEN
    ALTER TABLE timesheet_entries 
      ADD COLUMN total_benefits NUMERIC(10,2) DEFAULT 0
      CHECK (total_benefits >= 0);
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN timesheet_entries.diaria_type IS 'Type of daily allowance: nessuna (none), evento (event), trasferta (travel)';
COMMENT ON COLUMN timesheet_entries.diaria_amount IS 'Daily allowance amount in euros, calculated at checkout';
COMMENT ON COLUMN timesheet_entries.other_benefits_amount IS 'Sum of other custom benefits in euros';
COMMENT ON COLUMN timesheet_entries.total_benefits IS 'Total of all benefits (meal vouchers + diaria + others)';