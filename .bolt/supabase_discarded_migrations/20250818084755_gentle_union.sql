/*
  # Fix auth_user_id constraint e ricrea tabelle

  1. Aggiungi constraint UNIQUE a registration_requests.auth_user_id
  2. Ricrea warehouse_checkins con riferimento corretto
  3. Ricrea timesheet_entries con riferimento corretto  
  4. Ricrea expenses con riferimento corretto
  5. Aggiorna tutte le RLS policies
*/

-- 1. Aggiungi constraint UNIQUE a auth_user_id se non esiste
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'registration_requests_auth_user_id_key'
  ) THEN
    ALTER TABLE registration_requests 
    ADD CONSTRAINT registration_requests_auth_user_id_key UNIQUE (auth_user_id);
  END IF;
END $$;

-- 2. Elimina e ricrea warehouse_checkins
DROP TABLE IF EXISTS warehouse_checkins CASCADE;

CREATE TABLE warehouse_checkins (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES registration_requests(auth_user_id) ON DELETE CASCADE,
  date date NOT NULL,
  check_in_time time NOT NULL,
  check_out_time time,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'pending')),
  location jsonb,
  notes text,
  created_at timestamptz DEFAULT now(),
  total_hours numeric(5,2),
  break_minutes integer DEFAULT 0,
  net_hours numeric(5,2),
  company_meal boolean DEFAULT false,
  meal_voucher boolean DEFAULT false,
  meal_cost numeric(5,2) DEFAULT 0.00,
  shift_id uuid
);

-- Indici per warehouse_checkins
CREATE INDEX idx_warehouse_checkins_employee_id ON warehouse_checkins(employee_id);
CREATE INDEX idx_warehouse_checkins_date ON warehouse_checkins(date);
CREATE INDEX idx_warehouse_checkins_warehouse_id ON warehouse_checkins(warehouse_id);

-- 3. Elimina e ricrea timesheet_entries  
DROP TABLE IF EXISTS timesheet_entries CASCADE;

CREATE TABLE timesheet_entries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id uuid NOT NULL REFERENCES registration_requests(auth_user_id) ON DELETE CASCADE,
  event_id uuid REFERENCES crew_events(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time,
  end_time time,
  break_time integer DEFAULT 0,
  total_hours numeric(5,2),
  total_days numeric(3,1),
  tracking_type text NOT NULL CHECK (tracking_type IN ('hours', 'days')),
  hourly_rate numeric(10,2),
  daily_rate numeric(10,2),
  retention_percentage numeric(5,2) NOT NULL,
  gross_amount numeric(10,2) NOT NULL,
  net_amount numeric(10,2) NOT NULL,
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid_by_company', 'received_by_crew', 'confirmed')),
  notes text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  gps_location jsonb,
  company_meal boolean DEFAULT false,
  meal_voucher boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  diaria_amount numeric(6,2) DEFAULT 0.00,
  diaria_type text CHECK (diaria_type IN ('evento', 'trasferta', 'nessuna')),
  diaria_notes text
);

-- Indici per timesheet_entries
CREATE INDEX idx_timesheet_entries_employee_id ON timesheet_entries(employee_id);
CREATE INDEX idx_timesheet_entries_date ON timesheet_entries(date);
CREATE INDEX idx_timesheet_entries_event_id ON timesheet_entries(event_id);

-- 4. Elimina e ricrea expenses
DROP TABLE IF EXISTS expenses CASCADE;

CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id uuid NOT NULL REFERENCES registration_requests(auth_user_id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES crew_events(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('food', 'alloggio', 'transport', 'materials', 'communication', 'other')),
  amount numeric(10,2) NOT NULL,
  description text NOT NULL,
  receipt_url text,
  expense_date date NOT NULL,
  submitted_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  rejection_reason text,
  notes text,
  location text,
  is_within_time_limit boolean DEFAULT true,
  is_within_budget_limit boolean DEFAULT true
);

-- Indici per expenses
CREATE INDEX idx_expenses_employee_id ON expenses(employee_id);
CREATE INDEX idx_expenses_event_id ON expenses(event_id);
CREATE INDEX idx_expenses_date ON expenses(expense_date);

-- 5. Abilita RLS su tutte le tabelle
ALTER TABLE warehouse_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies per warehouse_checkins
CREATE POLICY "Employees can manage own warehouse checkins"
  ON warehouse_checkins
  FOR ALL
  TO authenticated
  USING (employee_id = uid())
  WITH CHECK (employee_id = uid());

CREATE POLICY "Companies can manage warehouse checkins"
  ON warehouse_checkins
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM warehouses w
    JOIN regaziendasoftware r ON w.company_id = r.id
    WHERE w.id = warehouse_checkins.warehouse_id
    AND (r.auth_user_id = uid() OR r.email = email() OR r.id = uid())
    AND r.attivo = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM warehouses w
    JOIN regaziendasoftware r ON w.company_id = r.id
    WHERE w.id = warehouse_checkins.warehouse_id
    AND (r.auth_user_id = uid() OR r.email = email() OR r.id = uid())
    AND r.attivo = true
  ));

-- 7. RLS Policies per timesheet_entries
CREATE POLICY "Employees can manage own timesheet entries"
  ON timesheet_entries
  FOR ALL
  TO authenticated
  USING (employee_id = uid())
  WITH CHECK (employee_id = uid());

CREATE POLICY "Companies can read timesheet entries for their events"
  ON timesheet_entries
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM crew_events ce
    JOIN regaziendasoftware r ON ce.company_id = r.id
    WHERE ce.id = timesheet_entries.event_id
    AND (r.auth_user_id = uid() OR r.email = email() OR r.id = uid())
    AND r.attivo = true
  ));

-- 8. RLS Policies per expenses
CREATE POLICY "Employees can manage own expenses"
  ON expenses
  FOR ALL
  TO authenticated
  USING (employee_id = uid())
  WITH CHECK (employee_id = uid());

CREATE POLICY "Companies can manage expenses for their events"
  ON expenses
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM crew_events ce
    JOIN regaziendasoftware r ON ce.company_id = r.id
    WHERE ce.id = expenses.event_id
    AND (r.auth_user_id = uid() OR r.email = email() OR r.id = uid())
    AND r.attivo = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM crew_events ce
    JOIN regaziendasoftware r ON ce.company_id = r.id
    WHERE ce.id = expenses.event_id
    AND (r.auth_user_id = uid() OR r.email = email() OR r.id = uid())
    AND r.attivo = true
  ));