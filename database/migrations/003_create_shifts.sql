-- Migration: 003_create_shifts
-- Description: Work scheduling for staff
-- Run order: 3

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shifts_clinic_id ON shifts(clinic_id);
CREATE INDEX IF NOT EXISTS idx_shifts_staff_id ON shifts(staff_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);

-- Success
SELECT 'Migration 003: shifts created' AS status;
