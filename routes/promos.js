/**
 * HURE Core - Promos Routes
 */

const express = require('express');
const router = express.Router();

const { supabaseAdmin } = require('../lib/supabase');
const { requireSuperAdmin } = require('../lib/auth');
const { logAudit, AUDIT_TYPES } = require('../lib/audit');

/**
 * GET /api/promos
 * List all promo codes
 */
router.get('/', requireSuperAdmin, async (req, res) => {
    try {
        const { data: promos, error } = await supabaseAdmin
            .from('promos')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch promos' });
        }

        res.json({ promos });

    } catch (err) {
        console.error('List promos error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/promos
 * Create a new promo code
 */
router.post('/', requireSuperAdmin, async (req, res) => {
    try {
        const { code, discountPercent, expiresAt, maxUses } = req.body;

        if (!code || !discountPercent) {
            return res.status(400).json({ error: 'Code and discount are required' });
        }

        // Check if code exists
        const { data: existing } = await supabaseAdmin
            .from('promos')
            .select('id')
            .eq('code', code.toUpperCase())
            .single();

        if (existing) {
            return res.status(409).json({ error: 'Promo code already exists' });
        }

        const { data: promo, error } = await supabaseAdmin
            .from('promos')
            .insert({
                code: code.toUpperCase(),
                discount_percent: discountPercent,
                expires_at: expiresAt || null,
                max_uses: maxUses || null,
                active: true
            })
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: 'Failed to create promo' });
        }

        await logAudit(
            AUDIT_TYPES.PROMO_CREATED,
            req.user,
            { entity: 'promo', id: promo.id, name: promo.code },
            { discountPercent, expiresAt }
        );

        res.status(201).json({
            success: true,
            promo
        });

    } catch (err) {
        console.error('Create promo error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * PATCH /api/promos/:id/toggle
 * Toggle promo active status
 */
router.patch('/:id/toggle', requireSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const { data: promo, error: fetchError } = await supabaseAdmin
            .from('promos')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !promo) {
            return res.status(404).json({ error: 'Promo not found' });
        }

        const { error: updateError } = await supabaseAdmin
            .from('promos')
            .update({ active: !promo.active })
            .eq('id', id);

        if (updateError) {
            return res.status(500).json({ error: 'Failed to toggle promo' });
        }

        await logAudit(
            AUDIT_TYPES.PROMO_TOGGLED,
            req.user,
            { entity: 'promo', id: promo.id, name: promo.code },
            { nowActive: !promo.active }
        );

        res.json({
            success: true,
            active: !promo.active
        });

    } catch (err) {
        console.error('Toggle promo error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/promos/validate
 * Validate a promo code (public endpoint for onboarding)
 */
router.post('/validate', async (req, res) => {
    try {
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({ error: 'Code required' });
        }

        const { data: promo, error } = await supabaseAdmin
            .from('promos')
            .select('*')
            .eq('code', code.toUpperCase())
            .eq('active', true)
            .single();

        if (error || !promo) {
            return res.status(404).json({ error: 'Invalid promo code' });
        }

        // Check expiry
        if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
            return res.status(400).json({ error: 'Promo code expired' });
        }

        // Check max uses
        if (promo.max_uses && promo.usage_count >= promo.max_uses) {
            return res.status(400).json({ error: 'Promo code limit reached' });
        }

        res.json({
            valid: true,
            code: promo.code,
            discountPercent: promo.discount_percent
        });

    } catch (err) {
        console.error('Validate promo error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
