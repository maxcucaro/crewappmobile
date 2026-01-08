/*
  # Add overtime benefit field to registration_requests
  
  1. Changes
    - Add `benefit_straordinari` boolean column to `registration_requests` table
    - Default value is false (not authorized for overtime)
  
  2. Purpose
    - Allow tracking which employees are authorized to request overtime
    - Used by mobile app Straordinari component to determine authorization
*/

-- Add benefit_straordinari column to registration_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'registration_requests' AND column_name = 'benefit_straordinari'
  ) THEN
    ALTER TABLE registration_requests 
    ADD COLUMN benefit_straordinari boolean DEFAULT false;
  END IF;
END $$;