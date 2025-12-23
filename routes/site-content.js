/**
 * HURE Core - Site Content Routes
 * Marketing site content management
 */

const express = require('express');
const router = express.Router();

const { supabaseAdmin } = require('../lib/supabase');
const { requireSuperAdmin } = require('../lib/auth');
const { logAudit, AUDIT_TYPES } = require('../lib/audit');

/**
 * GET /api/site-content
 * Get all site content (public endpoint)
 */
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('site_content')
            .select('key, value');

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch content' });
        }

        // Convert to object
        const content = {};
        data.forEach(item => {
            content[item.key] = item.value;
        });

        res.json(content);

    } catch (err) {
        console.error('Get site content error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * PATCH /api/site-content
 * Update site content
 */
router.patch('/', requireSuperAdmin, async (req, res) => {
    try {
        const updates = req.body;

        if (!updates || typeof updates !== 'object') {
            return res.status(400).json({ error: 'Invalid update data' });
        }

        // Update each key
        for (const [key, value] of Object.entries(updates)) {
            await supabaseAdmin
                .from('site_content')
                .upsert({
                    key,
                    value,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'key'
                });
        }

        await logAudit(
            AUDIT_TYPES.SITE_CONTENT_UPDATED,
            req.user,
            { entity: 'site_content', id: null, name: 'Marketing Content' },
            { keys: Object.keys(updates) }
        );

        res.json({
            success: true,
            message: 'Content updated'
        });

    } catch (err) {
        console.error('Update site content error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
