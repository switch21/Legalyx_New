-- =====================================================================
-- STRUCTURE DE LA BASE DE DONNÉES DE L'APPLICATION JUDICIAIRE
-- Système de gestion des dossiers, pièces scellées et audiences
-- SGBD Recommandé : PostgreSQL (v14 ou supérieure)
-- =====================================================================

-- Activation de l'extension UUID pour la génération d'identifiants sécurisés
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Déclaration des types énumérés (ENUM)
CREATE TYPE user_role AS ENUM (
    'Administrateur', 
    'Président', 
    'Juge', 
    'Greffier', 
    'Secrétaire'
);

CREATE TYPE hearing_status AS ENUM (
    'Planifiée', 
    'En cours', 
    'Terminée', 
    'Reportée'
);

-- =====================================================================
-- 1. TABLE : USERS (Agents et Magistrats)
-- =====================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL,
    tribunal VARCHAR(150) NOT NULL,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    avatar TEXT,
    password_hash VARCHAR(255) NOT NULL,
    mfa_enabled BOOLEAN DEFAULT TRUE NOT NULL,
    biometric_registered BOOLEAN DEFAULT TRUE NOT NULL,
    
    -- Permissions granulaires (Habilitations de sécurité)
    can_create_cases BOOLEAN DEFAULT FALSE NOT NULL,
    can_delete_cases BOOLEAN DEFAULT FALSE NOT NULL,
    can_edit_plumitif BOOLEAN DEFAULT FALSE NOT NULL,
    can_manage_hearings BOOLEAN DEFAULT FALSE NOT NULL,
    can_upload_documents BOOLEAN DEFAULT FALSE NOT NULL,
    can_verify_integrity BOOLEAN DEFAULT FALSE NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- =====================================================================
-- 2. TABLE : CASES (Dossiers Judiciaires)
-- =====================================================================
CREATE TABLE cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    num_dossier VARCHAR(50) UNIQUE NOT NULL, -- Numéro unique d'enrôlement
    title VARCHAR(255) NOT NULL,
    nature VARCHAR(100) NOT NULL,            -- ex: Correctionnel, Civil, Commercial
    status VARCHAR(50) NOT NULL,            -- ex: En cours, Mis en délibéré, Clôturé
    chamber VARCHAR(100) NOT NULL,           -- Chambre d'affectation
    president VARCHAR(100) NOT NULL,         -- Président du tribunal en charge
    notes_deliberation TEXT,                 -- Notes sécrètes d'audience / délibéré
    parties TEXT[] NOT NULL,                 -- Liste des parties impliquées
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- =====================================================================
-- 3. TABLE : HEARINGS (Audiences)
-- =====================================================================
CREATE TABLE hearings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    time TIME NOT NULL,
    room VARCHAR(100) NOT NULL,
    status hearing_status DEFAULT 'Planifiée' NOT NULL,
    notes TEXT,                             -- Notes préparatoires ou consignes de greffe
    compte_rendu TEXT,                       -- Procès-verbal / Plumitif scellé d'audience
    greffier_name VARCHAR(100),             -- Nom du greffier d'audience affecté
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- =====================================================================
-- 4. TABLE : DOCUMENTS (Pièces Jointes et Preuves Numérisées)
-- =====================================================================
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    hearing_id UUID REFERENCES hearings(id) ON DELETE SET NULL, -- Optionnel: associer à une audience spécifique
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,             -- ex: Plainte, Preuve, Conclusions
    size VARCHAR(20) NOT NULL,              -- ex: '1.2 MB'
    hash VARCHAR(64) NOT NULL,              -- Empreinte cryptographique SHA-256 (Garantie d'intégrité)
    secure BOOLEAN DEFAULT TRUE NOT NULL,    -- Statut de chiffrement/scellage
    uploaded_by VARCHAR(100) NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- =====================================================================
-- 5. TABLE : ACTIVITIES (Journaux de Traçabilité - Audits)
-- =====================================================================
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(100) NOT NULL,          -- Identifiant ou nom d'utilisateur (ou système)
    action VARCHAR(100) NOT NULL,           -- Type d'activité (ex: SCELLAGE_PIECE, ACCES_DOSSIER)
    details TEXT NOT NULL,                  -- Description textuelle détaillée de l'action
    ip_address VARCHAR(45),                 -- Adresse IP pour la traçabilité
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- =====================================================================
-- INDEX DE PERFORMANCE (Optimisation des requêtes de recherche)
-- =====================================================================

-- Accélérer la recherche et la connexion des utilisateurs
CREATE INDEX idx_users_username ON users(username);

-- Accélérer la recherche de dossiers par numéro d'enrôlement unique
CREATE INDEX idx_cases_num_dossier ON cases(num_dossier);

-- Optimiser l'affichage des pièces liées à un dossier ou à une audience spécifique
CREATE INDEX idx_documents_case ON documents(case_id);
CREATE INDEX idx_documents_hearing ON documents(hearing_id);

-- Optimiser la chronologie et le calendrier des audiences par dossier et par date
CREATE INDEX idx_hearings_case ON hearings(case_id);
CREATE INDEX idx_hearings_date ON hearings(date);

-- Assurer un audit rapide des logs d'activité
CREATE INDEX idx_activities_timestamp ON activities(timestamp DESC);