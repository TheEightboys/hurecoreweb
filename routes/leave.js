/**
 * HURE Core - Leave Routes
 * Time off request management
 */

const express = require('express');
const router = express.Router();

const { supabaseAdmin } = require('../lib/supabase');

/**
 * Calculate business days between two dates
 */
function calculateDays(from, to) {
    const start = new Date(from);
    const end = new Date(to);
    let count = 0;
    const current = new Date(start);

    while (current <= end) {
        const day = current.getDay();
        if (day !== 0 && day !== 6) { // Exclude weekends
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    return count;
}

/**
 * GET /api/clinics/:clinicId/leave
 * List leave requests
 */
router.get('/:clinicId/leave', async (req, res) => {
    try {
        const { clinicId } = req.params;
        const { status, staffId, type } = req.query;

        let query = supabaseAdmin
            .from('leave_requests')
            .select(`
                *,
                staff:staff_id (id, first_name, last_name, job_role),
                reviewer:reviewed_by (id, first_name, last_name)
            `)
            .eq('clinic_id', clinicId)
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }
        if (staffId) {
            query = query.eq('staff_id', staffId);
        }
        if (type) {
            query = query.eq('leave_type', type);
        }

        const { data, error } = await query;

        if (error) {
            console.error('List leave error:', error);
            return res.status(500).json({ error: 'Failed to fetch leave requests' });
        }

        res.json({ success: true, data });

    } catch (err) {
        console.error('List leave error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/clinics/:clinicId/leave/:leaveId
 * Get single leave request
 */
router.get('/:clinicId/leave/:leaveId', async (req, res) => {
    try {
        const { clinicId, leaveId } = req.params;

        const { data, error } = await supabaseAdmin
            .from('leave_requests')
            .select(`
                *,
                staff:staff_id (id, first_name, last_name, job_role, email),
                reviewer:reviewed_by (id, first_name, last_name)
            `)
            .eq('id', leaveId)
            .eq('clinic_id', clinicId)
            .single();

        if (error || !data) {
            return res.status(404).json({ error: 'Leave request not found' });
        }

        res.json({ success: true, data });

    } catch (err) {
        console.error('Get leave error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/clinics/:clinicId/leave
 * Create leave request
 */
router.post('/:clinicId/leave', async (req, res) => {
    try {
        const { clinicId } = req.params;
        const {
            staffId,
            leaveType,
            fromDate,
            toDate,
            reason,
            attachmentUrl
        } = req.body;

        // Validation
        if (!staffId || !leaveType || !fromDate || !toDate) {
            return res.status(400).json({
                error: 'Staff ID, leave type, from date, and to date are required'
            });
        }

        // Validate dates
        if (new Date(toDate) < new Date(fromDate)) {
            return res.status(400).json({ error: 'End date cannot be before start date' });
        }

        // Calculate days
        const daysCount = calculateDays(fromDate, toDate);

        const { data, error } = await supabaseAdmin
            .from('leave_requests')
            .insert({
                clinic_id: clinicId,
                staff_id: staffId,
                leave_type: leaveType,
                from_date: fromDate,
                to_date: toDate,
                days_count: daysCount,
                reason,
                attachment_url: attachmentUrl,
                status: 'pending'
            })
            .select()
            .single();

        if (error) {
            console.error('Create leave error:', error);
            return res.status(500).json({ error: 'Failed to create leave request' });
        }

        res.status(201).json({
            success: true,
            data,
            message: `Leave request for ${daysCount} day(s) submitted`
        });

    } catch (err) {
        console.error('Create leave error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * PATCH /api/clinics/:clinicId/leave/:leaveId
 * Update leave request (approve/reject)
 */
router.patch('/:clinicId/leave/:leaveId', async (req, res) => {
    try {
        const { clinicId, leaveId } = req.params;
        const { status, rejectionReason, reviewerId } = req.body;

        const validStatuses = ['pending', 'approved', 'rejected', 'cancelled'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const updates = {
            updated_at: new Date().toISOString()
        };

        if (status) {
            updates.status = status;

            if (status === 'approved' || status === 'rejected') {
                updates.reviewed_at = new Date().toISOString();
                if (reviewerId) {
                    updates.reviewed_by = reviewerId;
                }
            }

            if (status === 'rejected' && rejectionReason) {
                updates.rejection_reason = rejectionReason;
            }
        }

        const { data, error } = await supabaseAdmin
            .from('leave_requests')
            .update(updates)
            .eq('id', leaveId)
            .eq('clinic_id', clinicId)
            .select()
            .single();

        if (error) {
            console.error('Update leave error:', error);
            return res.status(500).json({ error: 'Failed to update leave request' });
        }

        // If approved, update staff status during leave period
        if (status === 'approved') {
            // TODO: Could set staff status to 'on_leave' during the period
        }

        res.json({
            success: true,
            data,
            message: `Leave request ${status}`
        });

    } catch (err) {
        console.error('Update leave error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * DELETE /api/clinics/:clinicId/leave/:leaveId
 * Cancel/delete leave request
 */
router.delete('/:clinicId/leave/:leaveId', async (req, res) => {
    try {
        const { clinicId, leaveId } = req.params;

        // Only allow deleting pending requests
        const { data: existing } = await supabaseAdmin
            .from('leave_requests')
            .select('status')
            .eq('id', leaveId)
            .eq('clinic_id', clinicId)
            .single();

        if (!existing) {
            return res.status(404).json({ error: 'Leave request not found' });
        }

        if (existing.status !== 'pending') {
            return res.status(400).json({
                error: 'Can only delete pending requests. Use cancel instead.'
            });
        }

        const { error } = await supabaseAdmin
            .from('leave_requests')
            .delete()
            .eq('id', leaveId)
            .eq('clinic_id', clinicId);

        if (error) {
            console.error('Delete leave error:', error);
            return res.status(500).json({ error: 'Failed to delete leave request' });
        }

        res.json({ success: true, message: 'Leave request deleted' });

    } catch (err) {
        console.error('Delete leave error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
