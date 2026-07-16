import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[Legalyx-CMS] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY non définies.\n' +
    'Créez un fichier .env.local à la racine du projet avec :\n' +
    '  VITE_SUPABASE_URL=https://votre-projet.supabase.co\n' +
    '  VITE_SUPABASE_ANON_KEY=votre-cle-anon'
  );
}

// Client frontend : utilise la clé anon, respecte les politiques RLS
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export default supabase;