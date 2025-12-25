-- ============================================
-- Migration 013: Facility Verification (per-location)
-- ============================================

-- Add facility verification columns to clinic_locations
ALTER TABLE clinic_locations ADD COLUMN IF NOT EXISTS facility_verification_status TEXT DEFAULT 'draft';
-- Values: draft, pending_review, approved, rejected, expired

ALTER TABLE clinic_locations ADD COLUMN IF NOT EXISTS license_no TEXT;

ALTER TABLE clinic_locations ADD COLUMN IF NOT EXISTS licensing_body TEXT DEFAULT 'KMPDC';
-- Values: KMPDC, NCK, PPB, COC, OTHER

ALTER TABLE clinic_locations ADD COLUMN IF NOT EXISTS license_expiry DATE;

ALTER TABLE clinic_locations ADD COLUMN IF NOT EXISTS facility_docs JSONB DEFAULT '[]';

-- Settings per location
ALTER TABLE clinic_locations ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Africa/Nairobi';

-- Index for verification status
CREATE INDEX IF NOT EXISTS idx_clinic_locations_verification ON clinic_locations(facility_verification_status);

-- Success message
SELECT 'Migration 013: Facility verification columns added successfully!' AS message;
