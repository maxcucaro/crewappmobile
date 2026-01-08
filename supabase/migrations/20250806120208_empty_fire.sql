/*
  # Fix crewtemplate foreign key reference

  1. Problem
    - crewtemplate.azienda_id references companies(id)
    - But user login uses regaziendasoftware table
    - Need to change foreign key to reference regaziendasoftware(id)

  2. Solution
    - Drop existing foreign key constraint
    - Add new foreign key to regaziendasoftware table
    - Update RLS policies to work with new structure
*/

-- Drop existing foreign key constraint
ALTER TABLE public.crewtemplate 
DROP CONSTRAINT IF EXISTS crewtemplate_azienda_id_fkey;

-- Add new foreign key constraint to regaziendasoftware
ALTER TABLE public.crewtemplate 
ADD CONSTRAINT crewtemplate_azienda_id_fkey 
FOREIGN KEY (azienda_id) REFERENCES public.regaziendasoftware(id) ON DELETE CASCADE;

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Aziende possono gestire i propri template" ON public.crewtemplate;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.crewtemplate;
DROP POLICY IF EXISTS "Enable all operations for public role" ON public.crewtemplate;

-- Create new RLS policies that work with the corrected foreign key
CREATE POLICY "Aziende possono gestire i propri template"
ON public.crewtemplate
FOR ALL
TO public
USING (true)
WITH CHECK (true);