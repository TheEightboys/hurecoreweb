/**
 * HURE Core - Staff Routes
 * CRUD operations for clinic staff/employees
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const { supabaseAdmin } = require('../lib/supabase');
const { logAudit, AUDIT_TYPES } = require('../lib/audit');

/**
 * GET /api/clinics/:clinicId/staff
 * List all staff for a clinic
 */
router.get('/:clinicId/staff', async (req, res) => {
    try {
        const { clinicId } = req.params;
        const { status, kyc_status, employment_status, search } = req.query;

        let query = supabaseAdmin
            .from('staff')
            .select('*')
            .eq('clinic_id', clinicId)
            .order('created_at', { ascending: false });

        // Filters
        if (status) {
            query = query.eq('status', status);
        }
        if (kyc_status) {
            query = query.eq('kyc_status', kyc_status);
        }
        if (employment_status) {
            query = query.eq('employment_status', employment_status);
        }
        if (search) {
            query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
        }

        const { data, error } = await query;

        if (error) {
            console.error('List staff error:', error);
            return res.status(500).json({ error: 'Failed to fetch staff' });
        }

        res.json({ success: true, data });

    } catch (err) {
        console.error('List staff error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/clinics/:clinicId/staff/:staffId
 * Get single staff member
 */
router.get('/:clinicId/staff/:staffId', async (req, res) => {
    try {
        const { clinicId, staffId } = req.params;

        const { data, error } = await supabaseAdmin
            .from('staff')
            .select('*')
            .eq('id', staffId)
            .eq('clinic_id', clinicId)
            .single();

        if (error || !data) {
            return res.status(404).json({ error: 'Staff not found' });
        }

        res.json({ success: true, data });

    } catch (err) {
        console.error('Get staff error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/clinics/:clinicId/staff
 * Create new staff member
 */
router.post('/:clinicId/staff', async (req, res) => {
    try {
        const { clinicId } = req.params;
        const {
            firstName,
            lastName,
            email,
            phone,
            accountRole = 'employee',
            jobRole,
            licenseType,
            licenseNumber,
            licenseExpiry,
            employmentStatus = 'inactive'
        } = req.body;

        console.log('Create staff - received data:', { firstName, lastName, email, jobRole, accountRole, licenseType, licenseNumber, licenseExpiry });

        // Validation
        if (!firstName || !lastName) {
            return res.status(400).json({ error: 'First name and last name are required' });
        }

        // Check if email already exists for this clinic
        if (email) {
            const { data: existing } = await supabaseAdmin
                .from('staff')
                .select('id')
                .eq('clinic_id', clinicId)
                .eq('email', email)
                .single();

            if (existing) {
                return res.status(409).json({ error: 'Email already exists for this clinic' });
            }
        }

        // Create staff
        const { data, error } = await supabaseAdmin
            .from('staff')
            .insert({
                clinic_id: clinicId,
                first_name: firstName,
                last_name: lastName,
                email,
                phone,
                account_role: accountRole,
                job_role: jobRole,
                license_type: licenseType,
                license_number: licenseNumber,
                license_expiry: licenseExpiry,
                employment_status: employmentStatus,
                kyc_status: 'not_started'
            })
            .select()
            .single();

        if (error) {
            console.error('Create staff error:', error);
            return res.status(500).json({ error: 'Failed to create staff' });
        }

        // Update clinic staff count (optional - RPC function may not exist yet)
        // await supabaseAdmin.rpc('increment_staff_count', { clinic_uuid: clinicId });

        // Log audit
        await logAudit(
            AUDIT_TYPES.STAFF_CREATED || 'staff_created',
            { id: 'system', role: 'owner', name: 'Employer Portal' },
            { entity: 'staff', id: data.id, name: `${firstName} ${lastName}` },
            { clinicId, accountRole, jobRole }
        );

        res.status(201).json({ success: true, data });

    } catch (err) {
        console.error('Create staff error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * PATCH /api/clinics/:clinicId/staff/:staffId
 * Update staff member
 */
router.patch('/:clinicId/staff/:staffId', async (req, res) => {
    try {
        const { clinicId, staffId } = req.params;
        const updates = req.body;

        // Map camelCase to snake_case
        const dbUpdates = {};
        if (updates.firstName !== undefined) dbUpdates.first_name = updates.firstName;
        if (updates.lastName !== undefined) dbUpdates.last_name = updates.lastName;
        if (updates.email !== undefined) dbUpdates.email = updates.email;
        if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
        if (updates.accountRole !== undefined) dbUpdates.account_role = updates.accountRole;
        if (updates.jobRole !== undefined) dbUpdates.job_role = updates.jobRole;
        if (updates.status !== undefined) dbUpdates.status = updates.status;
        if (updates.employmentStatus !== undefined) dbUpdates.employment_status = updates.employmentStatus;
        if (updates.licenseType !== undefined) dbUpdates.license_type = updates.licenseType;
        if (updates.licenseNumber !== undefined) dbUpdates.license_number = updates.licenseNumber;
        if (updates.licenseExpiry !== undefined) dbUpdates.license_expiry = updates.licenseExpiry;
        if (updates.inviteStatus !== undefined) dbUpdates.invite_status = updates.inviteStatus;

        dbUpdates.updated_at = new Date().toISOString();

        const { data, error } = await supabaseAdmin
            .from('staff')
            .update(dbUpdates)
            .eq('id', staffId)
            .eq('clinic_id', clinicId)
            .select()
            .single();

        if (error) {
            console.error('Update staff error:', error);
            return res.status(500).json({ error: 'Failed to update staff' });
        }

        if (!data) {
            return res.status(404).json({ error: 'Staff not found' });
        }

        res.json({ success: true, data });

    } catch (err) {
        console.error('Update staff error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * DELETE /api/clinics/:clinicId/staff/:staffId
 * Delete staff member
 */
router.delete('/:clinicId/staff/:staffId', async (req, res) => {
    try {
        const { clinicId, staffId } = req.params;

        const { error } = await supabaseAdmin
            .from('staff')
            .delete()
            .eq('id', staffId)
            .eq('clinic_id', clinicId);

        if (error) {
            console.error('Delete staff error:', error);
            return res.status(500).json({ error: 'Failed to delete staff' });
        }

        res.json({ success: true, message: 'Staff deleted' });

    } catch (err) {
        console.error('Delete staff error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/clinics/:clinicId/staff/:staffId/invite
 * Send invite to staff member
 */
router.post('/:clinicId/staff/:staffId/invite', async (req, res) => {
    try {
        const { clinicId, staffId } = req.params;
        const { method = 'email' } = req.body;

        // Get staff
        const { data: staff, error: staffError } = await supabaseAdmin
            .from('staff')
            .select('*')
            .eq('id', staffId)
            .eq('clinic_id', clinicId)
            .single();

        if (staffError || !staff) {
            return res.status(404).json({ error: 'Staff not found' });
        }

        if (!staff.email && method === 'email') {
            return res.status(400).json({ error: 'Staff has no email address' });
        }

        if (!staff.phone && method === 'sms') {
            return res.status(400).json({ error: 'Staff has no phone number' });
        }

        // Generate invite token
        const inviteToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Update staff
        const { error: updateError } = await supabaseAdmin
            .from('staff')
            .update({
                invite_status: 'pending',
                invite_token: inviteToken,
                invite_sent_at: new Date().toISOString(),
                invite_expires_at: expiresAt.toISOString(),
                invite_method: method
            })
            .eq('id', staffId);

        if (updateError) {
            console.error('Update invite error:', updateError);
            return res.status(500).json({ error: 'Failed to send invite' });
        }

        // Generate invite URL
        const APP_URL = process.env.APP_URL || 'http://localhost:5173';
        const inviteUrl = `${APP_URL}/employee/accept-invite?token=${inviteToken}`;

        // Send invite email (with error handling - don't fail if email fails)
        try {
            const { sendStaffInviteEmail } = require('../lib/email');

            // Get clinic name
            const { data: clinic } = await supabaseAdmin
                .from('clinics')
                .select('name')
                .eq('id', clinicId)
                .single();

            const emailResult = await sendStaffInviteEmail(
                staff.email,
                `${staff.first_name || ''} ${staff.last_name || ''}`.trim() || 'Team Member',
                clinic?.name || 'HURE Clinic',
                inviteUrl,
                staff.job_role || 'Employee'
            );

            console.log('Email send result:', emailResult);
        } catch (emailErr) {
            console.error('Email send error (non-fatal):', emailErr);
            // Continue anyway - the token was saved
        }

        res.json({
            success: true,
            message: `Invite sent via ${method}`,
            expiresAt: expiresAt.toISOString(),
            inviteUrl // For testing
        });

    } catch (err) {
        console.error('Send invite error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * DELETE /api/clinics/:clinicId/staff/:staffId/invite
 * Revoke staff invite
 */
router.delete('/:clinicId/staff/:staffId/invite', async (req, res) => {
    try {
        const { clinicId, staffId } = req.params;

        const { error } = await supabaseAdmin
            .from('staff')
            .update({
                invite_status: 'none',
                invite_token: null,
                invite_expires_at: null
            })
            .eq('id', staffId)
            .eq('clinic_id', clinicId);

        if (error) {
            console.error('Revoke invite error:', error);
            return res.status(500).json({ error: 'Failed to revoke invite' });
        }

        res.json({ success: true, message: 'Invite revoked' });

    } catch (err) {
        console.error('Revoke invite error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * PATCH /api/clinics/:clinicId/staff/:staffId/kyc
 * Update staff KYC status
 */
router.patch('/:clinicId/staff/:staffId/kyc', async (req, res) => {
    try {
        const { clinicId, staffId } = req.params;
        const { status } = req.body;

        const validStatuses = ['not_started', 'pending_review', 'verified', 'rejected', 'expired'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid KYC status' });
        }

        const updates = {
            kyc_status: status,
            vetting_status: status, // Also update vetting_status for consistency
            updated_at: new Date().toISOString()
        };

        // If verified, also update employment status
        if (status === 'verified') {
            updates.kyc_verified_at = new Date().toISOString();
            updates.employment_status = 'active';
        } else if (status === 'rejected' || status === 'expired') {
            updates.employment_status = 'inactive';
        }

        const { data, error } = await supabaseAdmin
            .from('staff')
            .update(updates)
            .eq('id', staffId)
            .eq('clinic_id', clinicId)
            .select()
            .single();

        if (error) {
            console.error('Update KYC error:', error);
            return res.status(500).json({ error: 'Failed to update KYC status' });
        }

        res.json({ success: true, data });

    } catch (err) {
        console.error('Update KYC error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

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
                account_role,
                invite_status,
                invite_expires_at,
                clinic:clinics(id, name, town)
            `)
            .eq('invite_token', token)
            .single();

        if (error || !staff) {
            console.log('Verify invite - not found for token:', token);
            return res.status(404).json({ error: 'Invalid invite token' });
        }

        if (staff.invite_status === 'accepted') {
            return res.status(400).json({ error: 'Invite already accepted' });
        }

        if (new Date(staff.invite_expires_at) < new Date()) {
            return res.status(400).json({ error: 'Invite has expired' });
        }

        console.log('Verify invite - staff found:', staff);

        // Build full name, handling null values
        const firstName = staff.first_name || '';
        const lastName = staff.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim() || 'Staff Member';

        res.json({
            success: true,
            staff: {
                name: fullName,
                email: staff.email,
                jobRole: staff.job_role || 'Employee',
                accountRole: staff.account_role || 'employee',
                clinic: staff.clinic
            }
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
        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Update staff - set invite_status to accepted and activate the employee
        const updateData = {
            password_hash: passwordHash,
            invite_status: 'accepted',
            invite_token: null,
            invite_accepted_at: new Date().toISOString(),
            status: 'active',
            employment_status: 'active', // Also activate employment
            updated_at: new Date().toISOString()
        };

        console.log('Accept invite - updating staff', staff.id, 'with:', updateData);

        const { data: updatedStaff, error: updateError } = await supabaseAdmin
            .from('staff')
            .update(updateData)
            .eq('id', staff.id)
            .select()
            .single();

        if (updateError) {
            console.error('Accept invite error:', updateError);
            return res.status(500).json({ error: 'Failed to accept invite' });
        }

        console.log('Accept invite - staff updated successfully:', updatedStaff?.id, 'invite_status:', updatedStaff?.invite_status);

        // Generate auth token
        const { generateToken } = require('../lib/auth');
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
            return res.status(400).json({ error: 'Please accept your invite first' });
        }

        // Verify password
        const bcrypt = require('bcryptjs');
        const passwordValid = await bcrypt.compare(password, staff.password_hash);

        if (!passwordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate token
        const { generateToken } = require('../lib/auth');
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
