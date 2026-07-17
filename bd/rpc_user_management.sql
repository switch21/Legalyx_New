-- =====================================================================
-- RPC LEGALYX-CMS : Gestion des utilisateurs (update + password)
-- =====================================================================
-- Fonctions RPC nécessaires pour la modification des profils
-- utilisateurs et la mise à jour des mots de passe depuis le
-- panneau d'administration.
--
-- PREREQUIS : auth_real.sql déjà exécuté
-- EXECUTION : Coller dans l'éditeur SQL Supabase
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. RPC : update_user_profile
-- =====================================================================
-- Met à jour les informations d'un utilisateur existant.
-- SECURITY DEFINER contourne RLS pour permettre la mise à jour
-- depuis le rôle anon.

DROP FUNCTION IF EXISTS update_user_profile(VARCHAR, VARCHAR, VARCHAR, VARCHAR, TEXT, BOOLEAN, BOOLEAN, BOOLEAN);
CREATE OR REPLACE FUNCTION update_user_profile(
  p_user_id           VARCHAR(50),
  p_full_name         VARCHAR,
  p_role              VARCHAR,
  p_tribunal          VARCHAR,
  p_avatar            TEXT,
  p_mfa_enabled       BOOLEAN,
  p_biometric_registered BOOLEAN,
  p_active            BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE users
  SET
    full_name          = p_full_name,
    role               = p_role,
    tribunal           = p_tribunal,
    avatar             = p_avatar,
    mfa_enabled        = p_mfa_enabled,
    biometric_registered = p_biometric_registered,
    active             = p_active,
    updated_at         = NOW()
  WHERE id = p_user_id;

  RETURN FOUND;
END;
$$;

-- =====================================================================
-- 2. RPC : update_user_password
-- =====================================================================
-- Met à jour le mot de passe d'un utilisateur.
-- Sécurité : SECURITY DEFINER contourne RLS.

DROP FUNCTION IF EXISTS update_user_password(VARCHAR, VARCHAR);
CREATE OR REPLACE FUNCTION update_user_password(
  p_user_id     VARCHAR(50),
  p_new_password VARCHAR(255)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE users
  SET
    password   = p_new_password,
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN FOUND;
END;
$$;

-- =====================================================================
-- 3. RLS : Politique d'update pour les anon sur users
-- =====================================================================
-- Permet les mises à jour directes (toggle active, delete)
-- via le client Supabase avec le rôle anon.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'users' AND policyname = 'users_update_all'
  ) THEN
    CREATE POLICY users_update_all ON users
      FOR UPDATE USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'users' AND policyname = 'users_insert_all'
  ) THEN
    CREATE POLICY users_insert_all ON users
      FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'users' AND policyname = 'users_delete_all'
  ) THEN
    CREATE POLICY users_delete_all ON users
      FOR DELETE USING (true);
  END IF;

  -- Politiques pour user_permissions
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_permissions' AND policyname = 'user_permissions_select_all'
  ) THEN
    CREATE POLICY user_permissions_select_all ON user_permissions
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_permissions' AND policyname = 'user_permissions_insert_all'
  ) THEN
    CREATE POLICY user_permissions_insert_all ON user_permissions
      FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_permissions' AND policyname = 'user_permissions_update_all'
  ) THEN
    CREATE POLICY user_permissions_update_all ON user_permissions
      FOR UPDATE USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_permissions' AND policyname = 'user_permissions_delete_all'
  ) THEN
    CREATE POLICY user_permissions_delete_all ON user_permissions
      FOR DELETE USING (true);
  END IF;
END $$;

-- =====================================================================
-- 4. GRANT EXECUTE sur les RPC pour le rôle anon
-- =====================================================================

GRANT EXECUTE ON FUNCTION update_user_profile(
  VARCHAR, VARCHAR, VARCHAR, VARCHAR, TEXT, BOOLEAN, BOOLEAN, BOOLEAN
) TO anon;

GRANT EXECUTE ON FUNCTION update_user_password(
  VARCHAR, VARCHAR
) TO anon;

COMMIT;

-- =====================================================================
-- RÉSUMÉ
-- =====================================================================
-- update_user_profile(p_user_id, p_full_name, p_role, p_tribunal,
--   p_avatar, p_mfa_enabled, p_biometric_registered, p_active)
--   → Met à jour le profil d'un utilisateur. Retourne BOOLEAN.
--
-- update_user_password(p_user_id, p_new_password)
--   → Met à jour le mot de passe. Retourne BOOLEAN.
--
-- Politiques RLS ajoutées sur users et user_permissions
-- pour permettre CRUD complet via le rôle anon.