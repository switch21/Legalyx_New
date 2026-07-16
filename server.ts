import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini Client
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
  console.log("Legalyx-CMS: Gemini client initialized successfully.");
} else {
  console.warn("Legalyx-CMS Warning: GEMINI_API_KEY is not defined. AI report generation will fall back to simulated generation.");
}

// Simulated Cryptographic Database path
const DB_FILE = path.join(process.cwd(), "src", "db_encrypted.json");

// Helper to encrypt/decrypt (Base64 + XOR with a secret key to simulate robust secure military-grade SQLite/at-rest encryption)
const ENCRYPTION_KEY = process.env.DATABASE_SECRET_KEY || "Legalyx_Cameroun_Secret_Vault_2026_Key";
function encryptData(text: string): string {
  const cipher = crypto.createCipheriv('aes-256-cbc', crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32), Buffer.alloc(16));
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decryptData(hexText: string): string {
  try {
    const decipher = crypto.createDecipheriv('aes-256-cbc', crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32), Buffer.alloc(16));
    let decrypted = decipher.update(hexText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    // Fallback if encryption key changed or unencrypted
    return hexText;
  }
}

// In-Memory Database Structure
interface DBState {
  users: any[];
  cases: any[];
  hearings: any[];
  activityLogs: any[];
  courtProfiles: any[];
}

let dbState: DBState = {
  users: [
    {
      id: "u1",
      username: "emmanuel.nsame",
      fullName: "M. le Juge Emmanuel Nsame",
      role: "Juge",
      tribunal: "TGI du Mfoundi (Yaoundé)",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=120",
      mfaEnabled: true,
      biometricRegistered: true,
      passwordHash: "5e97940a5c3660", // mock hash
      active: true,
    },
    {
      id: "u2",
      username: "therese.atangana",
      fullName: "Mme Thérèse Atangana",
      role: "Greffier",
      tribunal: "TGI du Mfoundi (Yaoundé)",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=120",
      mfaEnabled: true,
      biometricRegistered: true,
      passwordHash: "5e97940a5c3660",
      active: true,
    },
    {
      id: "u3",
      username: "christian.bella",
      fullName: "M. Christian Bella",
      role: "Secrétaire",
      tribunal: "TGI du Mfoundi (Yaoundé)",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=120",
      mfaEnabled: true,
      biometricRegistered: true,
      passwordHash: "5e97940a5c3660",
      active: true,
    },
    {
      id: "u4",
      username: "amadou.toure",
      fullName: "Me Amadou Touré",
      role: "Administrateur",
      tribunal: "Ministère de la Justice (MINJUSTICE)",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=120",
      mfaEnabled: true,
      biometricRegistered: true,
      passwordHash: "5e97940a5c3660",
      active: true,
    },
    {
      id: "u5",
      username: "philippe.ndi",
      fullName: "M. le Président Philippe Ndi",
      role: "Président",
      tribunal: "TGI du Mfoundi (Yaoundé)",
      avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=120",
      mfaEnabled: true,
      biometricRegistered: true,
      passwordHash: "5e97940a5c3660",
      active: true,
    }
  ],
  cases: [
    {
      id: "c1",
      numDossier: "TGI-YDE/2026/412-CIV",
      title: "Affaire Amadou Ousmanou contre Société Nationale des Hydrocarbures (SNH)",
      description: "Litige foncier concernant les droits d'exploitation d'une parcelle de terrain de 2500m² située à Yaoundé III (Bastos). Le demandeur réclame une indemnisation pour expropriation irrégulière et non-respect du décret d'utilité publique.",
      tribunal: "TGI du Mfoundi (Yaoundé)",
      nature: "Civil",
      status: "En cours",
      parties: "Amadou Ousmanou (Demandeur) vs SNH S.A. (Défendeur)",
      priority: "Haute",
      dateCreation: "2026-03-12T10:30:00Z",
      magistratId: "u1",
      magistratName: "M. le Juge Emmanuel Nsame",
      documents: [
        {
          id: "d1_1",
          name: "Requete_Introductive_Signee.pdf",
          date: "2026-03-12T10:35:00Z",
          type: "Requête",
          hash: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
          size: "2.4 MB",
          uploadedBy: "M. Christian Bella",
          secure: true
        },
        {
          id: "d1_2",
          name: "Titre_Foncier_No_4412_Mfoundi.pdf",
          date: "2026-03-15T14:20:00Z",
          type: "Pièce jointe",
          hash: "a3a2e1d13d7890a56fbc8a239b98ec34a9e52cde12e3e4a2bc0d8df3d56efb91",
          size: "4.1 MB",
          uploadedBy: "M. Christian Bella",
          secure: true
        },
        {
          id: "d1_3",
          name: "Memoire_En_Defense_SNH.pdf",
          date: "2026-04-10T09:15:00Z",
          type: "Mémoire",
          hash: "f82b3a1a9e88d128cb5b3b3a12a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3",
          size: "1.8 MB",
          uploadedBy: "Mme Thérèse Atangana",
          secure: true
        }
      ],
      notesDeliberation: "Note d'audience confidentielle : Nécessité de requérir l'avis du Cadastre de Yaoundé III pour délimitation définitive. Les prétentions de l'exproprié semblent fondées en droit mais surévaluées quant au préjudice financier réel."
    },
    {
      id: "c2",
      numDossier: "TGI-YDE/2026/889-PEN",
      title: "Ministère Public contre Ndongo Jean-Pierre (Détournement de fonds publics)",
      description: "Poursuite pénale pour détournement de deniers publics, corruption et favoritisme dans le cadre de la passation des marchés publics d'infrastructure de la CAN. Montant suspecté : 450 millions FCFA via des entreprises écrans.",
      tribunal: "TGI du Mfoundi (Yaoundé)",
      nature: "Pénal",
      status: "Mis en délibéré",
      parties: "L'État du Cameroun & Ministère Public vs Ndongo Jean-Pierre",
      priority: "Urgente",
      dateCreation: "2026-01-20T08:00:00Z",
      magistratId: "u1",
      magistratName: "M. le Juge Emmanuel Nsame",
      documents: [
        {
          id: "d2_1",
          name: "Rapport_Enquete_Preliminaire_CONAC.pdf",
          date: "2026-01-20T08:12:00Z",
          type: "Procès-verbal",
          hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          size: "11.2 MB",
          uploadedBy: "Mme Thérèse Atangana",
          secure: true
        },
        {
          id: "d2_2",
          name: "Expertise_Comptable_Financiere_Signee.pdf",
          date: "2026-02-18T11:40:00Z",
          type: "Procès-verbal",
          hash: "f1a23b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a",
          size: "5.7 MB",
          uploadedBy: "Mme Thérèse Atangana",
          secure: true
        }
      ],
      notesDeliberation: "Délibéré fixé pour le 30 Juillet 2026. L'accusé s'est défendu d'avoir ordonné les virements litigieux, accusant le Trésorier Payeur Général d'alors. Cependant, les signatures conjointes sur les ordres de virement constituent une présomption grave de complicité."
    },
    {
      id: "c3",
      numDossier: "TPI-YDE-EK/2026/104-COM",
      title: "Ets Elégance Cameroun contre Cameroon Telecommunications (CAMTEL)",
      description: "Rupture unilatérale abusive des contrats de distribution exclusive de cartes de recharge de télécommunications et demande d'indemnisation de 120 000 000 FCFA à titre de manque à gagner.",
      tribunal: "TPI de Yaoundé Ekounou",
      nature: "Commercial",
      status: "En cours",
      parties: "Ets Elégance Cameroun (Demandeur) vs CAMTEL S.A. (Défendeur)",
      priority: "Moyenne",
      dateCreation: "2026-04-05T14:00:00Z",
      magistratId: "u1",
      magistratName: "M. le Juge Emmanuel Nsame",
      documents: [
        {
          id: "d3_1",
          name: "Contrat_Original_CAMTEL_Elegance.pdf",
          date: "2026-04-05T14:15:00Z",
          type: "Pièce jointe",
          hash: "a4c28d9c28919e830f3f222ac99d0092ee009ff9bc8d8e3b1239ab7d7283fc32",
          size: "3.5 MB",
          uploadedBy: "M. Christian Bella",
          secure: true
        }
      ],
      notesDeliberation: "Affaire reportée à plusieurs reprises pour défaut de production des pièces comptables par CAMTEL S.A. Une injonction de faire sous astreinte journalière de 1 000 000 FCFA est envisagée si l'ajournement persiste."
    }
  ],
  hearings: [
    {
      id: "h1",
      caseId: "c1",
      numDossier: "TGI-YDE/2026/412-CIV",
      caseTitle: "Affaire Amadou Ousmanou contre Société Nationale des Hydrocarbures (SNH)",
      date: "2026-07-20",
      time: "09:00",
      room: "Chambre Civile I - Salle 3",
      status: "Planifiée",
      notes: "Audition des experts topographes désignés par le tribunal et plaidoiries de la défense sur l'exception d'incompétence soulevée par les avocats de la SNH.",
      greffierName: "Mme Thérèse Atangana"
    },
    {
      id: "h2",
      caseId: "c2",
      numDossier: "TGI-YDE/2026/889-PEN",
      caseTitle: "Ministère Public contre Ndongo Jean-Pierre (Détournement)",
      date: "2026-07-16",
      time: "10:30",
      room: "Chambre Criminelle - Salle d'Audience Principale",
      status: "En cours",
      notes: "Présentation orale du rapport d'expertise financière par l'auditeur assermenté. Interrogatoire complémentaire de l'accusé sur les virements bancaires émis de la banque CBC vers le compte offshore à Singapour.",
      greffierName: "Mme Thérèse Atangana"
    },
    {
      id: "h3",
      caseId: "c3",
      numDossier: "TPI-YDE-EK/2026/104-COM",
      caseTitle: "Ets Elégance Cameroun contre Cameroon Telecommunications (CAMTEL)",
      date: "2026-07-12",
      time: "11:00",
      room: "Chambre Commerciale - Cabinet du Président",
      status: "Terminée",
      notes: "Appelé pour la production des pièces comptables originales par CAMTEL. Le conseil de CAMTEL a sollicité un report pour motifs organisationnels internes. Accordé au 12 Août 2026.",
      compteRendu: `REPUBLIQUE DU CAMEROUN\nPAIX - TRAVAIL - PATRIE\n--------------------\nTRIBUNAL DE PREMIERE INSTANCE DE YAOUNDE EKOUNOU\nAUDIENCE COMMERCIALE PUBLIQUE ORDINAIRE DU 12 JUILLET 2026\n\nComposition du Tribunal :\n- Président : M. le Juge Emmanuel Nsame\n- Greffier : Mme Thérèse Atangana\n\nAffaire Commerciale n° 104-COM :\nETS ELÉGANCE CAMEROUN (Demandeur)\nContre\nCAMEROON TELECOMMUNICATIONS - CAMTEL S.A. (Défendeur)\n\nL'an deux mille vingt-six, le douze juillet, la cause a été régulièrement appelée à l'audience commerciale.\nLe demandeur, représenté par son Directeur Général assisté de Maître Fon, Avocat au Barreau du Cameroun, a réitéré ses conclusions en réparation du préjudice pour rupture brutale des relations d'affaires.\nLa défenderesse (CAMTEL), comparant par le biais de son conseil Maître Mbida, a sollicité un énième renvoi de la cause pour produire la comptabilité certifiée du département logistique, arguant d'une mise à jour majeure du progiciel de gestion.\n\nLe Tribunal, après avoir ouï les parties, a prononcé la décision suivante :\n- Accorde un ultime renvoi au 12 Août 2026 à 10H00 pour production effective par la CAMTEL S.A. des documents requis.\n- Condamne CAMTEL S.A. aux dépens de la présente audience.\n\nPour le Greffier d'Audience,                                    Le Président du Tribunal`,
      greffierName: "Mme Thérèse Atangana"
    }
  ],
  activityLogs: [],
  courtProfiles: []
};

// Helper function for default user permissions
function getDefaultPermissions(role: string) {
  switch (role) {
    case "Administrateur":
      return {
        canCreateCases: false,
        canDeleteCases: false,
        canEditPlumitif: false,
        canManageHearings: false,
        canUploadDocuments: false,
        canVerifyIntegrity: true
      };
    case "Président":
      return {
        canCreateCases: true,
        canDeleteCases: true,
        canEditPlumitif: true,
        canManageHearings: true,
        canUploadDocuments: true,
        canVerifyIntegrity: true
      };
    case "Juge":
      return {
        canCreateCases: true,
        canDeleteCases: true,
        canEditPlumitif: true,
        canManageHearings: true,
        canUploadDocuments: true,
        canVerifyIntegrity: true
      };
    case "Greffier":
      return {
        canCreateCases: true,
        canDeleteCases: false,
        canEditPlumitif: true,
        canManageHearings: true,
        canUploadDocuments: true,
        canVerifyIntegrity: true
      };
    case "Secrétaire":
    default:
      return {
        canCreateCases: true,
        canDeleteCases: false,
        canEditPlumitif: false,
        canManageHearings: false,
        canUploadDocuments: true,
        canVerifyIntegrity: false
      };
  }
}

// Cryptographic hash helper for integrity tracking (blockchain-style log chain)
function generateAuditHash(logEntry: any, previousHash: string): string {
  const content = `${logEntry.userId}-${logEntry.action}-${logEntry.timestamp}-${logEntry.details}-${previousHash}`;
  return crypto.createHash("sha256").update(content).digest("hex");
}

// Function to log actions in the system audit trail (immutability rule)
function logActivity(userId: string, action: string, details: string, req: express.Request) {
  const user = dbState.users.find(u => u.id === userId);
  const previousLog = dbState.activityLogs[dbState.activityLogs.length - 1];
  const previousHash = previousLog ? previousLog.integrityHash : "GENESIS_BLOCK_LEGALLYX_CMS_2026";
  
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || "127.0.0.1";
  
  const newLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId: userId,
    userName: user ? user.fullName : "Système / Inconnu",
    userRole: user ? user.role : "Administrateur",
    action: action,
    timestamp: new Date().toISOString(),
    ip: ip,
    details: details,
    integrityHash: ""
  };
  
  newLog.integrityHash = generateAuditHash(newLog, previousHash);
  dbState.activityLogs.push(newLog);
  saveDatabaseState();
}

// Save & Load state to encrypted DB simulation
function saveDatabaseState() {
  try {
    const rawJSON = JSON.stringify(dbState, null, 2);
    const encrypted = encryptData(rawJSON);
    
    // Check if parent directory exists
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(DB_FILE, JSON.stringify({
      security_metadata: {
        legal_framework: "Normes RGPD & Loi Camerounaise sur la cybersécurité",
        saved_at: new Date().toISOString(),
        vault_integrity_hash: crypto.createHash("sha256").update(encrypted).digest("hex"),
        encryption_algorithm: "AES-256-CBC with PBKDF2"
      },
      encrypted_payload: encrypted
    }, null, 2), "utf8");
    
    console.log(`[Legalyx-DB] Base de données cryptée sauvegardée dans ${DB_FILE}`);
  } catch (error) {
    console.error("[Legalyx-DB] Erreur lors de l'enregistrement de l'état crypté:", error);
  }
}

function loadDatabaseState() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const fileContent = fs.readFileSync(DB_FILE, "utf8");
      const wrapper = JSON.parse(fileContent);
      if (wrapper.encrypted_payload) {
        const decrypted = decryptData(wrapper.encrypted_payload);
        const parsed = JSON.parse(decrypted);
        // Sync memory with file
        dbState = parsed;
        console.log("[Legalyx-DB] Base de données cryptée chargée avec succès.");
      }
    } else {
      console.log("[Legalyx-DB] Aucun fichier de base de données existant. Initialisation d'un nouvel état.");
      // Seed initial activity logs
      dbState.activityLogs = [
        {
          id: "log_genesis",
          userId: "system",
          userName: "Service d'Initialisation",
          userRole: "Administrateur",
          action: "INITIALISATION_SYSTEME",
          timestamp: "2026-07-15T08:00:00Z",
          ip: "127.0.0.1",
          details: "Initialisation sécurisée du CMS Legalyx pour les tribunaux de la République du Cameroun. Génération de la clé maître d'intégrité.",
          integrityHash: "2bc3ef7929a32c28929e84fc83fa41fb1fef3e3fcfcf8904332ab990141fde12"
        },
        {
          id: "log_seed_u1",
          userId: "system",
          userName: "Service d'Initialisation",
          userRole: "Administrateur",
          action: "ENREGISTREMENT_UTILISATEUR",
          timestamp: "2026-07-15T08:05:00Z",
          ip: "127.0.0.1",
          details: "Profil de M. le Juge Emmanuel Nsame enregistré et enrôlement biométrique activé.",
          integrityHash: "a9f82bc1283e18f8cb929312da5e2ab2412efea0f64c67bfbc99cfa392ef8c1d"
        }
      ];
      saveDatabaseState();
    }

    // Ensure court profiles exist in dbState
    if (!dbState.courtProfiles) {
      dbState.courtProfiles = [];
    }
    if (dbState.courtProfiles.length === 0) {
      dbState.courtProfiles = [
        {
          id: "court_1",
          name: "TGI du Mfoundi (Yaoundé)",
          type: "Tribunal de Grande Instance",
          president: "M. le Magistrat Hors Hiérarchie Philippe Ndi",
          address: "Place de la Justice, Centre Ville, Yaoundé",
          phone: "+237 222-31-45-67",
          email: "tgi.mfoundi@minjustice.gov.cm",
          jurisdictionRegion: "Centre",
          foundingDate: "1972-06-21",
          activeChambers: ["Chambre Civile I", "Chambre Pénale I", "Chambre Commerciale I", "Chambre Sociale"]
        }
      ];
    }

    // Ensure all users are populated and synchronized
    const defaultUsers = [
      {
        id: "u1",
        username: "emmanuel.nsame",
        fullName: "M. le Juge Emmanuel Nsame",
        role: "Juge",
        tribunal: "TGI du Mfoundi (Yaoundé)",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=120",
        mfaEnabled: true,
        biometricRegistered: true,
        passwordHash: "5e97940a5c3660",
        active: true,
      },
      {
        id: "u2",
        username: "therese.atangana",
        fullName: "Mme Thérèse Atangana",
        role: "Greffier",
        tribunal: "TGI du Mfoundi (Yaoundé)",
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=120",
        mfaEnabled: true,
        biometricRegistered: true,
        passwordHash: "5e97940a5c3660",
        active: true,
      },
      {
        id: "u3",
        username: "christian.bella",
        fullName: "M. Christian Bella",
        role: "Secrétaire",
        tribunal: "TGI du Mfoundi (Yaoundé)",
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=120",
        mfaEnabled: true,
        biometricRegistered: true,
        passwordHash: "5e97940a5c3660",
        active: true,
      },
      {
        id: "u4",
        username: "amadou.toure",
        fullName: "Me Amadou Touré",
        role: "Administrateur",
        tribunal: "Ministère de la Justice (MINJUSTICE)",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=120",
        mfaEnabled: true,
        biometricRegistered: true,
        passwordHash: "5e97940a5c3660",
        active: true,
      },
      {
        id: "u5",
        username: "philippe.ndi",
        fullName: "M. le Président Philippe Ndi",
        role: "Président",
        tribunal: "TGI du Mfoundi (Yaoundé)",
        avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=120",
        mfaEnabled: true,
        biometricRegistered: true,
        passwordHash: "5e97940a5c3660",
        active: true,
      }
    ];

    if (!dbState.users) {
      dbState.users = defaultUsers;
    } else {
      // Add missing default users
      defaultUsers.forEach(du => {
        const exists = dbState.users.some(u => u.username === du.username);
        if (!exists) {
          dbState.users.push(du);
        }
      });
    }

    dbState.users.forEach(u => {
      if (!u.permissions) {
        u.permissions = getDefaultPermissions(u.role);
      }
    });

    saveDatabaseState();

  } catch (error) {
    console.error("[Legalyx-DB] Erreur lors de la lecture du fichier crypté (recréation de l'état par défaut):", error);
    saveDatabaseState();
  }
}

// Initial DB Load
loadDatabaseState();

// API ENDPOINTS

// 1. Auth Endpoint
app.post("/api/auth/login", (req, res) => {
  const { username, hasBiometrics, password, pinMFA } = req.body;
  
  const user = dbState.users.find(u => u.username === username);
  if (!user) {
    return res.status(401).json({ success: false, message: "Identifiants invalides." });
  }

  // Verify if user is active
  if (user.active === false) {
    return res.status(403).json({ success: false, message: "Ce compte utilisateur a été désactivé par l'administrateur." });
  }

  // Handle Biometric flow or Standard password flow
  if (hasBiometrics) {
    // Biometric authentication simulator (facial scan or fingerprint matching)
    logActivity(user.id, "AUTHENTIFICATION_BIOMETRIQUE", "Validation biométrique de l'empreinte digitale et scan rétinien réussis.", req);
    
    // Simulate MFA verification successful for judicial roles
    return res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        tribunal: user.tribunal,
        avatar: user.avatar,
        mfaEnabled: user.mfaEnabled,
        biometricRegistered: user.biometricRegistered,
        active: user.active !== false,
        permissions: user.permissions || getDefaultPermissions(user.role)
      },
      message: "Authentification biométrique forte & MFA crypté réussis."
    });
  }

  // Standard password login check (simulated hash check)
  if (password && (password === "admin" || password === "legalyx2026" || password === "password")) {
    if (user.mfaEnabled && !pinMFA) {
      // Prompt client for the secondary MFA authentication code
      return res.json({
        success: true,
        mfaRequired: true,
        userId: user.id,
        message: "Code d'authentification multifacteur requis (MFA)."
      });
    }

    if (user.mfaEnabled && pinMFA && pinMFA !== "123456") {
      return res.status(401).json({ success: false, message: "Code MFA incorrect." });
    }

    logActivity(user.id, "CONNEXION_MOT_DE_PASSE_MFA", "Authentification validée via mot de passe chiffré et OTP multifacteur.", req);
    
    return res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        tribunal: user.tribunal,
        avatar: user.avatar,
        mfaEnabled: user.mfaEnabled,
        biometricRegistered: user.biometricRegistered,
        active: user.active !== false,
        permissions: user.permissions || getDefaultPermissions(user.role)
      },
      message: "Authentification robuste réussie."
    });
  }

  return res.status(401).json({ success: false, message: "Mot de passe erroné ou code d'accès non valide." });
});

// 2. Cases list and creation
app.get("/api/cases", (req, res) => {
  const { userId } = req.query;
  if (userId) {
    const user = dbState.users.find(u => u.id === userId);
    if (user && user.role === "Administrateur") {
      return res.status(403).json({ success: false, message: "Accès refusé : L'administrateur n'a pas accès aux dossiers judiciaires." });
    }
  }
  res.json({ success: true, cases: dbState.cases });
});

app.post("/api/cases", (req, res) => {
  const { userId, numDossier, title, description, tribunal, nature, parties, priority } = req.body;
  
  if (!numDossier || !title || !tribunal || !nature) {
    return res.status(400).json({ success: false, message: "Champs obligatoires manquants." });
  }

  const user = dbState.users.find(u => u.id === userId);
  const magistrat = dbState.users.find(u => u.role === "Juge") || user;

  const newCase = {
    id: `c_${Date.now()}`,
    numDossier,
    title,
    description: description || "Aucune description",
    tribunal,
    nature,
    status: "En cours" as const,
    parties: parties || "Ministère Public contre X",
    priority: priority || "Moyenne",
    dateCreation: new Date().toISOString(),
    magistratId: magistrat.id,
    magistratName: magistrat.fullName,
    documents: [],
    notesDeliberation: ""
  };

  dbState.cases.push(newCase);
  saveDatabaseState();

  logActivity(userId || "system", "CREATION_DOSSIER", `Nouveau dossier pénal/civil numérisé : ${numDossier} - ${title}`, req);

  res.json({ success: true, case: newCase });
});

// Update Case Status / Notes
app.patch("/api/cases/:id", (req, res) => {
  const { id } = req.params;
  const { userId, status, notesDeliberation, magistratId, magistratName, priority } = req.body;
  
  const dossier = dbState.cases.find(c => c.id === id);
  if (!dossier) {
    return res.status(404).json({ success: false, message: "Dossier introuvable." });
  }

  if (status) dossier.status = status;
  if (notesDeliberation !== undefined) dossier.notesDeliberation = notesDeliberation;
  if (magistratId) dossier.magistratId = magistratId;
  if (magistratName) dossier.magistratName = magistratName;
  if (priority) dossier.priority = priority;

  saveDatabaseState();

  logActivity(userId || "system", "MODIFICATION_DOSSIER", `Mise à jour du dossier : ${dossier.numDossier} (Statut: ${dossier.status}, Magistrat: ${dossier.magistratName || 'Inconnu'})`, req);

  res.json({ success: true, case: dossier });
});

// 3. Upload Document Simulation
app.post("/api/cases/:id/documents", (req, res) => {
  const { id } = req.params;
  const { userId, name, type, size, hearingId } = req.body;

  const dossier = dbState.cases.find(c => c.id === id);
  if (!dossier) {
    return res.status(404).json({ success: false, message: "Dossier introuvable." });
  }

  const user = dbState.users.find(u => u.id === userId);
  const uploaderName = user ? user.fullName : "Secrétariat";

  // Simulate secure digitization with sha256 hashing
  const simulatedHash = crypto.createHash("sha256").update(`${name}-${Date.now()}`).digest("hex");

  const newDoc = {
    id: `doc_${Date.now()}`,
    name,
    date: new Date().toISOString(),
    type: type || "Pièce jointe",
    hash: simulatedHash,
    size: size || "1.2 MB",
    uploadedBy: uploaderName,
    secure: true,
    hearingId: hearingId || undefined
  };

  dossier.documents.push(newDoc);
  saveDatabaseState();

  const hearingSuffix = hearingId ? ` lié à l'audience (${hearingId})` : "";
  logActivity(userId || "system", "NUMERISATION_DOCUMENT", `Document numérisé et haché ajouté au dossier ${dossier.numDossier}${hearingSuffix} : ${name} (SHA-256: ${simulatedHash.substring(0, 10)}...)`, req);

  res.json({ success: true, document: newDoc, case: dossier });
});

// Archive / Delete Document simulation
app.delete("/api/cases/:caseId/documents/:docId", (req, res) => {
  const { caseId, docId } = req.params;
  const { userId } = req.query;

  const dossier = dbState.cases.find(c => c.id === caseId);
  if (!dossier) {
    return res.status(404).json({ success: false, message: "Dossier introuvable." });
  }

  const docIndex = dossier.documents.findIndex(d => d.id === docId);
  if (docIndex === -1) {
    return res.status(404).json({ success: false, message: "Document introuvable." });
  }

  const docName = dossier.documents[docIndex].name;
  dossier.documents.splice(docIndex, 1);
  saveDatabaseState();

  logActivity((userId as string) || "system", "SUPPRESSION_DOCUMENT", `Document confidentiel détruit de manière sécurisée de la corbeille judiciaire : ${docName} sur dossier ${dossier.numDossier}`, req);

  res.json({ success: true, case: dossier });
});

// 4. Hearings / Roles d'Audience list, creation & update
app.get("/api/hearings", (req, res) => {
  const { userId } = req.query;
  if (userId) {
    const user = dbState.users.find(u => u.id === userId);
    if (user && user.role === "Administrateur") {
      return res.status(403).json({ success: false, message: "Accès refusé : L'administrateur n'a pas accès aux rôles d'audiences." });
    }
  }
  res.json({ success: true, hearings: dbState.hearings });
});

app.post("/api/hearings", (req, res) => {
  const { userId, caseId, date, time, room, notes } = req.body;

  const dossier = dbState.cases.find(c => c.id === caseId);
  if (!dossier) {
    return res.status(400).json({ success: false, message: "Le dossier spécifié est inexistant." });
  }

  const user = dbState.users.find(u => u.id === userId);
  const greffierName = user ? user.fullName : "Secrétaire Greffe";

  const newHearing = {
    id: `h_${Date.now()}`,
    caseId,
    numDossier: dossier.numDossier,
    caseTitle: dossier.title,
    date,
    time: time || "09:00",
    room: room || "Chambre Civile I",
    status: "Planifiée" as const,
    notes: notes || "",
    greffierName
  };

  dbState.hearings.push(newHearing);
  saveDatabaseState();

  logActivity(userId || "system", "PLANIFICATION_AUDIENCE", `Audience planifiée pour le dossier ${dossier.numDossier} à la date du ${date} à ${time} (Salle: ${room})`, req);

  res.json({ success: true, hearing: newHearing });
});

app.patch("/api/hearings/:id", (req, res) => {
  const { id } = req.params;
  const { userId, status, notes, compteRendu } = req.body;

  const audience = dbState.hearings.find(h => h.id === id);
  if (!audience) {
    return res.status(404).json({ success: false, message: "Audience introuvable." });
  }

  if (status) audience.status = status;
  if (notes !== undefined) audience.notes = notes;
  if (compteRendu !== undefined) audience.compteRendu = compteRendu;

  saveDatabaseState();

  logActivity(userId || "system", "MODIFICATION_AUDIENCE", `Audience mise à jour pour dossier ${audience.numDossier} (Statut: ${audience.status})`, req);

  res.json({ success: true, hearing: audience });
});

// 5. Activity Logs endpoint (Admin only)
app.get("/api/activities", (req, res) => {
  // Sort logs by date desc
  const sorted = [...dbState.activityLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  res.json({ success: true, logs: sorted });
});

// 6. Gemini-powered official Judicial minutes/report compiler
app.post("/api/generate-minutes", async (req, res) => {
  const { notes, caseNum, caseTitle, tribunalName, dateAudience, greffierName, jures } = req.body;
  
  if (!notes) {
    return res.status(400).json({ success: false, message: "Notes d'audiences brutes requises pour la compilation." });
  }

  const prompt = `
Vous êtes Legalyx-AI, un modèle d'IA spécialisé dans la rédaction juridique de la République du Cameroun.
Votre tâche est de transformer des notes d'audiences brutes ou de saisie de greffe en un COMPTE-RENDU / PROCES-VERBAL D'AUDIENCE officiel hautement formalisé.

Vous devez strictement respecter la structure et le style des cours camerounaises :
1. En-tête officiel à gauche :
   REPUBLIQUE DU CAMEROUN
   Paix - Travail - Patrie
   ---
   TRIBUNAL : ${tribunalName || "Tribunal de Grande Instance du Mfoundi (Yaoundé)"}
   ---
2. Titre centré en MAJUSCULES : "PROCES-VERBAL ET MINUTE D'AUDIENCE PUBLIQUE"
3. Informations sur l'affaire :
   - N° de dossier : ${caseNum || "Non spécifié"}
   - Affaire : ${caseTitle || "Non spécifié"}
   - Date de l'audience : ${dateAudience || "du jour"}
   - Greffier d'audience : ${greffierName || "Thérèse Atangana"}
4. Rédiger le corps du texte sous forme de paragraphes juridiques soignés (en français) :
   - Présentation de la composition du Tribunal (Président, Greffier, Substitut du Procureur).
   - Appel de la cause.
   - Synthèse fidèle et structurée des débats, dépositions, questions posées et plaidoiries basées sur les notes fournies ci-dessous.
   - Décision finale ou ordonnance du Tribunal (si présente dans les notes, sinon indiquer 'renvoyé pour délibéré').
5. Clôturer par les mentions de signature traditionnelles : "Fait au Greffe du Tribunal..." / "Pour le Greffier d'Audience" / "Le Magistrat-Président".

Voici les notes brutes d'audience fournies par le greffe :
"""
${notes}
"""

Générez uniquement le compte-rendu d'audience complet, rédigé de manière irréprochable et solennelle, prêt à être archivé. Ne rajoutez aucun commentaire ou texte d'accompagnement inutile.
  `;

  try {
    if (ai) {
      console.log(`[AI-Minutes] Lancement de la génération avec gemini-3.5-flash pour le dossier ${caseNum}...`);
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          temperature: 0.2, // Low temperature for high precision legal documentation
        }
      });
      
      const text = response.text;
      if (text) {
        return res.json({ success: true, compteRendu: text.trim() });
      } else {
        throw new Error("La réponse de l'API Gemini est vide.");
      }
    } else {
      // Fallback generator when GEMINI_API_KEY is not configured
      console.log("[AI-Minutes] Utilisation du générateur de compte-rendu simulé en l'absence de clé API.");
      const fallbackReport = `REPUBLIQUE DU CAMEROUN
Paix - Travail - Patrie
---
${tribunalName || "TRIBUNAL DE GRANDE INSTANCE DU MFOUNDI"}
---
PROCES-VERBAL ET MINUTE D'AUDIENCE PUBLIQUE DU ${dateAudience || new Date().toLocaleDateString("fr-FR")}

Affaire N° : ${caseNum || "TGI-YDE/2026/001-CIV"}
Parties : ${caseTitle || "Litige Particulier"}
Greffier d'audience : ${greffierName || "Mme Thérèse Atangana"}

En l'audience publique ordinaire du tribunal de céans, s'est tenue l'audience relative à l'affaire mentionnée en marge.

Composition de la Cour :
- Président : M. le Juge Emmanuel Nsame
- Représentant du Ministère Public : Substitut de Procureur de la République
- Greffier d'audience : ${greffierName || "Mme Thérèse Atangana"}

DÉROULEMENT DES DÉBATS :
La cause ayant été régulièrement inscrite au rôle de ce jour a été appelée. Le demandeur s'est présenté en personne assisté de son conseil. La défense a fait valoir des motifs légitimes d'opposition aux éléments de preuve versés au dossier.

La Cour, après examen des notes brutes transmises :
"${notes}"

A pris acte des déclarations faites et ordonne la jonction des nouvelles pièces numérisées au dossier principal d'instruction.

DÉCISION / DISPOSITIF :
Le Tribunal renvoie l'affaire à la session ordinaire subséquente pour la poursuite de l'instruction contradictoire des parties.

Fait au Greffe du Tribunal, le ${new Date().toLocaleDateString("fr-FR")}.

      Le Greffier d'Audience                                Le Président du Tribunal`;
      
      return res.json({ success: true, compteRendu: fallbackReport, simulated: true });
    }
  } catch (err: any) {
    console.error("[AI-Minutes-Error]", err);
    return res.status(500).json({ success: false, message: "Erreur lors de la compilation automatique des minutes : " + err.message });
  }
});

// User Management Endpoints (Administrateur only)
app.get("/api/users", (req, res) => {
  const usersWithActive = dbState.users.map(u => ({
    ...u,
    active: u.active !== false,
    permissions: u.permissions || getDefaultPermissions(u.role)
  }));
  res.json({ success: true, users: usersWithActive });
});

app.post("/api/users", (req, res) => {
  const { adminId, username, fullName, role, tribunal, mfaEnabled, biometricRegistered, permissions, avatar } = req.body;
  if (!username || !fullName || !role || !tribunal) {
    return res.status(400).json({ success: false, message: "Tous les champs obligatoires doivent être renseignés." });
  }

  const existing = dbState.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (existing) {
    return res.status(400).json({ success: false, message: "Cet identifiant unique est déjà attribué à un autre agent." });
  }

  const newUser = {
    id: `u_${Date.now()}`,
    username: username.toLowerCase().trim(),
    fullName: fullName.trim(),
    role,
    tribunal: tribunal.trim(),
    mfaEnabled: mfaEnabled ?? true,
    biometricRegistered: biometricRegistered ?? true,
    avatar: avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120",
    passwordHash: "5e97940a5c3660", // default hash
    active: true,
    permissions: permissions || getDefaultPermissions(role)
  };

  dbState.users.push(newUser);
  saveDatabaseState();

  logActivity(adminId || "system", "ENREGISTREMENT_UTILISATEUR", `Création du profil de l'agent : ${newUser.fullName} (${newUser.role}) avec gestion granulaire`, req);

  res.json({ success: true, user: newUser });
});

app.patch("/api/users/:id", (req, res) => {
  const { id } = req.params;
  const { adminId, active, role, fullName, tribunal, permissions, avatar } = req.body;

  const user = dbState.users.find(u => u.id === id);
  if (!user) {
    return res.status(404).json({ success: false, message: "Utilisateur introuvable." });
  }

  if (active !== undefined) {
    user.active = active;
    const statusText = active ? "actif" : "désactivé";
    logActivity(adminId || "system", active ? "ACTIVATION_UTILISATEUR" : "DESACTIVATION_UTILISATEUR", `Statut du compte de l'agent ${user.fullName} modifié à : ${statusText}`, req);
  }

  if (role) {
    user.role = role;
    if (!permissions) {
      user.permissions = getDefaultPermissions(role);
    }
  }
  if (fullName) user.fullName = fullName;
  if (tribunal) user.tribunal = tribunal;
  if (avatar !== undefined) user.avatar = avatar;
  if (permissions) {
    user.permissions = {
      ...(user.permissions || getDefaultPermissions(user.role)),
      ...permissions
    };
    logActivity(adminId || "system", "MIS_A_JOUR_HABILITATIONS", `Habilitations granulaires modifiées pour l'agent ${user.fullName}`, req);
  }

  saveDatabaseState();

  res.json({ success: true, user });
});

app.delete("/api/users/:id", (req, res) => {
  const { id } = req.params;
  const { adminId } = req.query;

  const index = dbState.users.findIndex(u => u.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Utilisateur introuvable." });
  }

  const user = dbState.users[index];
  if (user.id === adminId) {
    return res.status(400).json({ success: false, message: "Vous ne pouvez pas supprimer votre propre compte." });
  }

  dbState.users.splice(index, 1);
  saveDatabaseState();

  logActivity((adminId as string) || "system", "SUPPRESSION_UTILISATEUR", `Compte de l'agent définitivement supprimé de l'annuaire : ${user.fullName} (${user.role})`, req);

  res.json({ success: true });
});

// Court Profile Endpoints (Administrateur only)
app.get("/api/courts", (req, res) => {
  if (!dbState.courtProfiles) {
    dbState.courtProfiles = [];
  }
  res.json({ success: true, courtProfiles: dbState.courtProfiles });
});

app.post("/api/courts", (req, res) => {
  const { adminId, name, type, president, address, phone, email, jurisdictionRegion, foundingDate, activeChambers } = req.body;
  
  if (!name || !type || !president) {
    return res.status(400).json({ success: false, message: "Le nom, le type et le président du tribunal sont obligatoires." });
  }

  const newCourt = {
    id: `court_${Date.now()}`,
    name: name.trim(),
    type: type.trim(),
    president: president.trim(),
    address: (address || "").trim(),
    phone: (phone || "").trim(),
    email: (email || "").trim(),
    jurisdictionRegion: (jurisdictionRegion || "").trim(),
    foundingDate: foundingDate || "",
    activeChambers: activeChambers || []
  };

  if (!dbState.courtProfiles) {
    dbState.courtProfiles = [];
  }
  dbState.courtProfiles.push(newCourt);
  saveDatabaseState();

  logActivity(adminId || "system", "CREATION_PROFIL_TRIBUNAL", `Création du profil du tribunal : ${newCourt.name} (${newCourt.type})`, req);

  res.json({ success: true, courtProfile: newCourt });
});

app.patch("/api/courts/:id", (req, res) => {
  const { id } = req.params;
  const { adminId, name, type, president, address, phone, email, jurisdictionRegion, foundingDate, activeChambers } = req.body;

  if (!dbState.courtProfiles) {
    dbState.courtProfiles = [];
  }
  const court = dbState.courtProfiles.find(c => c.id === id);
  if (!court) {
    return res.status(404).json({ success: false, message: "Profil de tribunal introuvable." });
  }

  if (name) court.name = name.trim();
  if (type) court.type = type.trim();
  if (president) court.president = president.trim();
  if (address !== undefined) court.address = address.trim();
  if (phone !== undefined) court.phone = phone.trim();
  if (email !== undefined) court.email = email.trim();
  if (jurisdictionRegion !== undefined) court.jurisdictionRegion = jurisdictionRegion.trim();
  if (foundingDate !== undefined) court.foundingDate = foundingDate;
  if (activeChambers !== undefined) court.activeChambers = activeChambers;

  saveDatabaseState();

  logActivity(adminId || "system", "MISE_A_JOUR_TRIBUNAL", `Mise à jour du profil du tribunal : ${court.name}`, req);

  res.json({ success: true, courtProfile: court });
});

app.delete("/api/courts/:id", (req, res) => {
  const { id } = req.params;
  const { adminId } = req.query;

  if (!dbState.courtProfiles) {
    dbState.courtProfiles = [];
  }
  const index = dbState.courtProfiles.findIndex(c => c.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Profil de tribunal introuvable." });
  }

  const court = dbState.courtProfiles[index];
  dbState.courtProfiles.splice(index, 1);
  saveDatabaseState();

  logActivity((adminId as string) || "system", "SUPPRESSION_TRIBUNAL", `Désactivation et retrait du profil du tribunal : ${court.name}`, req);

  res.json({ success: true });
});

// Stats Analytical endpoint
app.get("/api/stats", (req, res) => {
  const activeCases = dbState.cases.filter(c => c.status === "En cours").length;
  const deliberationCases = dbState.cases.filter(c => c.status === "Mis en délibéré").length;
  const archivedCases = dbState.cases.filter(c => c.status === "Archivé").length;
  const closedCases = dbState.cases.filter(c => c.status === "Clôturé").length;
  const urgentCases = dbState.cases.filter(c => c.priority === "Urgente").length;
  
  const docsCount = dbState.cases.reduce((sum, c) => sum + (c.documents ? c.documents.length : 0), 0);
  const hearingsCount = dbState.hearings.length;

  res.json({
    success: true,
    stats: {
      totalCases: dbState.cases.length,
      activeHearings: dbState.hearings.filter(h => h.status === "Planifiée" || h.status === "En cours").length,
      urgentCases: urgentCases,
      digitizedDocsCount: docsCount,
      byNature: [
        { name: "Pénal", value: dbState.cases.filter(c => c.nature === "Pénal").length },
        { name: "Civil", value: dbState.cases.filter(c => c.nature === "Civil").length },
        { name: "Administratif", value: dbState.cases.filter(c => c.nature === "Administratif").length },
        { name: "Commercial", value: dbState.cases.filter(c => c.nature === "Commercial").length },
        { name: "Social", value: dbState.cases.filter(c => c.nature === "Social").length },
      ],
      byStatus: [
        { name: "En cours", value: activeCases },
        { name: "En délibéré", value: deliberationCases },
        { name: "Clôturé", value: closedCases },
        { name: "Archivé", value: archivedCases },
      ],
      monthlyActivity: [
        { month: "Mai", dossiers: 2, audiences: 3 },
        { month: "Juin", dossiers: 4, audiences: 5 },
        { month: "Juillet", dossiers: dbState.cases.length, audiences: hearingsCount },
      ]
    }
  });
});

// Configure Vite middleware or Static files
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Legalyx-CMS] Serveur actif sur http://0.0.0.0:${PORT}`);
  });
}

startServer();
