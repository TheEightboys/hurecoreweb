/**
 * HURE Core - Audit Log Routes
 * Audit log management
 */

const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../lib/supabase');

// ============================================
// AUDIT LOG ROUTES
// ============================================

// GET /api/employer/:clinicId/audit
router.get('/:clinicId/audit', async (req, res) => {
    try {
        const { clinicId } = req.params;
        const { location, limit = 100 } = req.query;

        let query = supabaseAdmin
            .from('audit_logs')
            .select('*')
            .eq('clinic_id', clinicId)
            .order('created_at', { ascending: false })
            .limit(parseInt(limit));

        if (location && location !== 'ALL') {
            query = query.or(`location_id.eq.${location},location_id.is.null`);
        }

        const { data, error } = await query;
        if (error) throw error;

        res.json({ success: true, data: data || [] });
    } catch (err) {
        console.error('Error fetching audit logs:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/employer/:clinicId/audit
router.post('/:clinicId/audit', async (req, res) => {
    try {
        const { clinicId } = req.params;
        const { type, actor_name, actor_role, target_entity, target_id, target_name,
            location_id, detail, meta, reason } = req.body;

        const { data, error } = await supabaseAdmin
            .from('audit_logs')
            .insert({
                clinic_id: clinicId,
                type,
                actor_name,
                actor_role,
                target_entity,
                target_id,
                target_name,
                location_id,
                detail,
                meta,
                reason
            })
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, data });
    } catch (err) {
        console.error('Error creating audit log:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
