-- Migration: 005_create_leave_requests
-- Description: Time off management
-- Run order: 5

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leave_requests_clinic_id ON leave_requests(clinic_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_staff_id ON leave_requests(staff_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(from_date, to_date);

-- Success
SELECT 'Migration 005: leave_requests created' AS status;
