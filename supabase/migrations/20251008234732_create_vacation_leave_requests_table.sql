/*
  # Create Vacation and Leave Requests Table

  1. New Tables
    - `vacation_leave_requests`
      - `id` (uuid, primary key)
      - `crew_id` (uuid, foreign key to crew_members)
      - `request_type` (text, 'vacation' or 'leave')
      - `start_date` (date, starting date)
      - `end_date` (date, ending date)
      - `days_requested` (integer, number of days)
      - `reason` (text, optional reason)
      - `status` (text, 'pending'|'approved'|'rejected')
      - `approved_by` (uuid, foreign key to users)
      - `approved_at` (timestamptz)
      - `rejection_reason` (text)
      - `submitted_at` (timestamptz, default now)
      - `notes` (text)

  2. Security
    - Enable RLS on `vacation_leave_requests` table
    - Add policy for crew members to read their own requests
    - Add policy for crew members to create their own requests
    - Add policy for admins to read all requests
*/

CREATE TABLE IF NOT EXISTS vacation_leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES crew_members(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('vacation', 'leave')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_requested INTEGER NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

ALTER TABLE vacation_leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crew members can read own vacation/leave requests"
  ON vacation_leave_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = crew_id);

CREATE POLICY "Crew members can create own vacation/leave requests"
  ON vacation_leave_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = crew_id);

CREATE POLICY "Admin can read all vacation/leave requests"
  ON vacation_leave_requests FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin can update vacation/leave requests"
  ON vacation_leave_requests FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');