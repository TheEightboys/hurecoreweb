-- ============================================
-- Migration 012: Multi-Location Organization Support
-- ============================================

-- Add organization-level columns to clinics table
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS plan_tier TEXT DEFAULT 'essential';
-- Values: essential, professional, enterprise

ALTER TABLE clinics ADD COLUMN IF NOT EXISTS plan_status TEXT DEFAULT 'active';
-- Values: active, suspended, cancelled

ALTER TABLE clinics ADD COLUMN IF NOT EXISTS plan_renew_on DATE;

ALTER TABLE clinics ADD COLUMN IF NOT EXISTS billing_currency TEXT DEFAULT 'KES';

ALTER TABLE clinics ADD COLUMN IF NOT EXISTS last_invoice_id TEXT;

-- Organization verification (business-level verification)
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS org_verification_status TEXT DEFAULT 'pending_review';
-- Values: pending_review, approved, rejected, suspended

ALTER TABLE clinics ADD COLUMN IF NOT EXISTS kra_pin TEXT;

ALTER TABLE clinics ADD COLUMN IF NOT EXISTS business_reg_no TEXT;

ALTER TABLE clinics ADD COLUMN IF NOT EXISTS org_verification_docs JSONB DEFAULT '[]';

-- Index for plan status
CREATE INDEX IF NOT EXISTS idx_clinics_plan_status ON clinics(plan_status);
CREATE INDEX IF NOT EXISTS idx_clinics_org_verification ON clinics(org_verification_status);

-- Success message
SELECT 'Migration 012: Multi-location organization support added successfully!' AS message;
