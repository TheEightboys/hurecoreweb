-- Migration: 008_update_users_table
-- Description: Add staff_id and account_type to users
-- Run order: 8

-- Add staff_id to link users to staff records
ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES staff(id);

-- Add account type to distinguish owner vs staff
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'owner';
-- Values: superadmin, owner, staff

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_staff_id ON users(staff_id);
CREATE INDEX IF NOT EXISTS idx_users_account_type ON users(account_type);

-- Success
SELECT 'Migration 008: users table updated' AS status;
