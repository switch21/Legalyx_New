-- =====================================================================
-- MIGRATION LEGALYX-CMS : v1 → v2
-- =====================================================================
-- Ce script migre la base de données du schéma v1 (UUID, ENUM, 
-- colonnes plates) vers le schéma v2 (VARCHAR PK, CHECK, 
-- tables normalisées).
--
-- PREREQUIS :
--   - Exécuter dans l'éditeur SQL Supabase (SQL Editor)
--   - Aucune donnée réelle ne doit être présente (prototype en mémoire)
--
-- CE QUE FAIT CE SCRIPT :
--   1. Supprime les objets v1 (tables, index, types ENUM)
--   2. Crée les 7 tables du schéma v2
--   3. Ajoute les indexes de performance
--   4. Ajoute les politiques RLS (Row Level Security) Supabase
--   5. Insère les données de seed (utilisateurs, tribunal, logs genesis)
-- =====================================================================

BEGIN;

-- =====================================================================
-- PHASE 1 : NETTOYAGE DU SCHEMA v1
-- =====================================================================

-- Supprimer les index existants (ignorer les erreurs si absents)
DROP INDEX IF EXISTS idx_activities_timestamp;
DROP INDEX IF EXISTS idx_hearings_date;
DROP INDEX IF EXISTS idx_hearings_case;
DROP INDEX IF EXISTS idx_documents_hearing;
DROP INDEX IF EXISTS idx_documents_case;
DROP INDEX IF EXISTS idx_cases_num_dossier;
DROP INDEX IF EXISTS idx_users_username;

-- Supprimer les tables v1 dans l'ordre respectant les FK
DROP TABLE IF EXISTS activities    CASCADE;
DROP TABLE IF EXISTS documents     CASCADE;
DROP TABLE IF EXISTS hearings      CASCADE;
DROP TABLE IF EXISTS cases         CASCADE;
DROP TABLE IF EXISTS users         CASCADE;

-- Supprimer les types ENUM v1
DROP TYPE IF EXISTS hearing_status CASCADE;
DROP TYPE IF EXISTS user_role      CASCADE;

-- =====================================================================
-- PHASE 2 : CREATION DU SCHEMA v2
-- =====================================================================

-- -----------------------------------------------------------------
-- 2.1 TABLE : users
-- Agents et magistrats du système judiciaire
-- -----------------------------------------------------------------
CREATE TABLE users (
    id              VARCHAR(50)   PRIMARY KEY,
    username        VARCHAR(100)  UNIQUE NOT NULL,
    full_name       VARCHAR(150)  NOT NULL,
    role            VARCHAR(50)   CHECK (role IN ('Président', 'Juge', 'Greffier', 'Secrétaire', 'Administrateur')) NOT NULL,
    tribunal        VARCHAR(200)  NOT NULL,
    avatar          TEXT,
    mfa_enabled     BOOLEAN       DEFAULT TRUE,
    biometric_registered BOOLEAN  DEFAULT TRUE,
    password_hash   VARCHAR(255)  NOT NULL,
    active          BOOLEAN       DEFAULT TRUE,
    created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------
-- 2.2 TABLE : user_permissions
-- Habilitations granulaires par utilisateur (séparée de users)
-- -----------------------------------------------------------------
CREATE TABLE user_permissions (
    id                  VARCHAR(50) PRIMARY KEY,
    user_id             VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    can_create_cases    BOOLEAN DEFAULT FALSE NOT NULL,
    can_delete_cases    BOOLEAN DEFAULT FALSE NOT NULL,
    can_edit_plumitif   BOOLEAN DEFAULT FALSE NOT NULL,
    can_manage_hearings BOOLEAN DEFAULT FALSE NOT NULL,
    can_upload_documents BOOLEAN DEFAULT FALSE NOT NULL,
    can_verify_integrity BOOLEAN DEFAULT FALSE NOT NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- -----------------------------------------------------------------
-- 2.3 TABLE : cases
-- Dossiers judiciaires
-- -----------------------------------------------------------------
CREATE TABLE cases (
    id                  VARCHAR(50)   PRIMARY KEY,
    num_dossier         VARCHAR(100)  UNIQUE NOT NULL,
    title               VARCHAR(255)  NOT NULL,
    description         TEXT,
    tribunal            VARCHAR(200)  NOT NULL,
    nature              VARCHAR(100)  NOT NULL,
    status              VARCHAR(50)   DEFAULT 'En cours',
    parties             TEXT          NOT NULL,
    priority            VARCHAR(20)   DEFAULT 'Moyenne',
    notes_deliberation  TEXT,
    magistrat_id        VARCHAR(50)   REFERENCES users(id),
    created_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------
-- 2.4 TABLE : hearings
-- Audiences planifiées et passées
-- -----------------------------------------------------------------
CREATE TABLE hearings (
    id              VARCHAR(50)   PRIMARY KEY,
    case_id         VARCHAR(50)   NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    date            DATE          NOT NULL,
    time            TIME          NOT NULL,
    type            VARCHAR(100)  NOT NULL,
    status          VARCHAR(50)   DEFAULT 'Planifiée',
    location        VARCHAR(100)  NOT NULL,
    notes           TEXT,
    recording_url   TEXT,
    transcript      TEXT,
    signature_hash  VARCHAR(64),
    signed_by       VARCHAR(150),
    signed_at       TIMESTAMP,
    attendees       TEXT,
    metadata        TEXT,
    created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------
-- 2.5 TABLE : case_documents
-- Pièces jointes et preuves numérisées
-- -----------------------------------------------------------------
CREATE TABLE case_documents (
    id              VARCHAR(50)   PRIMARY KEY,
    case_id         VARCHAR(50)   NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    hearing_id      VARCHAR(50)   REFERENCES hearings(id) ON DELETE SET NULL,
    name            VARCHAR(255)  NOT NULL,
    type            VARCHAR(100)  NOT NULL,
    size            VARCHAR(50)   NOT NULL,
    hash            VARCHAR(64)   NOT NULL,
    uploaded_by     VARCHAR(150)  NOT NULL,
    secure          BOOLEAN       DEFAULT TRUE,
    uploaded_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------
-- 2.6 TABLE : activity_logs
-- Journal de traçabilité / audit (style blockchain)
-- -----------------------------------------------------------------
CREATE TABLE activity_logs (
    id              VARCHAR(50)   PRIMARY KEY,
    timestamp       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    action          VARCHAR(255)  NOT NULL,
    username        VARCHAR(100)  NOT NULL,
    details         TEXT,
    category        VARCHAR(100)  NOT NULL,
    severity        VARCHAR(20)   DEFAULT 'INFO',
    ip_address      VARCHAR(45),
    user_agent      TEXT,
    integrity_hash  VARCHAR(64)   NOT NULL
);

-- -----------------------------------------------------------------
-- 2.7 TABLE : court_profiles
-- Profils des tribunaux (manquant dans v1 ET v2, mais requis par l'app)
-- -----------------------------------------------------------------
CREATE TABLE court_profiles (
    id                  VARCHAR(50)   PRIMARY KEY,
    name                VARCHAR(255)  NOT NULL,
    type                VARCHAR(200)  NOT NULL,
    president           VARCHAR(200)  NOT NULL,
    address             TEXT,
    phone               VARCHAR(50),
    email               VARCHAR(200),
    jurisdiction_region VARCHAR(100),
    founding_date       DATE,
    active_chambers     TEXT[],       -- Array PostgreSQL des chambres actives
    created_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================
-- PHASE 3 : INDEX DE PERFORMANCE
-- =====================================================================

-- Utilisateurs
CREATE INDEX idx_users_username   ON users(username);
CREATE INDEX idx_users_role       ON users(role);
CREATE INDEX idx_users_tribunal   ON users(tribunal);

-- Dossiers
CREATE INDEX idx_cases_num_dossier ON cases(num_dossier);
CREATE INDEX idx_cases_nature      ON cases(nature);
CREATE INDEX idx_cases_status      ON cases(status);
CREATE INDEX idx_cases_magistrat   ON cases(magistrat_id);
CREATE INDEX idx_cases_tribunal    ON cases(tribunal);

-- Audiences
CREATE INDEX idx_hearings_case  ON hearings(case_id);
CREATE INDEX idx_hearings_date  ON hearings(date);
CREATE INDEX idx_hearings_status ON hearings(status);

-- Documents
CREATE INDEX idx_documents_case    ON case_documents(case_id);
CREATE INDEX idx_documents_hearing ON case_documents(hearing_id);

-- Logs d'audit
CREATE INDEX idx_logs_timestamp ON activity_logs(timestamp DESC);
CREATE INDEX idx_logs_category  ON activity_logs(category);
CREATE INDEX idx_logs_user      ON activity_logs(username);

-- Permissions
CREATE INDEX idx_permissions_user ON user_permissions(user_id);

-- =====================================================================
-- PHASE 4 : POLITIQUES RLS (Row Level Security) SUPABASE
-- =====================================================================

-- Activer RLS sur toutes les tables
ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases           ENABLE ROW LEVEL SECURITY;
ALTER TABLE hearings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_documents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_profiles  ENABLE ROW LEVEL SECURITY;

-- 4.1 USERS : tous les rôles authentifiés peuvent lire les profils publics
-- L'écriture est réservée à l'Administrateur
CREATE POLICY "users_select_all_authenticated" ON users
    FOR SELECT USING (true);

CREATE POLICY "users_admin_insert" ON users
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE auth.uid()::text = id AND role = 'Administrateur')
    );

CREATE POLICY "users_admin_update" ON users
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM users WHERE auth.uid()::text = id AND role = 'Administrateur')
    );

CREATE POLICY "users_admin_delete" ON users
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM users WHERE auth.uid()::text = id AND role = 'Administrateur')
    );

-- 4.2 USER_PERMISSIONS : lecture par soi-même, écriture par admin
CREATE POLICY "perms_self_read" ON user_permissions
    FOR SELECT USING (
        user_id = auth.uid()::text
        OR EXISTS (SELECT 1 FROM users WHERE auth.uid()::text = id AND role = 'Administrateur')
    );

CREATE POLICY "perms_admin_manage" ON user_permissions
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE auth.uid()::text = id AND role = 'Administrateur')
    );

-- 4.3 CASES : lecture pour Juge/Greffier/Secrétaire/Président, écriture restreinte
CREATE POLICY "cases_read_judicial_staff" ON cases
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE auth.uid()::text = id 
            AND role IN ('Juge', 'Greffier', 'Secrétaire', 'Président', 'Administrateur'))
    );

CREATE POLICY "cases_create_authorized" ON cases
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u 
            JOIN user_permissions p ON p.user_id = u.id
            WHERE u.id = auth.uid()::text AND p.can_create_cases = true
        )
    );

CREATE POLICY "cases_update_authorized" ON cases
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM users WHERE auth.uid()::text = id)
    );

-- 4.4 HEARINGS : même logique que cases
CREATE POLICY "hearings_read_judicial_staff" ON hearings
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE auth.uid()::text = id 
            AND role IN ('Juge', 'Greffier', 'Secrétaire', 'Président', 'Administrateur'))
    );

CREATE POLICY "hearings_manage_authorized" ON hearings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u 
            JOIN user_permissions p ON p.user_id = u.id
            WHERE u.id = auth.uid()::text AND p.can_manage_hearings = true
        )
    );

-- 4.5 CASE_DOCUMENTS : lecture par personnel, upload par habilités
CREATE POLICY "docs_read_judicial_staff" ON case_documents
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE auth.uid()::text = id 
            AND role IN ('Juge', 'Greffier', 'Secrétaire', 'Président', 'Administrateur'))
    );

CREATE POLICY "docs_upload_authorized" ON case_documents
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u 
            JOIN user_permissions p ON p.user_id = u.id
            WHERE u.id = auth.uid()::text AND p.can_upload_documents = true
        )
    );

CREATE POLICY "docs_delete_authorized" ON case_documents
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users u 
            JOIN user_permissions p ON p.user_id = u.id
            WHERE u.id = auth.uid()::text AND p.can_delete_cases = true
        )
    );

-- 4.6 ACTIVITY_LOGS : lecture admin uniquement, insertion par tout utilisateur authentifié
CREATE POLICY "logs_admin_read" ON activity_logs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE auth.uid()::text = id AND role = 'Administrateur')
    );

CREATE POLICY "logs_system_insert" ON activity_logs
    FOR INSERT WITH CHECK (true);

-- 4.7 COURT_PROFILES : lecture pour tous les authentifiés, écriture admin
CREATE POLICY "courts_read_all_authenticated" ON court_profiles
    FOR SELECT USING (true);

CREATE POLICY "courts_admin_manage" ON court_profiles
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE auth.uid()::text = id AND role = 'Administrateur')
    );

-- =====================================================================
-- PHASE 5 : DONNEES DE SEED (utilisateurs par défaut + tribunal)
-- =====================================================================

-- 5.1 Utilisateurs par défaut
INSERT INTO users (id, username, full_name, role, tribunal, avatar, password_hash, active, mfa_enabled, biometric_registered) VALUES
    ('u1', 'emmanuel.nsame',       'M. le Juge Emmanuel Nsame',         'Juge',          'TGI du Mfoundi (Yaoundé)',       'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=120', '$2b$12$LJ3m5ys2LkG9RrLqT6W3XeZ7p1K9w0mN5b8v2q4x6zA0c3E5g7I9', TRUE,  TRUE, TRUE),
    ('u2', 'therese.atangana',      'Mme Thérèse Atangana',             'Greffier',      'TGI du Mfoundi (Yaoundé)',       'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=120', '$2b$12$LJ3m5ys2LkG9RrLqT6W3XeZ7p1K9w0mN5b8v2q4x6zA0c3E5g7I9', TRUE,  TRUE, TRUE),
    ('u3', 'christian.bella',       'M. Christian Bella',                'Secrétaire',    'TGI du Mfoundi (Yaoundé)',       'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=120', '$2b$12$LJ3m5ys2LkG9RrLqT6W3XeZ7p1K9w0mN5b8v2q4x6zA0c3E5g7I9', TRUE,  TRUE, TRUE),
    ('u4', 'amadou.toure',          'Me Amadou Touré',                   'Administrateur', 'Ministère de la Justice (MINJUSTICE)', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=120', '$2b$12$LJ3m5ys2LkG9RrLqT6W3XeZ7p1K9w0mN5b8v2q4x6zA0c3E5g7I9', TRUE, TRUE, TRUE),
    ('u5', 'philippe.ndi',          'M. le Président Philippe Ndi',      'Président',     'TGI du Mfoundi (Yaoundé)',       'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=120', '$2b$12$LJ3m5ys2LkG9RrLqT6W3XeZ7p1K9w0mN5b8v2q4x6zA0c3E5g7I9', TRUE, TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 5.2 Permissions par rôle (selon la logique métier existante dans server.ts)
-- Administrateur : audit uniquement
INSERT INTO user_permissions (id, user_id, can_create_cases, can_delete_cases, can_edit_plumitif, can_manage_hearings, can_upload_documents, can_verify_integrity) VALUES
    ('perm_u4', 'u4', FALSE, FALSE, FALSE, FALSE, FALSE, TRUE)
ON CONFLICT (user_id) DO NOTHING;

-- Président : tous les droits
INSERT INTO user_permissions (id, user_id, can_create_cases, can_delete_cases, can_edit_plumitif, can_manage_hearings, can_upload_documents, can_verify_integrity) VALUES
    ('perm_u5', 'u5', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE)
ON CONFLICT (user_id) DO NOTHING;

-- Juge : tous les droits sauf suppression
INSERT INTO user_permissions (id, user_id, can_create_cases, can_delete_cases, can_edit_plumitif, can_manage_hearings, can_upload_documents, can_verify_integrity) VALUES
    ('perm_u1', 'u1', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE)
ON CONFLICT (user_id) DO NOTHING;

-- Greffier : pas de suppression, tout le reste
INSERT INTO user_permissions (id, user_id, can_create_cases, can_delete_cases, can_edit_plumitif, can_manage_hearings, can_upload_documents, can_verify_integrity) VALUES
    ('perm_u2', 'u2', TRUE, FALSE, TRUE, TRUE, TRUE, TRUE)
ON CONFLICT (user_id) DO NOTHING;

-- Secrétaire : créer + upload uniquement
INSERT INTO user_permissions (id, user_id, can_create_cases, can_delete_cases, can_edit_plumitif, can_manage_hearings, can_upload_documents, can_verify_integrity) VALUES
    ('perm_u3', 'u3', TRUE, FALSE, FALSE, FALSE, TRUE, FALSE)
ON CONFLICT (user_id) DO NOTHING;

-- 5.3 Tribunal par défaut
INSERT INTO court_profiles (id, name, type, president, address, phone, email, jurisdiction_region, founding_date, active_chambers) VALUES
    ('court_1', 
     'TGI du Mfoundi (Yaoundé)', 
     'Tribunal de Grande Instance', 
     'M. le Magistrat Hors Hiérarchie Philippe Ndi', 
     'Place de la Justice, Centre Ville, Yaoundé', 
     '+237 222-31-45-67', 
     'tgi.mfoundi@minjustice.gov.cm', 
     'Centre', 
     '1972-06-21', 
     ARRAY['Chambre Civile I', 'Chambre Pénale I', 'Chambre Commerciale I', 'Chambre Sociale']
    )
ON CONFLICT (id) DO NOTHING;

-- 5.4 Logs d'audit de genesis (chaîne de blocs initiale)
INSERT INTO activity_logs (id, timestamp, action, username, details, category, severity, ip_address, integrity_hash) VALUES
    ('log_genesis',
     '2026-07-15T08:00:00Z',
     'INITIALISATION_SYSTEME',
     'Service d''Initialisation',
     'Initialisation sécurisée du CMS Legalyx pour les tribunaux de la République du Cameroun. Génération de la clé maître d''intégrité.',
     'SYSTEM',
     'CRITICAL',
     '127.0.0.1',
     '2bc3ef7929a32c28929e84fc83fa41fb1fef3e3fcfcf8904332ab990141fde12'),
    ('log_seed_u1',
     '2026-07-15T08:05:00Z',
     'ENREGISTREMENT_UTILISATEUR',
     'Service d''Initialisation',
     'Profil de M. le Juge Emmanuel Nsame enregistré et enrôlement biométrique activé.',
     'USER_MANAGEMENT',
     'INFO',
     '127.0.0.1',
     'a9f82bc1283e18f8cb929312da5e2ab2412efea0f64c67bfbc99cfa392ef8c1d')
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- PHASE 6 : FONCTION UTILITAIRE (trigger de mise à jour updated_at)
-- =====================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer le trigger sur les tables qui ont updated_at
CREATE TRIGGER trg_court_profiles_updated_at
    BEFORE UPDATE ON court_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_user_permissions_updated_at
    BEFORE UPDATE ON user_permissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- =====================================================================
-- RESUME DE LA MIGRATION
-- =====================================================================
-- Tables supprimées (v1) : activities, documents, hearings, cases, users
-- Types supprimés (v1)  : hearing_status, user_role
--
-- Tables créées (v2)    : users, cases, hearings, case_documents, 
--                          activity_logs (5 tables du schéma officiel)
-- Tables ajoutées        : user_permissions, court_profiles (2 tables 
--                          manquantes mais requises par l'application)
--
-- Total : 7 tables, 14 indexes, 15 politiques RLS, 
--         5 utilisateurs seed, 5 permissions, 1 tribunal, 2 logs genesis
-- =====================================================================