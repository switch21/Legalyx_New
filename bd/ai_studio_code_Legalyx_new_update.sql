-- Structure de la base de données Legalyx-CMS
-- Système de Gestion Judiciaire (Norme ANIF / MINJUSTICE Cameroun)

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(50) CHECK (role IN ('Président', 'Juge', 'Greffier', 'Secrétaire', 'Administrateur')) NOT NULL,
    tribunal VARCHAR(200) NOT NULL,
    avatar TEXT,
    mfa_enabled BOOLEAN DEFAULT TRUE,
    biometric_registered BOOLEAN DEFAULT TRUE,
    password_hash VARCHAR(255) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cases (
    id VARCHAR(50) PRIMARY KEY,
    num_dossier VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    tribunal VARCHAR(200) NOT NULL,
    nature VARCHAR(100) NOT NULL, -- ex: Civil, Correctionnel, Administratif
    status VARCHAR(50) DEFAULT 'En cours',
    parties TEXT NOT NULL, -- ex: "Demandeur vs Défendeur"
    priority VARCHAR(20) DEFAULT 'Moyenne',
    notes_deliberation TEXT, -- Notes hautement confidentielles du magistrat
    magistrat_id VARCHAR(50) REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS case_documents (
    id VARCHAR(50) PRIMARY KEY,
    case_id VARCHAR(50) REFERENCES cases(id) ON DELETE CASCADE,
    hearing_id VARCHAR(50), -- Optionnel : Lié à une audience spécifique
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL, -- ex: Requête, Mémoire, Pièce jointe, Minute
    size VARCHAR(50) NOT NULL,
    hash VARCHAR(64) NOT NULL, -- Signature cryptographique SHA-256 de la pièce numérisée
    uploaded_by VARCHAR(150) NOT NULL,
    secure BOOLEAN DEFAULT TRUE,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hearings (
    id VARCHAR(50) PRIMARY KEY,
    case_id VARCHAR(50) REFERENCES cases(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    time TIME NOT NULL,
    type VARCHAR(100) NOT NULL, -- ex: Audience publique, Délibéré, Référé
    status VARCHAR(50) DEFAULT 'Planifiée', -- Planifiée, En cours, Terminée, Renvoyée
    location VARCHAR(100) NOT NULL, -- Salle d'audience
    notes TEXT, -- Notes du greffier
    recording_url TEXT, -- Lien de l'enregistrement sonore de l'audience
    transcript TEXT, -- Transcription textuelle automatique d'audience
    signature_hash VARCHAR(64), -- Hachage du plumitif signé
    signed_by VARCHAR(150),
    signed_at TIMESTAMP,
    attendees TEXT, -- JSON ou Liste des participants
    metadata TEXT, -- JSON optionnel pour informations additionnelles
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_logs (
    id VARCHAR(50) PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    action VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL,
    details TEXT,
    category VARCHAR(100) NOT NULL, -- ex: "AUTHENTICATION", "CASE_UPDATE", "PLUMITIF_SIGN"
    severity VARCHAR(20) DEFAULT 'INFO', -- INFO, WARNING, CRITICAL
    ip_address VARCHAR(45),
    user_agent TEXT,
    integrity_hash VARCHAR(64) NOT NULL -- Hachage SHA-256 en chaîne de blocs pour garantir l'anti-falsification des logs
);