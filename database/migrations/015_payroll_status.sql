-- ============================================
-- Migration 015: Payroll Status Tracking
-- ============================================

-- Payroll entries table for tracking payroll status
CREATE TABLE IF NOT EXISTS payroll_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  
  -- Entry key for deduplication (e.g., "d_staffId_date_locationId" or "m_staffId_period")
  payroll_key TEXT NOT NULL,
  
  -- Type
  pay_type TEXT NOT NULL, -- 'MONTHLY' or 'DAILY'
  
  -- Status workflow: draft -> submitted -> approved -> paid
  status TEXT DEFAULT 'draft',
  
  -- Reference data
  staff_id UUID REFERENCES staff(id),
  location_id UUID REFERENCES clinic_locations(id),
  period_label TEXT, -- e.g., 'Dec 2025' for monthly
  date DATE, -- for daily entries
  
  -- Amounts
  units DECIMAL(5,2) DEFAULT 0, -- e.g., 1 for full day, 0.5 for half
  rate_kes INT DEFAULT 0,
  amount_kes INT DEFAULT 0,
  
  -- Work summary
  work_summary TEXT,
  hours_audit DECIMAL(5,2),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  
  -- Unique constraint per clinic and payroll key
  UNIQUE(clinic_id, payroll_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payroll_entries_clinic ON payroll_entries(clinic_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_status ON payroll_entries(status);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_staff ON payroll_entries(staff_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_type ON payroll_entries(pay_type);

-- Enable RLS
ALTER TABLE payroll_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY payroll_entries_select_policy ON payroll_entries
  FOR SELECT USING (true);

CREATE POLICY payroll_entries_insert_policy ON payroll_entries
  FOR INSERT WITH CHECK (true);

CREATE POLICY payroll_entries_update_policy ON payroll_entries
  FOR UPDATE USING (true);

-- Success message
SELECT 'Migration 015: Payroll entries table created successfully!' AS message;
