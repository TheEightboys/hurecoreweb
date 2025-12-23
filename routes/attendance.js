/**
 * HURE Core - Attendance Routes
 * Clock in/out and time tracking
 */

const express = require('express');
const router = express.Router();

const { supabaseAdmin } = require('../lib/supabase');

/**
 * GET /api/clinics/:clinicId/attendance
 * List attendance records
 */
router.get('/:clinicId/attendance', async (req, res) => {
    try {
        const { clinicId } = req.params;
        const { date, from, to, staffId, status } = req.query;

        let query = supabaseAdmin
            .from('attendances')
            .select(`
                *,
                staff:staff_id (id, first_name, last_name, job_role)
            `)
            .eq('clinic_id', clinicId)
            .order('date', { ascending: false })
            .order('clock_in', { ascending: false });

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
        if (staffId) {
            query = query.eq('staff_id', staffId);
        }
        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) {
            console.error('List attendance error:', error);
            return res.status(500).json({ error: 'Failed to fetch attendance' });
        }

        res.json({ success: true, data });

    } catch (err) {
        console.error('List attendance error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/clinics/:clinicId/attendance/clock-in
 * Staff clock in
 */
router.post('/:clinicId/attendance/clock-in', async (req, res) => {
    try {
        const { clinicId } = req.params;
        const { staffId, method = 'manual', locationId = null, notes } = req.body;

        if (!staffId) {
            return res.status(400).json({ error: 'Staff ID is required' });
        }

        const today = new Date().toISOString().split('T')[0];
        const now = new Date().toISOString();

        // Check if already clocked in today
        const { data: existing } = await supabaseAdmin
            .from('attendances')
            .select('id, clock_in')
            .eq('staff_id', staffId)
            .eq('date', today)
            .single();

        if (existing) {
            return res.status(400).json({
                error: 'Already clocked in today',
                clockIn: existing.clock_in
            });
        }

        // Create attendance record
        const { data, error } = await supabaseAdmin
            .from('attendances')
            .insert({
                clinic_id: clinicId,
                staff_id: staffId,
                date: today,
                clock_in: now,
                clock_in_method: method,
                location_id: locationId,
                status: 'present',
                notes
            })
            .select()
            .single();

        if (error) {
            console.error('Clock in error:', error);
            return res.status(500).json({ error: 'Failed to clock in' });
        }

        // Update staff status
        await supabaseAdmin
            .from('staff')
            .update({ status: 'on_duty' })
            .eq('id', staffId);

        res.status(201).json({
            success: true,
            data,
            message: 'Clocked in successfully'
        });

    } catch (err) {
        console.error('Clock in error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/clinics/:clinicId/attendance/clock-out
 * Staff clock out
 */
router.post('/:clinicId/attendance/clock-out', async (req, res) => {
    try {
        const { clinicId } = req.params;
        const { staffId, method = 'manual', notes } = req.body;

        if (!staffId) {
            return res.status(400).json({ error: 'Staff ID is required' });
        }

        const today = new Date().toISOString().split('T')[0];
        const now = new Date();

        // Get today's attendance
        const { data: attendance, error: fetchError } = await supabaseAdmin
            .from('attendances')
            .select('*')
            .eq('staff_id', staffId)
            .eq('date', today)
            .single();

        if (fetchError || !attendance) {
            return res.status(400).json({ error: 'No clock-in record found for today' });
        }

        if (attendance.clock_out) {
            return res.status(400).json({
                error: 'Already clocked out today',
                clockOut: attendance.clock_out
            });
        }

        // Calculate hours worked
        const clockIn = new Date(attendance.clock_in);
        const hoursWorked = ((now - clockIn) / (1000 * 60 * 60)).toFixed(2);

        // Update attendance
        const { data, error } = await supabaseAdmin
            .from('attendances')
            .update({
                clock_out: now.toISOString(),
                clock_out_method: method,
                hours_worked: parseFloat(hoursWorked),
                notes: notes || attendance.notes,
                updated_at: now.toISOString()
            })
            .eq('id', attendance.id)
            .select()
            .single();

        if (error) {
            console.error('Clock out error:', error);
            return res.status(500).json({ error: 'Failed to clock out' });
        }

        // Update staff status
        await supabaseAdmin
            .from('staff')
            .update({ status: 'off' })
            .eq('id', staffId);

        res.json({
            success: true,
            data,
            hoursWorked: parseFloat(hoursWorked),
            message: 'Clocked out successfully'
        });

    } catch (err) {
        console.error('Clock out error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/clinics/:clinicId/attendance/summary
 * Get payroll summary for date range
 */
router.get('/:clinicId/attendance/summary', async (req, res) => {
    try {
        const { clinicId } = req.params;
        const { from, to } = req.query;

        if (!from || !to) {
            return res.status(400).json({ error: 'From and to dates are required' });
        }

        const { data, error } = await supabaseAdmin
            .from('attendances')
            .select(`
                staff_id,
                date,
                hours_worked,
                staff:staff_id (first_name, last_name, job_role)
            `)
            .eq('clinic_id', clinicId)
            .gte('date', from)
            .lte('date', to)
            .not('hours_worked', 'is', null);

        if (error) {
            console.error('Summary error:', error);
            return res.status(500).json({ error: 'Failed to fetch summary' });
        }

        // Aggregate by staff
        const summary = {};
        data.forEach(record => {
            const staffId = record.staff_id;
            if (!summary[staffId]) {
                summary[staffId] = {
                    staffId,
                    name: record.staff ? `${record.staff.first_name} ${record.staff.last_name}` : 'Unknown',
                    jobRole: record.staff?.job_role || '',
                    daysWorked: 0,
                    totalHours: 0,
                    lastDate: null
                };
            }
            summary[staffId].daysWorked += 1;
            summary[staffId].totalHours += parseFloat(record.hours_worked) || 0;
            if (!summary[staffId].lastDate || record.date > summary[staffId].lastDate) {
                summary[staffId].lastDate = record.date;
            }
        });

        res.json({
            success: true,
            data: Object.values(summary),
            period: { from, to }
        });

    } catch (err) {
        console.error('Summary error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/clinics/:clinicId/attendance/export
 * Export attendance as CSV
 */
router.get('/:clinicId/attendance/export', async (req, res) => {
    try {
        const { clinicId } = req.params;
        const { from, to } = req.query;

        let query = supabaseAdmin
            .from('attendances')
            .select(`
                date,
                clock_in,
                clock_out,
                hours_worked,
                status,
                staff:staff_id (first_name, last_name, job_role)
            `)
            .eq('clinic_id', clinicId)
            .order('date', { ascending: false });

        if (from) query = query.gte('date', from);
        if (to) query = query.lte('date', to);

        const { data, error } = await query;

        if (error) {
            console.error('Export error:', error);
            return res.status(500).json({ error: 'Failed to export' });
        }

        // Build CSV
        const header = 'Name,Job Role,Date,Clock In,Clock Out,Hours Worked,Status\n';
        const rows = data.map(r => {
            const name = r.staff ? `${r.staff.first_name} ${r.staff.last_name}` : 'Unknown';
            const jobRole = r.staff?.job_role || '';
            const clockIn = r.clock_in ? new Date(r.clock_in).toLocaleTimeString() : '';
            const clockOut = r.clock_out ? new Date(r.clock_out).toLocaleTimeString() : '';
            return `"${name}","${jobRole}","${r.date}","${clockIn}","${clockOut}","${r.hours_worked || ''}","${r.status}"`;
        }).join('\n');

        const csv = header + rows;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=attendance_export.csv');
        res.send(csv);

    } catch (err) {
        console.error('Export error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
