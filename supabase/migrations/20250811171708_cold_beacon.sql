/*
  # Fix warehouses table with unified ID logic

  1. Drop and recreate warehouses table
    - Add auth_user_id field for Supabase Auth reference
    - Keep company_id for business logic
    - Update RLS policies to work with both IDs

  2. Security
    - Enable RLS on warehouses table
    - Add policies for companies to manage their own warehouses
    - Support both company_id and auth_user_id identification
*/

-- Drop existing table if exists
DROP TABLE IF EXISTS warehouses CASCADE;

-- Recreate warehouses table with unified ID logic
CREATE TABLE warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text NOT NULL,
  description text,
  qr_code_value text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

-- Policy per lettura: aziende possono leggere i propri magazzini
CREATE POLICY "Companies can read own warehouses"
  ON warehouses
  FOR SELECT
  TO authenticated
  USING (
    auth_user_id = auth.uid() OR 
    company_id = auth.uid()
  );

-- Policy per inserimento: aziende possono creare i propri magazzini
CREATE POLICY "Companies can create own warehouses"
  ON warehouses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth_user_id = auth.uid() OR 
    company_id = auth.uid()
  );

-- Policy per aggiornamento: aziende possono aggiornare i propri magazzini
CREATE POLICY "Companies can update own warehouses"
  ON warehouses
  FOR UPDATE
  TO authenticated
  USING (
    auth_user_id = auth.uid() OR 
    company_id = auth.uid()
  )
  WITH CHECK (
    auth_user_id = auth.uid() OR 
    company_id = auth.uid()
  );

-- Policy per eliminazione: aziende possono eliminare i propri magazzini
CREATE POLICY "Companies can delete own warehouses"
  ON warehouses
  FOR DELETE
  TO authenticated
  USING (
    auth_user_id = auth.uid() OR 
    company_id = auth.uid()
  );

-- Policy per accesso pubblico (se necessario per admin)
CREATE POLICY "Admin can manage all warehouses"
  ON warehouses
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Indici per performance
CREATE INDEX idx_warehouses_company_id ON warehouses(company_id);
CREATE INDEX idx_warehouses_auth_user_id ON warehouses(auth_user_id);
CREATE INDEX idx_warehouses_qr_code ON warehouses(qr_code_value);