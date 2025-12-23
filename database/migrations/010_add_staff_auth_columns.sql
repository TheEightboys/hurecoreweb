-- Migration: 010_add_staff_auth_columns
-- Description: Add password_hash and invite_accepted_at columns to staff table for employee portal authentication
-- Run order: 10

-- Add password_hash column for staff authentication
ALTER TABLE staff ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Add invite_accepted_at column to track when invite was accepted
ALTER TABLE staff ADD COLUMN IF NOT EXISTS invite_accepted_at TIMESTAMPTZ;

-- Success
SELECT 'Migration 010: staff auth columns added' AS status;
