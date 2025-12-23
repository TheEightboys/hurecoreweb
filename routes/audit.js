/**
 * HURE Core - Audit Routes
 */

const express = require('express');
const router = express.Router();

const { supabaseAdmin } = require('../lib/supabase');
const { requireSuperAdmin } = require('../lib/auth');

/**
 * GET /api/audit
 * List audit logs with filtering
 */
router.get('/', requireSuperAdmin, async (req, res) => {
    try {
        const { type, search, limit = 100, offset = 0 } = req.query;

        let query = supabaseAdmin
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (type && type !== 'all') {
            query = query.eq('type', type);
        }

        if (search) {
            query = query.or(`actor_name.ilike.%${search}%,target_name.ilike.%${search}%,type.ilike.%${search}%`);
        }

        const { data: logs, error } = await query;

        if (error) {
            console.error('List audit logs error:', error);
            return res.status(500).json({ error: 'Failed to fetch audit logs' });
        }

        res.json({ logs });

    } catch (err) {
        console.error('List audit error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/audit/types
 * Get list of unique audit types
 */
router.get('/types', requireSuperAdmin, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('audit_logs')
            .select('type')
            .order('type');

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch types' });
        }

        const types = [...new Set(data.map(d => d.type))];
        res.json({ types });

    } catch (err) {
        console.error('List audit types error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/api-logs
 * List API logs
 */
router.get('/api-logs', requireSuperAdmin, async (req, res) => {
    try {
        const { limit = 100, offset = 0 } = req.query;

        const { data: logs, error } = await supabaseAdmin
            .from('api_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch API logs' });
        }

        res.json({ logs });

    } catch (err) {
        console.error('List API logs error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
