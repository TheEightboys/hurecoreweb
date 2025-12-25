/**
 * Seed East Africa locations for the clinic
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CLINIC_ID = '420306e8-1b86-4739-84b7-cba02f8c1d47';

const EAST_AFRICA_CITIES = [
    { name: 'Nairobi', town: 'Nairobi, Kenya', isPrimary: true },
    { name: 'Mombasa', town: 'Mombasa, Kenya', isPrimary: false },
    { name: 'Kisumu', town: 'Kisumu, Kenya', isPrimary: false },
    { name: 'Kampala', town: 'Kampala, Uganda', isPrimary: false },
    { name: 'Dar es Salaam', town: 'Dar es Salaam, Tanzania', isPrimary: false },
    { name: 'Kigali', town: 'Kigali, Rwanda', isPrimary: false },
    { name: 'Addis Ababa', town: 'Addis Ababa, Ethiopia', isPrimary: false },
    { name: 'Arusha', town: 'Arusha, Tanzania', isPrimary: false },
];

async function seedLocations() {
    console.log('🌍 Seeding East Africa locations...\n');

    for (const city of EAST_AFRICA_CITIES) {
        // Check if location already exists
        const { data: existing } = await supabaseAdmin
            .from('clinic_locations')
            .select('id')
            .eq('clinic_id', CLINIC_ID)
            .eq('name', city.name)
            .maybeSingle();

        if (existing) {
            console.log(`  ⏭️  ${city.name} already exists, skipping`);
            continue;
        }

        // Create location
        const { data, error } = await supabaseAdmin
            .from('clinic_locations')
            .insert({
                clinic_id: CLINIC_ID,
                name: city.name,
                town: city.town,
                is_primary: city.isPrimary,
                is_active: true
            })
            .select()
            .single();

        if (error) {
            console.log(`  ❌ Failed to add ${city.name}:`, error.message);
        } else {
            console.log(`  ✅ Added ${city.name} (${city.town})`);
        }
    }

    console.log('\n🎉 Location seeding complete!');
    process.exit(0);
}

seedLocations().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
