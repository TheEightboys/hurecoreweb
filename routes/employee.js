/**
 * HURE Core - Employee/Staff Routes
 * Handles staff portal access: schedule, attendance, leave, documents
 */

const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../lib/supabase');
const { verifyToken } = require('../lib/auth');
const { logAudit, AUDIT_TYPES } = require('../lib/audit');

/**
 * Middleware: Verify staff authentication
 */
async function requireStaff(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    // Staff must have staffId in token
    if (!decoded.staffId) {
        return res.status(403).json({ error: 'Staff access required' });
    }

    req.user = decoded;
    next();
}

/**
 * GET /api/employee/profile
 * Get staff member's own profile
 */
router.get('/profile', requireStaff, async (req, res) => {
    try {
        const { data: staff, error } = await supabaseAdmin
            .from('staff')
            .select(`
                *,
                clinic:clinics(id, name, town, country),
                location:clinic_locations(name)
            `)
            .eq('id', req.user.staffId)
            .single();

        if (error || !staff) {
            return res.status(404).json({ error: 'Staff profile not found' });
        }

        res.json(staff);
    } catch (err) {
        console.error('Get staff profile error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * PATCH /api/employee/profile
 * Update staff member's own profile (limited fields)
 */
router.patch('/profile', requireStaff, async (req, res) => {
    try {
        const { phone, email, licenseNumber, licenseExpiry } = req.body;

        const updates = {};
        if (phone) updates.phone = phone;
        if (email) updates.email = email;
        if (licenseNumber) updates.license_number = licenseNumber;
        if (licenseExpiry) updates.license_expiry = licenseExpiry;
        updates.updated_at = new Date().toISOString();

        const { data, error } = await supabaseAdmin
            .from('staff')
            .update(updates)
            .eq('id', req.user.staffId)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: 'Failed to update profile' });
        }

        res.json(data);
    } catch (err) {
        console.error('Update staff profile error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/employee/schedule
 * Get staff member's assigned shifts
 */
router.get('/schedule', requireStaff, async (req, res) => {
    try {
        const { from, to } = req.query;

        let query = supabaseAdmin
            .from('shifts')
            .select('*')
            .contains('assigned_staff', [req.user.staffId])
            .order('shift_date', { ascending: true });

        if (from) query = query.gte('shift_date', from);
        if (to) query = query.lte('shift_date', to);

        const { data, error } = await query;

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch schedule' });
        }

        res.json(data || []);
    } catch (err) {
        console.error('Get staff schedule error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * PATCH /api/employee/schedule/:shiftId/respond
 * Confirm or decline a shift assignment
 */
router.patch('/schedule/:shiftId/respond', requireStaff, async (req, res) => {
    try {
        const { shiftId } = req.params;
        const { status, reason } = req.body; // status: 'confirmed' or 'declined'

        if (!['confirmed', 'declined'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        // Get shift
        const { data: shift } = await supabaseAdmin
            .from('shifts')
            .select('*')
            .eq('id', shiftId)
            .single();

        if (!shift || !shift.assigned_staff?.includes(req.user.staffId)) {
            return res.status(404).json({ error: 'Shift not found or not assigned to you' });
        }

        const updates = { updated_at: new Date().toISOString() };

        // Store response in metadata
        const responses = shift.metadata?.staff_responses || {};
        responses[req.user.staffId] = { status, reason, respondedAt: new Date().toISOString() };
        updates.metadata = { ...shift.metadata, staff_responses: responses };

        const { data, error } = await supabaseAdmin
            .from('shifts')
            .update(updates)
            .eq('id', shiftId)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: 'Failed to update shift response' });
        }

        res.json(data);
    } catch (err) {
        console.error('Respond to shift error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/employee/attendance
 * Get staff member's attendance records
 */
router.get('/attendance', requireStaff, async (req, res) => {
    try {
        const { from, to } = req.query;

        let query = supabaseAdmin
            .from('attendances')
            .select('*')
            .eq('staff_id', req.user.staffId)
            .order('attendance_date', { ascending: false });

        if (from) query = query.gte('attendance_date', from);
        if (to) query = query.lte('attendance_date', to);

        const { data, error } = await query;

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch attendance' });
        }

        res.json(data || []);
    } catch (err) {
        console.error('Get attendance error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/employee/attendance/clock-in
 * Clock in for work
 */
router.post('/attendance/clock-in', requireStaff, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();

        // Check if already clocked in today
        const { data: existing } = await supabaseAdmin
            .from('attendances')
            .select('*')
            .eq('staff_id', req.user.staffId)
            .eq('clinic_id', req.user.clinicId)
            .eq('attendance_date', today)
            .is('clock_out', null)
            .single();

        if (existing) {
            return res.status(400).json({ error: 'Already clocked in today' });
        }

        const { data, error } = await supabaseAdmin
            .from('attendances')
            .insert({
                staff_id: req.user.staffId,
                clinic_id: req.user.clinicId,
                attendance_date: today,
                clock_in: now.toTimeString().slice(0, 8),
                status: 'present'
            })
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: 'Failed to clock in' });
        }

        res.json(data);
    } catch (err) {
        console.error('Clock in error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/employee/attendance/clock-out
 * Clock out from work
 */
router.post('/attendance/clock-out', requireStaff, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();

        // Find today's active clock-in
        const { data: attendance } = await supabaseAdmin
            .from('attendances')
            .select('*')
            .eq('staff_id', req.user.staffId)
            .eq('attendance_date', today)
            .is('clock_out', null)
            .single();

        if (!attendance) {
            return res.status(400).json({ error: 'No active clock-in found' });
        }

        const { data, error } = await supabaseAdmin
            .from('attendances')
            .update({
                clock_out: now.toTimeString().slice(0, 8),
                updated_at: new Date().toISOString()
            })
            .eq('id', attendance.id)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: 'Failed to clock out' });
        }

        res.json(data);
    } catch (err) {
        console.error('Clock out error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/employee/leave
 * Get staff member's leave requests
 */
router.get('/leave', requireStaff, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('leave_requests')
            .select('*')
            .eq('staff_id', req.user.staffId)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch leave requests' });
        }

        res.json(data || []);
    } catch (err) {
        console.error('Get leave requests error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/employee/leave
 * Submit new leave request
 */
router.post('/leave', requireStaff, async (req, res) => {
    try {
        const { leaveType, startDate, endDate, reason } = req.body;

        if (!leaveType || !startDate || !endDate) {
            return res.status(400).json({ error: 'Leave type, start date, and end date are required' });
        }

        const { data, error } = await supabaseAdmin
            .from('leave_requests')
            .insert({
                staff_id: req.user.staffId,
                clinic_id: req.user.clinicId,
                leave_type: leaveType,
                start_date: startDate,
                end_date: endDate,
                reason: reason || null,
                status: 'pending'
            })
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: 'Failed to submit leave request' });
        }

        res.json(data);
    } catch (err) {
        console.error('Submit leave request error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/employee/documents
 * Get documents assigned to staff
 */
router.get('/documents', requireStaff, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('documents')
            .select(`
                *,
                acknowledgment:document_acknowledgments!left(
                    acknowledged_at
                )
            `)
            .eq('clinic_id', req.user.clinicId)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch documents' });
        }

        // Format with acknowledgment status
        const docs = (data || []).map(doc => {
            const ack = doc.acknowledgment?.find(a => a.staff_id === req.user.staffId);
            return {
                ...doc,
                acknowledged: !!ack,
                acknowledgedAt: ack?.acknowledged_at || null
            };
        });

        res.json(docs);
    } catch (err) {
        console.error('Get documents error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/employee/documents/:docId/acknowledge
 * Acknowledge a document
 */
router.post('/documents/:docId/acknowledge', requireStaff, async (req, res) => {
    try {
        const { docId } = req.params;

        // Check if document exists
        const { data: doc } = await supabaseAdmin
            .from('documents')
            .select('*')
            .eq('id', docId)
            .eq('clinic_id', req.user.clinicId)
            .single();

        if (!doc) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Check if already acknowledged
        const { data: existing } = await supabaseAdmin
            .from('document_acknowledgments')
            .select('*')
            .eq('document_id', docId)
            .eq('staff_id', req.user.staffId)
            .single();

        if (existing) {
            return res.json(existing);
        }

        // Create acknowledgment
        const { data, error } = await supabaseAdmin
            .from('document_acknowledgments')
            .insert({
                document_id: docId,
                staff_id: req.user.staffId,
                acknowledged_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: 'Failed to acknowledge document' });
        }

        res.json(data);
    } catch (err) {
        console.error('Acknowledge document error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
