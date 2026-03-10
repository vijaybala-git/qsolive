import { createClient } from '@supabase/supabase-js'

// Supabase connection: use env vars (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY), or code in URL and anon key below.
// Anon key is safe in the frontend; RLS and Auth protect data. Users only set their callsign to upload.
const BUILTIN_SUPABASE_URL = ''      // e.g. 'https://YOUR-PROJECT.supabase.co'
const BUILTIN_SUPABASE_ANON_KEY = '' // Supabase Dashboard → Settings → API → anon public

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || BUILTIN_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || BUILTIN_SUPABASE_ANON_KEY

/* eslint-disable no-console */
console.debug('Supabase URL present?', !!supabaseUrl)
console.debug('Supabase anon key present?', !!supabaseAnonKey)

export const supabase = createClient(supabaseUrl, supabaseAnonKey)