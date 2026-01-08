/*
  # Tabelle per Gestione Turni Magazzino

  1. New Tables
    - `warehouse_shifts` - Turni programmati per i magazzini
    - `warehouse_shift_assignments` - Assegnazioni dipendenti ai turni
    - `warehouse_shift_templates` - Template per turni ricorrenti

  2. Security
    - Enable RLS on all tables
    - Add policies for companies to manage their warehouse shifts
    - Add policies for employees to view their assigned shifts

  3. Features
    - Support for recurring shifts
    - Role-based assignments (worker, supervisor, driver)
    - Check-in/check-out tracking
    - Integration with existing warehouses table
*/

-- Tabella per i turni magazzino
CREATE TABLE IF NOT EXISTS warehouse_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES regaziendasoftware(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  shift_name text NOT NULL,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  shift_type text NOT NULL CHECK (shift_type IN ('morning', 'afternoon', 'night', 'full_day')),
  required_crew integer NOT NULL DEFAULT 1,
  notes text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'in_progress', 'completed')),
  is_recurring boolean DEFAULT false,
  recurring_days text[], -- ['monday', 'tuesday', etc.]
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabella per le assegnazioni dipendenti ai turni
CREATE TABLE IF NOT EXISTS warehouse_shift_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES warehouse_shifts(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES registration_requests(id) ON DELETE CASCADE,
  employee_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('worker', 'supervisor', 'driver')),
  hourly_rate numeric(10,2),
  check_in_time time,
  check_out_time time,
  break_minutes integer DEFAULT 0,
  total_hours numeric(5,2),
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'checked_in', 'checked_out', 'absent', 'completed')),
  notes text,
  gps_location jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(shift_id, employee_id)
);

-- Tabella per i template di turni ricorrenti
CREATE TABLE IF NOT EXISTS warehouse_shift_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES regaziendasoftware(id) ON DELETE CASCADE,
  template_name text NOT NULL,
  shift_type text NOT NULL CHECK (shift_type IN ('morning', 'afternoon', 'night', 'full_day')),
  start_time time NOT NULL,
  end_time time NOT NULL,
  required_crew integer NOT NULL DEFAULT 1,
  default_warehouse_id uuid REFERENCES warehouses(id),
  recurring_days text[],
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Indici per performance
CREATE INDEX idx_warehouse_shifts_company ON warehouse_shifts(company_id);
CREATE INDEX idx_warehouse_shifts_warehouse ON warehouse_shifts(warehouse_id);
CREATE INDEX idx_warehouse_shifts_date ON warehouse_shifts(date);
CREATE INDEX idx_warehouse_shifts_status ON warehouse_shifts(status);

CREATE INDEX idx_warehouse_shift_assignments_shift ON warehouse_shift_assignments(shift_id);
CREATE INDEX idx_warehouse_shift_assignments_employee ON warehouse_shift_assignments(employee_id);
CREATE INDEX idx_warehouse_shift_assignments_status ON warehouse_shift_assignments(status);

CREATE INDEX idx_warehouse_shift_templates_company ON warehouse_shift_templates(company_id);

-- Enable RLS
ALTER TABLE warehouse_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_shift_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_shift_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies per warehouse_shifts
CREATE POLICY "Companies can manage their warehouse shifts"
  ON warehouse_shifts
  FOR ALL
  TO authenticated
  USING (company_id = auth.uid())
  WITH CHECK (company_id = auth.uid());

CREATE POLICY "Public can read warehouse shifts"
  ON warehouse_shifts
  FOR SELECT
  TO public
  USING (true);

-- RLS Policies per warehouse_shift_assignments
CREATE POLICY "Companies can manage their shift assignments"
  ON warehouse_shift_assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM warehouse_shifts 
      WHERE warehouse_shifts.id = warehouse_shift_assignments.shift_id 
      AND warehouse_shifts.company_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM warehouse_shifts 
      WHERE warehouse_shifts.id = warehouse_shift_assignments.shift_id 
      AND warehouse_shifts.company_id = auth.uid()
    )
  );

CREATE POLICY "Employees can read their shift assignments"
  ON warehouse_shift_assignments
  FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

CREATE POLICY "Public can read shift assignments"
  ON warehouse_shift_assignments
  FOR SELECT
  TO public
  USING (true);

-- RLS Policies per warehouse_shift_templates
CREATE POLICY "Companies can manage their shift templates"
  ON warehouse_shift_templates
  FOR ALL
  TO authenticated
  USING (company_id = auth.uid())
  WITH CHECK (company_id = auth.uid());

CREATE POLICY "Public can read shift templates"
  ON warehouse_shift_templates
  FOR SELECT
  TO public
  USING (true);

-- Funzione per aggiornare timestamp
CREATE OR REPLACE FUNCTION update_warehouse_shifts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger per aggiornare timestamp
CREATE TRIGGER update_warehouse_shifts_timestamp
  BEFORE UPDATE ON warehouse_shifts
  FOR EACH ROW
  EXECUTE FUNCTION update_warehouse_shifts_updated_at();

CREATE TRIGGER update_warehouse_shift_assignments_timestamp
  BEFORE UPDATE ON warehouse_shift_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_warehouse_shifts_updated_at();