-- HURE Core Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CLINICS TABLE (Tenants)
-- ============================================
CREATE TABLE IF NOT EXISTS clinics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  town TEXT,
  country TEXT DEFAULT 'Kenya',
  contact_name TEXT,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  business_license TEXT,
  
  -- Product/Plan Info
  modules TEXT[] DEFAULT ARRAY['core'], -- ['core'], ['care'], or ['core','care']
  plan_key TEXT DEFAULT 'essential', -- essential, professional, enterprise
  plan_product TEXT DEFAULT 'core', -- core, care
  is_bundle BOOLEAN DEFAULT FALSE,
  
  -- Status & Verification
  status TEXT DEFAULT 'pending_verification', 
  -- Values: pending_verification, pending_payment, pending_activation, active, suspended, rejected
  email_verified BOOLEAN DEFAULT FALSE,
  
  -- Usage Counts (updated by employer portal)
  staff_count INT DEFAULT 0,
  location_count INT DEFAULT 1,
  admin_role_count INT DEFAULT 1,
  
  -- Care Integration
  care_provisioned BOOLEAN DEFAULT FALSE,
  care_tenant_id TEXT, -- External Care system tenant ID
  
  -- Notes
  reject_reason TEXT,
  suspend_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USERS TABLE (Auth + Profile)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  
  -- Auth
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE, -- Set after first login
  temp_password_hash TEXT,
  temp_password_expires TIMESTAMPTZ,
  password_hash TEXT, -- Permanent password
  password_set BOOLEAN DEFAULT FALSE,
  
  -- Profile
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  
  -- Role
  role TEXT DEFAULT 'owner', -- owner, admin, hr, employee
  
  -- First login token
  first_login_token TEXT,
  first_login_token_expires TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- OTP CODES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  code TEXT NOT NULL, -- 6-digit code
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  
  -- Plan Info
  plan_key TEXT NOT NULL,
  plan_product TEXT NOT NULL, -- core, care
  modules TEXT[] DEFAULT ARRAY['core'],
  is_bundle BOOLEAN DEFAULT FALSE,
  
  -- Status
  status TEXT DEFAULT 'pending', -- pending, active, paused, cancelled
  
  -- Billing
  billing_cycle TEXT DEFAULT 'monthly', -- monthly, yearly
  base_amount INT DEFAULT 0,
  discount_percent INT DEFAULT 0,
  final_amount INT DEFAULT 0,
  currency TEXT DEFAULT 'KES',
  
  -- Renewal
  auto_renew BOOLEAN DEFAULT TRUE,
  next_renewal_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  
  -- Care
  care_provisioned BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  
  -- Reference
  tx_ref TEXT UNIQUE, -- Pesapal/internal reference
  
  -- Payment Details
  modules TEXT[],
  base_amount INT DEFAULT 0,
  discount_percent INT DEFAULT 0,
  final_amount INT DEFAULT 0,
  currency TEXT DEFAULT 'KES',
  
  -- Payment Method
  method TEXT, -- mpesa, card, bank
  
  -- Status
  status TEXT DEFAULT 'pending', -- pending, success, failed
  
  -- Pesapal Data
  pesapal_order_id TEXT,
  pesapal_tracking_id TEXT,
  pesapal_data JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================
-- PROMOS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS promos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  discount_percent INT DEFAULT 0,
  expires_at TIMESTAMPTZ,
  active BOOLEAN DEFAULT TRUE,
  usage_count INT DEFAULT 0,
  max_uses INT, -- NULL = unlimited
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AUDIT LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Action Type
  type TEXT NOT NULL, -- clinic_created, clinic_activated, promo_created, etc.
  
  -- Actor (who did it)
  actor_id TEXT,
  actor_role TEXT,
  actor_name TEXT,
  
  -- Target (what was affected)
  target_entity TEXT, -- clinic, promo, subscription, etc.
  target_id UUID,
  target_name TEXT,
  
  -- Extra Data
  meta JSONB,
  reason TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- API LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS api_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  endpoint TEXT NOT NULL,
  method TEXT DEFAULT 'GET',
  status_code INT,
  note TEXT,
  request_data JSONB,
  response_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SITE CONTENT TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS site_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default site content
INSERT INTO site_content (key, value) VALUES 
  ('heroHeadline', 'From staff to patients, we''ve got you covered.'),
  ('bundleBlurb', 'Bundle Core + Care and save 20% every month.')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- CLINIC LOCATIONS TABLE (Multi-Branch Support)
-- ============================================
CREATE TABLE IF NOT EXISTS clinic_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  
  -- Location Info
  name TEXT NOT NULL,
  address TEXT,
  town TEXT,
  
  -- Contact
  phone TEXT,
  email TEXT,
  
  -- Status
  is_primary BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STAFF TABLE (Clinic Employees)
-- ============================================
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  
  -- Basic Info
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  
  -- Roles
  account_role TEXT DEFAULT 'employee', 
  -- Values: owner, admin, hr, employee
  job_role TEXT,
  -- Values: GP, Nurse, Lab Tech, Phlebotomist, Radiographer, Receptionist, etc.
  
  -- Work Status
  status TEXT DEFAULT 'off',
  -- Values: on_duty, off, available, on_leave
  employment_status TEXT DEFAULT 'inactive',
  -- Values: active, inactive, suspended, terminated
  
  -- Licensing & Credentials (Kenya-specific)
  license_type TEXT,
  -- Values: KMPDC, NCK, KMLTTB, PPB, Other
  license_number TEXT,
  license_expiry DATE,
  
  -- KYC/Verification
  kyc_status TEXT DEFAULT 'not_started',
  -- Values: not_started, pending_review, verified, rejected, expired
  kyc_verified_at TIMESTAMPTZ,
  kyc_verified_by UUID REFERENCES users(id),
  
  -- Invite/Onboarding
  invite_status TEXT DEFAULT 'none',
  -- Values: none, pending, accepted, expired
  invite_token TEXT,
  invite_sent_at TIMESTAMPTZ,
  invite_expires_at TIMESTAMPTZ,
  invite_accepted_at TIMESTAMPTZ,
  invite_method TEXT,
  -- Values: email, sms
  
  -- Auth (for staff login to employee portal)
  password_hash TEXT, -- Staff's own password (set when accepting invite)
  user_id UUID REFERENCES users(id),
  -- Links to users table when staff creates account
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(clinic_id, email)
);

-- ============================================
-- SHIFTS TABLE (Scheduling)
-- ============================================
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  
  -- Assignment
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  -- NULL = open/unassigned shift
  
  -- Schedule Details
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  
  -- Role requirement (for open shifts)
  required_role TEXT,
  -- e.g., 'Nurse', 'GP'
  
  -- Location (if clinic has multiple)
  location_id UUID REFERENCES clinic_locations(id),
  
  -- Status
  status TEXT DEFAULT 'open',
  -- Values: open, assigned, confirmed, completed, cancelled
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- ============================================
-- ATTENDANCES TABLE (Time Tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS attendances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  
  -- Time Records
  date DATE NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  
  -- Computed (or set by trigger)
  hours_worked DECIMAL(5,2),
  
  -- Location/Method
  location_id UUID REFERENCES clinic_locations(id),
  clock_in_method TEXT,
  -- Values: manual, biometric, gps, qr_code
  clock_out_method TEXT,
  
  -- Shift link (optional)
  shift_id UUID REFERENCES shifts(id),
  
  -- Status
  status TEXT DEFAULT 'present',
  -- Values: present, late, absent, half_day
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LEAVE REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  
  -- Leave Details
  leave_type TEXT NOT NULL,
  -- Values: annual, sick, maternity, paternity, unpaid, compassionate, other
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  days_count INT,
  
  -- Request Info
  reason TEXT,
  attachment_url TEXT,
  -- For medical certificates, etc.
  
  -- Approval
  status TEXT DEFAULT 'pending',
  -- Values: pending, approved, rejected, cancelled
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DOCUMENTS TABLE (Policies & Files)
-- ============================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  
  -- Document Info
  title TEXT NOT NULL,
  description TEXT,
  doc_type TEXT DEFAULT 'policy',
  -- Values: policy, handbook, form, template, other
  
  -- File
  file_url TEXT,
  file_name TEXT,
  file_size INT,
  mime_type TEXT,
  
  -- Visibility
  visibility TEXT DEFAULT 'all_staff',
  -- Values: all_staff, admins_only, specific_roles
  required_roles TEXT[],
  
  -- Acknowledgment tracking
  requires_acknowledgment BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DOCUMENT ACKNOWLEDGMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS document_acknowledgments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  
  acknowledged_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  
  UNIQUE(document_id, staff_id)
);

-- ============================================
-- ROLE PERMISSIONS TABLE (RBAC)
-- ============================================
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  
  -- Role
  role_name TEXT NOT NULL,
  -- Values: owner, admin, hr, employee
  role_description TEXT,
  
  -- Permissions (JSON object)
  permissions JSONB DEFAULT '{}'::jsonb,
  
  -- System flag (owner role is immutable)
  is_system BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(clinic_id, role_name)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Existing indexes
CREATE INDEX IF NOT EXISTS idx_clinics_status ON clinics(status);
CREATE INDEX IF NOT EXISTS idx_clinics_email ON clinics(email);
CREATE INDEX IF NOT EXISTS idx_users_clinic ON users(clinic_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_subscriptions_clinic ON subscriptions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_transactions_clinic ON transactions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_type ON audit_logs(type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_codes_email ON otp_codes(email);

-- New indexes for employer portal tables
CREATE INDEX IF NOT EXISTS idx_clinic_locations_clinic_id ON clinic_locations(clinic_id);
CREATE INDEX IF NOT EXISTS idx_staff_clinic_id ON staff(clinic_id);
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);
CREATE INDEX IF NOT EXISTS idx_staff_kyc_status ON staff(kyc_status);
CREATE INDEX IF NOT EXISTS idx_staff_employment_status ON staff(employment_status);
CREATE INDEX IF NOT EXISTS idx_shifts_clinic_id ON shifts(clinic_id);
CREATE INDEX IF NOT EXISTS idx_shifts_staff_id ON shifts(staff_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
CREATE INDEX IF NOT EXISTS idx_attendances_clinic_id ON attendances(clinic_id);
CREATE INDEX IF NOT EXISTS idx_attendances_staff_id ON attendances(staff_id);
CREATE INDEX IF NOT EXISTS idx_attendances_date ON attendances(date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_clinic_id ON leave_requests(clinic_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_staff_id ON leave_requests(staff_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_documents_clinic_id ON documents(clinic_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_clinic_id ON role_permissions(clinic_id);

-- Unique constraint for attendance (one record per staff per day)
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendances_staff_date ON attendances(staff_id, date);

-- ============================================
-- ROW LEVEL SECURITY (Optional - Enable if needed)
-- ============================================
-- ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- TRIGGER: Auto-create default roles & location for new clinics
-- ============================================
CREATE OR REPLACE FUNCTION create_default_clinic_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default primary location
  INSERT INTO clinic_locations (clinic_id, name, is_primary)
  VALUES (NEW.id, 'Main Branch', TRUE);
  
  -- Owner role (full access - immutable)
  INSERT INTO role_permissions (clinic_id, role_name, role_description, is_system, permissions)
  VALUES (NEW.id, 'owner', 'Full access to all features', TRUE, '{
    "view_staff": true,
    "create_staff": true,
    "invite_staff": true,
    "view_schedule": true,
    "create_shift": true,
    "assign_shift": true,
    "view_attendance": true,
    "export_attendance": true,
    "view_leave": true,
    "approve_leave": true,
    "view_docs": true,
    "upload_docs": true,
    "manage_billing": true,
    "manage_permissions": true,
    "view_audit": true
  }'::jsonb);
  
  -- Admin role
  INSERT INTO role_permissions (clinic_id, role_name, role_description, permissions)
  VALUES (NEW.id, 'admin', 'Manage staff and schedules', '{
    "view_staff": true,
    "create_staff": true,
    "invite_staff": true,
    "view_schedule": true,
    "create_shift": true,
    "assign_shift": true,
    "view_attendance": true,
    "export_attendance": false,
    "view_leave": false,
    "approve_leave": false,
    "view_docs": true,
    "upload_docs": false,
    "manage_billing": false,
    "manage_permissions": false,
    "view_audit": false
  }'::jsonb);
  
  -- HR role
  INSERT INTO role_permissions (clinic_id, role_name, role_description, permissions)
  VALUES (NEW.id, 'hr', 'Manage leave and documents', '{
    "view_staff": true,
    "create_staff": false,
    "invite_staff": false,
    "view_schedule": false,
    "create_shift": false,
    "assign_shift": false,
    "view_attendance": true,
    "export_attendance": true,
    "view_leave": true,
    "approve_leave": true,
    "view_docs": true,
    "upload_docs": true,
    "manage_billing": false,
    "manage_permissions": false,
    "view_audit": false
  }'::jsonb);
  
  -- Employee role
  INSERT INTO role_permissions (clinic_id, role_name, role_description, permissions)
  VALUES (NEW.id, 'employee', 'Basic staff access', '{
    "view_staff": false,
    "create_staff": false,
    "invite_staff": false,
    "view_schedule": true,
    "create_shift": false,
    "assign_shift": false,
    "view_attendance": true,
    "export_attendance": false,
    "view_leave": true,
    "approve_leave": false,
    "view_docs": true,
    "upload_docs": false,
    "manage_billing": false,
    "manage_permissions": false,
    "view_audit": false
  }'::jsonb);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_create_default_clinic_data ON clinics;

-- Create trigger
CREATE TRIGGER trigger_create_default_clinic_data
  AFTER INSERT ON clinics
  FOR EACH ROW
  EXECUTE FUNCTION create_default_clinic_data();

-- ============================================
-- UPDATE USERS TABLE (Add staff_id and account_type)
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES staff(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'owner';
-- Values: superadmin, owner, staff

CREATE INDEX IF NOT EXISTS idx_users_staff_id ON users(staff_id);
CREATE INDEX IF NOT EXISTS idx_users_account_type ON users(account_type);

-- Success message
SELECT 'HURE Core database schema created successfully!' AS message;
