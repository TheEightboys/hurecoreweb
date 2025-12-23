/**
 * HURE Core - Shifts Routes
 * Scheduling endpoints for clinic staff
 */

const express = require('express');
const router = express.Router();

const { supabaseAdmin } = require('../lib/supabase');

/**
 * GET /api/clinics/:clinicId/shifts
 * List shifts for a clinic
 */
router.get('/:clinicId/shifts', async (req, res) => {
    try {
        const { clinicId } = req.params;
        const { date, from, to, status, staffId, role } = req.query;

        let query = supabaseAdmin
            .from('shifts')
            .select(`
                *,
                staff:staff_id (id, first_name, last_name, job_role),
                location:location_id (id, name)
            `)
            .eq('clinic_id', clinicId)
            .order('date', { ascending: true })
            .order('start_time', { ascending: true });

        // Filters
        if (date) {
            query = query.eq('date', date);
        }
        if (from && to) {
            query = query.gte('date', from).lte('date', to);
        } else if (from) {
            query = query.gte('date', from);
        } else if (to) {
            query = query.lte('date', to);
        }
        if (status) {
            query = query.eq('status', status);
        }
        if (staffId) {
            query = query.eq('staff_id', staffId);
        }
        if (role) {
            query = query.eq('required_role', role);
        }

        const { data, error } = await query;

        if (error) {
            console.error('List shifts error:', error);
            return res.status(500).json({ error: 'Failed to fetch shifts' });
        }

        res.json({ success: true, data });

    } catch (err) {
        console.error('List shifts error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/clinics/:clinicId/shifts/:shiftId
 * Get single shift
 */
router.get('/:clinicId/shifts/:shiftId', async (req, res) => {
    try {
        const { clinicId, shiftId } = req.params;

        const { data, error } = await supabaseAdmin
            .from('shifts')
            .select(`
                *,
                staff:staff_id (id, first_name, last_name, job_role),
                location:location_id (id, name)
            `)
            .eq('id', shiftId)
            .eq('clinic_id', clinicId)
            .single();

        if (error || !data) {
            return res.status(404).json({ error: 'Shift not found' });
        }

        res.json({ success: true, data });

    } catch (err) {
        console.error('Get shift error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/clinics/:clinicId/shifts
 * Create new shift
 */
router.post('/:clinicId/shifts', async (req, res) => {
    try {
        const { clinicId } = req.params;
        const {
            date,
            startTime,
            endTime,
            requiredRole,
            staffId = null,
            locationId = null,
            notes
        } = req.body;

        // Validation
        if (!date || !startTime || !endTime) {
            return res.status(400).json({ error: 'Date, start time, and end time are required' });
        }

        // Determine status
        const status = staffId ? 'assigned' : 'open';

        const { data, error } = await supabaseAdmin
            .from('shifts')
            .insert({
                clinic_id: clinicId,
                date,
                start_time: startTime,
                end_time: endTime,
                required_role: requiredRole,
                staff_id: staffId,
                location_id: locationId,
                status,
                notes
            })
            .select()
            .single();

        if (error) {
            console.error('Create shift error:', error);
            return res.status(500).json({ error: 'Failed to create shift' });
        }

        res.status(201).json({ success: true, data });

    } catch (err) {
        console.error('Create shift error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * PATCH /api/clinics/:clinicId/shifts/:shiftId
 * Update shift
 */
router.patch('/:clinicId/shifts/:shiftId', async (req, res) => {
    try {
        const { clinicId, shiftId } = req.params;
        const updates = req.body;

        // Map camelCase to snake_case
        const dbUpdates = {};
        if (updates.date !== undefined) dbUpdates.date = updates.date;
        if (updates.startTime !== undefined) dbUpdates.start_time = updates.startTime;
        if (updates.endTime !== undefined) dbUpdates.end_time = updates.endTime;
        if (updates.requiredRole !== undefined) dbUpdates.required_role = updates.requiredRole;
        if (updates.staffId !== undefined) dbUpdates.staff_id = updates.staffId;
        if (updates.locationId !== undefined) dbUpdates.location_id = updates.locationId;
        if (updates.status !== undefined) dbUpdates.status = updates.status;
        if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

        dbUpdates.updated_at = new Date().toISOString();

        const { data, error } = await supabaseAdmin
            .from('shifts')
            .update(dbUpdates)
            .eq('id', shiftId)
            .eq('clinic_id', clinicId)
            .select()
            .single();

        if (error) {
            console.error('Update shift error:', error);
            return res.status(500).json({ error: 'Failed to update shift' });
        }

        res.json({ success: true, data });

    } catch (err) {
        console.error('Update shift error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * PATCH /api/clinics/:clinicId/shifts/:shiftId/assign
 * Assign staff to shift
 */
router.patch('/:clinicId/shifts/:shiftId/assign', async (req, res) => {
    try {
        const { clinicId, shiftId } = req.params;
        const { staffId } = req.body;

        if (!staffId) {
            return res.status(400).json({ error: 'Staff ID is required' });
        }

        // Verify staff exists and belongs to clinic
        const { data: staff, error: staffError } = await supabaseAdmin
            .from('staff')
            .select('id, first_name, last_name')
            .eq('id', staffId)
            .eq('clinic_id', clinicId)
            .single();

        if (staffError || !staff) {
            return res.status(404).json({ error: 'Staff not found' });
        }

        const { data, error } = await supabaseAdmin
            .from('shifts')
            .update({
                staff_id: staffId,
                status: 'assigned',
                updated_at: new Date().toISOString()
            })
            .eq('id', shiftId)
            .eq('clinic_id', clinicId)
            .select()
            .single();

        if (error) {
            console.error('Assign shift error:', error);
            return res.status(500).json({ error: 'Failed to assign shift' });
        }

        res.json({
            success: true,
            data,
            message: `Shift assigned to ${staff.first_name} ${staff.last_name}`
        });

    } catch (err) {
        console.error('Assign shift error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * DELETE /api/clinics/:clinicId/shifts/:shiftId
 * Delete shift
 */
router.delete('/:clinicId/shifts/:shiftId', async (req, res) => {
    try {
        const { clinicId, shiftId } = req.params;

        const { error } = await supabaseAdmin
            .from('shifts')
            .delete()
            .eq('id', shiftId)
            .eq('clinic_id', clinicId);

        if (error) {
            console.error('Delete shift error:', error);
            return res.status(500).json({ error: 'Failed to delete shift' });
        }

        res.json({ success: true, message: 'Shift deleted' });

    } catch (err) {
        console.error('Delete shift error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
