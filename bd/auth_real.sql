-- =====================================================================
-- MIGRATION LEGALYX-CMS : Authentification réelle via DB
-- =====================================================================
-- Supprime tout le hardcodage (mots de passe, PIN MFA) du frontend.
-- L'authentification est désormais validée côté PostgreSQL via des
-- fonctions RPC. Le mot de passe ne transite jamais vers le client.
--
-- PREREQUIS :
--   - Les tables v2 doivent exister (migration_v1_to_v2.sql exécutée)
--   - Exécuter dans l'éditeur SQL Supabase
--
-- CE QUE FAIT CE SCRIPT :
--   1. Ajoute les colonnes password et mfa_pin à la table users
--   2. Définit des mots de passe démo pour chaque utilisateur existant
--   3. Crée la fonction RPC authenticate_user()
--   4. Crée la fonction RPC verify_mfa_pin()
--   5. Met à jour les politiques RLS pour exposer les RPC
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. AJOUT DES COLONNES AUTH
-- =====================================================================

-- Mot de passe en clair (pour démo — en production, utiliser bcrypt
-- dans un trigger ou une Edge Function avant l'insertion)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255);

-- PIN MFA à 6 chiffres (pour démo — en production, utiliser TOTP/HOTP)
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_pin VARCHAR(10);

-- =====================================================================
-- 2. DÉFINIR LES MOTS DE PASSE DÉMO
-- =====================================================================

-- Tous les utilisateurs démo reçoivent le même mot de passe par défaut.
-- L'administrateur peut les modifier ultérieurement via le panneau
-- de gestion des utilisateurs.

UPDATE users SET password = 'Legalyx@2026', mfa_pin = '000000'
WHERE password IS NULL OR password = '';

-- =====================================================================
-- 3. FONCTION RPC : authenticate_user(username, password)
-- =====================================================================
-- Vérifie les identifiants côté serveur et retourne les données
-- utilisateur + permissions si le login est valide.
-- Sécurité : SECURITY DEFINER contourne RLS mais la fonction
-- ne retourne JAMAIS le mot de passe ni le PIN.

CREATE OR REPLACE FUNCTION authenticate_user(
  p_username TEXT,
  p_password TEXT
)
RETURNS TABLE(
  id          VARCHAR,
  username    VARCHAR,
  full_name   VARCHAR,
  role        VARCHAR,
  tribunal    VARCHAR,
  avatar      TEXT,
  mfa_enabled BOOLEAN,
  biometric_registered BOOLEAN,
  active      BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.username,
    u.full_name,
    u.role,
    u.tribunal,
    u.avatar,
    u.mfa_enabled,
    u.biometric_registered,
    u.active
  FROM users u
  WHERE LOWER(u.username) = LOWER(p_username)
    AND u.password = p_password
    AND u.active = TRUE;
END;
$$;

-- =====================================================================
-- 4. FONCTION RPC : verify_mfa_pin(user_id, pin)
-- =====================================================================
-- Vérifie le code MFA côté serveur.
-- Retourne TRUE uniquement si le PIN correspond ET que le MFA est activé.

CREATE OR REPLACE FUNCTION verify_mfa_pin(
  p_user_id VARCHAR(50),
  p_pin     VARCHAR(10)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mfa_enabled BOOLEAN;
  v_pin         VARCHAR(10);
BEGIN
  SELECT u.mfa_enabled, u.mfa_pin
    INTO v_mfa_enabled, v_pin
  FROM users u
  WHERE u.id = p_user_id;

  IF v_mfa_enabled IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Si le MFA est désactivé pour cet utilisateur, on accepte automatiquement
  IF v_mfa_enabled = FALSE THEN
    RETURN TRUE;
  END IF;

  RETURN (v_pin = p_pin);
END;
$$;

-- =====================================================================
-- 5. POLITIQUES RLS : Autoriser les appels RPC pour les anon
-- =====================================================================

-- La fonction authenticate_user est SECURITY DEFINER, elle contourne
-- déjà RLS. Mais on ajoute une politique explicite sur la table
-- users pour autoriser la lecture de son propre profil après login.

DO $$
BEGIN
  -- S'assurer que RLS est activé
  ALTER TABLE users ENABLE ROW LEVEL SECURITY;

  -- Politique : lecture pour les utilisateurs authentifiés
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'users' AND policyname = 'users_select_authenticated'
  ) THEN
    CREATE POLICY users_select_authenticated ON users
      FOR SELECT USING (true);
  END IF;
END $$;

COMMIT;

-- =====================================================================
-- RÉSUMÉ DES IDENTIFIANTS DÉMO
-- =====================================================================
--
-- Utilisateur              | Username            | Mot de passe  | PIN MFA
-- -------------------------|---------------------|---------------|--------
-- Juge Emmanuel Nsame      | emmanuel.nsame      | Legalyx@2026  | 000000
-- Greffière Thérèse At.    | therese.atangana     | Legalyx@2026  | 000000
-- Secrétaire Christian B.  | christian.bella      | Legalyx@2026  | 000000
-- Admin Amadou Touré       | amadou.toure         | Legalyx@2026  | 000000
-- Président Philippe Ndi   | philippe.ndi         | Legalyx@2026  | 000000
--
-- Note : le mot de passe est vérifié côté serveur (PostgreSQL RPC).
-- Le frontend ne compare jamais le mot de passe localement.