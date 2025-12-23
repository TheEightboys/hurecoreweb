/**
 * HURE Core - Staff Authentication Routes
 * Separate router for staff login, invite verification, and acceptance
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

const { supabaseAdmin } = require('../lib/supabase');
const { generateToken } = require('../lib/auth');

/**
 * GET /api/staff/verify-invite
 * Verify invite token validity
 */
router.get('/verify-invite', async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({ error: 'Token required' });
        }

        const { data: staff, error } = await supabaseAdmin
            .from('staff')
            .select(`
                id,
                first_name,
                last_name,
                email,
                job_role,
                invite_status,
                invite_expires_at,
                clinic:clinics(id, name, town)
            `)
            .eq('invite_token', token)
            .single();

        if (error || !staff) {
            return res.status(404).json({ error: 'Invalid invite token' });
        }

        if (staff.invite_status === 'accepted') {
            return res.status(400).json({ error: 'Invite already accepted' });
        }

        if (new Date(staff.invite_expires_at) < new Date()) {
            return res.status(400).json({ error: 'Invite has expired' });
        }

        res.json({
            success: true,
            staff: {
                first_name: staff.first_name,
                last_name: staff.last_name,
                email: staff.email,
                role: staff.job_role
            },
            clinic_name: staff.clinic?.name
        });

    } catch (err) {
        console.error('Verify invite error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/staff/accept-invite
 * Accept invite and set password
 */
router.post('/accept-invite', async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ error: 'Token and password required' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        // Get staff
        const { data: staff, error: staffError } = await supabaseAdmin
            .from('staff')
            .select('*')
            .eq('invite_token', token)
            .single();

        if (staffError || !staff) {
            return res.status(404).json({ error: 'Invalid invite token' });
        }

        if (staff.invite_status === 'accepted') {
            return res.status(400).json({ error: 'Invite already accepted' });
        }

        if (new Date(staff.invite_expires_at) < new Date()) {
            return res.status(400).json({ error: 'Invite has expired' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Update staff
        const { error: updateError } = await supabaseAdmin
            .from('staff')
            .update({
                password_hash: passwordHash,
                invite_status: 'accepted',
                invite_token: null,
                invite_accepted_at: new Date().toISOString(),
                status: 'active',
                updated_at: new Date().toISOString()
            })
            .eq('id', staff.id);

        if (updateError) {
            console.error('Accept invite error:', updateError);
            return res.status(500).json({ error: 'Failed to accept invite' });
        }

        // Generate auth token
        const authToken = generateToken({
            staffId: staff.id,
            clinicId: staff.clinic_id,
            email: staff.email,
            role: staff.account_role,
            name: `${staff.first_name} ${staff.last_name}`
        });

        res.json({
            success: true,
            message: 'Invite accepted successfully',
            token: authToken,
            staff: {
                id: staff.id,
                name: `${staff.first_name} ${staff.last_name}`,
                email: staff.email,
                jobRole: staff.job_role,
                clinicId: staff.clinic_id
            }
        });

    } catch (err) {
        console.error('Accept invite error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/staff/login
 * Staff login with email and password
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        // Find staff
        const { data: staff, error } = await supabaseAdmin
            .from('staff')
            .select('*, clinic:clinics(id, name, status)')
            .eq('email', email.toLowerCase())
            .single();

        if (error || !staff) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (staff.status !== 'active') {
            return res.status(403).json({ error: 'Account is not active' });
        }

        if (!staff.password_hash) {
            return res.status(401).json({ error: 'Please complete your invite first' });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, staff.password_hash);

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate token
        const authToken = generateToken({
            staffId: staff.id,
            clinicId: staff.clinic_id,
            email: staff.email,
            role: staff.account_role,
            name: `${staff.first_name} ${staff.last_name}`
        });

        res.json({
            success: true,
            token: authToken,
            staff: {
                id: staff.id,
                name: `${staff.first_name} ${staff.last_name}`,
                email: staff.email,
                jobRole: staff.job_role,
                clinicId: staff.clinic_id,
                clinicName: staff.clinic?.name
            }
        });

    } catch (err) {
        console.error('Staff login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
