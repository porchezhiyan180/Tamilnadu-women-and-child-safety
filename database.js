const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://uexrrvpavlmqjoapqcms.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_RzZC9YvR28LdbTXIrRkVAw_UOyU7jEe';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('Connected to the Supabase database.');

module.exports = supabase;
