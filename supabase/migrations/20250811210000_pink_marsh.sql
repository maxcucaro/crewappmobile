/*
  # Add company name column to registration_requests

  1. Schema Changes
    - Add `company_name_cached` column to `registration_requests` table
    - This will store the company name for better performance and avoid JOINs

  2. Data Migration
    - Update existing records to populate the new column
    - Set up trigger to automatically update when parent_company_id changes

  3. Performance
    - Denormalized data for faster queries
    - Reduces need for JOINs in admin interface
*/

-- Add the new column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'registration_requests' AND column_name = 'company_name_cached'
  ) THEN
    ALTER TABLE registration_requests ADD COLUMN company_name_cached text;
  END IF;
END $$;

-- Update existing records to populate the company name
UPDATE registration_requests 
SET company_name_cached = regaziendasoftware.ragione_sociale
FROM regaziendasoftware 
WHERE registration_requests.parent_company_id = regaziendasoftware.id
AND registration_requests.company_name_cached IS NULL;

-- Create function to automatically update company name when parent_company_id changes
CREATE OR REPLACE FUNCTION update_registration_company_name()
RETURNS TRIGGER AS $$
BEGIN
  -- If parent_company_id is set, get the company name
  IF NEW.parent_company_id IS NOT NULL THEN
    SELECT ragione_sociale INTO NEW.company_name_cached
    FROM regaziendasoftware 
    WHERE id = NEW.parent_company_id;
  ELSE
    NEW.company_name_cached = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update company name
DROP TRIGGER IF EXISTS update_registration_company_name_trigger ON registration_requests;
CREATE TRIGGER update_registration_company_name_trigger
  BEFORE INSERT OR UPDATE OF parent_company_id ON registration_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_registration_company_name();

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_registration_requests_company_name 
ON registration_requests(company_name_cached) 
WHERE company_name_cached IS NOT NULL;