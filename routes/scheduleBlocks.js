/**
 * HURE Core - Schedule Blocks Routes
 * Coverage-first scheduling model
 */

const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../lib/supabase');

// ============================================
// SCHEDULE BLOCKS ROUTES (Coverage-first model)
// ============================================

// GET /api/employer/:clinicId/schedule-blocks
router.get('/:clinicId/schedule-blocks', async (req, res) => {
    try {
        const { clinicId } = req.params;
        const { location } = req.query;

        let query = supabaseAdmin
            .from('schedule_blocks')
            .select('*')
            .eq('clinic_id', clinicId)
            .order('date', { ascending: true })
            .order('start_time', { ascending: true });

        if (location && location !== 'ALL') {
            query = query.eq('location_id', location);
        }

        const { data, error } = await query;
        if (error) throw error;

        res.json({ success: true, data: data || [] });
    } catch (err) {
        console.error('Error fetching schedule blocks:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/employer/:clinicId/schedule-blocks
router.post('/:clinicId/schedule-blocks', async (req, res) => {
    try {
        const { clinicId } = req.params;
        const { date, start_time, end_time, role_needed, qty_needed, location_id, notes } = req.body;

        if (!date || !start_time || !end_time || !role_needed) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const { data, error } = await supabaseAdmin
            .from('schedule_blocks')
            .insert({
                clinic_id: clinicId,
                location_id,
                date,
                start_time,
                end_time,
                role_needed,
                qty_needed: qty_needed || 1,
                assigned_staff_ids: [],
                external_covers: [],
                notes
            })
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, data });
    } catch (err) {
        console.error('Error creating schedule block:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/employer/:clinicId/schedule-blocks/:blockId
router.put('/:clinicId/schedule-blocks/:blockId', async (req, res) => {
    try {
        const { clinicId, blockId } = req.params;
        const updates = req.body;

        // Verify block belongs to clinic
        const { data: existing } = await supabaseAdmin
            .from('schedule_blocks')
            .select('id')
            .eq('id', blockId)
            .eq('clinic_id', clinicId)
            .single();

        if (!existing) {
            return res.status(404).json({ success: false, error: 'Schedule block not found' });
        }

        const { data, error } = await supabaseAdmin
            .from('schedule_blocks')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', blockId)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, data });
    } catch (err) {
        console.error('Error updating schedule block:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/employer/:clinicId/schedule-blocks/:blockId
router.delete('/:clinicId/schedule-blocks/:blockId', async (req, res) => {
    try {
        const { clinicId, blockId } = req.params;

        const { error } = await supabaseAdmin
            .from('schedule_blocks')
            .delete()
            .eq('id', blockId)
            .eq('clinic_id', clinicId);

        if (error) throw error;

        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting schedule block:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/employer/:clinicId/schedule-blocks/:blockId/assign
// Assign staff to a schedule block
router.put('/:clinicId/schedule-blocks/:blockId/assign', async (req, res) => {
    try {
        const { blockId } = req.params;
        const { staff_id, action } = req.body; // action: 'add' or 'remove'

        const { data: block, error: fetchError } = await supabaseAdmin
            .from('schedule_blocks')
            .select('assigned_staff_ids')
            .eq('id', blockId)
            .single();

        if (fetchError) throw fetchError;

        let assignedStaffIds = block.assigned_staff_ids || [];

        if (action === 'add' && !assignedStaffIds.includes(staff_id)) {
            assignedStaffIds.push(staff_id);
        } else if (action === 'remove') {
            assignedStaffIds = assignedStaffIds.filter(id => id !== staff_id);
        }

        const { data, error } = await supabaseAdmin
            .from('schedule_blocks')
            .update({
                assigned_staff_ids: assignedStaffIds,
                updated_at: new Date().toISOString()
            })
            .eq('id', blockId)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, data });
    } catch (err) {
        console.error('Error assigning staff:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/employer/:clinicId/schedule-blocks/:blockId/locum
// Add/remove external locum cover
router.put('/:clinicId/schedule-blocks/:blockId/locum', async (req, res) => {
    try {
        const { blockId } = req.params;
        const { locum, action, locum_id } = req.body; // action: 'add' or 'remove'

        const { data: block, error: fetchError } = await supabaseAdmin
            .from('schedule_blocks')
            .select('external_covers')
            .eq('id', blockId)
            .single();

        if (fetchError) throw fetchError;

        let externalCovers = block.external_covers || [];

        if (action === 'add' && locum) {
            externalCovers.push({
                id: `lc_${Date.now()}`,
                ...locum
            });
        } else if (action === 'remove' && locum_id) {
            externalCovers = externalCovers.filter(l => l.id !== locum_id);
        }

        const { data, error } = await supabaseAdmin
            .from('schedule_blocks')
            .update({
                external_covers: externalCovers,
                updated_at: new Date().toISOString()
            })
            .eq('id', blockId)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, data });
    } catch (err) {
        console.error('Error managing locum:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
