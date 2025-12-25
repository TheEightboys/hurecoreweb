/**
 * HURE Core - Verification Routes
 * Organization and Facility verification
 */

const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../lib/supabase');

// ============================================
// VERIFICATION ROUTES
// ============================================

// GET /api/employer/:clinicId/org-verification
router.get('/:clinicId/org-verification', async (req, res) => {
    try {
        const { clinicId } = req.params;

        const { data, error } = await supabaseAdmin
            .from('clinics')
            .select('id, org_verification_status, kra_pin, business_reg_no, org_verification_docs')
            .eq('id', clinicId)
            .single();

        if (error) throw error;

        res.json({ success: true, data });
    } catch (err) {
        console.error('Error fetching org verification:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/employer/:clinicId/org-verification
router.put('/:clinicId/org-verification', async (req, res) => {
    try {
        const { clinicId } = req.params;
        const { org_verification_status, kra_pin, business_reg_no, org_verification_docs } = req.body;

        const updates = { updated_at: new Date().toISOString() };
        if (org_verification_status !== undefined) updates.org_verification_status = org_verification_status;
        if (kra_pin !== undefined) updates.kra_pin = kra_pin;
        if (business_reg_no !== undefined) updates.business_reg_no = business_reg_no;
        if (org_verification_docs !== undefined) updates.org_verification_docs = org_verification_docs;

        const { data, error } = await supabaseAdmin
            .from('clinics')
            .update(updates)
            .eq('id', clinicId)
            .select('id, org_verification_status, kra_pin, business_reg_no, org_verification_docs')
            .single();

        if (error) throw error;

        res.json({ success: true, data });
    } catch (err) {
        console.error('Error updating org verification:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/employer/:clinicId/locations/:locationId/verification
router.get('/:clinicId/locations/:locationId/verification', async (req, res) => {
    try {
        const { clinicId, locationId } = req.params;

        const { data, error } = await supabaseAdmin
            .from('clinic_locations')
            .select('id, name, facility_verification_status, license_no, licensing_body, license_expiry, facility_docs')
            .eq('id', locationId)
            .eq('clinic_id', clinicId)
            .single();

        if (error) throw error;

        res.json({ success: true, data });
    } catch (err) {
        console.error('Error fetching facility verification:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/employer/:clinicId/locations/:locationId/verification
router.put('/:clinicId/locations/:locationId/verification', async (req, res) => {
    try {
        const { clinicId, locationId } = req.params;
        const { facility_verification_status, license_no, licensing_body, license_expiry, facility_docs } = req.body;

        const updates = { updated_at: new Date().toISOString() };
        if (facility_verification_status !== undefined) updates.facility_verification_status = facility_verification_status;
        if (license_no !== undefined) updates.license_no = license_no;
        if (licensing_body !== undefined) updates.licensing_body = licensing_body;
        if (license_expiry !== undefined) updates.license_expiry = license_expiry;
        if (facility_docs !== undefined) updates.facility_docs = facility_docs;

        const { data, error } = await supabaseAdmin
            .from('clinic_locations')
            .update(updates)
            .eq('id', locationId)
            .eq('clinic_id', clinicId)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, data });
    } catch (err) {
        console.error('Error updating facility verification:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
