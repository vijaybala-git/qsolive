import { createClient } from '@supabase/supabase-js'

// Supabase connection: use env vars (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
// When "Legacy API Key disabled" in Supabase: use the new anon key from
// Dashboard → Settings → API → Project API keys (anon public), and set
// VITE_SUPABASE_ANON_KEY in Vercel (and .env.local for dev).
const BUILTIN_SUPABASE_URL = ''
const BUILTIN_SUPABASE_ANON_KEY = ''

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || BUILTIN_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || BUILTIN_SUPABASE_ANON_KEY

/* eslint-disable no-console */
console.debug('Supabase URL present?', !!supabaseUrl)
console.debug('Supabase anon key present?', !!supabaseAnonKey)

export const supabase = createClient(supabaseUrl, supabaseAnonKey)