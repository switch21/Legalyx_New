-- =====================================================================
-- LEGALYX-CMS : Gestion utilisateurs — avatars + mot de passe
-- =====================================================================
-- 1. Crée un bucket Supabase Storage pour les photos de profil
-- 2. Politiques d'accès publique en lecture, upload authentifié
-- 3. RPC pour mettre à jour le mot de passe d'un utilisateur
--
-- PREREQUIS : migration_v1_to_v2.sql + auth_real.sql exécutées
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. BUCKET STORAGE : avatars
-- =====================================================================

-- Créer le bucket (public pour affichage direct dans l'UI)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  TRUE,
  2097152, -- 2 Mo max
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Politique : lecture publique (pour afficher les photos dans l'UI)
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- Politique : upload pour tout utilisateur authentifié
CREATE POLICY "avatars_authenticated_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
  );

-- Politique : suppression pour le propriétaire ou admin
CREATE POLICY "avatars_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'avatars');

-- Politique : mise à jour (remplacement de photo)
CREATE POLICY "avatars_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars');

-- =====================================================================
-- 2. RPC : update_user_password(user_id, new_password)
-- =====================================================================
-- Permet à l'admin de définir/réinitialiser le mot de passe d'un agent.
-- Le mot de passe n'est JAMAIS lu ni retourné au client.

CREATE OR REPLACE FUNCTION update_user_password(
  p_user_id    VARCHAR(50),
  p_new_password VARCHAR(255)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF LENGTH(p_new_password) < 4 THEN
    RAISE EXCEPTION 'Le mot de passe doit contenir au moins 4 caractères.';
  END IF;

  UPDATE users
    SET password = p_new_password
    WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

-- =====================================================================
-- 3. RPC : update_user_profile (édition complète)
-- =====================================================================
-- Met à jour toutes les informations modifiables d'un utilisateur.
-- Sécurité : ne modifie jamais l'id ni le username.

CREATE OR REPLACE FUNCTION update_user_profile(
  p_user_id             VARCHAR(50),
  p_full_name           VARCHAR(150),
  p_role                VARCHAR(50),
  p_tribunal            VARCHAR(200),
  p_avatar              TEXT,
  p_mfa_enabled         BOOLEAN,
  p_biometric_registered BOOLEAN,
  p_active              BOOLEAN DEFAULT TRUE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE users
  SET full_name = p_full_name,
      role = p_role,
      tribunal = p_tribunal,
      avatar = p_avatar,
      mfa_enabled = p_mfa_enabled,
      biometric_registered = p_biometric_registered,
      active = p_active
  WHERE id = p_user_id;

  RETURN FOUND;
END;
$$;

-- =====================================================================
-- 4. GRANTs pour le rôle anon
-- =====================================================================

GRANT EXECUTE ON FUNCTION update_user_password(VARCHAR, VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION update_user_profile(VARCHAR, VARCHAR, VARCHAR, VARCHAR, TEXT, BOOLEAN, BOOLEAN, BOOLEAN) TO anon;

COMMIT;