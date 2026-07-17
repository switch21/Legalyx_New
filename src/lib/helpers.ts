/**
 * Helpers utilitaires pour Legalyx-CMS
 * Mapping snake_case (DB) ↔ camelCase (frontend)
 * Audit logging chaîné (SHA-256)
 * Permissions par défaut
 */

import supabase from './supabaseClient';
import type { UserPermissions, UserRole } from '../types';

// ============================================================================
// HELPERS : PERMISSIONS PAR DÉFAUT
// ============================================================================
export function getDefaultPermissions(role: string): UserPermissions {
  switch (role) {
    case 'Administrateur':
      return { canCreateCases: false, canDeleteCases: false, canEditPlumitif: false, canManageHearings: false, canUploadDocuments: false, canVerifyIntegrity: true };
    case 'Président':
      return { canCreateCases: true, canDeleteCases: true, canEditPlumitif: true, canManageHearings: true, canUploadDocuments: true, canVerifyIntegrity: true };
    case 'Juge':
      return { canCreateCases: true, canDeleteCases: true, canEditPlumitif: true, canManageHearings: true, canUploadDocuments: true, canVerifyIntegrity: true };
    case 'Greffier':
      return { canCreateCases: true, canDeleteCases: false, canEditPlumitif: true, canManageHearings: true, canUploadDocuments: true, canVerifyIntegrity: true };
    case 'Secrétaire':
    default:
      return { canCreateCases: true, canDeleteCases: false, canEditPlumitif: false, canManageHearings: false, canUploadDocuments: true, canVerifyIntegrity: false };
  }
}

// ============================================================================
// HELPERS : MAPPING UTILISATEUR (snake_case DB → camelCase frontend)
// ============================================================================
export function mapUserFromDb(row: any, permsRow?: any): any {
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    tribunal: row.tribunal,
    avatar: row.avatar,
    mfaEnabled: row.mfa_enabled,
    biometricRegistered: row.biometric_registered,
    active: row.active !== false,
    permissions: permsRow
      ? {
          canCreateCases: permsRow.can_create_cases,
          canDeleteCases: permsRow.can_delete_cases,
          canEditPlumitif: permsRow.can_edit_plumitif,
          canManageHearings: permsRow.can_manage_hearings,
          canUploadDocuments: permsRow.can_upload_documents,
          canVerifyIntegrity: permsRow.can_verify_integrity,
        }
      : getDefaultPermissions(row.role),
  };
}

// ============================================================================
// HELPERS : MAPPING DOSSIER (snake_case DB → camelCase frontend)
// ============================================================================
export function mapCaseFromDb(c: any, docs?: any[], magName?: string): any {
  return {
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
    magistratName: magName || '',
    notesDeliberation: c.notes_deliberation,
    documents: (docs || []).map(mapDocumentFromDb),
  };
}

export function mapDocumentFromDb(d: any): any {
  return {
    id: d.id,
    name: d.name,
    date: d.uploaded_at,
    type: d.type,
    hash: d.hash,
    size: d.size,
    uploadedBy: d.uploaded_by,
    secure: d.secure,
    hearingId: d.hearing_id,
  };
}

// ============================================================================
// HELPERS : MAPPING AUDIENCE (snake_case DB → camelCase frontend)
// ============================================================================
export function mapHearingFromDb(h: any, caseData?: any): any {
  return {
    id: h.id,
    caseId: h.case_id,
    numDossier: caseData?.num_dossier || '',
    caseTitle: caseData?.title || '',
    date: h.date,
    time: h.time?.substring(0, 5) || '09:00',
    room: h.location,
    status: h.status,
    notes: h.notes,
    compteRendu: h.transcript,
    greffierName: '',
    reporter: h.signed_by,
  };
}

// ============================================================================
// HELPERS : MAPPING ACTIVITÉ (snake_case DB → camelCase frontend)
// ============================================================================
export function mapActivityFromDb(log: any): any {
  return {
    id: log.id,
    userId: log.user_id,
    userName: log.username,
    userRole: 'Administrateur', // le rôle n'est pas stocké dans les logs v2
    action: log.action,
    timestamp: log.timestamp,
    ip: log.ip_address || '127.0.0.1',
    details: log.details,
    integrityHash: log.integrity_hash,
  };
}

// ============================================================================
// HELPERS : MAPPING TRIBUNAL (snake_case DB → camelCase frontend)
// ============================================================================
export function mapCourtFromDb(c: any): any {
  return {
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
  };
}

// ============================================================================
// AUDIT : Log d'activité chaîné (SHA-256 blockchain-style)
// ============================================================================
export async function logActivity(
  userId: string,
  action: string,
  details: string,
  category = 'OPERATION',
  severity = 'INFO'
) {
  try {
    // Récupérer le hash du dernier log pour la chaîne d'intégrité
    const { data: lastLog } = await supabase
      .from('activity_logs')
      .select('integrity_hash')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    const previousHash = lastLog?.integrity_hash || 'GENESIS_BLOCK_LEGALLYX_CMS_2026';

    // Récupérer le username
    const { data: user } = await supabase
      .from('users')
      .select('full_name, role')
      .eq('id', userId)
      .single();

    const content = `${userId}-${action}-${new Date().toISOString()}-${details}-${previousHash}`;
    // Utiliser Web Crypto API côté navigateur
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const integrityHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    await supabase.from('activity_logs').insert({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      user_id: userId,
      username: user?.full_name || 'Système / Inconnu',
      action,
      details,
      category,
      severity,
      ip_address: 'navigateur-client',
      integrity_hash: integrityHash,
    });
  } catch (err) {
    console.error('[Legalyx-Audit] Erreur de journalisation:', err);
  }
}

// ============================================================================
// GÉNÉRATION DE COMPTES-RENDUS IA (Gemini)
// ============================================================================
export async function generateMinutes(notes: string, caseNum: string, caseTitle: string, tribunalName: string, dateAudience: string, greffierName: string): Promise<{ text: string; simulated: boolean }> {
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

  // Essayer l'appel direct à l'API Gemini (coté navigateur via la clé env)
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2 },
          }),
        }
      );
      const result = await response.json();
      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return { text: text.trim(), simulated: false };
      }
    } catch (err) {
      console.warn('[AI-Minutes] Erreur API Gemini, utilisation du mode simulé:', err);
    }
  }

  // Mode simulé (fallback)
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

  return { text: fallbackReport, simulated: true };
}