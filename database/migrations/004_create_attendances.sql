-- Migration: 004_create_attendances
-- Description: Clock in/out time tracking
-- Run order: 4

CREATE TABLE IF NOT EXISTS attendances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  
  -- Time Records
  date DATE NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  
  -- Computed hours
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_attendances_clinic_id ON attendances(clinic_id);
CREATE INDEX IF NOT EXISTS idx_attendances_staff_id ON attendances(staff_id);
CREATE INDEX IF NOT EXISTS idx_attendances_date ON attendances(date);

-- Unique constraint: one attendance record per staff per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendances_staff_date ON attendances(staff_id, date);

-- Success
SELECT 'Migration 004: attendances created' AS status;
