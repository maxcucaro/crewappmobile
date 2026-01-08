/*
  # Schema iniziale CrewManager

  1. New Tables
    - `users`: Tabella base per tutti gli utenti
    - `companies`: Dettagli delle aziende
    - `crew_members`: Dettagli dei membri crew
    - `events`: Eventi creati dalle aziende
    - `event_crew_assignments`: Assegnazioni crew agli eventi
    - `rate_negotiations`: Negoziazioni tariffe tra aziende e crew
    - `rate_proposals`: Proposte di tariffa nelle negoziazioni
    - `timesheet_entries`: Registrazioni ore lavorate
    - `expenses`: Note spese inviate dai crew
    - `documents`: Documenti caricati (buste paga, contratti, ecc.)
    - `overtime_requests`: Richieste di straordinari
    - `warehouse_checkins`: Check-in magazzino tramite QR code
    - `training_courses`: Corsi di formazione
    - `training_enrollments`: Iscrizioni ai corsi di formazione
    - `privacy_settings`: Impostazioni privacy per i crew
    - `notifications`: Notifiche di sistema

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table (Base table for all users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'company', 'crew')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_approved BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ
);

-- Companies Table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  vat_number TEXT UNIQUE,
  address TEXT,
  phone TEXT,
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website TEXT,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'basic', 'premium', 'enterprise')),
  subscription_expires_at TIMESTAMPTZ,
  logo_url TEXT
);

-- Crew Members Table
CREATE TABLE IF NOT EXISTS crew_members (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  profile_type TEXT NOT NULL CHECK (profile_type IN ('freelance', 'employee')),
  company_id UUID REFERENCES companies(id) NULL,
  skills TEXT[] DEFAULT '{}',
  experience INTEGER DEFAULT 0,
  hourly_rate DECIMAL(10, 2),
  daily_rate DECIMAL(10, 2),
  bio TEXT,
  enpals_active BOOLEAN DEFAULT false,
  enpals_expiry_date DATE,
  enpals_document_number TEXT,
  availability JSONB DEFAULT '{"monday": true, "tuesday": true, "wednesday": true, "thursday": true, "friday": true, "saturday": false, "sunday": false}'::jsonb,
  rating DECIMAL(3, 2),
  rating_count INTEGER DEFAULT 0
);

-- Events Table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('warehouse', 'event', 'event_travel')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  location TEXT,
  required_crew INTEGER DEFAULT 1,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Event Crew Assignments
CREATE TABLE IF NOT EXISTS event_crew_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  crew_id UUID NOT NULL REFERENCES crew_members(id) ON DELETE CASCADE,
  rate_negotiation_id UUID,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'confirmed_by_crew')),
  company_retention_percentage DECIMAL(5, 2) DEFAULT 0,
  final_hourly_rate DECIMAL(10, 2),
  final_daily_rate DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, crew_id)
);

-- Rate Negotiations
CREATE TABLE IF NOT EXISTS rate_negotiations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  crew_id UUID NOT NULL REFERENCES crew_members(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'company_proposed' CHECK (status IN ('company_proposed', 'crew_counter', 'accepted', 'rejected')),
  final_hourly_rate DECIMAL(10, 2),
  final_daily_rate DECIMAL(10, 2),
  final_retention_percentage DECIMAL(5, 2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, crew_id)
);

-- Rate Proposals
CREATE TABLE IF NOT EXISTS rate_proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  negotiation_id UUID NOT NULL REFERENCES rate_negotiations(id) ON DELETE CASCADE,
  proposed_by TEXT NOT NULL CHECK (proposed_by IN ('company', 'crew')),
  hourly_rate DECIMAL(10, 2),
  daily_rate DECIMAL(10, 2),
  retention_percentage DECIMAL(5, 2) NOT NULL,
  message TEXT,
  proposed_at TIMESTAMPTZ DEFAULT now()
);

-- Timesheet Entries
CREATE TABLE IF NOT EXISTS timesheet_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crew_id UUID NOT NULL REFERENCES crew_members(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  break_time INTEGER DEFAULT 0, -- in minutes
  total_hours DECIMAL(5, 2),
  total_days DECIMAL(3, 1),
  tracking_type TEXT NOT NULL CHECK (tracking_type IN ('hours', 'days')),
  hourly_rate DECIMAL(10, 2),
  daily_rate DECIMAL(10, 2),
  retention_percentage DECIMAL(5, 2) NOT NULL,
  gross_amount DECIMAL(10, 2) NOT NULL,
  net_amount DECIMAL(10, 2) NOT NULL,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid_by_company', 'received_by_crew', 'confirmed')),
  notes TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  gps_location JSONB,
  company_meal BOOLEAN DEFAULT false,
  meal_voucher BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crew_id UUID NOT NULL REFERENCES crew_members(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('food', 'accommodation', 'transport', 'materials', 'communication', 'other')),
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT NOT NULL,
  receipt_url TEXT,
  expense_date DATE NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  location TEXT,
  is_within_time_limit BOOLEAN DEFAULT true,
  is_within_budget_limit BOOLEAN DEFAULT true
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('payslip', 'contract', 'amendment', 'certificate', 'policy', 'other')),
  description TEXT,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  uploaded_for UUID NOT NULL REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  is_read BOOLEAN DEFAULT false,
  is_important BOOLEAN DEFAULT false,
  expiry_date DATE,
  related_period TEXT,
  contract_type TEXT CHECK (contract_type IN ('permanent', 'temporary', 'freelance')),
  contract_start_date DATE,
  contract_end_date DATE,
  notes TEXT
);

-- Overtime Requests
CREATE TABLE IF NOT EXISTS overtime_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crew_id UUID NOT NULL REFERENCES crew_members(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES events(id),
  event_id UUID REFERENCES events(id),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  hours DECIMAL(4, 2) NOT NULL,
  base_rate DECIMAL(10, 2) NOT NULL,
  overtime_rate DECIMAL(10, 2) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes TEXT,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'confirmed')),
  CHECK (warehouse_id IS NOT NULL OR event_id IS NOT NULL)
);

-- Warehouse Check-ins
CREATE TABLE IF NOT EXISTS warehouse_checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  crew_id UUID NOT NULL REFERENCES crew_members(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in_time TIME NOT NULL,
  check_out_time TIME,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'pending')),
  location JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Training Courses
CREATE TABLE IF NOT EXISTS training_courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location TEXT NOT NULL,
  instructor TEXT,
  is_mandatory BOOLEAN DEFAULT false,
  category TEXT NOT NULL CHECK (category IN ('safety', 'technical', 'soft_skills', 'certification', 'other')),
  materials TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Training Enrollments
CREATE TABLE IF NOT EXISTS training_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  training_id UUID NOT NULL REFERENCES training_courses(id) ON DELETE CASCADE,
  crew_id UUID NOT NULL REFERENCES crew_members(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'invited' CHECK (status IN ('invited', 'registered', 'confirmed', 'attended', 'no_show', 'cancelled')),
  certificate_issued BOOLEAN DEFAULT false,
  certificate_url TEXT,
  invited_at TIMESTAMPTZ DEFAULT now(),
  registered_at TIMESTAMPTZ,
  UNIQUE(training_id, crew_id)
);

-- Privacy Settings
CREATE TABLE IF NOT EXISTS privacy_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crew_id UUID NOT NULL REFERENCES crew_members(id) ON DELETE CASCADE,
  is_public_profile BOOLEAN DEFAULT true,
  hidden_from_companies UUID[] DEFAULT '{}',
  hidden_fields JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Calendar Syncs
CREATE TABLE IF NOT EXISTS calendar_syncs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_type TEXT NOT NULL CHECK (user_type IN ('company', 'crew')),
  busy_dates JSONB DEFAULT '[]'::jsonb,
  shared_with UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('enpals_expiry', 'rate_negotiation', 'payment_update', 'event_assignment', 'document_upload', 'expense_status', 'overtime_status', 'training_invitation')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Expense Limits
CREATE TABLE IF NOT EXISTS expense_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('food', 'accommodation', 'transport', 'materials', 'communication', 'other')),
  daily_limit DECIMAL(10, 2) NOT NULL,
  event_limit DECIMAL(10, 2) NOT NULL,
  requires_approval BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, category)
);

-- Overtime Settings
CREATE TABLE IF NOT EXISTS overtime_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT true,
  requires_pre_approval BOOLEAN DEFAULT true,
  hourly_multiplier DECIMAL(3, 2) DEFAULT 1.3,
  hourly_amount DECIMAL(10, 2) DEFAULT 30,
  use_multiplier BOOLEAN DEFAULT true,
  daily_multiplier DECIMAL(3, 2) DEFAULT 1.2,
  daily_amount DECIMAL(10, 2) DEFAULT 240,
  use_daily_multiplier BOOLEAN DEFAULT true,
  max_hours_per_day INTEGER DEFAULT 4,
  max_hours_per_week INTEGER DEFAULT 12,
  notify_manager_on_request BOOLEAN DEFAULT true,
  notify_crew_on_approval BOOLEAN DEFAULT true,
  notify_crew_on_rejection BOOLEAN DEFAULT true,
  enable_auto_approval BOOLEAN DEFAULT false,
  max_auto_approval_hours INTEGER DEFAULT 2,
  trusted_crew_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Warehouses
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  description TEXT,
  qr_code_value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Custom Holidays
CREATE TABLE IF NOT EXISTS custom_holidays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, date)
);

-- Document Templates
CREATE TABLE IF NOT EXISTS document_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('payslip', 'contract', 'amendment', 'certificate', 'policy', 'other')),
  description TEXT,
  is_recurring BOOLEAN DEFAULT false,
  recurring_period TEXT CHECK (recurring_period IN ('monthly', 'yearly')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_crew_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_negotiations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE privacy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_syncs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies
-- Users can read their own data
CREATE POLICY "Users can read own data" ON users
  FOR SELECT
  USING (auth.uid() = id);

-- Companies can read their own data
CREATE POLICY "Companies can read own data" ON companies
  FOR SELECT
  USING (auth.uid() = id);

-- Companies can read crew members that are their employees or visible freelancers
CREATE POLICY "Companies can read visible crew members" ON crew_members
  FOR SELECT
  USING (
    auth.uid() = company_id OR
    (
      profile_type = 'freelance' AND
      id NOT IN (
        SELECT crew_id FROM privacy_settings
        WHERE is_public_profile = false OR
        auth.uid() = ANY(hidden_from_companies)
      )
    )
  );

-- Crew members can read their own data
CREATE POLICY "Crew members can read own data" ON crew_members
  FOR SELECT
  USING (auth.uid() = id);

-- Companies can read their own events
CREATE POLICY "Companies can read own events" ON events
  FOR SELECT
  USING (auth.uid() = company_id);

-- Crew members can read events they're assigned to
CREATE POLICY "Crew members can read assigned events" ON events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM event_crew_assignments
      WHERE event_id = events.id AND crew_id = auth.uid()
    )
  );

-- Companies can read their own event crew assignments
CREATE POLICY "Companies can read own event crew assignments" ON event_crew_assignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_crew_assignments.event_id AND events.company_id = auth.uid()
    )
  );

-- Crew members can read their own event assignments
CREATE POLICY "Crew members can read own event assignments" ON event_crew_assignments
  FOR SELECT
  USING (crew_id = auth.uid());

-- Companies can read rate negotiations for their events
CREATE POLICY "Companies can read own rate negotiations" ON rate_negotiations
  FOR SELECT
  USING (company_id = auth.uid());

-- Crew members can read their own rate negotiations
CREATE POLICY "Crew members can read own rate negotiations" ON rate_negotiations
  FOR SELECT
  USING (crew_id = auth.uid());

-- Companies can read rate proposals for their negotiations
CREATE POLICY "Companies can read own rate proposals" ON rate_proposals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rate_negotiations
      WHERE rate_negotiations.id = rate_proposals.negotiation_id AND rate_negotiations.company_id = auth.uid()
    )
  );

-- Crew members can read rate proposals for their negotiations
CREATE POLICY "Crew members can read own rate proposals" ON rate_proposals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rate_negotiations
      WHERE rate_negotiations.id = rate_proposals.negotiation_id AND rate_negotiations.crew_id = auth.uid()
    )
  );

-- Companies can read timesheet entries for their events
CREATE POLICY "Companies can read timesheet entries for their events" ON timesheet_entries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = timesheet_entries.event_id AND events.company_id = auth.uid()
    )
  );

-- Crew members can read their own timesheet entries
CREATE POLICY "Crew members can read own timesheet entries" ON timesheet_entries
  FOR SELECT
  USING (crew_id = auth.uid());

-- Companies can read expenses for their events
CREATE POLICY "Companies can read expenses for their events" ON expenses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = expenses.event_id AND events.company_id = auth.uid()
    )
  );

-- Crew members can read their own expenses
CREATE POLICY "Crew members can read own expenses" ON expenses
  FOR SELECT
  USING (crew_id = auth.uid());

-- Users can read documents uploaded for them
CREATE POLICY "Users can read documents uploaded for them" ON documents
  FOR SELECT
  USING (uploaded_for = auth.uid() OR uploaded_by = auth.uid());

-- Companies can read overtime requests for their events
CREATE POLICY "Companies can read overtime requests for their events" ON overtime_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE (events.id = overtime_requests.event_id OR events.id = overtime_requests.warehouse_id) AND events.company_id = auth.uid()
    )
  );

-- Crew members can read their own overtime requests
CREATE POLICY "Crew members can read own overtime requests" ON overtime_requests
  FOR SELECT
  USING (crew_id = auth.uid());

-- Companies can read warehouse checkins for their warehouses
CREATE POLICY "Companies can read warehouse checkins for their warehouses" ON warehouse_checkins
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = warehouse_checkins.warehouse_id AND events.company_id = auth.uid()
    )
  );

-- Crew members can read their own warehouse checkins
CREATE POLICY "Crew members can read own warehouse checkins" ON warehouse_checkins
  FOR SELECT
  USING (crew_id = auth.uid());

-- Companies can read training courses they created
CREATE POLICY "Companies can read own training courses" ON training_courses
  FOR SELECT
  USING (company_id = auth.uid());

-- Crew members can read training courses they're enrolled in
CREATE POLICY "Crew members can read enrolled training courses" ON training_courses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM training_enrollments
      WHERE training_enrollments.training_id = training_courses.id AND training_enrollments.crew_id = auth.uid()
    )
  );

-- Companies can read training enrollments for their courses
CREATE POLICY "Companies can read training enrollments for their courses" ON training_enrollments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM training_courses
      WHERE training_courses.id = training_enrollments.training_id AND training_courses.company_id = auth.uid()
    )
  );

-- Crew members can read their own training enrollments
CREATE POLICY "Crew members can read own training enrollments" ON training_enrollments
  FOR SELECT
  USING (crew_id = auth.uid());

-- Crew members can read their own privacy settings
CREATE POLICY "Crew members can read own privacy settings" ON privacy_settings
  FOR SELECT
  USING (crew_id = auth.uid());

-- Users can read their own calendar syncs
CREATE POLICY "Users can read own calendar syncs" ON calendar_syncs
  FOR SELECT
  USING (user_id = auth.uid());

-- Companies can read calendar syncs shared with them
CREATE POLICY "Companies can read shared calendar syncs" ON calendar_syncs
  FOR SELECT
  USING (auth.uid() = ANY(shared_with));

-- Users can read their own notifications
CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT
  USING (user_id = auth.uid());

-- Companies can read their own expense limits
CREATE POLICY "Companies can read own expense limits" ON expense_limits
  FOR SELECT
  USING (company_id = auth.uid());

-- Companies can read their own overtime settings
CREATE POLICY "Companies can read own overtime settings" ON overtime_settings
  FOR SELECT
  USING (company_id = auth.uid());

-- Companies can read their own warehouses
CREATE POLICY "Companies can read own warehouses" ON warehouses
  FOR SELECT
  USING (company_id = auth.uid());

-- Companies can read their own custom holidays
CREATE POLICY "Companies can read own custom holidays" ON custom_holidays
  FOR SELECT
  USING (company_id = auth.uid());

-- Companies can read their own document templates
CREATE POLICY "Companies can read own document templates" ON document_templates
  FOR SELECT
  USING (company_id = auth.uid());

-- Admin can read all data
CREATE POLICY "Admin can read all data" ON users FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Admin can read all data" ON companies FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Admin can read all data" ON crew_members FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Admin can read all data" ON events FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Admin can read all data" ON event_crew_assignments FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Admin can read all data" ON rate_negotiations FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Admin can read all data" ON rate_proposals FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Admin can read all data" ON timesheet_entries FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Admin can read all data" ON expenses FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Admin can read all data" ON documents FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Admin can read all data" ON overtime_requests FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Admin can read all data" ON warehouse_checkins FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Admin can read all data" ON training_courses FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Admin can read all data" ON training_enrollments FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Admin can read all data" ON privacy_settings FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Admin can read all data" ON calendar_syncs FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Admin can read all data" ON notifications FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Admin can read all data" ON expense_limits FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Admin can read all data" ON overtime_settings FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Admin can read all data" ON warehouses FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Admin can read all data" ON custom_holidays FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Admin can read all data" ON document_templates FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');