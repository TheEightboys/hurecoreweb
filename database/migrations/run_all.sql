-- ============================================
-- HURE Core - Run All Migrations
-- ============================================
-- Copy and paste this entire file into Supabase SQL Editor
-- Or run individual migration files in order (001 through 009)

-- Ensure UUID extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 001: CLINIC LOCATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS clinic_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  town TEXT,
  phone TEXT,
  email TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinic_locations_clinic_id ON clinic_locations(clinic_id);

-- ============================================
-- 002: STAFF
-- ============================================
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  account_role TEXT DEFAULT 'employee',
  job_role TEXT,
  status TEXT DEFAULT 'off',
  employment_status TEXT DEFAULT 'inactive',
  license_type TEXT,
  license_number TEXT,
  license_expiry DATE,
  kyc_status TEXT DEFAULT 'not_started',
  kyc_verified_at TIMESTAMPTZ,
  kyc_verified_by UUID REFERENCES users(id),
  invite_status TEXT DEFAULT 'none',
  invite_token TEXT,
  invite_sent_at TIMESTAMPTZ,
  invite_expires_at TIMESTAMPTZ,
  invite_method TEXT,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clinic_id, email)
);

CREATE INDEX IF NOT EXISTS idx_staff_clinic_id ON staff(clinic_id);
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);
CREATE INDEX IF NOT EXISTS idx_staff_kyc_status ON staff(kyc_status);
CREATE INDEX IF NOT EXISTS idx_staff_employment_status ON staff(employment_status);

-- ============================================
-- 003: SHIFTS
-- ============================================
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  required_role TEXT,
  location_id UUID REFERENCES clinic_locations(id),
  status TEXT DEFAULT 'open',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_shifts_clinic_id ON shifts(clinic_id);
CREATE INDEX IF NOT EXISTS idx_shifts_staff_id ON shifts(staff_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);

-- ============================================
-- 004: ATTENDANCES
-- ============================================
CREATE TABLE IF NOT EXISTS attendances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  hours_worked DECIMAL(5,2),
  location_id UUID REFERENCES clinic_locations(id),
  clock_in_method TEXT,
  clock_out_method TEXT,
  shift_id UUID REFERENCES shifts(id),
  status TEXT DEFAULT 'present',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendances_clinic_id ON attendances(clinic_id);
CREATE INDEX IF NOT EXISTS idx_attendances_staff_id ON attendances(staff_id);
CREATE INDEX IF NOT EXISTS idx_attendances_date ON attendances(date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendances_staff_date ON attendances(staff_id, date);

-- ============================================
-- 005: LEAVE REQUESTS
-- ============================================
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  days_count INT,
  reason TEXT,
  attachment_url TEXT,
  status TEXT DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_clinic_id ON leave_requests(clinic_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_staff_id ON leave_requests(staff_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(from_date, to_date);

-- ============================================
-- 006: DOCUMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  doc_type TEXT DEFAULT 'policy',
  file_url TEXT,
  file_name TEXT,
  file_size INT,
  mime_type TEXT,
  visibility TEXT DEFAULT 'all_staff',
  required_roles TEXT[],
  requires_acknowledgment BOOLEAN DEFAULT FALSE,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_acknowledgments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  UNIQUE(document_id, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_documents_clinic_id ON documents(clinic_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_doc_ack_document_id ON document_acknowledgments(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_ack_staff_id ON document_acknowledgments(staff_id);

-- ============================================
-- 007: ROLE PERMISSIONS
-- ============================================
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  role_description TEXT,
  permissions JSONB DEFAULT '{}'::jsonb,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clinic_id, role_name)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_clinic_id ON role_permissions(clinic_id);

-- ============================================
-- 008: UPDATE USERS TABLE
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES staff(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'owner';

CREATE INDEX IF NOT EXISTS idx_users_staff_id ON users(staff_id);
CREATE INDEX IF NOT EXISTS idx_users_account_type ON users(account_type);

-- ============================================
-- 009: TRIGGERS
-- ============================================
DROP FUNCTION IF EXISTS create_default_clinic_data() CASCADE;

CREATE OR REPLACE FUNCTION create_default_clinic_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default primary location
  INSERT INTO clinic_locations (clinic_id, name, is_primary)
  VALUES (NEW.id, 'Main Branch', TRUE);
  
  -- Owner role (full access)
  INSERT INTO role_permissions (clinic_id, role_name, role_description, is_system, permissions)
  VALUES (NEW.id, 'owner', 'Full access to all features', TRUE, 
    '{"view_staff":true,"create_staff":true,"invite_staff":true,"view_schedule":true,"create_shift":true,"assign_shift":true,"view_attendance":true,"export_attendance":true,"view_leave":true,"approve_leave":true,"view_docs":true,"upload_docs":true,"manage_billing":true,"manage_permissions":true,"view_audit":true}'::jsonb);
  
  -- Admin role
  INSERT INTO role_permissions (clinic_id, role_name, role_description, permissions)
  VALUES (NEW.id, 'admin', 'Manage staff and schedules',
    '{"view_staff":true,"create_staff":true,"invite_staff":true,"view_schedule":true,"create_shift":true,"assign_shift":true,"view_attendance":true,"export_attendance":false,"view_leave":false,"approve_leave":false,"view_docs":true,"upload_docs":false,"manage_billing":false,"manage_permissions":false,"view_audit":false}'::jsonb);
  
  -- HR role
  INSERT INTO role_permissions (clinic_id, role_name, role_description, permissions)
  VALUES (NEW.id, 'hr', 'Manage leave and documents',
    '{"view_staff":true,"create_staff":false,"invite_staff":false,"view_schedule":false,"create_shift":false,"assign_shift":false,"view_attendance":true,"export_attendance":true,"view_leave":true,"approve_leave":true,"view_docs":true,"upload_docs":true,"manage_billing":false,"manage_permissions":false,"view_audit":false}'::jsonb);
  
  -- Employee role
  INSERT INTO role_permissions (clinic_id, role_name, role_description, permissions)
  VALUES (NEW.id, 'employee', 'Basic staff access',
    '{"view_staff":false,"create_staff":false,"invite_staff":false,"view_schedule":true,"create_shift":false,"assign_shift":false,"view_attendance":true,"export_attendance":false,"view_leave":true,"approve_leave":false,"view_docs":true,"upload_docs":false,"manage_billing":false,"manage_permissions":false,"view_audit":false}'::jsonb);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_default_clinic_data ON clinics;

CREATE TRIGGER trigger_create_default_clinic_data
  AFTER INSERT ON clinics
  FOR EACH ROW
  EXECUTE FUNCTION create_default_clinic_data();

-- ============================================
-- DONE!
-- ============================================
SELECT 'All migrations completed successfully!' AS status;
