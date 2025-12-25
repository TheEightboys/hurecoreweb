-- ============================================
-- Migration 018: Organization Documents Enhancement
-- ============================================

-- Add scope column to documents for org-vs-location visibility
ALTER TABLE documents ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'all_staff';
-- Values: ORG (visible at all locations), LOCATION (visible only at specific location)

ALTER TABLE documents ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES clinic_locations(id);

-- Index
CREATE INDEX IF NOT EXISTS idx_documents_scope ON documents(scope);
CREATE INDEX IF NOT EXISTS idx_documents_location ON documents(location_id);

-- Success message
SELECT 'Migration 018: Organization documents enhancement added successfully!' AS message;
