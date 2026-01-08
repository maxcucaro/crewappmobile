/*
  # Recreate warehouses table with correct structure

  1. New Tables
    - `warehouses`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to regaziendasoftware)
      - `name` (text, warehouse name)
      - `address` (text, warehouse address)
      - `description` (text, optional description)
      - `qr_code_value` (text, unique QR code identifier)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `warehouses` table
    - Add policy for companies to manage their own warehouses
    - Add policy for crew to read warehouses for check-in

  3. Changes
    - Drop existing warehouses table if exists
    - Create new table with simplified structure
    - Add appropriate indexes and constraints
*/

-- Drop existing table if exists
DROP TABLE IF EXISTS warehouses CASCADE;

-- Create warehouses table
CREATE TABLE warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES regaziendasoftware(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text NOT NULL,
  description text,
  qr_code_value text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_warehouses_company_id ON warehouses(company_id);
CREATE INDEX idx_warehouses_qr_code ON warehouses(qr_code_value);

-- RLS Policies
CREATE POLICY "Companies can manage their own warehouses"
  ON warehouses
  FOR ALL
  TO authenticated
  USING (company_id = auth.uid())
  WITH CHECK (company_id = auth.uid());

CREATE POLICY "Crew can read warehouses for check-in"
  ON warehouses
  FOR SELECT
  TO authenticated
  USING (true);

-- Public access for QR code scanning
CREATE POLICY "Public can read warehouses for QR scanning"
  ON warehouses
  FOR SELECT
  TO public
  USING (true);