import { createClient } from '@supabase/supabase-js'

// Set these in Vercel (Settings > Environment Variables) and in .env.local for `npm run dev`.
// The anon key is meant to be public. Your data is protected by the database rules
// in supabase/setup.sql, not by hiding this key.
const url = import.meta.env?.VITE_SUPABASE_URL
const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY

export const supabase = url && anonKey ? createClient(url, anonKey) : null
export const syncConfigured = Boolean(supabase)
