-- Migration: 002_create_staff
-- Description: Employee/staff records for clinics
-- Run order: 2

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
  -- Values: none, pending, active, expired
  invite_token TEXT,
  invite_sent_at TIMESTAMPTZ,
  invite_expires_at TIMESTAMPTZ,
  invite_method TEXT,
  -- Values: email, sms
  
  -- Auth (for staff login to employee portal)
  user_id UUID REFERENCES users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(clinic_id, email)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_staff_clinic_id ON staff(clinic_id);
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);
CREATE INDEX IF NOT EXISTS idx_staff_kyc_status ON staff(kyc_status);
CREATE INDEX IF NOT EXISTS idx_staff_employment_status ON staff(employment_status);

-- Success
SELECT 'Migration 002: staff created' AS status;
