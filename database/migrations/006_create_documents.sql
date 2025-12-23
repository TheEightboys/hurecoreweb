-- Migration: 006_create_documents
-- Description: Policies & HR documents
-- Run order: 6

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

-- Document acknowledgments
CREATE TABLE IF NOT EXISTS document_acknowledgments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  
  acknowledged_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  
  UNIQUE(document_id, staff_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_documents_clinic_id ON documents(clinic_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_doc_ack_document_id ON document_acknowledgments(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_ack_staff_id ON document_acknowledgments(staff_id);

-- Success
SELECT 'Migration 006: documents & document_acknowledgments created' AS status;
