-- Migration: 009_create_triggers
-- Description: Auto-create default roles & location for new clinics
-- Run order: 9

-- Drop existing function if exists
DROP FUNCTION IF EXISTS create_default_clinic_data() CASCADE;

-- Create function
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

-- Success
SELECT 'Migration 009: triggers created' AS status;
