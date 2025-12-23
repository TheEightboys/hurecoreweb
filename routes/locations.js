/**
 * HURE Core - Locations Routes
 * Multi-branch/location management
 */

const express = require('express');
const router = express.Router();

const { supabaseAdmin } = require('../lib/supabase');

/**
 * GET /api/clinics/:clinicId/locations
 * List clinic locations
 */
router.get('/:clinicId/locations', async (req, res) => {
    try {
        const { clinicId } = req.params;
        const { active } = req.query;

        let query = supabaseAdmin
            .from('clinic_locations')
            .select('*')
            .eq('clinic_id', clinicId)
            .order('is_primary', { ascending: false })
            .order('name', { ascending: true });

        if (active === 'true') {
            query = query.eq('is_active', true);
        }

        const { data, error } = await query;

        if (error) {
            console.error('List locations error:', error);
            return res.status(500).json({ error: 'Failed to fetch locations' });
        }

        res.json({ success: true, data });

    } catch (err) {
        console.error('List locations error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/clinics/:clinicId/locations
 * Create new location
 */
router.post('/:clinicId/locations', async (req, res) => {
    try {
        const { clinicId } = req.params;
        const { name, address, town, phone, email, isPrimary = false } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Location name is required' });
        }

        // If setting as primary, unset existing primary
        if (isPrimary) {
            await supabaseAdmin
                .from('clinic_locations')
                .update({ is_primary: false })
                .eq('clinic_id', clinicId)
                .eq('is_primary', true);
        }

        const { data, error } = await supabaseAdmin
            .from('clinic_locations')
            .insert({
                clinic_id: clinicId,
                name,
                address,
                town,
                phone,
                email,
                is_primary: isPrimary,
                is_active: true
            })
            .select()
            .single();

        if (error) {
            console.error('Create location error:', error);
            return res.status(500).json({ error: 'Failed to create location' });
        }

        // Update clinic location count
        await supabaseAdmin.rpc('increment_location_count', { clinic_uuid: clinicId });

        res.status(201).json({ success: true, data });

    } catch (err) {
        console.error('Create location error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * PATCH /api/clinics/:clinicId/locations/:locationId
 * Update location
 */
router.patch('/:clinicId/locations/:locationId', async (req, res) => {
    try {
        const { clinicId, locationId } = req.params;
        const { name, address, town, phone, email, isPrimary, isActive } = req.body;

        const updates = {
            updated_at: new Date().toISOString()
        };

        if (name !== undefined) updates.name = name;
        if (address !== undefined) updates.address = address;
        if (town !== undefined) updates.town = town;
        if (phone !== undefined) updates.phone = phone;
        if (email !== undefined) updates.email = email;
        if (isActive !== undefined) updates.is_active = isActive;

        // If setting as primary, unset existing primary first
        if (isPrimary === true) {
            await supabaseAdmin
                .from('clinic_locations')
                .update({ is_primary: false })
                .eq('clinic_id', clinicId)
                .eq('is_primary', true);

            updates.is_primary = true;
        }

        const { data, error } = await supabaseAdmin
            .from('clinic_locations')
            .update(updates)
            .eq('id', locationId)
            .eq('clinic_id', clinicId)
            .select()
            .single();

        if (error) {
            console.error('Update location error:', error);
            return res.status(500).json({ error: 'Failed to update location' });
        }

        res.json({ success: true, data });

    } catch (err) {
        console.error('Update location error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * DELETE /api/clinics/:clinicId/locations/:locationId
 * Delete location
 */
router.delete('/:clinicId/locations/:locationId', async (req, res) => {
    try {
        const { clinicId, locationId } = req.params;

        // Check if it's the primary location
        const { data: location } = await supabaseAdmin
            .from('clinic_locations')
            .select('is_primary')
            .eq('id', locationId)
            .eq('clinic_id', clinicId)
            .single();

        if (location?.is_primary) {
            return res.status(400).json({
                error: 'Cannot delete primary location. Set another location as primary first.'
            });
        }

        const { error } = await supabaseAdmin
            .from('clinic_locations')
            .delete()
            .eq('id', locationId)
            .eq('clinic_id', clinicId);

        if (error) {
            console.error('Delete location error:', error);
            return res.status(500).json({ error: 'Failed to delete location' });
        }

        res.json({ success: true, message: 'Location deleted' });

    } catch (err) {
        console.error('Delete location error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
