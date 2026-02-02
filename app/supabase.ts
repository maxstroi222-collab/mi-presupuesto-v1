import { createClient } from '@supabase/supabase-js'

// PEGA AQUÍ TUS DATOS REALES DE SUPABASE (COPIALOS DEL DASHBOARD)
const supabaseUrl = "https://bddbbrqnedurdbtcxuav.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkZGJicnFuZWR1cmRidGN4dWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNjI3OTEsImV4cCI6MjA4NTYzODc5MX0.2s48IyzLPBd0Y80wwgNim7GFP5xbLpdMOD1MOjI3Xfs"

export const supabase = createClient(supabaseUrl, supabaseKey)
