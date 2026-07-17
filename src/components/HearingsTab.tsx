import React, { useState, useEffect } from "react";
import { Case, Hearing, User } from "../types";
import { 
  Calendar, Clock, MapPin, Scale, Sparkles, Send, 
  CheckCircle, AlertCircle, Play, Pause, RefreshCw, FileText, ChevronRight, Bell, Plus,
  Paperclip, Trash2, Eye, Hash
} from "lucide-react";
import { motion } from "motion/react";
import supabase from "../lib/supabaseClient";
import { logActivity, generateMinutes } from "../lib/helpers";

interface HearingsTabProps {
  hearings: Hearing[];
  cases: Case[];
  currentUser: User;
  onRefreshHearings: () => void;
}

export default function HearingsTab({ hearings, cases, currentUser, onRefreshHearings }: HearingsTabProps) {
  const [selectedHearing, setSelectedHearing] = useState<Hearing | null>(null);
  const [hearingNotes, setHearingNotes] = useState("");
  const [compteRenduText, setCompteRenduText] = useState("");
  
  // AI compiling state
  const [compilingAI, setCompilingAI] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // New hearing scheduling form
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleCaseId, setScheduleCaseId] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scheduleRoom, setScheduleRoom] = useState("Salle d'Audience A");
  const [scheduleNotes, setScheduleNotes] = useState("");

  // Simulated calendar calendar date selection
  const [selectedDate, setSelectedDate] = useState<string>("2026-07-16"); // Defaults to "today"

  // Document upload helper state
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Load notes when a hearing is selected
  useEffect(() => {
    if (selectedHearing) {
      setHearingNotes(selectedHearing.notes || "");
      setCompteRenduText(selectedHearing.compteRendu || "");
    } else {
      setHearingNotes("");
      setCompteRenduText("");
    }
    setSuccessMsg("");
    setErrorMsg("");
  }, [selectedHearing]);

  // Find currently selected hearing's associated case and documents
  const associatedCaseForSelectedHearing = selectedHearing
    ? cases.find(c => c.id === selectedHearing.caseId)
    : null;

  const handleUploadDocForHearing = async (file: File) => {
    if (!selectedHearing || !associatedCaseForSelectedHearing) return;
    setUploadingDoc(true);
    setSuccessMsg("");
    setErrorMsg("");

    const simulatedSize = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;

    try {
      const content = `${file.name}-${Date.now()}`;
      const encoder = new TextEncoder();
      const dataBuf = encoder.encode(content);
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuf);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const simulatedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const { error } = await supabase
        .from('case_documents')
        .insert({
          id: `doc_${Date.now()}`,
          case_id: associatedCaseForSelectedHearing.id,
          hearing_id: selectedHearing.id,
          name: file.name,
          type: 'Pièce jointe',
          hash: simulatedHash,
          size: simulatedSize,
          uploaded_by: currentUser.fullName,
          secure: true,
        });

      if (error) { setErrorMsg('Erreur lors de la numérisation du document.'); return; }

      await logActivity(currentUser.id, 'NUMERISATION_DOCUMENT', `Document ajouté à l'audience : ${file.name}`);
      setSuccessMsg(`Document "${file.name}" ajouté avec succès à l'audience.`);
      onRefreshHearings();
    } catch (err) {
      console.error(err);
      setErrorMsg('Erreur de communication avec le serveur de numérisation.');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDocFromHearing = async (docId: string) => {
    if (!associatedCaseForSelectedHearing) return;
    if (!confirm('Voulez-vous détruire cette pièce jointe ?')) return;
    setSuccessMsg("");
    setErrorMsg("");

    try {
      const { error } = await supabase.from('case_documents').delete().eq('id', docId);
      if (error) { setErrorMsg('Erreur de suppression.'); return; }

      await logActivity(currentUser.id, 'SUPPRESSION_DOCUMENT', `Document supprimé d'une audience`, 'DOCUMENT_MANAGEMENT', 'WARNING');
      setSuccessMsg('Document supprimé définitivement.');
      onRefreshHearings();
    } catch (e) {
      console.error(e);
      setErrorMsg('Erreur de suppression.');
    }
  };

  // Handle scheduling new hearing
  const handleScheduleHearing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleCaseId || !scheduleDate) return;

    try {
      const { data: dossier } = await supabase.from('cases').select('num_dossier, title').eq('id', scheduleCaseId).single();
      if (!dossier) { setErrorMsg('Le dossier spécifié est inexistant.'); return; }

      const { data: newHearing, error } = await supabase
        .from('hearings')
        .insert({
          id: `h_${Date.now()}`,
          case_id: scheduleCaseId,
          date: scheduleDate,
          time: scheduleTime || '09:00',
          type: 'Audience publique',
          location: scheduleRoom || 'Chambre Civile I',
          status: 'Planifiée',
          notes: scheduleNotes || '',
        })
        .select()
        .single();

      if (error) { console.error(error); return; }

      await logActivity(currentUser.id, 'PLANIFICATION_AUDIENCE', `Audience planifiée pour le dossier ${dossier.num_dossier} le ${scheduleDate} à ${scheduleTime} (${scheduleRoom})`);

      setShowScheduleForm(false);
      setScheduleCaseId("");
      setScheduleDate("");
      setScheduleNotes("");
      onRefreshHearings();
      setSuccessMsg('Audience ajoutée avec succès au rôle.');
    } catch (err) {
      console.error(err);
    }
  };

  // Compile draft notes using Gemini API (direct call from browser)
  const handleAICompileMinutes = async () => {
    if (!selectedHearing) return;
    setCompilingAI(true);
    setSuccessMsg("");
    setErrorMsg("");

    const associatedCase = cases.find(c => c.id === selectedHearing.caseId);

    try {
      const { text: compteRendu, simulated } = await generateMinutes(
        hearingNotes,
        selectedHearing.numDossier,
        selectedHearing.caseTitle,
        associatedCase?.tribunal || currentUser.tribunal,
        selectedHearing.date,
        selectedHearing.greffierName || currentUser.fullName,
      );

      setCompteRenduText(compteRendu);
      
      // Auto-save generated report back to this hearing
      const { error } = await supabase
        .from('hearings')
        .update({ transcript: compteRendu, notes: hearingNotes })
        .eq('id', selectedHearing.id);

      if (!error) {
        await logActivity(currentUser.id, 'GENERATION_COMPTE_RENDU_IA', `Compte-rendu IA ${simulated ? '(simulé)' : '(Gemini)'} généré pour l'audience du ${selectedHearing.date}`);
      }

      onRefreshHearings();
      setSuccessMsg('Le compte-rendu a été compilé et structuré par Legalyx-AI.');
    } catch (e: any) {
      setErrorMsg('Impossible de joindre le service de compilation IA.');
    } finally {
      setCompilingAI(false);
    }
  };

  // Update hearing notes or status
  const handleUpdateHearingDetails = async (newStatus?: Hearing["status"]) => {
    if (!selectedHearing) return;
    try {
      const updatePayload: any = {
        notes: hearingNotes,
        transcript: compteRenduText,
      };
      if (newStatus) updatePayload.status = newStatus;

      const { data: updated, error } = await supabase
        .from('hearings')
        .update(updatePayload)
        .eq('id', selectedHearing.id)
        .select()
        .single();

      if (error) { setErrorMsg('Erreur lors de la mise à jour.'); return; }

      await logActivity(currentUser.id, 'MODIFICATION_AUDIENCE', `Audience mise à jour (ID: ${selectedHearing.id}, Statut: ${updated.status})`);

      // Update local state with mapped hearing
      const linkedCase = cases.find(c => c.id === updated.case_id);
      setSelectedHearing({
        id: updated.id,
        caseId: updated.case_id,
        numDossier: linkedCase?.numDossier || selectedHearing.numDossier,
        caseTitle: linkedCase?.title || selectedHearing.caseTitle,
        date: updated.date,
        time: updated.time?.substring(0, 5) || '09:00',
        room: updated.location,
        status: updated.status,
        notes: updated.notes,
        compteRendu: updated.transcript,
        greffierName: selectedHearing.greffierName,
        reporter: updated.signed_by,
      });
      onRefreshHearings();
      setSuccessMsg('Audience enregistrée et synchronisée avec le greffe.');
    } catch (e) {
      setErrorMsg('Erreur lors de la mise à jour.');
    }
  };

  // Calendar Helpers (Simulate calendar matrix for July 2026)
  const daysInJuly = Array.from({ length: 31 }, (_, i) => i + 1);
  const getHearingsCountForDay = (dayNum: number) => {
    const formattedDay = `2026-07-${dayNum.toString().padStart(2, "0")}`;
    return hearings.filter(h => h.date === formattedDay).length;
  };

  const getUrgentDeadlines = () => {
    // Return cases with High/Urgent priority that have planified hearings soon
    return hearings.filter(h => {
      const relatedCase = cases.find(c => c.id === h.caseId);
      return relatedCase?.priority === "Urgente" && h.status === "Planifiée";
    });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6" id="hearings-tab-view">
      
      {/* 1. Alerts & Urgent deadlines (Column 1) */}
      <div className="xl:col-span-1 space-y-6">
        
        {/* Urgent Deadlines Alerts panel */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 text-left shadow-sm" id="alerts-panel">
          <h2 className="text-sm font-bold text-slate-950 flex items-center gap-2 mb-3">
            <Bell className="h-4 w-4 text-amber-500 animate-bounce" /> Alertes de Dossiers Urgents
          </h2>
          <div className="space-y-3">
            {getUrgentDeadlines().map((dead) => (
              <div key={dead.id} className="bg-red-50/50 border border-red-100 p-3 rounded-lg space-y-2 shadow-inner">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-mono text-red-600 font-bold select-all">{dead.numDossier}</span>
                  <span className="bg-red-100 text-red-700 font-bold px-1.5 py-0.2 rounded uppercase text-[8px]">Échéance critique</span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{dead.caseTitle}</h4>
                <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(dead.date).toLocaleDateString("fr-FR")}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {dead.time}</span>
                </div>
              </div>
            ))}

            {getUrgentDeadlines().length === 0 && (
              <p className="text-xs text-slate-400 italic text-center py-2">Aucune alerte d'urgence critique sur le calendrier judiciaire.</p>
            )}
          </div>
        </div>

        {/* Dynamic Agendas Calendar Widget */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 text-left shadow-sm">
          <h2 className="text-sm font-bold text-slate-950 flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-blue-600" /> Calendrier de Juil. 2026
          </h2>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 border-b border-slate-100 pb-1.5 mb-1.5">
            <span>LU</span><span>MA</span><span>ME</span><span>JE</span><span>VE</span><span>SA</span><span>DI</span>
          </div>
          
          {/* Fill spacing for Thursday July 1st 2026 */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty grid blocks for days preceding July 2026 */}
            <div className="h-6"></div><div className="h-6"></div><div className="h-6"></div>
            
            {daysInJuly.map(day => {
              const dayStr = `2026-07-${day.toString().padStart(2, "0")}`;
              const count = getHearingsCountForDay(day);
              const isSelected = selectedDate === dayStr;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(dayStr)}
                  className={`relative h-7 flex flex-col items-center justify-center rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    isSelected ? 'bg-blue-600 text-white shadow-md' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span>{day}</span>
                  {count > 0 && !isSelected && (
                    <span className="absolute bottom-1 w-1 h-1 bg-amber-500 rounded-full"></span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-[10px]">
            <span className="text-slate-400 font-light">Filtre sélectionné :</span>
            <span className="font-mono text-blue-600 font-bold">{new Date(selectedDate).toLocaleDateString("fr-FR", {day: 'numeric', month: 'long', year: 'numeric'})}</span>
          </div>
        </div>

      </div>

      {/* 2. Middle Role d'Audience list (Column 2) */}
      <div className="xl:col-span-1 bg-white rounded-xl border border-slate-200 flex flex-col h-[calc(100vh-180px)] shadow-sm" id="hearings-list-panel">
        <div className="p-4 border-b border-slate-200 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-950 flex items-center gap-2">
              <Scale className="h-4 w-4 text-blue-600" /> Rôle d'Audience
            </h2>
            {/* Only Clerk or Secretary can schedule hearings */}
            {(currentUser.role === "Secrétaire" || currentUser.role === "Greffier") && (
              <button
                onClick={() => setShowScheduleForm(!showScheduleForm)}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm"
              >
                <Plus className="h-3 w-3" /> Fixer Date
              </button>
            )}
          </div>
          <p className="text-[10px] text-slate-500">Cliquez sur une audience pour rédiger le plumitif ou lancer la compilation par IA.</p>
        </div>

        {/* Scrollable Role List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {hearings
            .filter(h => h.date === selectedDate)
            .map((h) => (
              <div
                key={h.id}
                onClick={() => setSelectedHearing(h)}
                className={`p-4 text-left cursor-pointer transition-all ${selectedHearing?.id === h.id ? 'bg-blue-50 border-r-2 border-blue-600 shadow-inner' : 'hover:bg-slate-50/70'}`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[10px] font-bold text-slate-600">{h.numDossier}</span>
                  <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                    h.status === "Terminée" ? "bg-slate-100 text-slate-500 border border-slate-200" :
                    h.status === "En cours" ? "bg-blue-50 text-blue-600 border border-blue-100 animate-pulse" :
                    "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}>{h.status}</span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 mt-2 line-clamp-2">{h.caseTitle}</h4>
                
                <div className="flex flex-col gap-1 mt-3 text-[10px] text-slate-500 font-mono font-medium">
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-slate-400" /> Heure: {h.time}</span>
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400" /> {h.room}</span>
                </div>
              </div>
            ))}

          {hearings.filter(h => h.date === selectedDate).length === 0 && (
            <div className="text-center py-12 text-slate-400 text-xs italic">
              Aucune audience planifiée pour cette date.
            </div>
          )}
        </div>
      </div>

      {/* 3. Right Section: Live notes compiler & AI draft tool (Column 3 & 4) */}
      <div className="xl:col-span-2 flex flex-col h-[calc(100vh-180px)] bg-white rounded-xl border border-slate-200 overflow-y-auto p-6 shadow-sm" id="hearing-compilation-view">
        
        {showScheduleForm ? (
          /* Scheduler Form */
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 text-left">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h2 className="text-md font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" /> Planifier une audience (Greffe)
              </h2>
              <button onClick={() => setShowScheduleForm(false)} className="text-slate-400 hover:text-slate-700 text-xs font-semibold cursor-pointer">Annuler</button>
            </div>

            <form onSubmit={handleScheduleHearing} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase">Associer à un dossier numérisé</label>
                <select
                  required
                  value={scheduleCaseId}
                  onChange={(e) => setScheduleCaseId(e.target.value)}
                  className="mt-1 block w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- Sélectionner le dossier --</option>
                  {cases.map(c => (
                    <option key={c.id} value={c.id}>{c.numDossier} - {c.title}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase">Date d'Audience</label>
                  <input
                    type="date"
                    required
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="mt-1 block w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase">Heure de début</label>
                  <input
                    type="time"
                    required
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="mt-1 block w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase">Salle d'Audience / Chambre</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Chambre Civile I"
                  value={scheduleRoom}
                  onChange={(e) => setScheduleRoom(e.target.value)}
                  className="mt-1 block w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase">Consignes préalables ou motif de fixation</label>
                <textarea
                  rows={3}
                  value={scheduleNotes}
                  onChange={(e) => setScheduleNotes(e.target.value)}
                  className="mt-1 block w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 font-sans"
                  placeholder="Ordre du jour de la cause, citation de témoins..."
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors cursor-pointer shadow-sm"
              >
                Inscrire l'audience au rôle
              </button>
            </form>
          </motion.div>
        ) : selectedHearing ? (
          /* Hearing Details with Notes and Gemini Compile */
          <div className="space-y-6 text-left" id="hearing-details-pane">
            
            {/* Header / Meta */}
            <div className="border-b border-slate-200 pb-4">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <span className="font-mono text-xs text-slate-400 uppercase tracking-widest block font-bold">Suivi d'audience</span>
                  <h2 className="text-lg font-bold text-slate-900 mt-1 leading-tight">{selectedHearing.caseTitle}</h2>
                  <p className="text-xs text-blue-600 mt-1 font-mono font-bold">{selectedHearing.numDossier}</p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleUpdateHearingDetails("En cours")}
                    className={`p-1.5 text-slate-400 hover:text-blue-600 rounded-md transition-all ${selectedHearing.status === "En cours" ? "text-blue-600 bg-blue-50 border border-blue-100 shadow-sm" : ""}`}
                    title="Démarrer l'audience en direct"
                  >
                    <Play className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleUpdateHearingDetails("Terminée")}
                    className={`p-1.5 text-slate-400 hover:text-emerald-600 rounded-md transition-all ${selectedHearing.status === "Terminée" ? "text-emerald-600 bg-emerald-50 border border-emerald-100 shadow-sm" : ""}`}
                    title="Clore l'audience"
                  >
                    <CheckCircle className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200 shadow-sm">
                <div>
                  <span className="text-slate-500 font-bold block">Chambre :</span>
                  <span className="font-semibold text-slate-800">{selectedHearing.room}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block">Horaire :</span>
                  <span className="font-semibold text-slate-800">{selectedHearing.date} à {selectedHearing.time}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block">Rédacteur Plumitif :</span>
                  <span className="font-semibold text-slate-800">{selectedHearing.greffierName}</span>
                </div>
              </div>
            </div>

            {successMsg && (
              <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-blue-650 text-xs font-semibold shadow-sm">
                {successMsg}
              </div>
            )}

            {errorMsg && (
              <div className="bg-red-50 border border-red-100 p-3 rounded-lg text-red-650 text-xs font-semibold shadow-sm">
                {errorMsg}
              </div>
            )}

            {/* Double column input: Left (Plumitif raw notes) -> Right (Gemini formal report) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Raw Draft column */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                    <FileText className="h-4 w-4 text-slate-500" /> Plumitif de Greffe (Brut)
                  </h3>
                  <span className="text-[10px] text-slate-500 font-medium">Saisie d'audience</span>
                </div>
                <textarea
                  rows={14}
                  value={hearingNotes}
                  onChange={(e) => setHearingNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 font-sans shadow-inner leading-relaxed"
                  placeholder="Inscrivez les déclarations des témoins, exceptions soulevées, observations de procureur ou réquisitions judiciaires de l'audience de manière informelle..."
                />
                
                {/* Save local drafts button */}
                <button
                  onClick={() => handleUpdateHearingDetails()}
                  className="w-full py-2 bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 hover:text-slate-900 rounded-lg text-xs font-bold hover:border-slate-300 transition-colors cursor-pointer"
                >
                  Sauvegarder le brouillon du plumitif
                </button>
              </div>

              {/* AI official compilation column */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-blue-600 animate-pulse" /> Compte-rendu Structuré (AI)
                  </h3>
                  
                  {/* Compilation Trigger (limited to Juge/Greffier) */}
                  {(currentUser.role === "Greffier" || currentUser.role === "Juge") ? (
                    <button
                      onClick={handleAICompileMinutes}
                      disabled={compilingAI || !hearingNotes}
                      className="px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded text-[10px] font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1 shadow-sm"
                    >
                      {compilingAI ? (
                        <>
                          <RefreshCw className="animate-spin h-3 w-3" /> Rédaction...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3" /> Compiler par IA
                        </>
                      )}
                    </button>
                  ) : (
                    <span className="text-[9px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-semibold">Lecture seule AI</span>
                  )}
                </div>

                <div className="relative">
                  <textarea
                    rows={14}
                    value={compteRenduText}
                    onChange={(e) => setCompteRenduText(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 font-sans leading-relaxed shadow-inner"
                    placeholder="Le procès-verbal officiel et minute de délibération compilés par l'IA d'aide à la décision s'afficheront ici. Relisez, modifiez au besoin, puis enregistrez l'acte d'audience officiel."
                  />
                  {compilingAI && (
                    <div className="absolute inset-0 bg-white/95 backdrop-blur-md rounded-xl flex flex-col justify-center items-center gap-3 text-center p-4">
                      <Sparkles className="h-10 w-10 text-blue-600 animate-pulse" />
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-900">Compilation Juridique Solennelle par l'IA...</p>
                        <p className="text-[10px] text-slate-500 max-w-xs leading-relaxed font-sans font-medium">Modélisation de la composition de la Cour, conversion des acronymes administratifs et structuration des conclusions d'audience.</p>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleUpdateHearingDetails()}
                  disabled={!compteRenduText}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs transition-colors disabled:opacity-50 cursor-pointer shadow-md"
                >
                  Valider et sceller la minute officielle d'audience
                </button>
              </div>

            </div>

            {/* Pièces et Documents de cette Audience */}
            <div className="border-t border-slate-200 pt-6 mt-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-blue-600" /> Documents & Pièces fournis lors de cette audience
                </h3>
                
                {/* Inline upload specifically for this hearing */}
                {currentUser.permissions?.canUploadDocuments && (
                  <div>
                    <input 
                      type="file" 
                      id={`hearing-tab-file-${selectedHearing.id}`} 
                      className="hidden" 
                      disabled={uploadingDoc}
                      onChange={async (e) => {
                        if (e.target.files && e.target.files[0]) {
                          await handleUploadDocForHearing(e.target.files[0]);
                        }
                      }} 
                    />
                    <label 
                      htmlFor={`hearing-tab-file-${selectedHearing.id}`} 
                      className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 border border-blue-200 rounded-lg text-[11px] font-bold transition-all shadow-sm"
                    >
                      {uploadingDoc ? "Numérisation..." : "Ajouter une pièce"}
                    </label>
                  </div>
                )}
              </div>

              {/* Document List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {associatedCaseForSelectedHearing?.documents?.filter(d => d.hearingId === selectedHearing.id).map((doc) => (
                  <div key={doc.id} className="bg-slate-50/50 p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-white rounded-lg border border-slate-200 text-slate-500 shadow-sm">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 line-clamp-1">{doc.name}</h4>
                        <span className="text-[10px] text-slate-400 block font-medium">Numérisé par {doc.uploadedBy} • {doc.size}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-[9px] shrink-0">
                      <button 
                        className="p-1 text-slate-400 hover:text-slate-800"
                        title="Visualiser la pièce"
                        onClick={() => alert(`Visualisation sécurisée du document : ${doc.name}\nEmpreinte : ${doc.hash}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {currentUser.permissions?.canDeleteCases && (
                        <button 
                          onClick={() => handleDeleteDocFromHearing(doc.id)}
                          className="p-1 text-red-500 hover:text-red-700 transition-colors cursor-pointer" 
                          title="Détruire la pièce"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {(!associatedCaseForSelectedHearing?.documents?.some(d => d.hearingId === selectedHearing.id)) && (
                  <div className="md:col-span-2 border border-dashed border-slate-200 rounded-xl py-6 px-4 text-center text-slate-400">
                    <Paperclip className="h-6 w-6 text-slate-300 mx-auto" />
                    <p className="text-[11px] font-bold text-slate-600 mt-1">Aucune pièce fournie pour cette audience</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Utilisez le bouton ci-dessus pour ajouter des justificatifs, requêtes ou conclusions d'audience.</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400" id="empty-hearings-view">
            <Calendar className="h-16 w-16 text-slate-300 stroke-1" />
            <h3 className="text-sm font-semibold text-slate-700 mt-4">Sélectionner une audience</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">Sélectionnez une date dans le calendrier pour faire apparaître le rôle d'audience quotidien de greffe. Vous pourrez ensuite rédiger ou compiler par IA les minutes officielles.</p>
          </div>
        )}

      </div>

    </div>
  );
}
