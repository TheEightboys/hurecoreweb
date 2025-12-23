-- Migration: 001_create_clinic_locations
-- Description: Multi-branch support for clinics
-- Run order: 1

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_clinic_locations_clinic_id ON clinic_locations(clinic_id);

-- Success
SELECT 'Migration 001: clinic_locations created' AS status;
