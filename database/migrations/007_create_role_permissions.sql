-- Migration: 007_create_role_permissions
-- Description: RBAC permission matrix per clinic
-- Run order: 7

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_role_permissions_clinic_id ON role_permissions(clinic_id);

-- Success
SELECT 'Migration 007: role_permissions created' AS status;
