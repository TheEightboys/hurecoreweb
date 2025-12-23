/**
 * HURE Core - Auth Routes
 * Handles authentication and first-login flow
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

const { supabaseAdmin } = require('../lib/supabase');
const { verifyFirstLoginToken, generateToken } = require('../lib/auth');
const { logAudit, AUDIT_TYPES } = require('../lib/audit');

/**
 * POST /api/auth/first-login
 * Complete first login - set username and permanent password
 */
router.post('/first-login', async (req, res) => {
    try {
        const { token, tempPassword, newPassword, username } = req.body;

        // Validation
        if (!token || !tempPassword || !newPassword || !username) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        if (username.length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters' });
        }

        // Username format validation (alphanumeric + underscore)
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
        }

        // Verify the first-login token
        const decoded = verifyFirstLoginToken(token);
        if (!decoded) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Find the user
        const { data: user, error: userError } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('clinic_id', decoded.clinicId)
            .eq('email', decoded.email)
            .eq('role', 'owner')
            .single();

        if (userError || !user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if already completed first login
        if (user.password_set) {
            return res.status(400).json({ error: 'Password already set. Please use regular login.' });
        }

        // Verify token matches
        if (user.first_login_token !== token) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Check token expiry
        if (new Date(user.first_login_token_expires) < new Date()) {
            return res.status(401).json({ error: 'Token has expired. Please contact support.' });
        }

        // Verify temp password
        const tempPasswordValid = await bcrypt.compare(tempPassword, user.temp_password_hash);
        if (!tempPasswordValid) {
            return res.status(401).json({ error: 'Incorrect temporary password' });
        }

        // Check username availability
        const { data: existingUser } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('username', username.toLowerCase())
            .single();

        if (existingUser) {
            return res.status(409).json({ error: 'Username already taken' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const newPasswordHash = await bcrypt.hash(newPassword, salt);

        // Update user
        const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({
                username: username.toLowerCase(),
                password_hash: newPasswordHash,
                password_set: true,
                first_login_token: null,
                first_login_token_expires: null,
                temp_password_hash: null,
                temp_password_expires: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

        if (updateError) {
            console.error('Update user error:', updateError);
            return res.status(500).json({ error: 'Failed to update password' });
        }

        // Get clinic info
        const { data: clinic } = await supabaseAdmin
            .from('clinics')
            .select('id, name')
            .eq('id', decoded.clinicId)
            .single();

        // Log audit
        await logAudit(
            'first_login_completed',
            { id: user.id, role: 'owner', name: username },
            { entity: 'user', id: user.id, name: username },
            { clinicId: decoded.clinicId }
        );

        // Generate auth token for immediate login
        const authToken = generateToken({
            id: user.id,
            email: user.email,
            role: 'owner',
            name: username,
            clinicId: decoded.clinicId
        });

        res.json({
            success: true,
            message: 'Account setup complete! You can now log in.',
            token: authToken,
            user: {
                id: user.id,
                email: user.email,
                username: username.toLowerCase(),
                role: 'owner',
                clinicId: clinic?.id,
                clinicName: clinic?.name
            }
        });

    } catch (err) {
        console.error('First login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/auth/login
 * Login with username/email and password
 */
router.post('/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({ error: 'Username/email and password required' });
        }

        // Find user by email or username
        const isEmail = identifier.includes('@');

        const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('*, clinic:clinics(id, name, status)')
            .or(`email.eq.${identifier},username.eq.${identifier.toLowerCase()}`)
            .single();

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check if password is set
        if (!user.password_set || !user.password_hash) {
            return res.status(400).json({
                error: 'Please complete first-time login setup first',
                needsFirstLogin: true
            });
        }

        // Check clinic status
        if (user.clinic?.status === 'suspended') {
            return res.status(403).json({ error: 'Your clinic account is suspended' });
        }

        // Verify password
        const passwordValid = await bcrypt.compare(password, user.password_hash);
        if (!passwordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        await supabaseAdmin
            .from('users')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', user.id);

        // Generate token
        const token = generateToken({
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.username || user.first_name,
            clinicId: user.clinic_id
        });

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role,
                clinicId: user.clinic?.id,
                clinicName: user.clinic?.name
            }
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/auth/verify-token
 * Verify first-login token is valid
 */
router.get('/verify-token', async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({ error: 'Token required' });
        }

        // Decode token
        const decoded = verifyFirstLoginToken(token);
        if (!decoded) {
            return res.status(401).json({ error: 'Invalid or expired token', valid: false });
        }

        // Find user and check token
        const { data: user } = await supabaseAdmin
            .from('users')
            .select('id, email, password_set, first_login_token, first_login_token_expires')
            .eq('clinic_id', decoded.clinicId)
            .eq('email', decoded.email)
            .single();

        if (!user) {
            return res.status(404).json({ error: 'User not found', valid: false });
        }

        if (user.password_set) {
            return res.status(400).json({ error: 'Account already set up', valid: false, alreadySetup: true });
        }

        if (user.first_login_token !== token) {
            return res.status(401).json({ error: 'Token mismatch', valid: false });
        }

        if (new Date(user.first_login_token_expires) < new Date()) {
            return res.status(401).json({ error: 'Token expired', valid: false });
        }

        // Get clinic name
        const { data: clinic } = await supabaseAdmin
            .from('clinics')
            .select('name')
            .eq('id', decoded.clinicId)
            .single();

        res.json({
            valid: true,
            email: user.email,
            clinicName: clinic?.name
        });

    } catch (err) {
        console.error('Verify token error:', err);
        res.status(500).json({ error: 'Server error', valid: false });
    }
});

/**
 * POST /api/auth/resend-activation
 * Resend activation email (for SuperAdmin use)
 */
router.post('/resend-activation', async (req, res) => {
    try {
        const { clinicId } = req.body;

        if (!clinicId) {
            return res.status(400).json({ error: 'Clinic ID required' });
        }

        // Get clinic and user
        const { data: clinic } = await supabaseAdmin
            .from('clinics')
            .select('*')
            .eq('id', clinicId)
            .single();

        if (!clinic) {
            return res.status(404).json({ error: 'Clinic not found' });
        }

        if (clinic.status !== 'active') {
            return res.status(400).json({ error: 'Clinic must be active to resend activation' });
        }

        const { data: user } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('clinic_id', clinicId)
            .eq('role', 'owner')
            .single();

        if (!user) {
            return res.status(404).json({ error: 'Owner not found' });
        }

        if (user.password_set) {
            return res.status(400).json({ error: 'User already completed setup' });
        }

        // Generate new token
        const { generateFirstLoginToken } = require('../lib/auth');
        const newToken = generateFirstLoginToken(clinicId, clinic.email);
        const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        // Update user
        await supabaseAdmin
            .from('users')
            .update({
                first_login_token: newToken,
                first_login_token_expires: tokenExpires.toISOString()
            })
            .eq('id', user.id);

        // Send email
        const { sendActivationEmail } = require('../lib/email');
        const firstLoginUrl = `${process.env.APP_URL || 'http://localhost:5173'}/first-login?token=${newToken}`;
        await sendActivationEmail(clinic.email, clinic.name, firstLoginUrl);

        res.json({
            success: true,
            message: 'Activation email resent'
        });

    } catch (err) {
        console.error('Resend activation error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
