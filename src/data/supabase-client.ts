import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Only the public anon key is ever used here. It is meant to be public: row level security is what protects the data.
// The service role key must never appear in the app (it is only for the Edge Function and the scripts).
export function createSupabaseClient(url: string, anonKey: string): SupabaseClient {
  const client = createClient(url, anonKey, {
    auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  });
  // refresh the login only while the app is in front
  AppState.addEventListener('change', (state) => {
    if (state === 'active') client.auth.startAutoRefresh();
    else client.auth.stopAutoRefresh();
  });
  return client;
}
