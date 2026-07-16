import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl) {
  throw new Error('[Legalyx-CMS] SUPABASE_URL n\'est pas définie dans les variables d\'environnement.');
}
if (!supabaseServiceKey) {
  throw new Error('[Legalyx-CMS] SUPABASE_SERVICE_ROLE_KEY n\'est pas définie dans les variables d\'environnement.');
}

// Client administrateur : contourne les politiques RLS pour les opérations serveur
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export default supabase;