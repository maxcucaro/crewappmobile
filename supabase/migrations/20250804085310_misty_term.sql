/*
  # Fix infinite recursion in training_courses RLS policy

  1. Problem
    - The existing RLS policy for training_courses causes infinite recursion
    - This happens when crew members try to read training courses through enrollments

  2. Solution
    - Drop the problematic policy that causes recursion
    - Create a simpler, direct policy without circular references
    - Ensure crew members can read courses they are enrolled in without recursion
*/

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Crew members can read enrolled training courses" ON training_courses;

-- Create a new, simpler policy without recursion
CREATE POLICY "Crew can read training courses for their enrollments"
  ON training_courses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM training_enrollments 
      WHERE training_enrollments.training_id = training_courses.id 
      AND training_enrollments.crew_id = auth.uid()
    )
  );