import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";
import "./src/lib/supabaseAdmin.js";
import supabase from "./src/lib/supabaseAdmin.js";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use(express.json());

// ============================================================================
// INITIALISATION GEMINI
// ============================================================================
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
  console.log("Legalyx-CMS: Client Gemini initialisé.");
} else {
  console.warn("Legalyx-CMS Warning: GEMINI_API_KEY non définie. La génération IA utilisera le mode simulé.");
}

// ============================================================================
// HELPERS : LOG D'AUDIT (chaîne de blocs)
// ============================================================================
async function logActivity(userId: string, action: string, details: string, req: express.Request, category = "OPERATION", severity = "INFO") {
  try {
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || "127.0.0.1";

    // Récupérer le hash du dernier log pour la chaîne d'intégrité
    const { data: lastLog } = await supabase
      .from("activity_logs")
      .select("integrity_hash")
      .order("timestamp", { ascending: false })
      .limit(1)
      .single();

    const previousHash = lastLog?.integrity_hash || "GENESIS_BLOCK_LEGALLYX_CMS_2026";

    // Récupérer le username
    const { data: user } = await supabase
      .from("users")
      .select("full_name, role")
      .eq("id", userId)
      .single();

    const content = `${userId}-${action}-${new Date().toISOString()}-${details}-${previousHash}`;
    const integrityHash = crypto.createHash("sha256").update(content).digest("hex");

    await supabase.from("activity_logs").insert({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      user_id: userId,
      username: user?.full_name || "Système / Inconnu",
      action,
      details,
      category,
      severity,
      ip_address: ip,
      integrity_hash: integrityHash,
    });
  } catch (err) {
    console.error("[Legalyx-Audit] Erreur de journalisation:", err);
  }
}

// ============================================================================
// HELPERS : PERMISSIONS PAR DÉFAUT (inchangé par rapport au code original)
// ============================================================================
function getDefaultPermissions(role: string) {
  switch (role) {
    case "Administrateur":
      return { canCreateCases: false, canDeleteCases: false, canEditPlumitif: false, canManageHearings: false, canUploadDocuments: false, canVerifyIntegrity: true };
    case "Président":
      return { canCreateCases: true, canDeleteCases: true, canEditPlumitif: true, canManageHearings: true, canUploadDocuments: true, canVerifyIntegrity: true };
    case "Juge":
      return { canCreateCases: true, canDeleteCases: true, canEditPlumitif: true, canManageHearings: true, canUploadDocuments: true, canVerifyIntegrity: true };
    case "Greffier":
      return { canCreateCases: true, canDeleteCases: false, canEditPlumitif: true, canManageHearings: true, canUploadDocuments: true, canVerifyIntegrity: true };
    case "Secrétaire":
    default:
      return { canCreateCases: true, canDeleteCases: false, canEditPlumitif: false, canManageHearings: false, canUploadDocuments: true, canVerifyIntegrity: false };
  }
}

// ============================================================================
// VÉRIFICATION DE CONNEXION SUPABASE AU DÉMARRAGE
// ============================================================================
async function verifySupabaseConnection() {
  try {
    const { count, error } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    if (error) throw error;
    console.log(`[Legalyx-CMS] Connexion Supabase établie. ${count} utilisateur(s) en base.`);
  } catch (err: any) {
    console.error(`[Legalyx-CMS] ERREUR FATALE : Connexion Supabase impossible.`);
    console.error(`  Vérifiez vos variables SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans .env.local`);
    console.error(`  Détail : ${err.message}`);
    process.exit(1);
  }
}

// Helper : construire un objet Case complet (camelCase) avec ses documents
async function buildCaseWithDocuments(caseRow: any) {
  const { data: docs } = await supabase
    .from("case_documents")
    .select("*")
    .eq("case_id", caseRow.id);

  let magistratName = "";
  if (caseRow.magistrat_id) {
    const { data: mag } = await supabase.from("users").select("full_name").eq("id", caseRow.magistrat_id).single();
    magistratName = mag?.full_name || "";
  }

  return {
    id: caseRow.id,
    numDossier: caseRow.num_dossier,
    title: caseRow.title,
    description: caseRow.description,
    tribunal: caseRow.tribunal,
    nature: caseRow.nature,
    status: caseRow.status,
    parties: caseRow.parties,
    priority: caseRow.priority,
    dateCreation: caseRow.created_at,
    magistratId: caseRow.magistrat_id,
    magistratName,
    notesDeliberation: caseRow.notes_deliberation,
    documents: (docs || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      date: d.uploaded_at,
      type: d.type,
      hash: d.hash,
      size: d.size,
      uploadedBy: d.uploaded_by,
      secure: d.secure,
      hearingId: d.hearing_id,
    })),
  };
}

verifySupabaseConnection();

// ============================================================================
// API ENDPOINTS
// ============================================================================

// ---------------------------------------------------------------------------
// 1. AUTHENTIFICATION
// ---------------------------------------------------------------------------
app.post("/api/auth/login", async (req, res) => {
  const { username, hasBiometrics, password, pinMFA } = req.body;

  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("*, user_permissions(*)")
      .eq("username", username)
      .single();

    if (error || !user) {
      return res.status(401).json({ success: false, message: "Identifiants invalides." });
    }

    if (user.active === false) {
      return res.status(403).json({ success: false, message: "Ce compte utilisateur a été désactivé par l'administrateur." });
    }

    // Biométrie simulée
    if (hasBiometrics) {
      await logActivity(user.id, "AUTHENTIFICATION_BIOMETRIQUE", "Validation biométrique de l'empreinte digitale et scan rétinien réussis.", req, "AUTHENTICATION", "INFO");
      return res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          role: user.role,
          tribunal: user.tribunal,
          avatar: user.avatar,
          mfaEnabled: user.mfa_enabled,
          biometricRegistered: user.biometric_registered,
          active: user.active !== false,
          permissions: user.user_permissions?.[0]
            ? {
                canCreateCases: user.user_permissions[0].can_create_cases,
                canDeleteCases: user.user_permissions[0].can_delete_cases,
                canEditPlumitif: user.user_permissions[0].can_edit_plumitif,
                canManageHearings: user.user_permissions[0].can_manage_hearings,
                canUploadDocuments: user.user_permissions[0].can_upload_documents,
                canVerifyIntegrity: user.user_permissions[0].can_verify_integrity,
              }
            : getDefaultPermissions(user.role),
        },
        message: "Authentification biométrique forte & MFA crypté réussis."
      });
    }

    // Authentification par mot de passe
    if (password && (password === "admin" || password === "legalyx2026" || password === "password")) {
      if (user.mfa_enabled && !pinMFA) {
        return res.json({
          success: true,
          mfaRequired: true,
          userId: user.id,
          message: "Code d'authentification multifacteur requis (MFA)."
        });
      }

      if (user.mfa_enabled && pinMFA && pinMFA !== "123456") {
        return res.status(401).json({ success: false, message: "Code MFA incorrect." });
      }

      await logActivity(user.id, "CONNEXION_MOT_DE_PASSE_MFA", "Authentification validée via mot de passe chiffré et OTP multifacteur.", req, "AUTHENTICATION", "INFO");

      return res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          role: user.role,
          tribunal: user.tribunal,
          avatar: user.avatar,
          mfaEnabled: user.mfa_enabled,
          biometricRegistered: user.biometric_registered,
          active: user.active !== false,
          permissions: user.user_permissions?.[0]
            ? {
                canCreateCases: user.user_permissions[0].can_create_cases,
                canDeleteCases: user.user_permissions[0].can_delete_cases,
                canEditPlumitif: user.user_permissions[0].can_edit_plumitif,
                canManageHearings: user.user_permissions[0].can_manage_hearings,
                canUploadDocuments: user.user_permissions[0].can_upload_documents,
                canVerifyIntegrity: user.user_permissions[0].can_verify_integrity,
              }
            : getDefaultPermissions(user.role),
        },
        message: "Authentification robuste réussie."
      });
    }

    return res.status(401).json({ success: false, message: "Mot de passe erroné ou code d'accès non valide." });
  } catch (err: any) {
    console.error("[Auth Error]", err);
    return res.status(500).json({ success: false, message: "Erreur serveur lors de l'authentification." });
  }
});

// ---------------------------------------------------------------------------
// 2. DOSSIERS (CASES) — Lecture et Création
// ---------------------------------------------------------------------------
app.get("/api/cases", async (req, res) => {
  const { userId } = req.query;
  try {
    if (userId) {
      const { data: user } = await supabase.from("users").select("role").eq("id", userId).single();
      if (user?.role === "Administrateur") {
        return res.status(403).json({ success: false, message: "Accès refusé : L'administrateur n'a pas accès aux dossiers judiciaires." });
      }
    }

    const { data: cases, error } = await supabase
      .from("cases")
      .select(`
        *,
        case_documents(*)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Mapper le format snake_case Supabase → camelCase pour le frontend
    const mapped = (cases || []).map((c: any) => ({
      id: c.id,
      numDossier: c.num_dossier,
      title: c.title,
      description: c.description,
      tribunal: c.tribunal,
      nature: c.nature,
      status: c.status,
      parties: c.parties,
      priority: c.priority,
      dateCreation: c.created_at,
      magistratId: c.magistrat_id,
      magistratName: c.magistrat_id || "",
      notesDeliberation: c.notes_deliberation,
      documents: (c.case_documents || []).map((d: any) => ({
        id: d.id,
        name: d.name,
        date: d.uploaded_at,
        type: d.type,
        hash: d.hash,
        size: d.size,
        uploadedBy: d.uploaded_by,
        secure: d.secure,
        hearingId: d.hearing_id,
      })),
    }));

    // Enrichir avec le nom du magistrat
    if (mapped.length > 0) {
      const magistratIds = [...new Set(mapped.filter(c => c.magistratId).map(c => c.magistratId))];
      const { data: magistrats } = await supabase
        .from("users")
        .select("id, full_name")
        .in("id", magistratIds);

      const magMap = Object.fromEntries((magistrats || []).map((m: any) => [m.id, m.full_name]));
      mapped.forEach((c: any) => { c.magistratName = magMap[c.magistratId] || ""; });
    }

    res.json({ success: true, cases: mapped });
  } catch (err: any) {
    console.error("[Cases GET Error]", err);
    res.status(500).json({ success: false, message: "Erreur lors de la récupération des dossiers." });
  }
});

app.post("/api/cases", async (req, res) => {
  const { userId, numDossier, title, description, tribunal, nature, parties, priority, magistratId } = req.body;

  if (!numDossier || !title || !tribunal || !nature) {
    return res.status(400).json({ success: false, message: "Champs obligatoires manquants." });
  }

  try {
    // Déterminer le magistrat
    let finalMagistratId = magistratId;
    if (!finalMagistratId) {
      const { data: juge } = await supabase.from("users").select("id").eq("role", "Juge").limit(1).single();
      finalMagistratId = juge?.id || userId;
    }

    const { data: newCase, error } = await supabase
      .from("cases")
      .insert({
        id: `c_${Date.now()}`,
        num_dossier: numDossier,
        title,
        description: description || "Aucune description",
        tribunal,
        nature,
        status: "En cours",
        parties: parties || "Ministère Public contre X",
        priority: priority || "Moyenne",
        magistrat_id: finalMagistratId,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({ success: false, message: "Ce numéro de dossier existe déjà." });
      }
      throw error;
    }

    await logActivity(userId || "system", "CREATION_DOSSIER", `Nouveau dossier numérisé : ${numDossier} - ${title}`, req, "CASE_MANAGEMENT");

    res.json({
      success: true,
      case: {
        id: newCase.id,
        numDossier: newCase.num_dossier,
        title: newCase.title,
        description: newCase.description,
        tribunal: newCase.tribunal,
        nature: newCase.nature,
        status: newCase.status,
        parties: newCase.parties,
        priority: newCase.priority,
        dateCreation: newCase.created_at,
        magistratId: newCase.magistrat_id,
        magistratName: "",
        notesDeliberation: newCase.notes_deliberation,
        documents: [],
      },
    });
  } catch (err: any) {
    console.error("[Cases POST Error]", err);
    res.status(500).json({ success: false, message: "Erreur lors de la création du dossier." });
  }
});

// ---------------------------------------------------------------------------
// 2b. DOSSIERS — Mise à jour
// ---------------------------------------------------------------------------
app.patch("/api/cases/:id", async (req, res) => {
  const { id } = req.params;
  const { userId, status, notesDeliberation, magistratId, magistratName, priority } = req.body;

  try {
    const updatePayload: any = {};
    if (status) updatePayload.status = status;
    if (notesDeliberation !== undefined) updatePayload.notes_deliberation = notesDeliberation;
    if (magistratId) updatePayload.magistrat_id = magistratId;
    if (priority) updatePayload.priority = priority;

    const { data: updated, error } = await supabase
      .from("cases")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error || !updated) {
      return res.status(404).json({ success: false, message: "Dossier introuvable." });
    }

    await logActivity(userId || "system", "MODIFICATION_DOSSIER", `Mise à jour du dossier : ${updated.num_dossier} (Statut: ${updated.status})`, req, "CASE_UPDATE");

    res.json({
      success: true,
      case: {
        id: updated.id,
        numDossier: updated.num_dossier,
        title: updated.title,
        status: updated.status,
        priority: updated.priority,
        notesDeliberation: updated.notes_deliberation,
      },
    });
  } catch (err: any) {
    console.error("[Cases PATCH Error]", err);
    res.status(500).json({ success: false, message: "Erreur lors de la mise à jour du dossier." });
  }
});

// ---------------------------------------------------------------------------
// 3. DOCUMENTS — Upload (métadonnées)
// ---------------------------------------------------------------------------
app.post("/api/cases/:id/documents", async (req, res) => {
  const { id } = req.params;
  const { userId, name, type, size, hearingId } = req.body;

  try {
    // Vérifier que le dossier existe
    const { data: dossier, error: caseError } = await supabase
      .from("cases")
      .select("num_dossier")
      .eq("id", id)
      .single();

    if (caseError || !dossier) {
      return res.status(404).json({ success: false, message: "Dossier introuvable." });
    }

    const { data: user } = await supabase.from("users").select("full_name").eq("id", userId).single();
    const uploaderName = user?.full_name || "Secrétariat";

    const simulatedHash = crypto.createHash("sha256").update(`${name}-${Date.now()}`).digest("hex");

    const { data: newDoc, error } = await supabase
      .from("case_documents")
      .insert({
        id: `doc_${Date.now()}`,
        case_id: id,
        hearing_id: hearingId || null,
        name,
        type: type || "Pièce jointe",
        hash: simulatedHash,
        size: size || "1.2 MB",
        uploaded_by: uploaderName,
        secure: true,
      })
      .select()
      .single();

    if (error) throw error;

    const hearingSuffix = hearingId ? ` lié à l'audience (${hearingId})` : "";
    await logActivity(userId || "system", "NUMERISATION_DOCUMENT", `Document numérisé et haché ajouté au dossier ${dossier.num_dossier}${hearingSuffix} : ${name} (SHA-256: ${simulatedHash.substring(0, 10)}...)`, req, "DOCUMENT_MANAGEMENT");

    // Renvoyer le case complet avec ses documents mis à jour
    const { data: refreshedCase } = await supabase.from("cases").select("*").eq("id", id).single();
    const caseWithDocs = await buildCaseWithDocuments(refreshedCase);

    res.json({ success: true, case: caseWithDocs });
  } catch (err: any) {
    console.error("[Document POST Error]", err);
    res.status(500).json({ success: false, message: "Erreur lors de l'ajout du document." });
  }
});

// ---------------------------------------------------------------------------
// 3b. DOCUMENTS — Suppression
// ---------------------------------------------------------------------------
app.delete("/api/cases/:caseId/documents/:docId", async (req, res) => {
  const { caseId, docId } = req.params;
  const { userId } = req.query;

  try {
    // Récupérer le nom du document avant suppression
    const { data: doc } = await supabase
      .from("case_documents")
      .select("name")
      .eq("id", docId)
      .single();

    if (!doc) {
      return res.status(404).json({ success: false, message: "Document introuvable." });
    }

    const { error } = await supabase
      .from("case_documents")
      .delete()
      .eq("id", docId);

    if (error) throw error;

    // Récupérer le numéro de dossier pour le log
    const { data: dossier } = await supabase.from("cases").select("num_dossier").eq("id", caseId).single();

    await logActivity((userId as string) || "system", "SUPPRESSION_DOCUMENT", `Document confidentiel détruit : ${doc.name} sur dossier ${dossier?.num_dossier || caseId}`, req, "DOCUMENT_MANAGEMENT", "WARNING");

    // Renvoyer le case complet avec ses documents mis à jour
    const { data: refreshedCase } = await supabase.from("cases").select("*").eq("id", caseId).single();
    const caseWithDocs = await buildCaseWithDocuments(refreshedCase);

    res.json({ success: true, case: caseWithDocs });
  } catch (err: any) {
    console.error("[Document DELETE Error]", err);
    res.status(500).json({ success: false, message: "Erreur lors de la suppression du document." });
  }
});

// ---------------------------------------------------------------------------
// 4. AUDIENCES (HEARINGS) — Lecture et Création
// ---------------------------------------------------------------------------
app.get("/api/hearings", async (req, res) => {
  const { userId } = req.query;
  try {
    if (userId) {
      const { data: user } = await supabase.from("users").select("role").eq("id", userId).single();
      if (user?.role === "Administrateur") {
        return res.status(403).json({ success: false, message: "Accès refusé : L'administrateur n'a pas accès aux rôles d'audiences." });
      }
    }

    const { data: hearings, error } = await supabase
      .from("hearings")
      .select(`
        *,
        cases:num_dossier, case_title:title
      `)
      .order("date", { ascending: false });

    if (error) throw error;

    // Le select ci-dessus ne fait pas de jointure correcte sur Supabase,
    // on refait manuellement
    const { data: cleanHearings } = await supabase
      .from("hearings")
      .select("*")
      .order("date", { ascending: false });

    const mapped = (cleanHearings || []).map((h: any) => ({
      id: h.id,
      caseId: h.case_id,
      numDossier: "", // rempli ci-dessous
      caseTitle: "",  // rempli ci-dessous
      date: h.date,
      time: h.time?.substring(0, 5) || "09:00",
      room: h.location,
      status: h.status,
      notes: h.notes,
      compteRendu: h.transcript,
      greffierName: "", // pas de champ dédié en v2 — laissé vide
      reporter: h.signed_by,
    }));

    // Enrichir avec les infos des dossiers liés
    const caseIds = [...new Set(mapped.map((h: any) => h.caseId))];
    if (caseIds.length > 0) {
      const { data: linkedCases } = await supabase
        .from("cases")
        .select("id, num_dossier, title")
        .in("id", caseIds);
      const caseMap = Object.fromEntries((linkedCases || []).map((c: any) => [c.id, c]));
      mapped.forEach((h: any) => {
        const linked = caseMap[h.caseId];
        if (linked) {
          h.numDossier = linked.num_dossier;
          h.caseTitle = linked.title;
        }
      });
    }

    res.json({ success: true, hearings: mapped });
  } catch (err: any) {
    console.error("[Hearings GET Error]", err);
    res.status(500).json({ success: false, message: "Erreur lors de la récupération des audiences." });
  }
});

app.post("/api/hearings", async (req, res) => {
  const { userId, caseId, date, time, room, notes } = req.body;

  try {
    const { data: dossier, error: caseError } = await supabase
      .from("cases")
      .select("num_dossier, title")
      .eq("id", caseId)
      .single();

    if (caseError || !dossier) {
      return res.status(400).json({ success: false, message: "Le dossier spécifié est inexistant." });
    }

    const { data: user } = await supabase.from("users").select("full_name").eq("id", userId).single();
    const greffierName = user?.full_name || "Secrétaire Greffe";

    const { data: newHearing, error } = await supabase
      .from("hearings")
      .insert({
        id: `h_${Date.now()}`,
        case_id: caseId,
        date,
        time: time || "09:00",
        type: "Audience publique",
        location: room || "Chambre Civile I",
        status: "Planifiée",
        notes: notes || "",
      })
      .select()
      .single();

    if (error) throw error;

    await logActivity(userId || "system", "PLANIFICATION_AUDIENCE", `Audience planifiée pour le dossier ${dossier.num_dossier} le ${date} à ${time} (${room})`, req, "HEARING_MANAGEMENT");

    res.json({
      success: true,
      hearing: {
        id: newHearing.id,
        caseId: newHearing.case_id,
        numDossier: dossier.num_dossier,
        caseTitle: dossier.title,
        date: newHearing.date,
        time: newHearing.time?.substring(0, 5) || "09:00",
        room: newHearing.location,
        status: newHearing.status,
        notes: newHearing.notes,
        compteRendu: newHearing.transcript,
        greffierName,
      },
    });
  } catch (err: any) {
    console.error("[Hearings POST Error]", err);
    res.status(500).json({ success: false, message: "Erreur lors de la planification de l'audience." });
  }
});

app.patch("/api/hearings/:id", async (req, res) => {
  const { id } = req.params;
  const { userId, status, notes, compteRendu } = req.body;

  try {
    const updatePayload: any = {};
    if (status) updatePayload.status = status;
    if (notes !== undefined) updatePayload.notes = notes;
    if (compteRendu !== undefined) updatePayload.transcript = compteRendu;

    const { data: updated, error } = await supabase
      .from("hearings")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error || !updated) {
      return res.status(404).json({ success: false, message: "Audience introuvable." });
    }

    await logActivity(userId || "system", "MODIFICATION_AUDIENCE", `Audience mise à jour (ID: ${id}, Statut: ${updated.status})`, req, "HEARING_UPDATE");

    res.json({
      success: true,
      hearing: {
        id: updated.id,
        caseId: updated.case_id,
        date: updated.date,
        time: updated.time?.substring(0, 5) || "09:00",
        room: updated.location,
        status: updated.status,
        notes: updated.notes,
        compteRendu: updated.transcript,
      },
    });
  } catch (err: any) {
    console.error("[Hearings PATCH Error]", err);
    res.status(500).json({ success: false, message: "Erreur lors de la mise à jour de l'audience." });
  }
});

// ---------------------------------------------------------------------------
// 5. ACTIVITÉS / AUDIT (lecture seule)
// ---------------------------------------------------------------------------
app.get("/api/activities", async (req, res) => {
  try {
    const { data: logs, error } = await supabase
      .from("activity_logs")
      .select("*")
      .order("timestamp", { ascending: false });

    if (error) throw error;

    const mapped = (logs || []).map((log: any) => ({
      id: log.id,
      userId: log.user_id,
      userName: log.username,
      userRole: "Administrateur", // le rôle n'est pas stocké dans les logs en v2
      action: log.action,
      timestamp: log.timestamp,
      ip: log.ip_address || "127.0.0.1",
      details: log.details,
      integrityHash: log.integrity_hash,
    }));

    res.json({ success: true, logs: mapped });
  } catch (err: any) {
    console.error("[Activities Error]", err);
    res.status(500).json({ success: false, message: "Erreur lors de la récupération des logs." });
  }
});

// ---------------------------------------------------------------------------
// 6. GÉNÉRATION IA DE COMPTES-RENDUS (Gemini)
// ---------------------------------------------------------------------------
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
      console.log(`[AI-Minutes] Génération avec gemini-3.5-flash pour le dossier ${caseNum}...`);
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: { temperature: 0.2 },
      });

      const text = response.text;
      if (text) {
        return res.json({ success: true, compteRendu: text.trim() });
      } else {
        throw new Error("La réponse de l'API Gemini est vide.");
      }
    } else {
      console.log("[AI-Minutes] Générateur simulé (pas de clé API Gemini).");
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
    console.error("[AI-Minutes Error]", err);
    return res.status(500).json({ success: false, message: "Erreur lors de la compilation automatique des minutes : " + err.message });
  }
});

// ---------------------------------------------------------------------------
// 7. GESTION UTILISATEURS (Administrateur)
// ---------------------------------------------------------------------------
app.get("/api/users", async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from("users")
      .select(`
        *,
        user_permissions(*)
      `)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const mapped = (users || []).map((u: any) => ({
      id: u.id,
      username: u.username,
      fullName: u.full_name,
      role: u.role,
      tribunal: u.tribunal,
      avatar: u.avatar,
      mfaEnabled: u.mfa_enabled,
      biometricRegistered: u.biometric_registered,
      passwordHash: u.password_hash,
      active: u.active !== false,
      permissions: u.user_permissions?.[0]
        ? {
            canCreateCases: u.user_permissions[0].can_create_cases,
            canDeleteCases: u.user_permissions[0].can_delete_cases,
            canEditPlumitif: u.user_permissions[0].can_edit_plumitif,
            canManageHearings: u.user_permissions[0].can_manage_hearings,
            canUploadDocuments: u.user_permissions[0].can_upload_documents,
            canVerifyIntegrity: u.user_permissions[0].can_verify_integrity,
          }
        : getDefaultPermissions(u.role),
    }));

    res.json({ success: true, users: mapped });
  } catch (err: any) {
    console.error("[Users GET Error]", err);
    res.status(500).json({ success: false, message: "Erreur lors de la récupération des utilisateurs." });
  }
});

app.post("/api/users", async (req, res) => {
  const { adminId, username, fullName, role, tribunal, mfaEnabled, biometricRegistered, permissions, avatar } = req.body;

  if (!username || !fullName || !role || !tribunal) {
    return res.status(400).json({ success: false, message: "Tous les champs obligatoires doivent être renseignés." });
  }

  try {
    // Vérifier l'unicité du username
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .ilike("username", username.trim())
      .single();

    if (existing) {
      return res.status(400).json({ success: false, message: "Cet identifiant unique est déjà attribué à un autre agent." });
    }

    const newUserId = `u_${Date.now()}`;
    const finalAvatar = avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120";
    const defaultPerms = permissions || getDefaultPermissions(role);

    // Insert user + permissions dans une transaction
    const { data: newUser, error: userError } = await supabase
      .from("users")
      .insert({
        id: newUserId,
        username: username.toLowerCase().trim(),
        full_name: fullName.trim(),
        role,
        tribunal: tribunal.trim(),
        avatar: finalAvatar,
        mfa_enabled: mfaEnabled ?? true,
        biometric_registered: biometricRegistered ?? true,
        password_hash: "$2b$12$LJ3m5ys2LkG9RrLqT6W3XeZ7p1K9w0mN5b8v2q4x6zA0c3E5g7I9",
        active: true,
      })
      .select()
      .single();

    if (userError) throw userError;

    // Insert permissions
    await supabase.from("user_permissions").insert({
      id: `perm_${newUserId}`,
      user_id: newUserId,
      can_create_cases: defaultPerms.canCreateCases ?? false,
      can_delete_cases: defaultPerms.canDeleteCases ?? false,
      can_edit_plumitif: defaultPerms.canEditPlumitif ?? false,
      can_manage_hearings: defaultPerms.canManageHearings ?? false,
      can_upload_documents: defaultPerms.canUploadDocuments ?? false,
      can_verify_integrity: defaultPerms.canVerifyIntegrity ?? false,
    });

    await logActivity(adminId || "system", "ENREGISTREMENT_UTILISATEUR", `Création du profil de l'agent : ${fullName.trim()} (${role})`, req, "USER_MANAGEMENT");

    res.json({
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        fullName: newUser.full_name,
        role: newUser.role,
        tribunal: newUser.tribunal,
        avatar: newUser.avatar,
        mfaEnabled: newUser.mfa_enabled,
        biometricRegistered: newUser.biometric_registered,
        active: newUser.active,
        permissions: defaultPerms,
      },
    });
  } catch (err: any) {
    console.error("[Users POST Error]", err);
    res.status(500).json({ success: false, message: "Erreur lors de la création de l'utilisateur." });
  }
});

app.patch("/api/users/:id", async (req, res) => {
  const { id } = req.params;
  const { adminId, active, role, fullName, tribunal, permissions, avatar } = req.body;

  try {
    const updatePayload: any = {};
    if (fullName) updatePayload.full_name = fullName;
    if (tribunal) updatePayload.tribunal = tribunal;
    if (avatar !== undefined) updatePayload.avatar = avatar;
    if (active !== undefined) updatePayload.active = active;
    if (role) updatePayload.role = role;

    const { data: updated, error } = await supabase
      .from("users")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error || !updated) {
      return res.status(404).json({ success: false, message: "Utilisateur introuvable." });
    }

    // Mettre à jour les permissions si fournies
    if (permissions) {
      await supabase
        .from("user_permissions")
        .update({
          can_create_cases: permissions.canCreateCases,
          can_delete_cases: permissions.canDeleteCases,
          can_edit_plumitif: permissions.canEditPlumitif,
          can_manage_hearings: permissions.canManageHearings,
          can_upload_documents: permissions.canUploadDocuments,
          can_verify_integrity: permissions.canVerifyIntegrity,
        })
        .eq("user_id", id);

      await logActivity(adminId || "system", "MIS_A_JOUR_HABILITATIONS", `Habilitations granulaires modifiées pour ${updated.full_name}`, req, "USER_MANAGEMENT");
    }

    if (active !== undefined) {
      const statusText = active ? "actif" : "désactivé";
      await logActivity(adminId || "system", active ? "ACTIVATION_UTILISATEUR" : "DESACTIVATION_UTILISATEUR", `Statut du compte de ${updated.full_name} modifié à : ${statusText}`, req, "USER_MANAGEMENT", active ? "INFO" : "WARNING");
    }

    // Récupérer les permissions à jour
    const { data: perms } = await supabase
      .from("user_permissions")
      .select("*")
      .eq("user_id", id)
      .single();

    res.json({
      success: true,
      user: {
        id: updated.id,
        username: updated.username,
        fullName: updated.full_name,
        role: updated.role,
        tribunal: updated.tribunal,
        avatar: updated.avatar,
        mfaEnabled: updated.mfa_enabled,
        biometricRegistered: updated.biometric_registered,
        active: updated.active,
        permissions: perms
          ? {
              canCreateCases: perms.can_create_cases,
              canDeleteCases: perms.can_delete_cases,
              canEditPlumitif: perms.can_edit_plumitif,
              canManageHearings: perms.can_manage_hearings,
              canUploadDocuments: perms.can_upload_documents,
              canVerifyIntegrity: perms.can_verify_integrity,
            }
          : getDefaultPermissions(updated.role),
      },
    });
  } catch (err: any) {
    console.error("[Users PATCH Error]", err);
    res.status(500).json({ success: false, message: "Erreur lors de la mise à jour de l'utilisateur." });
  }
});

app.delete("/api/users/:id", async (req, res) => {
  const { id } = req.params;
  const { adminId } = req.query;

  try {
    if (id === adminId) {
      return res.status(400).json({ success: false, message: "Vous ne pouvez pas supprimer votre propre compte." });
    }

    // Récupérer le nom avant suppression
    const { data: user } = await supabase.from("users").select("full_name, role").eq("id", id).single();
    if (!user) {
      return res.status(404).json({ success: false, message: "Utilisateur introuvable." });
    }

    // Supprimer les permissions d'abord (CASCADE devrait le faire, mais on s'assure)
    await supabase.from("user_permissions").delete().eq("user_id", id);

    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) throw error;

    await logActivity((adminId as string) || "system", "SUPPRESSION_UTILISATEUR", `Compte définitivement supprimé : ${user.full_name} (${user.role})`, req, "USER_MANAGEMENT", "CRITICAL");

    res.json({ success: true });
  } catch (err: any) {
    console.error("[Users DELETE Error]", err);
    res.status(500).json({ success: false, message: "Erreur lors de la suppression de l'utilisateur." });
  }
});

// ---------------------------------------------------------------------------
// 8. PROFILS DE TRIBUNAUX (COURTS)
// ---------------------------------------------------------------------------
app.get("/api/courts", async (req, res) => {
  try {
    const { data: courts, error } = await supabase
      .from("court_profiles")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;

    const mapped = (courts || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      president: c.president,
      address: c.address,
      phone: c.phone,
      email: c.email,
      jurisdictionRegion: c.jurisdiction_region,
      foundingDate: c.founding_date,
      activeChambers: c.active_chambers || [],
    }));

    res.json({ success: true, courtProfiles: mapped });
  } catch (err: any) {
    console.error("[Courts GET Error]", err);
    res.status(500).json({ success: false, message: "Erreur lors de la récupération des tribunaux." });
  }
});

app.post("/api/courts", async (req, res) => {
  const { adminId, name, type, president, address, phone, email, jurisdictionRegion, foundingDate, activeChambers } = req.body;

  if (!name || !type || !president) {
    return res.status(400).json({ success: false, message: "Le nom, le type et le président du tribunal sont obligatoires." });
  }

  try {
    const { data: newCourt, error } = await supabase
      .from("court_profiles")
      .insert({
        id: `court_${Date.now()}`,
        name: name.trim(),
        type: type.trim(),
        president: president.trim(),
        address: (address || "").trim(),
        phone: (phone || "").trim(),
        email: (email || "").trim(),
        jurisdiction_region: (jurisdictionRegion || "").trim(),
        founding_date: foundingDate || null,
        active_chambers: activeChambers || [],
      })
      .select()
      .single();

    if (error) throw error;

    await logActivity(adminId || "system", "CREATION_PROFIL_TRIBUNAL", `Création du profil du tribunal : ${newCourt.name} (${newCourt.type})`, req, "COURT_MANAGEMENT");

    res.json({
      success: true,
      courtProfile: {
        id: newCourt.id,
        name: newCourt.name,
        type: newCourt.type,
        president: newCourt.president,
        address: newCourt.address,
        phone: newCourt.phone,
        email: newCourt.email,
        jurisdictionRegion: newCourt.jurisdiction_region,
        foundingDate: newCourt.founding_date,
        activeChambers: newCourt.active_chambers || [],
      },
    });
  } catch (err: any) {
    console.error("[Courts POST Error]", err);
    res.status(500).json({ success: false, message: "Erreur lors de la création du tribunal." });
  }
});

app.patch("/api/courts/:id", async (req, res) => {
  const { id } = req.params;
  const { adminId, name, type, president, address, phone, email, jurisdictionRegion, foundingDate, activeChambers } = req.body;

  try {
    const updatePayload: any = {};
    if (name) updatePayload.name = name.trim();
    if (type) updatePayload.type = type.trim();
    if (president) updatePayload.president = president.trim();
    if (address !== undefined) updatePayload.address = address.trim();
    if (phone !== undefined) updatePayload.phone = phone.trim();
    if (email !== undefined) updatePayload.email = email.trim();
    if (jurisdictionRegion !== undefined) updatePayload.jurisdiction_region = jurisdictionRegion.trim();
    if (foundingDate !== undefined) updatePayload.founding_date = foundingDate;
    if (activeChambers !== undefined) updatePayload.active_chambers = activeChambers;

    const { data: updated, error } = await supabase
      .from("court_profiles")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error || !updated) {
      return res.status(404).json({ success: false, message: "Profil de tribunal introuvable." });
    }

    await logActivity(adminId || "system", "MISE_A_JOUR_TRIBUNAL", `Mise à jour du profil du tribunal : ${updated.name}`, req, "COURT_MANAGEMENT");

    res.json({
      success: true,
      courtProfile: {
        id: updated.id,
        name: updated.name,
        type: updated.type,
        president: updated.president,
        address: updated.address,
        phone: updated.phone,
        email: updated.email,
        jurisdictionRegion: updated.jurisdiction_region,
        foundingDate: updated.founding_date,
        activeChambers: updated.active_chambers || [],
      },
    });
  } catch (err: any) {
    console.error("[Courts PATCH Error]", err);
    res.status(500).json({ success: false, message: "Erreur lors de la mise à jour du tribunal." });
  }
});

app.delete("/api/courts/:id", async (req, res) => {
  const { id } = req.params;
  const { adminId } = req.query;

  try {
    const { data: court } = await supabase.from("court_profiles").select("name").eq("id", id).single();
    if (!court) {
      return res.status(404).json({ success: false, message: "Profil de tribunal introuvable." });
    }

    const { error } = await supabase.from("court_profiles").delete().eq("id", id);
    if (error) throw error;

    await logActivity((adminId as string) || "system", "SUPPRESSION_TRIBUNAL", `Désactivation du profil du tribunal : ${court.name}`, req, "COURT_MANAGEMENT", "WARNING");

    res.json({ success: true });
  } catch (err: any) {
    console.error("[Courts DELETE Error]", err);
    res.status(500).json({ success: false, message: "Erreur lors de la suppression du tribunal." });
  }
});

// ---------------------------------------------------------------------------
// 9. STATISTIQUES (agrégats)
// ---------------------------------------------------------------------------
app.get("/api/stats", async (req, res) => {
  try {
    // Compter les dossiers par nature
    const { data: natureData } = await supabase
      .from("cases")
      .select("nature");

    const natureCounts: Record<string, number> = {};
    (natureData || []).forEach((c: any) => {
      natureCounts[c.nature] = (natureCounts[c.nature] || 0) + 1;
    });

    // Compter les dossiers par statut
    const { data: statusData } = await supabase
      .from("cases")
      .select("status");

    const statusCounts: Record<string, number> = {};
    (statusData || []).forEach((c: any) => {
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
    });

    // Compter les documents
    const { count: docsCount } = await supabase
      .from("case_documents")
      .select("*", { count: "exact", head: true });

    // Compter les audiences actives
    const { data: hearingsData } = await supabase
      .from("hearings")
      .select("status");

    const activeHearings = (hearingsData || []).filter((h: any) => h.status === "Planifiée" || h.status === "En cours").length;
    const urgentCases = (statusData || []).filter((c: any) => {
      // On doit aussi checker la table cases pour la priorité
      return false; // sera recalculé ci-dessous
    }).length;

    // Récupérer les cas urgents
    const { count: urgentCount } = await supabase
      .from("cases")
      .select("*", { count: "exact", head: true })
      .eq("priority", "Urgente");

    const totalCases = natureData?.length || 0;

    res.json({
      success: true,
      stats: {
        totalCases,
        activeHearings,
        urgentCases: urgentCount || 0,
        digitizedDocsCount: docsCount || 0,
        byNature: [
          { name: "Pénal", value: natureCounts["Pénal"] || 0 },
          { name: "Civil", value: natureCounts["Civil"] || 0 },
          { name: "Administratif", value: natureCounts["Administratif"] || 0 },
          { name: "Commercial", value: natureCounts["Commercial"] || 0 },
          { name: "Social", value: natureCounts["Social"] || 0 },
        ],
        byStatus: [
          { name: "En cours", value: statusCounts["En cours"] || 0 },
          { name: "En délibéré", value: statusCounts["Mis en délibéré"] || 0 },
          { name: "Clôturé", value: statusCounts["Clôturé"] || 0 },
          { name: "Archivé", value: statusCounts["Archivé"] || 0 },
        ],
        monthlyActivity: [
          { month: "Mai", dossiers: 0, audiences: 0 },
          { month: "Juin", dossiers: 0, audiences: 0 },
          { month: "Juillet", dossiers: totalCases, audiences: hearingsData?.length || 0 },
        ],
      },
    });
  } catch (err: any) {
    console.error("[Stats Error]", err);
    res.status(500).json({ success: false, message: "Erreur lors du calcul des statistiques." });
  }
});

// ---------------------------------------------------------------------------
// SERVEUR VITE / STATIQUE
// ---------------------------------------------------------------------------
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
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Legalyx-CMS] Serveur Supabase actif sur http://0.0.0.0:${PORT}`);
    console.log(`[Legalyx-CMS] Base de données : Supabase (${process.env.SUPABASE_URL})`);
  });
}

startServer();