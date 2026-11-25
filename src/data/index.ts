import AsyncStorage from '@react-native-async-storage/async-storage';
import { createFakeLayer } from './fake';
import { createSupabaseLayer } from './supabase';
import { createSupabaseClient } from './supabase-client';
import type { DataLayer } from './types';

// The one place that decides which data layer the app uses.
// Both EXPO_PUBLIC_ variables set  -> the real Supabase layer.   Not set -> the demo layer (data stays on this device).
// The names are written out in full on purpose: Expo only inlines them when they appear literally.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const IS_DEMO = !(url && anonKey);

export const data: DataLayer = IS_DEMO
  ? createFakeLayer({ get: (k) => AsyncStorage.getItem(k), set: (k, v) => AsyncStorage.setItem(k, v) })
  : createSupabaseLayer(createSupabaseClient(url!, anonKey!));

export * from './types';
export { DEMO_CODE } from './fake';
