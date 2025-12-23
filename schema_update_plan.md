# HURE Core - Schema Update Plan for Multi-Tenant Employer Portal

## Overview

This document outlines the database schema updates needed to transform the standalone Employer Portal into a fully integrated multi-tenant SaaS application.

**Tenant Model:** Each `clinic` is a tenant. All employee/staff data is scoped by `clinic_id`.

---

## Current Schema (Already Exists)

| Table | Purpose |
|-------|---------|
| `clinics` | Tenant/organization records |
| `users` | Auth users (owners only currently) |
| `subscriptions` | Billing plans |
| `transactions` | Payment records |
| `otp_codes` | Email verification |
| `audit_logs` | Activity tracking |
| `site_content` | CMS content |

---

## New Tables Required

### 1. `staff` - Employee/Staff Records

This replaces the `defaultStaff` mock data. Each staff member belongs to a clinic (multi-tenant).

```sql
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
  -- Values: none, pending, active, expired
  invite_token TEXT,
  invite_sent_at TIMESTAMPTZ,
  invite_expires_at TIMESTAMPTZ,
  invite_method TEXT,
  -- Values: email, sms
  
  -- Auth (for staff login to employee portal)
  user_id UUID REFERENCES users(id),
  -- Links to users table when staff creates account
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(clinic_id, email)
);

-- Indexes for multi-tenant queries
CREATE INDEX idx_staff_clinic_id ON staff(clinic_id);
CREATE INDEX idx_staff_email ON staff(email);
CREATE INDEX idx_staff_kyc_status ON staff(kyc_status);
CREATE INDEX idx_staff_employment_status ON staff(employment_status);
```

---

### 2. `shifts` - Work Schedule

```sql
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

-- Indexes
CREATE INDEX idx_shifts_clinic_id ON shifts(clinic_id);
CREATE INDEX idx_shifts_staff_id ON shifts(staff_id);
CREATE INDEX idx_shifts_date ON shifts(date);
CREATE INDEX idx_shifts_status ON shifts(status);
```

---

### 3. `attendances` - Clock In/Out Records

```sql
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

-- Indexes
CREATE INDEX idx_attendances_clinic_id ON attendances(clinic_id);
CREATE INDEX idx_attendances_staff_id ON attendances(staff_id);
CREATE INDEX idx_attendances_date ON attendances(date);

-- Unique constraint: one attendance record per staff per day
CREATE UNIQUE INDEX idx_attendances_staff_date ON attendances(staff_id, date);
```

---

### 4. `leave_requests` - Time Off Management

```sql
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

-- Indexes
CREATE INDEX idx_leave_requests_clinic_id ON leave_requests(clinic_id);
CREATE INDEX idx_leave_requests_staff_id ON leave_requests(staff_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_leave_requests_dates ON leave_requests(from_date, to_date);
```

---

### 5. `clinic_locations` - Multi-Location Support

```sql
-- ============================================
-- CLINIC LOCATIONS TABLE
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

-- Indexes
CREATE INDEX idx_clinic_locations_clinic_id ON clinic_locations(clinic_id);
```

---

### 6. `documents` - Policies & HR Documents

```sql
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

-- Indexes
CREATE INDEX idx_documents_clinic_id ON documents(clinic_id);
CREATE INDEX idx_documents_type ON documents(doc_type);
```

---

### 7. `document_acknowledgments` - Track Staff Document Reads

```sql
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

-- Indexes
CREATE INDEX idx_doc_ack_document_id ON document_acknowledgments(document_id);
CREATE INDEX idx_doc_ack_staff_id ON document_acknowledgments(staff_id);
```

---

### 8. `role_permissions` - RBAC Permission Matrix

```sql
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
  
  -- Permissions (JSON object or individual columns)
  permissions JSONB DEFAULT '{}'::jsonb,
  /*
    Example permissions object:
    {
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
    }
  */
  
  -- System flag (owner role is immutable)
  is_system BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(clinic_id, role_name)
);

-- Indexes
CREATE INDEX idx_role_permissions_clinic_id ON role_permissions(clinic_id);
```

---

## Update Existing Tables

### Update `users` Table

Add support for staff members to have user accounts:

```sql
-- Add staff_id to link users to staff records
ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES staff(id);

-- Add account type to distinguish owner vs staff
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'owner';
-- Values: superadmin, owner, staff

-- Index
CREATE INDEX IF NOT EXISTS idx_users_staff_id ON users(staff_id);
CREATE INDEX IF NOT EXISTS idx_users_account_type ON users(account_type);
```

### Update `audit_logs` Table (if not already comprehensive)

```sql
-- Ensure audit_logs supports staff actions
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES staff(id);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
```

---

## Default Data Seed

### Insert Default Role Permissions (Per Clinic)

When a clinic is created, insert default role permissions:

```sql
-- Function to create default permissions for a new clinic
CREATE OR REPLACE FUNCTION create_default_role_permissions()
RETURNS TRIGGER AS $$
BEGIN
  -- Owner (full access)
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
  
  -- Admin
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
  
  -- HR
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
  
  -- Employee
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
  
  -- Create default location
  INSERT INTO clinic_locations (clinic_id, name, is_primary)
  VALUES (NEW.id, 'Main Branch', TRUE);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create defaults when clinic is created
DROP TRIGGER IF EXISTS trigger_create_default_permissions ON clinics;
CREATE TRIGGER trigger_create_default_permissions
  AFTER INSERT ON clinics
  FOR EACH ROW
  EXECUTE FUNCTION create_default_role_permissions();
```

---

## API Endpoints Roadmap

| Feature | Method | Endpoint | Description |
|---------|--------|----------|-------------|
| **Staff** | | | |
| List staff | GET | `/api/clinics/:clinicId/staff` | Get all staff (paginated) |
| Get staff | GET | `/api/clinics/:clinicId/staff/:staffId` | Get single staff |
| Create staff | POST | `/api/clinics/:clinicId/staff` | Add new staff |
| Update staff | PATCH | `/api/clinics/:clinicId/staff/:staffId` | Update details |
| Delete staff | DELETE | `/api/clinics/:clinicId/staff/:staffId` | Soft delete |
| Send invite | POST | `/api/clinics/:clinicId/staff/:staffId/invite` | Send onboarding invite |
| Update KYC | PATCH | `/api/clinics/:clinicId/staff/:staffId/kyc` | Update KYC status |
| **Shifts** | | | |
| List shifts | GET | `/api/clinics/:clinicId/shifts` | Get schedule |
| Create shift | POST | `/api/clinics/:clinicId/shifts` | Create shift |
| Update shift | PATCH | `/api/clinics/:clinicId/shifts/:shiftId` | Edit shift |
| Assign shift | PATCH | `/api/clinics/:clinicId/shifts/:shiftId/assign` | Assign to staff |
| **Attendance** | | | |
| List attendance | GET | `/api/clinics/:clinicId/attendance` | Get records |
| Clock in | POST | `/api/clinics/:clinicId/attendance/clock-in` | Staff clock in |
| Clock out | POST | `/api/clinics/:clinicId/attendance/clock-out` | Staff clock out |
| Export payroll | GET | `/api/clinics/:clinicId/attendance/export` | CSV export |
| **Leave** | | | |
| List requests | GET | `/api/clinics/:clinicId/leave` | Get leave requests |
| Create request | POST | `/api/clinics/:clinicId/leave` | Submit leave |
| Approve/Reject | PATCH | `/api/clinics/:clinicId/leave/:leaveId` | Review leave |
| **Locations** | | | |
| List locations | GET | `/api/clinics/:clinicId/locations` | Get locations |
| Create location | POST | `/api/clinics/:clinicId/locations` | Add location |
| **Documents** | | | |
| List docs | GET | `/api/clinics/:clinicId/documents` | Get documents |
| Upload doc | POST | `/api/clinics/:clinicId/documents` | Upload file |
| Acknowledge | POST | `/api/clinics/:clinicId/documents/:docId/ack` | Staff acknowledges |
| **Permissions** | | | |
| Get roles | GET | `/api/clinics/:clinicId/roles` | Get role permissions |
| Update role | PATCH | `/api/clinics/:clinicId/roles/:roleName` | Update permissions |

---

## Multi-Tenant Security Checklist

### Row Level Security (RLS) Policies

```sql
-- Enable RLS on all tenant tables
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_acknowledgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Example RLS policy for staff table
-- (Assumes JWT contains clinic_id claim)
CREATE POLICY staff_tenant_isolation ON staff
  FOR ALL
  USING (clinic_id = current_setting('app.current_clinic_id')::uuid);

-- For service role (backend), bypass RLS
-- This is handled by using supabaseAdmin with service_role key
```

---

## Migration Order

Run these in sequence:

1. `001_create_clinic_locations.sql`
2. `002_create_staff.sql`
3. `003_create_shifts.sql`
4. `004_create_attendances.sql`
5. `005_create_leave_requests.sql`
6. `006_create_documents.sql`
7. `007_create_document_acknowledgments.sql`
8. `008_create_role_permissions.sql`
9. `009_update_users_table.sql`
10. `010_update_audit_logs.sql`
11. `011_create_triggers.sql`

---

## Next Steps After Schema

1. **Create API Routes** - Build `/routes/staff.js`, `/routes/shifts.js`, etc.
2. **Migrate Frontend** - Convert `hure_core_EmployerOwner_dashboard_portal.html` to React components
3. **Implement Auth Middleware** - Verify JWT and extract `clinic_id` for all requests
4. **Add Staff Invite Flow** - Email/SMS invites for staff to create accounts
5. **Employee Portal** - Separate view for staff (clock in/out, view schedule, request leave)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           HURE CORE SAAS                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │  SuperAdmin │    │   Employer  │    │  Employee   │                 │
│  │  Dashboard  │    │   Portal    │    │   Portal    │                 │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                 │
│         │                  │                  │                         │
│         └──────────────────┼──────────────────┘                         │
│                            │                                            │
│                    ┌───────▼───────┐                                    │
│                    │   API Layer   │                                    │
│                    │  (Express.js) │                                    │
│                    └───────┬───────┘                                    │
│                            │                                            │
│         ┌──────────────────┼──────────────────┐                         │
│         │                  │                  │                         │
│  ┌──────▼──────┐   ┌───────▼──────┐   ┌──────▼──────┐                  │
│  │   Clinics   │   │    Staff     │   │  Schedule   │                  │
│  │   (Tenant)  │   │  Management  │   │  & Attend.  │                  │
│  └─────────────┘   └──────────────┘   └─────────────┘                  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     Supabase (PostgreSQL)                        │   │
│  │  ┌─────────┐ ┌───────┐ ┌────────┐ ┌───────────┐ ┌─────────────┐ │   │
│  │  │ clinics │ │ staff │ │ shifts │ │attendances│ │leave_requests│ │   │
│  │  └─────────┘ └───────┘ └────────┘ └───────────┘ └─────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

| New Table | Records Per Clinic | Purpose |
|-----------|-------------------|---------|
| `staff` | 1-100+ | Employee records |
| `shifts` | 10-500+/month | Work schedules |
| `attendances` | 10-500+/month | Clock in/out |
| `leave_requests` | 1-50/month | Time off |
| `clinic_locations` | 1-10 | Branches |
| `documents` | 5-50 | Policies/forms |
| `document_acknowledgments` | staff × docs | Tracking |
| `role_permissions` | 4 (fixed roles) | RBAC |

This schema supports a full multi-tenant HR/workforce management system scoped by `clinic_id`.
