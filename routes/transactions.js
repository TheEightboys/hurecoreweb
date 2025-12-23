/**
 * HURE Core - Transactions Routes
 */

const express = require('express');
const router = express.Router();

const { supabaseAdmin } = require('../lib/supabase');
const { requireSuperAdmin } = require('../lib/auth');

/**
 * GET /api/transactions
 * List all transactions
 */
router.get('/', requireSuperAdmin, async (req, res) => {
    try {
        const { clinicId, status, limit = 50, offset = 0 } = req.query;

        let query = supabaseAdmin
            .from('transactions')
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

        const { data: transactions, error } = await query;

        if (error) {
            console.error('List transactions error:', error);
            return res.status(500).json({ error: 'Failed to fetch transactions' });
        }

        res.json({ transactions });

    } catch (err) {
        console.error('List transactions error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/transactions/:id
 * Get single transaction
 */
router.get('/:id', requireSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const { data: transaction, error } = await supabaseAdmin
            .from('transactions')
            .select(`
        *,
        clinic:clinics(id, name, email)
      `)
            .eq('id', id)
            .single();

        if (error || !transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        res.json({ transaction });

    } catch (err) {
        console.error('Get transaction error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
