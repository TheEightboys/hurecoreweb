-- ============================================
-- Migration 017: Audit Log Enhancements
-- ============================================

-- Add clinic_id to audit_logs for tenant isolation
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id);

-- Add location_id for location-scoped viewing
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES clinic_locations(id);

-- Add action detail
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS detail TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_clinic ON audit_logs(clinic_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_location ON audit_logs(location_id);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY audit_logs_select_policy ON audit_logs
  FOR SELECT USING (true);

CREATE POLICY audit_logs_insert_policy ON audit_logs
  FOR INSERT WITH CHECK (true);

-- Success message
SELECT 'Migration 017: Audit log enhancements added successfully!' AS message;
