import { createClient } from '@supabase/supabase-js'

// These are safe to expose in the frontend (Anon key)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Debug helper: log whether Vite env vars are present (avoid printing full anon key)
/* eslint-disable no-console */
console.debug('VITE_SUPABASE_URL present?', !!supabaseUrl, 'length:', supabaseUrl ? supabaseUrl.length : 0)
console.debug('VITE_SUPABASE_ANON_KEY present?', !!supabaseAnonKey, 'length:', supabaseAnonKey ? supabaseAnonKey.length : 0)

export const supabase = createClient(supabaseUrl, supabaseAnonKey)