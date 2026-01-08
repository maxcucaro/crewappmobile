/*
  # Fix Registration Requests Table and Policies

  1. New Tables
    - `registration_requests`: Tabella per le richieste di registrazione

  2. Security
    - Enable RLS on the table
    - Add policies for public and authenticated users
*/

-- Tabella per le richieste di registrazione
CREATE TABLE IF NOT EXISTS registration_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('base', 'professional', 'enterprise')),
  message TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  temp_password TEXT,
  note TEXT
);

-- Indici per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_registration_requests_status ON registration_requests(status);
CREATE INDEX IF NOT EXISTS idx_registration_requests_created ON registration_requests(created_at);

-- Enable Row Level Security
ALTER TABLE registration_requests ENABLE ROW LEVEL SECURITY;

-- Policies
-- Verifica se la policy esiste prima di crearla
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polname = 'enable_public_insert' AND polrelid = 'registration_requests'::regclass
  ) THEN
    -- Chiunque può inserire una richiesta di registrazione
    EXECUTE 'CREATE POLICY "enable_public_insert" ON registration_requests
      FOR INSERT TO public
      WITH CHECK (true)';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polname = 'enable_read_requests' AND polrelid = 'registration_requests'::regclass
  ) THEN
    -- Chiunque può leggere le richieste
    EXECUTE 'CREATE POLICY "enable_read_requests" ON registration_requests
      FOR SELECT TO public
      USING (true)';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polname = 'enable_admin_update_requests' AND polrelid = 'registration_requests'::regclass
  ) THEN
    -- Gli admin possono aggiornare le richieste
    EXECUTE 'CREATE POLICY "enable_admin_update_requests" ON registration_requests
      FOR UPDATE TO authenticated
      USING (true)
      WITH CHECK (true)';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polname = 'enable_admin_read' AND polrelid = 'registration_requests'::regclass
  ) THEN
    -- Gli admin possono leggere tutte le richieste
    EXECUTE 'CREATE POLICY "enable_admin_read" ON registration_requests
      FOR SELECT TO authenticated
      USING (true)';
  END IF;
END
$$;