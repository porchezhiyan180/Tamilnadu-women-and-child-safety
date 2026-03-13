const { createClient } = require('@supabase/supabase-js');

// Use environment variables for better security
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://uexrrvpavlmqjoapqcms.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_RzZC9YvR28LdbTXIrRkVAw_UOyU7jEe';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('Connected to the Supabase database.');

module.exports = supabase;

