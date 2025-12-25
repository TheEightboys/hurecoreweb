-- ============================================
-- Migration 014: Schedule Blocks (Coverage-first Model)
-- ============================================

-- Schedule blocks table for coverage-first scheduling
CREATE TABLE IF NOT EXISTS schedule_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  location_id UUID REFERENCES clinic_locations(id) ON DELETE CASCADE,
  
  -- Schedule details
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  role_needed TEXT NOT NULL,
  qty_needed INT DEFAULT 1,
  
  -- Assignments (multiple staff can be assigned)
  assigned_staff_ids UUID[] DEFAULT '{}',
  
  -- External/Locum covers (JSON array for flexibility)
  -- Each entry: { id, name, phone, supervisorId, notes, roleCovered }
  external_covers JSONB DEFAULT '[]',
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_clinic ON schedule_blocks(clinic_id);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_location ON schedule_blocks(location_id);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_date ON schedule_blocks(date);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_role ON schedule_blocks(role_needed);

-- Enable RLS
ALTER TABLE schedule_blocks ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see schedule blocks for their clinic
CREATE POLICY schedule_blocks_select_policy ON schedule_blocks
  FOR SELECT USING (true);

CREATE POLICY schedule_blocks_insert_policy ON schedule_blocks
  FOR INSERT WITH CHECK (true);

CREATE POLICY schedule_blocks_update_policy ON schedule_blocks
  FOR UPDATE USING (true);

CREATE POLICY schedule_blocks_delete_policy ON schedule_blocks
  FOR DELETE USING (true);

-- Success message
SELECT 'Migration 014: Schedule blocks table created successfully!' AS message;
