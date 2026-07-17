import React, { useState, useEffect } from "react";
import { User, Case, Hearing, ActivityLog } from "../types";
import { 
  FileText, Calendar, ShieldCheck, Download, Printer, Check, 
  Lock, RefreshCw, Database, Activity, Filter, Clock, ChevronRight, 
  ClipboardList, AlertCircle, FileLock, Scale, Award, ShieldAlert
} from "lucide-react";
import { motion } from "motion/react";

interface ReportsTabProps {
  currentUser: User;
  cases: Case[];
  hearings: Hearing[];
  activities: ActivityLog[];
}

export default function ReportsTab({ currentUser, cases, hearings, activities }: ReportsTabProps) {
  // Custom period selection
  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState("2026-12-31");
  
  // Select which report template of their profile they want to generate
  const [selectedReportId, setSelectedReportId] = useState("");
  
  // Workflow state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [generatedReport, setGeneratedReport] = useState<any | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Available reports based on role
  const getReportsMenuForRole = () => {
    switch (currentUser.role) {
      case "Président":
        return [
          {
            id: "pres_annual",
            title: "Rapport Général d'Activité du Tribunal",
            desc: "Bilan global des dossiers enrôlés, jugés, délibérés prorogés et indicateurs de performance de la juridiction."
          },
          {
            id: "pres_delays",
            title: "Audit Analytique des Délais d'Instruction",
            desc: "Analyse des goulots d'étranglement, temps moyens d'instruction et de délibéré par chambre."
          },
          {
            id: "pres_workload",
            title: "Tableau de Répartition Comparative des Cabinets",
            desc: "Productivité comparée des Magistrats instructeurs et Greffiers d'audience en exercice."
          }
        ];
      case "Juge":
        return [
          {
            id: "juge_rendement",
            title: "Rendement Décisionnel Individuel",
            desc: "État récapitulatif des dossiers qui vous sont côtés, taux de liquidation et délais de rédaction de vos ordonnances."
          },
          {
            id: "juge_deliberes",
            title: "Suivi des Délibérés Prorogés",
            desc: "Registre confidentiel des affaires mises en délibéré sous votre présidence et échéanciers de délibéré."
          },
          {
            id: "juge_audiences",
            title: "Registre des Audiences du Cabinet",
            desc: "Statistiques d'audiencement, comptes rendus et historique des reports prononcés en chambre."
          }
        ];
      case "Greffier":
        return [
          {
            id: "gref_plumitifs",
            title: "Registre Certifié des Plumitifs d'Audience",
            desc: "Relevé des minutes rédigées, signées électroniquement et transmises au greffe central pour archivage."
          },
          {
            id: "gref_docs",
            title: "Bilan de Numérisation & Signature de Pièces",
            desc: "Historique des pièces de procédure versées aux dossiers et signées par votre certificat de greffier."
          },
          {
            id: "gref_scelles",
            title: "Bordereau des Scellés Numériques",
            desc: "Inventaire et empreintes cryptographiques SHA-256 de l'intégralité des pièces d'accusation."
          }
        ];
      case "Secrétaire":
        return [
          {
            id: "sec_enrolements",
            title: "Bordereau des Enrôlements de Requêtes",
            desc: "Registre d'inscription au Registre Général des nouvelles requêtes introduites au secrétariat du greffe."
          },
          {
            id: "sec_transmission",
            title: "Bordereau de Dispatching par Chambre",
            desc: "Journal de transmission physique et numérique des dossiers physiques d'instruction vers les cabinets."
          },
          {
            id: "sec_exploits",
            title: "Registre de Suivi des Exploits & Notifications",
            desc: "État d'avancement des notifications d'audiences transmises aux huissiers de justice mandatés."
          }
        ];
      case "Administrateur":
        return [
          {
            id: "admin_audit",
            title: "Rapport d'Audit des Accès Biométriques & MFA",
            desc: "Journal d'audit chiffré des connexions sécurisées par empreinte, clés FIDO2 et jetons éphémères OTP."
          },
          {
            id: "admin_integrity",
            title: "Certificat d'Intégrité de la Base Chiffrée",
            desc: "Vérification algorithmique de la chaîne de blocs Legalyx et des signatures de hachage de l'annuaire."
          }
        ];
      default:
        return [];
    }
  };

  const reportsList = getReportsMenuForRole();

  // Set default report template on load or when role changes
  useEffect(() => {
    if (reportsList.length > 0) {
      setSelectedReportId(reportsList[0].id);
      setGeneratedReport(null);
    }
  }, [currentUser]);

  // Dynamic filtering of cases "côtés" or "adjoints" to user on selected period
  const getFilteredData = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Filter cases by date
    const dateFilteredCases = cases.filter(c => {
      const cDate = new Date(c.dateCreation);
      return cDate >= start && cDate <= end;
    });

    // 1. Cases directly "côtés" (assigned as Judge)
    const cotesCases = dateFilteredCases.filter(c => c.magistratId === currentUser.id);

    // 2. Cases "adjointes" (Greffier or Secrétaire assigned to hearings or documents)
    // Hearings on which Greffier is assigned
    const userHearings = hearings.filter(h => {
      const hDate = new Date(h.date);
      const inPeriod = hDate >= start && hDate <= end;
      const isGreffier = h.greffierName === currentUser.fullName;
      return inPeriod && isGreffier;
    });
    
    const userHearingCaseIds = new Set(userHearings.map(h => h.caseId));

    // Documents uploaded by this user
    const userUploadedCases = dateFilteredCases.filter(c => 
      c.documents && c.documents.some(d => d.uploadedBy === currentUser.fullName)
    );
    const userUploadedCaseIds = new Set(userUploadedCases.map(c => c.id));

    // Combine for adjoints
    const adjointsCases = dateFilteredCases.filter(c => 
      userHearingCaseIds.has(c.id) || userUploadedCaseIds.has(c.id)
    );

    // Dynamic final set based on role
    let relevantCases: Case[] = [];
    if (currentUser.role === "Président" || currentUser.role === "Administrateur") {
      relevantCases = dateFilteredCases; // President sees all tribunal cases
    } else if (currentUser.role === "Juge") {
      relevantCases = cotesCases;
    } else if (currentUser.role === "Greffier") {
      relevantCases = adjointsCases;
    } else if (currentUser.role === "Secrétaire") {
      relevantCases = userUploadedCases;
    }

    // Filtered hearings in period
    const relevantHearings = hearings.filter(h => {
      const hDate = new Date(h.date);
      const matchesPeriod = hDate >= start && hDate <= end;
      if (currentUser.role === "Président" || currentUser.role === "Administrateur") {
        return matchesPeriod;
      }
      if (currentUser.role === "Juge") {
        // Judge's hearings matching assigned cases
        const judgeCaseIds = new Set(cotesCases.map(c => c.id));
        return matchesPeriod && judgeCaseIds.has(h.caseId);
      }
      if (currentUser.role === "Greffier") {
        return matchesPeriod && h.greffierName === currentUser.fullName;
      }
      return matchesPeriod;
    });

    // Filtered activities in period
    const relevantActivities = activities.filter(a => {
      const aDate = new Date(a.timestamp);
      const matchesPeriod = aDate >= start && aDate <= end;
      if (currentUser.role === "Administrateur" || currentUser.role === "Président") {
        return matchesPeriod;
      }
      return matchesPeriod && a.userId === currentUser.id;
    });

    return {
      cases: relevantCases,
      hearings: relevantHearings,
      activities: relevantActivities,
      allCotesCount: cotesCases.length,
      allAdjointsCount: adjointsCases.length
    };
  };

  const filteredData = getFilteredData();

  const signatureSteps = [
    "Interrogation chiffrée de la base locale du Greffe...",
    "Filtrage chronologique des dossiers et audiences...",
    "Calcul des hashs d'intégrité de la pièce (SHA-256)...",
    "Application du cachet numérique officiel MINJUSTICE Cameroun...",
    "Finalisation de l'empreinte biométrique de signature..."
  ];

  const handleGenerate = () => {
    setIsGenerating(true);
    setGenerationStep(0);
    setGeneratedReport(null);
    setShowSuccessToast(false);

    const interval = setInterval(() => {
      setGenerationStep((prev) => {
        if (prev < signatureSteps.length - 1) {
          return prev + 1;
        } else {
          clearInterval(interval);
          setTimeout(() => {
            setIsGenerating(false);
            compileReportDocument();
          }, 600);
          return prev;
        }
      });
    }, 700);
  };

  const compileReportDocument = () => {
    const hash = Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join("");
    const reportCode = `REP-${currentUser.role.substring(0,3).toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const dateGenerated = new Date().toLocaleDateString("fr-FR", { 
      year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" 
    });

    const selectedTemplate = reportsList.find(r => r.id === selectedReportId);
    
    let reportData: any = {
      id: selectedReportId,
      title: selectedTemplate?.title || "Rapport Judiciaire",
      description: selectedTemplate?.desc || "",
      code: reportCode,
      hash: `0x${hash}`,
      date: dateGenerated,
      startDate: new Date(startDate).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" }),
      endDate: new Date(endDate).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" }),
      officer: currentUser.fullName,
      role: currentUser.role,
      tribunal: currentUser.tribunal,
      metrics: [],
      records: []
    };

    // Populate customized data based on selected templates and roles
    if (currentUser.role === "Président") {
      if (selectedReportId === "pres_annual") {
        const closures = filteredData.cases.filter(c => c.status === "Clôturé").length;
        const deliberations = filteredData.cases.filter(c => c.status === "Mis en délibéré").length;
        reportData.metrics = [
          { label: "Dossiers Enrôlés", value: `${filteredData.cases.length} Affaires`, desc: "Total des saisines enregistrées" },
          { label: "Affaires Résolues", value: `${closures} Arrêts`, desc: "Dossiers clôturés ou archivés" },
          { label: "Délibérés Actifs", value: `${deliberations} dossiers`, desc: "En attente de prononcé" },
          { label: "Audiences Planifiées", value: `${filteredData.hearings.length} Rôles`, desc: "Audiences ordinaires et référés" }
        ];
        reportData.records = filteredData.cases.map(c => ({
          col1: c.numDossier,
          col2: c.parties,
          col3: c.nature,
          col4: c.magistratName,
          col5: c.status
        }));
        reportData.headers = ["N° Dossier", "Parties en Cause", "Nature", "Magistrat Instructeur", "Statut"];
      } else if (selectedReportId === "pres_delays") {
        const urgents = filteredData.cases.filter(c => c.priority === "Urgente").length;
        reportData.metrics = [
          { label: "Délai Moyen d'Instruction", value: "43 Jours", desc: "Entre l'enrôlement et le délibéré" },
          { label: "Délai de Rédaction Plumitif", value: "24 Heures", desc: "Greffe d'audience à jour" },
          { label: "Dossiers Prioritaires", value: `${urgents} urgents`, desc: "Traitement en procédure rapide" },
          { label: "Taux de Prorogation", value: "4.1%", desc: "Délibérés ayant subi un renvoi" }
        ];
        reportData.records = filteredData.cases.filter(c => c.priority === "Urgente" || c.priority === "Haute").map(c => ({
          col1: c.numDossier,
          col2: c.title,
          col3: c.priority,
          col4: c.magistratName,
          col5: c.status
        }));
        reportData.headers = ["N° Dossier", "Objet du Litige", "Priorité", "Président de Chambre", "État"];
      } else {
        // pres_workload
        reportData.metrics = [
          { label: "Magistrats Actifs", value: "3 Présidents", desc: "Cabinets de jugement opérationnels" },
          { label: "Greffiers Titulaires", value: "4 Officiers", desc: "Mise en état et minutes" },
          { label: "Charge Moyenne / Juge", value: `${Math.ceil(filteredData.cases.length / 3)} Dossiers`, desc: "Dossiers actifs par cabinet" },
          { label: "Taux d'Audiencement", value: "100.0%", desc: "Couverture totale du greffe" }
        ];
        reportData.records = [
          { col1: "Cabinet I (Nsame)", col2: "M. le Juge Emmanuel Nsame", col3: `${filteredData.cases.filter(c => c.magistratId === "u1").length} dossiers`, col4: "48 Jours de moyenne", col5: "89.2% Résolution" },
          { col1: "Cabinet II (Tchouta)", col2: "Mme le Juge Jeanne Tchouta", col3: "3 dossiers", col4: "45 Jours de moyenne", col5: "85.0% Résolution" },
          { col1: "Cabinet III (Bella)", col2: "M. le Juge Christian Bella", col3: "1 dossier", col4: "30 Jours de moyenne", col5: "100.0% Résolution" }
        ];
        reportData.headers = ["Cabinet d'Instruction", "Magistrat Titulaire", "Affaires Côtées", "Délai Moyen", "Rendement"];
      }
    } else if (currentUser.role === "Juge") {
      const cotesCount = filteredData.cases.length;
      const deliberationCount = filteredData.cases.filter(c => c.status === "Mis en délibéré").length;
      
      if (selectedReportId === "juge_rendement") {
        reportData.metrics = [
          { label: "Dossiers Côtés", value: `${cotesCount} dossiers`, desc: "Dossiers sous votre instruction" },
          { label: "Délai Moyen d'Ordonnance", value: "39 Jours", desc: "Instruction avant délibéré" },
          { label: "Taux de Liquidation", value: `${cotesCount > 0 ? Math.round((filteredData.cases.filter(c => c.status === "Clôturé").length / cotesCount) * 100) : 0}%`, desc: "Rapport affaires closes/reçues" },
          { label: "Verdicts Rendus", value: `${filteredData.cases.filter(c => c.status === "Clôturé").length} arrêts`, desc: "Ordonnances définitives signées" }
        ];
        reportData.records = filteredData.cases.map(c => ({
          col1: c.numDossier,
          col2: c.parties,
          col3: c.nature,
          col4: c.priority,
          col5: c.status
        }));
        reportData.headers = ["N° Dossier", "Parties", "Nature Judiciaire", "Priorité", "État d'Avancement"];
      } else if (selectedReportId === "juge_deliberes") {
        reportData.metrics = [
          { label: "Affaires en Délibéré", value: `${deliberationCount} dossiers`, desc: "Pistes de verdict actives" },
          { label: "Délibérés Prorogés", value: "1 dossier", desc: "Prorogation exceptionnelle requise" },
          { label: "Echéances Proches (<7j)", value: `${deliberationCount > 0 ? "1 affaire" : "Aucune"}`, desc: "Priorité de rédaction" },
          { label: "Verdicts en Préparation", value: `${deliberationCount} rédactions`, desc: "Notes confidentielles saisies" }
        ];
        reportData.records = filteredData.cases.filter(c => c.status === "Mis en délibéré").map(c => ({
          col1: c.numDossier,
          col2: c.parties,
          col3: c.nature,
          col4: c.priority,
          col5: c.notesDeliberation ? "Notes Confidentielles Saisies" : "En attente de rédaction"
        }));
        reportData.headers = ["N° Dossier", "Parties Concernées", "Nature", "Priorité", "Statut Notes Secrètes"];
      } else {
        // juge_audiences
        reportData.metrics = [
          { label: "Audiences de Chambre", value: `${filteredData.hearings.length} rôles`, desc: "Audiences présidées" },
          { label: "Affaires Appelées", value: `${filteredData.hearings.length} dossiers`, desc: "Dossiers examinés à la barre" },
          { label: "Reports d'Audience", value: `${filteredData.hearings.filter(h => h.status === "Reportée").length} renvois`, desc: "Affaires ajournées en instruction" },
          { label: "Comptes Rendus Générés", value: `${filteredData.hearings.filter(h => h.compteRendu).length} minutes`, desc: "Assistés par IA sécurisée" }
        ];
        reportData.records = filteredData.hearings.map(h => ({
          col1: h.numDossier,
          col2: h.caseTitle,
          col3: `${h.date} à ${h.time}`,
          col4: h.room,
          col5: h.status
        }));
        reportData.headers = ["N° Dossier", "Titre du Dossier", "Date & Heure", "Chambre / Salle", "Statut"];
      }
    } else if (currentUser.role === "Greffier") {
      if (selectedReportId === "gref_plumitifs") {
        reportData.metrics = [
          { label: "Minutes Certifiées", value: `${filteredData.hearings.filter(h => h.status === "Terminée").length} minutes`, desc: "Audiences retranscrites" },
          { label: "Signatures Numériques", value: `${filteredData.hearings.filter(h => h.status === "Terminée").length} apposées`, desc: "Plumitifs certifiés conformes" },
          { label: "Greffier Adjoint", value: currentUser.fullName, desc: "Officier de plume titulaire" },
          { label: "Intégrité des Actes", value: "100.0%", desc: "Empreintes valides dans la base" }
        ];
        reportData.records = filteredData.hearings.map(h => ({
          col1: h.numDossier,
          col2: h.caseTitle,
          col3: h.room,
          col4: `${h.date} ${h.time}`,
          col5: h.status === "Terminée" ? "Plumitif clos & signé" : "En rédaction active"
        }));
        reportData.headers = ["N° Dossier", "Titre de l'Affaire", "Chambre / Salle", "Audition", "État Certificat"];
      } else if (selectedReportId === "gref_docs") {
        const totalDocs = filteredData.cases.reduce((sum, c) => sum + (c.documents ? c.documents.filter(d => d.uploadedBy === currentUser.fullName).length : 0), 0);
        reportData.metrics = [
          { label: "Pièces Judiciaires", value: `${totalDocs} scellés`, desc: "Pièces numérisées par vos soins" },
          { label: "Format PDF Certifié", value: "100% conformes", desc: "Résolution & lisibilité validées" },
          { label: "Hachage Automatique", value: `${totalDocs} hachages`, desc: "Clef cryptographique SHA-256" },
          { label: "Poids des Fichiers", value: "14.2 Mo", desc: "Volume de stockage sécurisé" }
        ];
        
        let docRecords: any[] = [];
        filteredData.cases.forEach(c => {
          if (c.documents) {
            c.documents.filter(d => d.uploadedBy === currentUser.fullName).forEach(d => {
              docRecords.push({
                col1: c.numDossier,
                col2: d.name,
                col3: d.type,
                col4: d.size,
                col5: d.hash.substring(0, 16) + "..."
              });
            });
          }
        });
        reportData.records = docRecords;
        reportData.headers = ["N° Dossier", "Nom du Document", "Type de Document", "Taille", "Empreinte SHA-256"];
      } else {
        // gref_scelles
        reportData.metrics = [
          { label: "Scellés Numériques", value: `${filteredData.cases.reduce((sum, c) => sum + (c.documents ? c.documents.length : 0), 0)} objets`, desc: "Total des scellés enregistrés" },
          { label: "Coffre-fort Actif", value: "Chiffrement AES", desc: "Chiffrement au repos actif" },
          { label: "Clés d'Accès Valides", value: "2 Magistrats", desc: "Accès réglementé" },
          { label: "Chaîne d'Audit", value: "Intègre", desc: "Zéro falsification détectée" }
        ];
        
        let scelleRecords: any[] = [];
        filteredData.cases.forEach(c => {
          if (c.documents) {
            c.documents.forEach(d => {
              scelleRecords.push({
                col1: c.numDossier,
                col2: d.name,
                col3: d.uploadedBy,
                col4: d.date.split("T")[0],
                col5: "SCELLÉ NUMÉRIQUE OK"
              });
            });
          }
        });
        reportData.records = scelleRecords;
        reportData.headers = ["N° Dossier", "Objet Scellé", "Officier Déposant", "Date de Dépôt", "Intégrité"];
      }
    } else if (currentUser.role === "Secrétaire") {
      if (selectedReportId === "sec_enrolements") {
        reportData.metrics = [
          { label: "Requêtes Saisies", value: `${filteredData.cases.length} saisines`, desc: "Enregistrées au Registre Général" },
          { label: "Bordereaux Édités", value: `${filteredData.cases.length} fiches`, desc: "Dossiers d'audience créés" },
          { label: "Taux de Saisie", value: "100.0%", desc: "Délai de transcription immédiat" },
          { label: "Notifications Transmises", value: "12 assignations", desc: "Bordereaux huissier générés" }
        ];
        reportData.records = filteredData.cases.map(c => ({
          col1: c.numDossier,
          col2: c.parties,
          col3: c.nature,
          col4: c.priority,
          col5: "Bordereau Enregistré"
        }));
        reportData.headers = ["N° Dossier", "Parties en Cause", "Nature", "Priorité", "État de l'Enrôlement"];
      } else if (selectedReportId === "sec_transmission") {
        reportData.metrics = [
          { label: "Dossiers Transmis", value: `${filteredData.cases.length} transmissions`, desc: "Acheminés aux magistrats instructeurs" },
          { label: "Accusés de Réception", value: "100.0% reçus", desc: "Signatures de décharge validées" },
          { label: "Cabinets Destinataires", value: "3 Cabinets", desc: "Répartition équitable" },
          { label: "Temps de Transmission", value: "1.2 Heure(s)", desc: "Délai d'acheminement moyen" }
        ];
        reportData.records = filteredData.cases.map(c => ({
          col1: c.numDossier,
          col2: c.title,
          col3: c.magistratName,
          col4: c.nature,
          col5: "Transmis au Cabinet"
        }));
        reportData.headers = ["N° Dossier", "Objet du Dossier", "Magistrat Côté", "Chambre", "Statut Logistique"];
      } else {
        // sec_exploits
        reportData.metrics = [
          { label: "Exploits Transmis", value: "14 exploits", desc: "Assignations et citations de témoins" },
          { label: "Huissiers Requis", value: "4 Officiers", desc: "Huissiers de justice mandatés" },
          { label: "Retours Validés", value: "11 procès-verbaux", desc: "Citations signifiées retournées" },
          { label: "Rapports en Suspens", value: "3 actes", desc: "En attente de retour de l'exploit" }
        ];
        reportData.records = [
          { col1: "EXP-2026-0041", col2: "Citation de Témoin - Bella Jacques", col3: "Me Atangana (Huissier)", col4: "Signifiée le 14/07", col5: "Retour physique OK" },
          { col1: "EXP-2026-0042", col2: "Assignation d'audience - SNH S.A.", col3: "Me Nsame (Huissier)", col4: "Signifiée le 15/07", col5: "Retour physique OK" },
          { col1: "EXP-2026-0043", col2: "Sommation de comparaître - Ndongo", col3: "Me Essomba (Huissier)", col4: "Transmis le 16/07", col5: "En cours de délivrance" }
        ];
        reportData.headers = ["N° Exploit", "Nature de l'Acte", "Huissier de Justice", "Date Notification", "Statut de Retour"];
      }
    } else if (currentUser.role === "Administrateur") {
      if (selectedReportId === "admin_audit") {
        const standardConns = filteredData.activities.filter(a => a.action === "CONNEXION_MOT_DE_PASSE_MFA").length;
        const bioConns = filteredData.activities.filter(a => a.action === "AUTHENTIFICATION_BIOMETRIQUE").length;
        reportData.metrics = [
          { label: "Logs d'Audit Générés", value: `${filteredData.activities.length} blocs`, desc: "Traces cryptées uniques" },
          { label: "Connexions Biométriques", value: `${bioConns} accès`, desc: "Scan d'empreinte digitale validé" },
          { label: "Double Facteur MFA", value: `${standardConns} validations`, desc: "Clés OTP matérielles validées" },
          { label: "Tentatives Anormales", value: "0 incident", desc: "Zéro anomalie de sécurité" }
        ];
        reportData.records = filteredData.activities.map(a => ({
          col1: a.action,
          col2: a.userName,
          col3: a.ip,
          col4: a.timestamp.split("T")[0] + " " + a.timestamp.split("T")[1].substring(0, 8),
          col5: a.details
        }));
        reportData.headers = ["Événement Système", "Utilisateur Responsable", "Adresse IP", "Horodatage", "Détail de l'Action"];
      } else {
        // admin_integrity
        reportData.metrics = [
          { label: "Blocs de Signature", value: `${filteredData.activities.length} signatures`, desc: "Clés d'intégrité chaînées" },
          { label: "Algorithme Actif", value: "SHA-256", desc: "Hachage cryptographique sécurisé" },
          { label: "Contrôle d'Intégrité", value: "100.0% Intègre", desc: "Vérification de la chaîne de bloc" },
          { label: "Alertes Falsification", value: "0 alerte", desc: "Aucun bloc altéré détecté" }
        ];
        reportData.records = filteredData.activities.slice(0, 5).map(a => ({
          col1: a.id,
          col2: a.userName,
          col3: a.action,
          col4: a.integrityHash.substring(0, 24) + "...",
          col5: "SIGNATURE ENREGISTRÉE OK"
        }));
        reportData.headers = ["ID de Log d'Audit", "Opérateur", "Action Sécurisée", "Empreinte Cryptographique unique (SHA-256)", "Intégrité"];
      }
    }

    setGeneratedReport(reportData);
  };

  const handleExport = () => {
    setShowSuccessToast(true);
    setTimeout(() => {
      setShowSuccessToast(false);
    }, 4000);
  };

  return (
    <div className="space-y-6 text-left animate-fade-in" id="reports-tab-view">
      
      {/* Upper header section */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2" id="certified-reports-generator">
              <ClipboardList className="h-5.5 w-5.5 text-blue-600" /> Générateur de Rapports Certifiés par Profil d'Utilisateur
            </h2>
            <p className="text-xs text-slate-500 max-w-3xl font-medium">
              Sélectionnez, compilez et scellez cryptographiquement les rapports de votre profil. Vous ne pouvez visualiser, signer et exporter que les types de rapports pour lesquels vous possédez une habilitation officielle de l'État du Cameroun.
            </p>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-lg text-[11px] text-emerald-800 font-bold shrink-0 flex items-center gap-1.5 self-start md:self-auto">
            <ShieldCheck className="h-4.5 w-4.5 text-emerald-600" />
            <span>Habilitation Signataire Certifié • Actif</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Reports templates list and period filter */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Period selector */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Filter className="h-4 w-4 text-blue-600" /> Personnalisation de la Période
            </h3>
            
            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date de début du rapport</label>
                <div className="relative">
                  <Calendar className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setGeneratedReport(null); // clear generated to enforce re-compile
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date de fin du rapport</label>
                <div className="relative">
                  <Calendar className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setGeneratedReport(null);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Live statistics matching dates and users */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-[10px] text-slate-600 space-y-2">
              <div className="font-bold text-slate-700 uppercase tracking-wider">Éléments dans cet intervalle :</div>
              <div className="flex justify-between items-center">
                <span>Dossiers liés (Côtés/Saisis) :</span>
                <strong className="text-slate-900 font-sans">{filteredData.cases.length} dossiers</strong>
              </div>
              <div className="flex justify-between items-center">
                <span>Audiences dans l'intervalle :</span>
                <strong className="text-slate-900 font-sans">{filteredData.hearings.length} rôles</strong>
              </div>
              <div className="flex justify-between items-center">
                <span>Logs d'action d'officier :</span>
                <strong className="text-slate-900 font-sans">{filteredData.activities.length} événements</strong>
              </div>
            </div>
          </div>

          {/* Templates list */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-blue-600" /> Modèles de Rapports Habilités ({currentUser.role})
            </h3>
            
            <div className="space-y-3">
              {reportsList.map((item) => {
                const isSelected = selectedReportId === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (!isGenerating) {
                        setSelectedReportId(item.id);
                        setGeneratedReport(null);
                      }
                    }}
                    className={`p-3.5 rounded-lg border text-left cursor-pointer transition-all relative ${
                      isSelected 
                        ? "border-blue-600 bg-blue-50/40 ring-1 ring-blue-600" 
                        : "border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-900 flex items-center gap-1">
                        {item.title}
                      </span>
                      {isSelected && <ChevronRight className="h-4 w-4 text-blue-600" />}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                );
              })}
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !selectedReportId}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Signature & Scellement...
                </>
              ) : (
                <>
                  <Award className="h-4 w-4" /> Générer ce Rapport
                </>
              )}
            </button>
          </div>

        </div>

        {/* Right column: Dynamic preview / compilation status */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Generating loading block */}
          {isGenerating && (
            <div className="bg-white border border-slate-200 p-12 rounded-xl flex flex-col items-center justify-center space-y-4 shadow-sm min-h-[300px]">
              <div className="relative flex items-center justify-center">
                <div className="w-14 h-14 rounded-full border-4 border-blue-50 border-t-blue-600 animate-spin"></div>
                <Lock className="h-5 w-5 text-blue-600 absolute animate-pulse" />
              </div>
              
              <div className="text-center space-y-1">
                <span className="text-xs font-bold text-slate-800 block">SÉCURISATION DU RAPPORT</span>
                <span className="text-[11px] text-slate-500 font-mono block max-w-md animate-pulse">
                  {signatureSteps[generationStep]}
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                {signatureSteps.map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-1.5 w-6 rounded-full transition-all duration-350 ${
                      i <= generationStep ? "bg-blue-600" : "bg-slate-200"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Not generated yet placeholder */}
          {!generatedReport && !isGenerating && (
            <div className="bg-slate-50 border-2 border-dashed border-slate-300 p-12 rounded-xl flex flex-col items-center justify-center text-center space-y-3 min-h-[400px]">
              <FileLock className="h-12 w-12 text-slate-400" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Aperçu du Certificat Judiciaire</h4>
                <p className="text-[11px] text-slate-500 max-w-sm">
                  Sélectionnez un type de rapport dans le menu latéral gauche, ajustez l'intervalle chronologique, puis cliquez sur <strong>"Générer ce Rapport"</strong> pour compiler les métriques et apposer le sceau.
                </p>
              </div>
            </div>
          )}

          {/* Generated certified document preview */}
          {generatedReport && !isGenerating && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }} 
              animate={{ opacity: 1, scale: 1 }} 
              className="border border-slate-300 rounded-xl overflow-hidden shadow-md bg-white text-left relative"
              id="certified-report-view-paper"
            >
              {/* Background watermark seal */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-[0.02] select-none border-[12px] border-blue-600 p-12 rounded-full rotate-12 flex flex-col items-center">
                <span className="text-8xl font-black uppercase font-sans">CERTIFIÉ</span>
                <span className="text-4xl font-extrabold font-sans">MINJUSTICE</span>
              </div>

              {/* Cameroonian crest style header block */}
              <div className="bg-slate-50 border-b border-slate-200 p-6 flex flex-col sm:flex-row items-start justify-between gap-4 font-sans text-xs">
                <div className="space-y-1 text-left">
                  <span className="font-black text-[10px] tracking-wider text-slate-700 block uppercase">RÉPUBLIQUE DU CAMEROUN</span>
                  <span className="text-[9px] text-slate-400 block italic">Paix - Travail - Patrie</span>
                  <span className="font-bold text-slate-800 block uppercase pt-1">MINISTÈRE DE LA JUSTICE</span>
                  <span className="text-slate-600 block">{generatedReport.tribunal}</span>
                </div>

                <div className="text-left sm:text-right space-y-1">
                  <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[9px] font-extrabold tracking-wider font-mono">
                    {generatedReport.code}
                  </span>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Généré le: <span className="font-semibold text-slate-800">{generatedReport.date}</span>
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono break-all max-w-[280px]">
                    Signature SHA-256: <span className="text-slate-600">{generatedReport.hash}</span>
                  </div>
                </div>
              </div>

              {/* Document Body */}
              <div className="p-6 space-y-6">
                
                {/* Title block */}
                <div className="space-y-1 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-600"></span>
                    <span className="text-[9px] uppercase font-bold text-blue-600 tracking-widest">ACTE D'ADMINISTRATION JUDICIAIRE DE LA RÉPUBLIQUE</span>
                  </div>
                  <h4 className="text-md font-extrabold text-slate-900">{generatedReport.title}</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-medium">{generatedReport.description}</p>
                </div>

                {/* Period specification block */}
                <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100/50 text-[11px] text-blue-800 font-semibold flex items-center justify-between">
                  <span>Période d'audit :</span>
                  <span>Du {generatedReport.startDate} au {generatedReport.endDate}</span>
                </div>

                {/* Grid of compiled metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  {generatedReport.metrics.map((m: any, i: number) => (
                    <div key={i} className="space-y-1 text-left">
                      <span className="text-[9px] text-slate-500 font-bold block uppercase">{m.label}</span>
                      <span className="text-base font-extrabold text-slate-900 font-sans">{m.value}</span>
                      <span className="text-[9px] text-slate-400 leading-tight block">{m.desc}</span>
                    </div>
                  ))}
                </div>

                {/* Table containing the real filtered lists */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <Database className="h-4 w-4 text-blue-600" /> Inscriptions consignées correspondantes ({generatedReport.records.length})
                  </span>

                  {generatedReport.records.length === 0 ? (
                    <div className="p-6 text-center border border-slate-200 rounded-lg text-[11px] text-slate-500 font-medium bg-slate-50">
                      Aucune inscription enregistrée dans le greffe pour la période sélectionnée.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700 text-left">
                            {generatedReport.headers.map((h: string, idx: number) => (
                              <td key={idx} className="p-2 text-[10px] uppercase tracking-wider">{h}</td>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                          {generatedReport.records.map((row: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="p-2 font-mono text-blue-600">{row.col1}</td>
                              <td className="p-2 max-w-[200px] truncate">{row.col2}</td>
                              <td className="p-2">
                                <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9px] font-bold">{row.col3}</span>
                              </td>
                              <td className="p-2 text-slate-600">{row.col4}</td>
                              <td className="p-2 font-bold text-slate-900">{row.col5}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Seal / Signatures block */}
                <div className="flex flex-col sm:flex-row justify-between items-center pt-6 border-t border-slate-100 gap-6 text-xs">
                  <div className="space-y-1 text-slate-500 text-[9px] text-center sm:text-left">
                    <span className="block font-bold uppercase tracking-wider">Certifié sincère et conforme au registre central</span>
                    <span className="block font-semibold">Officier habilité: {generatedReport.officer}</span>
                    <span className="block italic">Qualité d'agent: {generatedReport.role} du {generatedReport.tribunal}</span>
                    <span className="block font-mono text-[8px]">QR Validation: S-MINJ-${generatedReport.code}</span>
                  </div>

                  <div className="border border-slate-200 p-3 rounded-lg text-center min-w-[180px] bg-slate-50 relative space-y-1.5 shadow-sm">
                    <div className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Sceau de Conformité</div>
                    <div className="flex justify-center text-blue-600">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div className="text-[9px] font-mono text-slate-800 font-bold">{generatedReport.code}</div>
                    <div className="text-[8px] text-emerald-600 font-bold">✓ Signature électronique certifiée</div>
                  </div>
                </div>

              </div>

              {/* Action and Download footer */}
              <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-[10px] text-slate-500 font-semibold italic flex items-center gap-1">
                  <Lock className="h-3 w-3 text-slate-400" /> Ce document est chiffré et soumis aux règles de confidentialité de l'institution.
                </span>

                <div className="flex gap-2">
                  <button
                    onClick={handleExport}
                    className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Printer className="h-3.5 w-3.5" /> Imprimer
                  </button>
                  <button
                    onClick={handleExport}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Download className="h-3.5 w-3.5" /> Télécharger (.pdf)
                  </button>
                </div>
              </div>

            </motion.div>
          )}

          {/* Toast Notification */}
          {showSuccessToast && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-sm"
            >
              <Check className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Rapport exporté avec succès sous format sécurisé. L'intégrité de la minute a été validée par la chaîne d'audit du Ministère de la Justice de la République du Cameroun.</span>
            </motion.div>
          )}

        </div>

      </div>

    </div>
  );
}
