/**
 * HURE Core - Onboarding Routes
 * Handles clinic registration, OTP verification, temp password
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

const { supabaseAdmin } = require('../lib/supabase');
const { logAudit, AUDIT_TYPES } = require('../lib/audit');
const { sendOtpEmail, generateOtpCode } = require('../lib/email');
const { getPlanPrice } = require('../lib/plans');

/**
 * POST /api/onboard/clinic
 * Create a new pending clinic
 */
router.post('/clinic', async (req, res) => {
    try {
        const {
            name,
            town,
            country = 'Kenya',
            contactName,
            email,
            phone,
            businessLicense,
            modules = ['core'],
            planKey = 'essential',
            planProduct = 'core'
        } = req.body;

        // Validation
        if (!name || !email) {
            return res.status(400).json({ error: 'Name and email are required' });
        }

        // Check if email already exists
        const { data: existing } = await supabaseAdmin
            .from('clinics')
            .select('id')
            .eq('email', email)
            .single();

        if (existing) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Determine if bundle
        const isBundle = modules.includes('core') && modules.includes('care');

        // Create clinic
        const { data: clinic, error } = await supabaseAdmin
            .from('clinics')
            .insert({
                name,
                town,
                country,
                contact_name: contactName,
                email,
                phone,
                business_license: businessLicense,
                modules,
                plan_key: planKey,
                plan_product: planProduct,
                is_bundle: isBundle,
                status: 'pending_verification'
            })
            .select()
            .single();

        if (error) {
            console.error('Create clinic error:', error);
            return res.status(500).json({ error: 'Failed to create clinic' });
        }

        // Log audit
        await logAudit(
            AUDIT_TYPES.CLINIC_CREATED,
            { id: 'system', role: 'system', name: 'Onboarding' },
            { entity: 'clinic', id: clinic.id, name: clinic.name },
            { modules, planKey, isBundle }
        );

        res.status(201).json({
            success: true,
            clinicId: clinic.id,
            message: 'Clinic created. Please set a temporary password.'
        });

    } catch (err) {
        console.error('Onboard clinic error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/onboard/temp-password
 * Set temporary password for clinic owner
 */
router.post('/temp-password', async (req, res) => {
    try {
        const { clinicId, email, password } = req.body;

        if (!clinicId || !email || !password) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Verify clinic exists
        const { data: clinic } = await supabaseAdmin
            .from('clinics')
            .select('id, email, name')
            .eq('id', clinicId)
            .single();

        if (!clinic) {
            return res.status(404).json({ error: 'Clinic not found' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Create or update user
        const { data: existingUser } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (existingUser) {
            // Update existing user
            await supabaseAdmin
                .from('users')
                .update({
                    temp_password_hash: hashedPassword,
                    temp_password_expires: expiresAt.toISOString()
                })
                .eq('id', existingUser.id);
        } else {
            // Create new user
            await supabaseAdmin
                .from('users')
                .insert({
                    clinic_id: clinicId,
                    email,
                    temp_password_hash: hashedPassword,
                    temp_password_expires: expiresAt.toISOString(),
                    role: 'owner'
                });
        }

        res.json({
            success: true,
            message: 'Temporary password set. Please verify your email.'
        });

    } catch (err) {
        console.error('Temp password error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/onboard/verify-email
 * Send OTP to email
 */
router.post('/verify-email', async (req, res) => {
    try {
        const { clinicId, email } = req.body;

        if (!clinicId || !email) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Get clinic
        const { data: clinic } = await supabaseAdmin
            .from('clinics')
            .select('id, name, email')
            .eq('id', clinicId)
            .single();

        if (!clinic) {
            return res.status(404).json({ error: 'Clinic not found' });
        }

        // Generate OTP
        const code = generateOtpCode();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        // Save OTP
        await supabaseAdmin
            .from('otp_codes')
            .insert({
                clinic_id: clinicId,
                email,
                code,
                expires_at: expiresAt.toISOString()
            });

        // Send email
        await sendOtpEmail(email, code, clinic.name);

        // Log audit
        await logAudit(
            AUDIT_TYPES.OTP_SENT,
            { id: 'system', role: 'system', name: 'Onboarding' },
            { entity: 'clinic', id: clinicId, name: clinic.name },
            { email }
        );

        res.json({
            success: true,
            message: 'Verification code sent to email'
        });

    } catch (err) {
        console.error('Verify email error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/onboard/verify-otp
 * Verify OTP code
 */
router.post('/verify-otp', async (req, res) => {
    try {
        const { clinicId, code } = req.body;

        if (!clinicId || !code) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Find valid OTP
        const { data: otpRecord } = await supabaseAdmin
            .from('otp_codes')
            .select('*')
            .eq('clinic_id', clinicId)
            .eq('code', code)
            .eq('used', false)
            .gte('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!otpRecord) {
            return res.status(400).json({ error: 'Invalid or expired code' });
        }

        // Mark OTP as used
        await supabaseAdmin
            .from('otp_codes')
            .update({ used: true })
            .eq('id', otpRecord.id);

        // Update clinic status
        await supabaseAdmin
            .from('clinics')
            .update({
                email_verified: true,
                status: 'pending_payment'
            })
            .eq('id', clinicId);

        // Get clinic for pricing
        const { data: clinic } = await supabaseAdmin
            .from('clinics')
            .select('*')
            .eq('id', clinicId)
            .single();

        // Calculate price
        const pricing = getPlanPrice(clinic.modules, clinic.plan_key);

        // Log audit
        await logAudit(
            AUDIT_TYPES.EMAIL_VERIFIED,
            { id: 'system', role: 'system', name: 'Onboarding' },
            { entity: 'clinic', id: clinicId, name: clinic.name }
        );

        res.json({
            success: true,
            message: 'Email verified. Proceed to payment.',
            pricing,
            clinic: {
                id: clinic.id,
                name: clinic.name,
                modules: clinic.modules,
                planKey: clinic.plan_key,
                isBundle: clinic.is_bundle
            }
        });

    } catch (err) {
        console.error('Verify OTP error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/onboard/skip-payment
 * DEV ONLY: Skip payment step and set status to pending_activation
 */
router.post('/skip-payment', async (req, res) => {
    try {
        // Only allow in development mode
        if (process.env.NODE_ENV === 'production') {
            return res.status(403).json({ error: 'Not available in production' });
        }

        const { clinicId } = req.body;

        if (!clinicId) {
            return res.status(400).json({ error: 'Clinic ID required' });
        }

        // Get clinic
        const { data: clinic, error: fetchError } = await supabaseAdmin
            .from('clinics')
            .select('*')
            .eq('id', clinicId)
            .single();

        if (fetchError || !clinic) {
            return res.status(404).json({ error: 'Clinic not found' });
        }

        // Calculate pricing for subscription record
        const pricing = getPlanPrice(clinic.modules, clinic.plan_key);

        // Create subscription record
        await supabaseAdmin
            .from('subscriptions')
            .insert({
                clinic_id: clinicId,
                plan_key: clinic.plan_key,
                plan_product: clinic.plan_product,
                modules: clinic.modules,
                is_bundle: clinic.is_bundle,
                status: 'pending',
                base_amount: pricing.base,
                discount_percent: pricing.discountPercent,
                final_amount: pricing.final,
                auto_renew: true,
                trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // 14 day trial
            });

        // Update clinic status to pending_activation
        const { error: updateError } = await supabaseAdmin
            .from('clinics')
            .update({ status: 'pending_activation' })
            .eq('id', clinicId);

        if (updateError) {
            return res.status(500).json({ error: 'Failed to update status' });
        }

        // Log audit
        await logAudit(
            'payment_skipped_dev',
            { id: 'system', role: 'system', name: 'Dev Mode' },
            { entity: 'clinic', id: clinicId, name: clinic.name },
            { note: 'Payment skipped for development testing' }
        );

        console.log(`⚠️ DEV: Payment skipped for clinic ${clinic.name} (${clinicId})`);

        res.json({
            success: true,
            message: 'Payment skipped. Clinic is now pending activation.',
            clinicId,
            clinicName: clinic.name
        });

    } catch (err) {
        console.error('Skip payment error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
