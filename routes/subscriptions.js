/**
 * HURE Core - Subscriptions Routes
 */

const express = require('express');
const router = express.Router();

const { supabaseAdmin } = require('../lib/supabase');
const { requireSuperAdmin } = require('../lib/auth');
const { logAudit, AUDIT_TYPES } = require('../lib/audit');
const { getPlanPrice } = require('../lib/plans');

/**
 * GET /api/subscriptions
 * List all subscriptions
 */
router.get('/', requireSuperAdmin, async (req, res) => {
    try {
        const { clinicId, status, limit = 50, offset = 0 } = req.query;

        let query = supabaseAdmin
            .from('subscriptions')
            .select(`
        *,
        clinic:clinics(id, name, email)
      `)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (clinicId) {
            query = query.eq('clinic_id', clinicId);
        }

        if (status && status !== 'all') {
            query = query.eq('status', status);
        }

        const { data: subscriptions, error } = await query;

        if (error) {
            console.error('List subscriptions error:', error);
            return res.status(500).json({ error: 'Failed to fetch subscriptions' });
        }

        res.json({ subscriptions });

    } catch (err) {
        console.error('List subscriptions error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * PATCH /api/subscriptions/:id/autorenew
 * Toggle auto-renewal
 */
router.patch('/:id/autorenew', requireSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { enabled } = req.body;

        const { data: subscription, error: fetchError } = await supabaseAdmin
            .from('subscriptions')
            .select('*, clinic:clinics(name)')
            .eq('id', id)
            .single();

        if (fetchError || !subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        const { error: updateError } = await supabaseAdmin
            .from('subscriptions')
            .update({ auto_renew: enabled })
            .eq('id', id);

        if (updateError) {
            return res.status(500).json({ error: 'Failed to update subscription' });
        }

        await logAudit(
            AUDIT_TYPES.AUTORENEW_TOGGLED,
            req.user,
            { entity: 'subscription', id, name: subscription.clinic?.name },
            { enabled }
        );

        res.json({
            success: true,
            message: `Auto-renewal ${enabled ? 'enabled' : 'disabled'}`
        });

    } catch (err) {
        console.error('Toggle autorenew error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * PATCH /api/subscriptions/:id/upgrade
 * Upgrade subscription plan
 */
router.patch('/:id/upgrade', requireSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { planKey, modules } = req.body;

        const { data: subscription, error: fetchError } = await supabaseAdmin
            .from('subscriptions')
            .select('*, clinic:clinics(name)')
            .eq('id', id)
            .single();

        if (fetchError || !subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        const newModules = modules || subscription.modules;
        const pricing = getPlanPrice(newModules, planKey);

        const { error: updateError } = await supabaseAdmin
            .from('subscriptions')
            .update({
                plan_key: planKey,
                modules: newModules,
                is_bundle: pricing.isBundle,
                base_amount: pricing.baseAmount,
                discount_percent: pricing.discountPercent,
                final_amount: pricing.finalAmount
            })
            .eq('id', id);

        if (updateError) {
            return res.status(500).json({ error: 'Failed to upgrade subscription' });
        }

        // Also update clinic
        await supabaseAdmin
            .from('clinics')
            .update({
                plan_key: planKey,
                modules: newModules,
                is_bundle: pricing.isBundle
            })
            .eq('id', subscription.clinic_id);

        res.json({
            success: true,
            message: 'Subscription upgraded',
            pricing
        });

    } catch (err) {
        console.error('Upgrade subscription error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
