/*
  # Fix crewtemplate RLS policies with correct auth.uid() function

  1. Security Policies
    - Add INSERT policy for companies to create templates
    - Add UPDATE policy for companies to modify their templates  
    - Add DELETE policy for companies to delete their templates
    - Use correct auth.uid() function instead of uid()

  2. Access Control
    - Only authenticated users can manage templates
    - Each company can only access their own templates (azienda_id = auth.uid())
*/

-- Add INSERT policy for crewtemplate
CREATE POLICY "Companies can insert own templates"
  ON crewtemplate
  FOR INSERT
  TO authenticated
  WITH CHECK (azienda_id = auth.uid());

-- Add UPDATE policy for crewtemplate  
CREATE POLICY "Companies can update own templates"
  ON crewtemplate
  FOR UPDATE
  TO authenticated
  USING (azienda_id = auth.uid())
  WITH CHECK (azienda_id = auth.uid());

-- Add DELETE policy for crewtemplate
CREATE POLICY "Companies can delete own templates"
  ON crewtemplate
  FOR DELETE
  TO authenticated
  USING (azienda_id = auth.uid());