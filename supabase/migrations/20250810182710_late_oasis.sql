/*
  # Import crew members data from registration_requests

  1. Data Import
    - Import approved users from registration_requests to crew_members
    - Map freelance and employee data correctly
    - Extract skills and experience from message field
    - Set proper profile types and company relationships

  2. Data Mapping
    - full_name -> first_name, last_name
    - email -> preserved
    - phone -> preserved  
    - parent_company_id -> company_id (for employees)
    - Extract skills from message field
    - Extract experience from message field
    - Set profile_type based on parent_company_id

  3. Security
    - Only import approved users
    - Preserve existing crew_members data
    - Handle duplicates gracefully
*/

-- Function to extract skills from message
CREATE OR REPLACE FUNCTION extract_skills_from_message(message_text TEXT)
RETURNS TEXT[] AS $$
DECLARE
  skills_text TEXT;
  skills_array TEXT[];
BEGIN
  IF message_text IS NULL THEN
    RETURN ARRAY[]::TEXT[];
  END IF;
  
  -- Extract skills from "Competenze: skill1, skill2, skill3"
  skills_text := substring(message_text FROM 'Competenze:\s*([^.]+)');
  
  IF skills_text IS NOT NULL THEN
    -- Split by comma and clean up
    SELECT ARRAY(
      SELECT TRIM(skill) 
      FROM unnest(string_to_array(skills_text, ',')) AS skill
      WHERE TRIM(skill) != ''
    ) INTO skills_array;
    
    RETURN COALESCE(skills_array, ARRAY[]::TEXT[]);
  END IF;
  
  RETURN ARRAY[]::TEXT[];
END;
$$ LANGUAGE plpgsql;

-- Function to extract experience from message
CREATE OR REPLACE FUNCTION extract_experience_from_message(message_text TEXT)
RETURNS INTEGER AS $$
DECLARE
  experience_text TEXT;
BEGIN
  IF message_text IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Extract experience from "Esperienza: X anni"
  experience_text := substring(message_text FROM 'Esperienza:\s*(\d+)\s*anni');
  
  IF experience_text IS NOT NULL THEN
    RETURN experience_text::INTEGER;
  END IF;
  
  RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- Function to extract bio from message
CREATE OR REPLACE FUNCTION extract_bio_from_message(message_text TEXT)
RETURNS TEXT AS $$
DECLARE
  bio_text TEXT;
BEGIN
  IF message_text IS NULL THEN
    RETURN '';
  END IF;
  
  -- Extract bio from "Bio: text content"
  bio_text := substring(message_text FROM 'Bio:\s*([^.]+)');
  
  RETURN COALESCE(TRIM(bio_text), '');
END;
$$ LANGUAGE plpgsql;

-- Import data from registration_requests to crew_members
DO $$
DECLARE
  rec RECORD;
  name_parts TEXT[];
  first_name_val TEXT;
  last_name_val TEXT;
  skills_array TEXT[];
  experience_val INTEGER;
  bio_val TEXT;
  profile_type_val TEXT;
  company_id_val UUID;
  imported_count INTEGER := 0;
  skipped_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting import from registration_requests to crew_members...';
  
  -- Loop through approved registration requests
  FOR rec IN 
    SELECT 
      id,
      auth_user_id,
      full_name,
      company_name,
      email,
      phone,
      parent_company_id,
      message,
      software_nome,
      tipologia_registrazione,
      created_at
    FROM registration_requests 
    WHERE status = 'approved'
    ORDER BY created_at
  LOOP
    -- Check if already exists in crew_members
    IF EXISTS (SELECT 1 FROM crew_members WHERE id = rec.auth_user_id) THEN
      RAISE NOTICE 'Skipping existing crew member: % (ID: %)', COALESCE(rec.full_name, rec.company_name), rec.auth_user_id;
      skipped_count := skipped_count + 1;
      CONTINUE;
    END IF;
    
    -- Skip if no auth_user_id
    IF rec.auth_user_id IS NULL THEN
      RAISE NOTICE 'Skipping record without auth_user_id: %', COALESCE(rec.full_name, rec.company_name);
      skipped_count := skipped_count + 1;
      CONTINUE;
    END IF;
    
    -- Parse name
    name_parts := string_to_array(COALESCE(rec.full_name, rec.company_name, 'Nome Cognome'), ' ');
    first_name_val := COALESCE(name_parts[1], 'Nome');
    last_name_val := COALESCE(array_to_string(name_parts[2:], ' '), 'Cognome');
    
    -- Extract data from message
    skills_array := extract_skills_from_message(rec.message);
    experience_val := extract_experience_from_message(rec.message);
    bio_val := extract_bio_from_message(rec.message);
    
    -- Determine profile type and company
    IF rec.parent_company_id IS NOT NULL THEN
      profile_type_val := 'employee';
      company_id_val := rec.parent_company_id;
    ELSE
      profile_type_val := 'freelance';
      company_id_val := NULL;
    END IF;
    
    -- Insert into crew_members
    BEGIN
      INSERT INTO crew_members (
        id,
        first_name,
        last_name,
        phone,
        address,
        profile_type,
        company_id,
        skills,
        experience,
        hourly_rate,
        daily_rate,
        bio,
        enpals_active,
        enpals_expiry_date,
        enpals_document_number,
        availability,
        rating,
        rating_count
      ) VALUES (
        rec.auth_user_id,
        first_name_val,
        last_name_val,
        rec.phone,
        '', -- address not available in registration_requests
        profile_type_val,
        company_id_val,
        skills_array,
        experience_val,
        CASE 
          WHEN profile_type_val = 'freelance' THEN 25.00 -- default hourly rate for freelance
          ELSE NULL 
        END,
        CASE 
          WHEN profile_type_val = 'freelance' THEN 200.00 -- default daily rate for freelance
          ELSE NULL 
        END,
        bio_val,
        false, -- default ENPALS not active
        NULL,
        NULL,
        jsonb_build_object(
          'monday', true,
          'tuesday', true, 
          'wednesday', true,
          'thursday', true,
          'friday', true,
          'saturday', false,
          'sunday', false
        ),
        NULL, -- no rating initially
        0 -- no ratings count initially
      );
      
      imported_count := imported_count + 1;
      
      RAISE NOTICE 'Imported crew member: % % (%, ID: %)', 
        first_name_val, last_name_val, profile_type_val, rec.auth_user_id;
        
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error importing crew member % %: %', 
        first_name_val, last_name_val, SQLERRM;
      skipped_count := skipped_count + 1;
    END;
  END LOOP;
  
  RAISE NOTICE 'Import completed: % imported, % skipped', imported_count, skipped_count;
  
  -- Show final counts
  RAISE NOTICE 'Total crew_members now: %', (SELECT COUNT(*) FROM crew_members);
  RAISE NOTICE 'Employees: %', (SELECT COUNT(*) FROM crew_members WHERE profile_type = 'employee');
  RAISE NOTICE 'Freelancers: %', (SELECT COUNT(*) FROM crew_members WHERE profile_type = 'freelance');
END $$;

-- Clean up helper functions
DROP FUNCTION IF EXISTS extract_skills_from_message(TEXT);
DROP FUNCTION IF EXISTS extract_experience_from_message(TEXT);
DROP FUNCTION IF EXISTS extract_bio_from_message(TEXT);

-- Show sample of imported data
SELECT 
  id,
  first_name,
  last_name,
  profile_type,
  company_id,
  skills,
  experience,
  bio
FROM crew_members 
ORDER BY first_name, last_name
LIMIT 10;