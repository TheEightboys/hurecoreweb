/**
 * HURE Core - Payroll Routes
 * Payroll status tracking and export
 */

const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../lib/supabase');

// ============================================
// PAYROLL ROUTES
// ============================================

// GET /api/employer/:clinicId/payroll
router.get('/:clinicId/payroll', async (req, res) => {
    try {
        const { clinicId } = req.params;
        const { location, type } = req.query;

        let query = supabaseAdmin
            .from('payroll_entries')
            .select('*')
            .eq('clinic_id', clinicId);

        if (location && location !== 'ALL') {
            query = query.eq('location_id', location);
        }

        if (type) {
            query = query.eq('pay_type', type);
        }

        const { data, error } = await query;
        if (error) throw error;

        res.json({ success: true, data: data || [] });
    } catch (err) {
        console.error('Error fetching payroll:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/employer/:clinicId/payroll
router.post('/:clinicId/payroll', async (req, res) => {
    try {
        const { clinicId } = req.params;
        const { payroll_key, pay_type, staff_id, location_id, period_label, date,
            units, rate_kes, amount_kes, work_summary, hours_audit, status } = req.body;

        // Upsert based on payroll_key
        const { data, error } = await supabaseAdmin
            .from('payroll_entries')
            .upsert({
                clinic_id: clinicId,
                payroll_key,
                pay_type,
                staff_id,
                location_id,
                period_label,
                date,
                units,
                rate_kes,
                amount_kes,
                work_summary,
                hours_audit,
                status: status || 'draft',
                updated_at: new Date().toISOString()
            }, { onConflict: 'clinic_id,payroll_key' })
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, data });
    } catch (err) {
        console.error('Error creating/updating payroll entry:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/employer/:clinicId/payroll/:payrollKey/status
router.put('/:clinicId/payroll/:payrollKey/status', async (req, res) => {
    try {
        const { clinicId, payrollKey } = req.params;
        const { status } = req.body;

        const validStatuses = ['draft', 'submitted', 'approved', 'paid'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status' });
        }

        const updates = {
            status,
            updated_at: new Date().toISOString()
        };

        if (status === 'approved') {
            updates.approved_at = new Date().toISOString();
        } else if (status === 'paid') {
            updates.paid_at = new Date().toISOString();
        }

        const { data, error } = await supabaseAdmin
            .from('payroll_entries')
            .update(updates)
            .eq('clinic_id', clinicId)
            .eq('payroll_key', decodeURIComponent(payrollKey))
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, data });
    } catch (err) {
        console.error('Error updating payroll status:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/employer/:clinicId/payroll/bulk-status
router.put('/:clinicId/payroll/bulk-status', async (req, res) => {
    try {
        const { clinicId } = req.params;
        const { payroll_keys, status } = req.body;

        if (!Array.isArray(payroll_keys) || payroll_keys.length === 0) {
            return res.status(400).json({ success: false, error: 'No payroll keys provided' });
        }

        const updates = {
            status,
            updated_at: new Date().toISOString()
        };

        if (status === 'approved') {
            updates.approved_at = new Date().toISOString();
        } else if (status === 'paid') {
            updates.paid_at = new Date().toISOString();
        }

        const { data, error } = await supabaseAdmin
            .from('payroll_entries')
            .update(updates)
            .eq('clinic_id', clinicId)
            .in('payroll_key', payroll_keys)
            .select();

        if (error) throw error;

        res.json({ success: true, data, updated: data?.length || 0 });
    } catch (err) {
        console.error('Error bulk updating payroll:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
