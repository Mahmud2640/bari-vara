/// <reference types="node" />
// Run with: npm run seed -- you@example.com        (needs your own Supabase project: see replica/backend.md)
// Fills ONE account with realistic fake data (no real people) so you can explore the real app.
// Creates the account if it does not exist, signs in as it without needing an email code, then adds the sample data.
// Refuses to touch an account that already has properties.
import { createClient } from '@supabase/supabase-js';
import { createSupabaseLayer } from '../src/data/supabase';
import { seedSample } from '../src/data/sample';

const email = process.argv[2];
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!email || !url || !anon || !service) {
  console.error('Usage: npm run seed -- you@example.com   (and set the keys, see replica/backend.md)');
  process.exit(2);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } } as const;
const admin = createClient(url, service, opts);

// create the account if needed (an "already registered" error just means it exists)
const created = await admin.auth.admin.createUser({ email, email_confirm: true });
if (created.error && !/already|registered|exists/i.test(created.error.message)) {
  console.error('Could not create the account:', created.error.message);
  process.exit(1);
}

// a one-time sign-in token for this account, so the script acts as them under row level security
const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
const tokenHash = link.data?.properties?.hashed_token;
if (link.error || !tokenHash) {
  console.error('Could not sign in as the account:', link.error?.message);
  process.exit(1);
}
const client = createClient(url, anon, opts);
const verified = await client.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
if (verified.error) {
  console.error('Could not sign in as the account:', verified.error.message);
  process.exit(1);
}

const layer = createSupabaseLayer(client);
if ((await layer.listProperties()).length > 0) {
  console.error('This account already has data. Nothing was changed.');
  process.exit(1);
}
await seedSample(layer);
const props = await layer.listProperties();
console.log(`Added ${props.length} properties with flats, tenants, bills and payments to ${email}.`);
