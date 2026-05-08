import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lgpksrzqjqoznabrsacg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxncGtzcnpxanFvem5hYnJzYWNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMTM3MzEsImV4cCI6MjA5Mzc4OTczMX0.BYIzbSyXH5F26ReArAj0SiIyhO544MRePAK0mD1Srpk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);