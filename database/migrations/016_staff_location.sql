-- ============================================
-- Migration 016: Staff Location and Pay Type
-- ============================================

-- Add location reference to staff
ALTER TABLE staff ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES clinic_locations(id);

-- Add pay type columns for salaried vs casual
ALTER TABLE staff ADD COLUMN IF NOT EXISTS pay_basis TEXT DEFAULT 'MONTHLY';
-- Values: MONTHLY, DAILY

ALTER TABLE staff ADD COLUMN IF NOT EXISTS monthly_salary_kes INT DEFAULT 0;

ALTER TABLE staff ADD COLUMN IF NOT EXISTS daily_rate_kes INT DEFAULT 0;

-- Add enhanced onboarding and vetting status
ALTER TABLE staff ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'not_started';
-- Values: not_started, in_progress, completed

ALTER TABLE staff ADD COLUMN IF NOT EXISTS vetting_status TEXT DEFAULT 'not_started';
-- Values: not_started, in_progress, pending_review, verified, rejected, expired

-- Invite enhancements
ALTER TABLE staff ADD COLUMN IF NOT EXISTS invite_code TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS invite_last_channel TEXT;
-- Values: email, sms, whatsapp

ALTER TABLE staff ADD COLUMN IF NOT EXISTS invite_revoked_at TIMESTAMPTZ;

-- Index for location
CREATE INDEX IF NOT EXISTS idx_staff_location ON staff(location_id);
CREATE INDEX IF NOT EXISTS idx_staff_pay_basis ON staff(pay_basis);
CREATE INDEX IF NOT EXISTS idx_staff_vetting ON staff(vetting_status);

-- Success message
SELECT 'Migration 016: Staff location and pay type columns added successfully!' AS message;
