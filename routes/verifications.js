/**
 * HURE Core - Verifications Routes (SuperAdmin)
 * Review and approve/reject organization and facility verifications
 */

const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../lib/supabase');
const { sendVerificationStatusEmail } = require('../lib/email');

// ============================================
// GET PENDING VERIFICATIONS
// ============================================

// GET /api/verifications/pending
router.get('/pending', async (req, res) => {
    try {
        // Get clinics with pending org verification
        const { data: pendingOrgs, error: orgsError } = await supabaseAdmin
            .from('clinics')
            .select('id, name, email, kra_pin, business_reg_no, org_verification_status, created_at')
            .eq('org_verification_status', 'pending_review')
            .order('created_at', { ascending: false });

        if (orgsError) throw orgsError;

        // Get locations with pending facility verification
        const { data: pendingFacilities, error: facError } = await supabaseAdmin
            .from('clinic_locations')
            .select('id, name, clinic_id, license_no, licensing_body, license_expiry, facility_verification_status, created_at, clinic:clinics(name, email)')
            .eq('facility_verification_status', 'pending_review')
            .order('created_at', { ascending: false });

        if (facError) throw facError;

        res.json({
            success: true,
            data: {
                organizations: pendingOrgs || [],
                facilities: pendingFacilities || []
            }
        });
    } catch (err) {
        console.error('Error fetching pending verifications:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================
// ORGANIZATION VERIFICATION ACTIONS
// ============================================

// PATCH /api/verifications/org/:clinicId/approve
router.patch('/org/:clinicId/approve', async (req, res) => {
    try {
        const { clinicId } = req.params;
        console.log('[Verification] Approving org:', clinicId);

        const { data, error } = await supabaseAdmin
            .from('clinics')
            .update({
                org_verification_status: 'approved',
                updated_at: new Date().toISOString()
            })
            .eq('id', clinicId)
            .select('id, name, email, org_verification_status')
            .single();

        if (error) {
            console.error('[Verification] Update error:', error);
            throw error;
        }

        // Send notification email
        if (data && data.email) {
            try {
                await sendVerificationStatusEmail(
                    data.email,
                    data.name,
                    'organization',
                    'approved'
                );
                console.log(`Approval email sent to ${data.email}`);
            } catch (emailErr) {
                console.error('Failed to send approval email:', emailErr);
            }
        }

        res.json({ success: true, data });
    } catch (err) {
        console.error('Error approving org verification:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PATCH /api/verifications/org/:clinicId/reject
router.patch('/org/:clinicId/reject', async (req, res) => {
    try {
        const { clinicId } = req.params;
        const { reason } = req.body;
        console.log('[Verification] Rejecting org:', clinicId, 'Reason:', reason);

        const { data, error } = await supabaseAdmin
            .from('clinics')
            .update({
                org_verification_status: 'rejected',
                updated_at: new Date().toISOString()
            })
            .eq('id', clinicId)
            .select('id, name, email, org_verification_status')
            .single();

        if (error) {
            console.error('[Verification] Update error:', error);
            throw error;
        }

        // Send notification email
        if (data && data.email) {
            try {
                await sendVerificationStatusEmail(
                    data.email,
                    data.name,
                    'organization',
                    'rejected',
                    null,
                    reason
                );
                console.log(`Rejection email sent to ${data.email}`);
            } catch (emailErr) {
                console.error('Failed to send rejection email:', emailErr);
            }
        }

        res.json({ success: true, data });
    } catch (err) {
        console.error('Error rejecting org verification:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================
// FACILITY VERIFICATION ACTIONS
// ============================================

// PATCH /api/verifications/facility/:clinicId/:locationId/approve
router.patch('/facility/:clinicId/:locationId/approve', async (req, res) => {
    try {
        const { clinicId, locationId } = req.params;

        // First get clinic email
        const { data: clinic, error: clinicErr } = await supabaseAdmin
            .from('clinics')
            .select('name, email')
            .eq('id', clinicId)
            .single();

        if (clinicErr) throw clinicErr;

        console.log('[Verification] Approving facility:', locationId, 'for clinic:', clinicId);

        const { data, error } = await supabaseAdmin
            .from('clinic_locations')
            .update({
                facility_verification_status: 'approved',
                updated_at: new Date().toISOString()
            })
            .eq('id', locationId)
            .eq('clinic_id', clinicId)
            .select('id, name, facility_verification_status')
            .single();

        if (error) {
            console.error('[Verification] Facility update error:', error);
            throw error;
        }

        // Send notification email
        if (clinic && clinic.email) {
            try {
                await sendVerificationStatusEmail(
                    clinic.email,
                    clinic.name,
                    'facility',
                    'approved',
                    data.name
                );
                console.log(`Facility approval email sent to ${clinic.email}`);
            } catch (emailErr) {
                console.error('Failed to send facility approval email:', emailErr);
            }
        }

        res.json({ success: true, data });
    } catch (err) {
        console.error('Error approving facility verification:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PATCH /api/verifications/facility/:clinicId/:locationId/reject
router.patch('/facility/:clinicId/:locationId/reject', async (req, res) => {
    try {
        const { clinicId, locationId } = req.params;
        const { reason } = req.body;

        // First get clinic email
        const { data: clinic, error: clinicErr } = await supabaseAdmin
            .from('clinics')
            .select('name, email')
            .eq('id', clinicId)
            .single();

        if (clinicErr) throw clinicErr;

        console.log('[Verification] Rejecting facility:', locationId, 'for clinic:', clinicId);

        const { data, error } = await supabaseAdmin
            .from('clinic_locations')
            .update({
                facility_verification_status: 'rejected',
                updated_at: new Date().toISOString()
            })
            .eq('id', locationId)
            .eq('clinic_id', clinicId)
            .select('id, name, facility_verification_status')
            .single();

        if (error) {
            console.error('[Verification] Facility update error:', error);
            throw error;
        }

        // Send notification email
        if (clinic && clinic.email) {
            try {
                await sendVerificationStatusEmail(
                    clinic.email,
                    clinic.name,
                    'facility',
                    'rejected',
                    data.name,
                    reason
                );
                console.log(`Facility rejection email sent to ${clinic.email}`);
            } catch (emailErr) {
                console.error('Failed to send facility rejection email:', emailErr);
            }
        }

        res.json({ success: true, data });
    } catch (err) {
        console.error('Error rejecting facility verification:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
