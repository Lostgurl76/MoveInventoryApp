import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lfpfozqoxqxelihfvted.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmcGZvenFveHF4ZWxpaGZ2dGVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MzM2NjMsImV4cCI6MjA5NDAwOTY2M30.eDOZJXUP3KtlBQKt8je-28Uh4Thn-eu8mtdLTTMlVpk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);