
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function updateClinics() {
    console.log('🔄 Updating clinics to pending_activation...');

    const emails = ['theboysofficialone@gmail.com', 'mani@test.com', 'test@test.com'];

    const { data, error } = await supabaseAdmin
        .from('clinics')
        .update({ status: 'pending_activation' })
        .in('email', emails)
        .select();

    if (error) {
        console.error('❌ Error updating clinics:', error);
    } else {
        console.log('✅ Successfully updated ' + data.length + ' clinics:');
        data.forEach(c => console.log(`   - ${c.name} (${c.email}) -> ${c.status}`));
    }
}

updateClinics();
