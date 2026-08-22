require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error(
        'Missing Supabase env vars: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required.'
    );
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
