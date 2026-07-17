import React, { useState, useEffect } from "react";
import { User, Case, Hearing } from "../types";
import { 
  Users, Scale, AlertTriangle, CheckCircle, Clock, 
  Folder, ArrowRightLeft, Shield, Award, Search, 
  ChevronRight, RefreshCw, Star, BarChart3, Mail, HeartPulse
} from "lucide-react";
import { motion } from "motion/react";
import supabase from "../lib/supabaseClient";
import { mapUserFromDb, logActivity } from "../lib/helpers";

interface PresidentControlTabProps {
  currentUser: User;
  cases: Case[];
  hearings: Hearing[];
  onRefreshData: () => void;
}

export default function PresidentControlTab({ 
  currentUser, 
  cases, 
  hearings, 
  onRefreshData 
}: PresidentControlTabProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [natureFilter, setNatureFilter] = useState("All");
  
  // Re-allocation states
  const [reassigningCaseId, setReassigningCaseId] = useState<string | null>(null);
  const [updatingCaseId, setUpdatingCaseId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*, user_permissions(*)')
        .order('created_at', { ascending: true });
      if (error) throw error;

      const mapped = (data || []).map((u: any) => mapUserFromDb(u, u.user_permissions?.[0]));
      setUsers(mapped);
      if (!selectedUser && mapped.length > 0) {
        const firstNonAdmin = mapped.find((u: User) => u.role !== "Administrateur");
        if (firstNonAdmin) setSelectedUser(firstNonAdmin);
      }
    } catch (err) {
      console.error("Erreur lors de la récupération des agents:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Helper to get cases treated by a specific user
  const getCasesTreatedByUser = (user: User) => {
    if (user.role === "Juge" || user.role === "Président") {
      return cases.filter(c => c.magistratId === user.id);
    }
    if (user.role === "Greffier") {
      // Find case IDs from hearings assigned to this clerk, or documents uploaded
      const clerkCaseIds = new Set(
        hearings
          .filter(h => h.greffierName === user.fullName)
          .map(h => h.caseId)
      );
      return cases.filter(c => 
        clerkCaseIds.has(c.id) || 
        (c.documents && c.documents.some(d => d.uploadedBy === user.fullName))
      );
    }
    if (user.role === "Secrétaire") {
      // Secretary handles initial enrolement or document uploads
      return cases.filter(c => 
        c.documents && c.documents.some(d => d.uploadedBy === user.fullName)
      );
    }
    return [];
  };

  const handleReassignMagistrat = async (caseId: string, targetMagistratId: string) => {
    const targetMagistrat = users.find(u => u.id === targetMagistratId);
    if (!targetMagistrat) return;

    setUpdatingCaseId(caseId);
    setSuccessMessage("");
    try {
      const { data: updated, error } = await supabase
        .from('cases')
        .update({ magistrat_id: targetMagistrat.id })
        .eq('id', caseId)
        .select()
        .single();

      if (error) { console.error(error); return; }

      await logActivity(currentUser.id, 'REAFFECTATION_DOSSIER', `Dossier ${updated.num_dossier} réalloué au cabinet de ${targetMagistrat.fullName}`);

      setSuccessMessage(`Dossier réalloué avec succès au cabinet de ${targetMagistrat.fullName}.`);
      onRefreshData();
      setReassigningCaseId(null);
      if (selectedUser) {
        const freshSelectedUser = users.find(u => u.id === selectedUser.id);
        if (freshSelectedUser) setSelectedUser(freshSelectedUser);
      }
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err) {
      console.error("Échec de la réallocation:", err);
    } finally {
      setUpdatingCaseId(null);
    }
  };

  // Filter cases for the allocation grid
  const filteredCases = cases.filter(c => {
    const matchesSearch = 
      c.numDossier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.parties.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesNature = natureFilter === "All" || c.nature === natureFilter;
    return matchesSearch && matchesNature;
  });

  const getPriorityBadge = (p: Case["priority"]) => {
    switch (p) {
      case "Urgente":
        return <span className="bg-red-50 text-red-600 border border-red-200 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><AlertTriangle className="h-3 w-3 animate-pulse" /> Urgent</span>;
      case "Haute":
        return <span className="bg-orange-50 text-orange-600 border border-orange-200 text-[10px] px-2 py-0.5 rounded-full font-semibold">Haute</span>;
      case "Moyenne":
        return <span className="bg-blue-50 text-blue-600 border border-blue-100 text-[10px] px-2 py-0.5 rounded-full font-medium">Moyenne</span>;
      default:
        return <span className="bg-slate-50 text-slate-500 border border-slate-200 text-[10px] px-2 py-0.5 rounded-full font-normal">Basse</span>;
    }
  };

  const getStatusBadge = (s: Case["status"]) => {
    switch (s) {
      case "En cours":
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><Clock className="h-3 w-3" /> En cours</span>;
      case "Mis en délibéré":
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><Scale className="h-3 w-3" /> Délibéré</span>;
      case "Clôturé":
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Clôturé</span>;
      default:
        return <span className="bg-slate-50 text-slate-500 border border-slate-200 text-[10px] px-2 py-0.5 rounded-full font-normal">{s}</span>;
    }
  };

  // Magistrates only
  const magistratesList = users.filter(u => u.role === "Juge" || u.role === "Président");

  return (
    <div className="space-y-6 text-left animate-fade-in" id="president-control-view">
      
      {/* Upper header section */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Award className="h-5.5 w-5.5 text-blue-600" /> Supervision du Chef de Juridiction
            </h2>
            <p className="text-xs text-slate-500 max-w-3xl font-medium">
              Pilotez l'activité globale du tribunal en temps réel : visualisez la charge de travail nominative des magistrats et greffiers, et procédez à des réallocations de dossiers pour fluidifier le traitement des affaires.
            </p>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-lg text-[11px] text-emerald-700 font-bold shrink-0 flex items-center gap-1.5 self-start md:self-auto shadow-sm">
            <Shield className="h-4.5 w-4.5 text-emerald-600" />
            <span>Président du Tribunal • Droits de réallocation actifs</span>
          </div>
        </div>
      </div>

      {/* Numerical general KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600 shrink-0">
            <Folder className="h-6 w-6" />
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Dossiers Judiciaires</span>
            <span className="text-xl font-extrabold text-slate-900 font-sans block">{cases.length} affaires</span>
            <span className="text-[9px] text-slate-500 leading-none">Actives, délibérées ou closes</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 rounded-lg text-amber-600 shrink-0">
            <Scale className="h-6 w-6" />
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Délibérés en Cours</span>
            <span className="text-xl font-extrabold text-slate-900 font-sans block">
              {cases.filter(c => c.status === "Mis en délibéré").length} dossiers
            </span>
            <span className="text-[9px] text-slate-500 leading-none">Rédaction des jugements</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 rounded-lg text-red-50 shrink-0">
            <AlertTriangle className="h-6 w-6 text-red-500 animate-pulse" />
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Procédures Urgentes</span>
            <span className="text-xl font-extrabold text-slate-900 font-sans block">
              {cases.filter(c => c.priority === "Urgente").length} dossiers
            </span>
            <span className="text-[9px] text-slate-500 leading-none">Référés et urgences absolues</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 rounded-lg text-purple-600 shrink-0">
            <Users className="h-6 w-6" />
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Agents du Greffe</span>
            <span className="text-xl font-extrabold text-slate-900 font-sans block">{users.length} fonctionnaires</span>
            <span className="text-[9px] text-slate-500 leading-none">Magistrats, plume & auxiliaires</span>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm">
          <CheckCircle className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Grid: 1. Users Charge list + 2. Selected user dossier list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Section: Users list with their workloads */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col h-[600px]" id="pres-workloads-sidebar">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-600" /> Charge nominative des cabinets
            </h3>
            <p className="text-[10px] text-slate-500 font-medium mt-1">Sélectionnez un agent pour voir les dossiers qu'il traite.</p>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
            {loadingUsers ? (
              <div className="p-8 text-center text-xs text-slate-500 font-medium flex justify-center items-center gap-1.5">
                <RefreshCw className="h-4 w-4 animate-spin text-blue-600" /> Chargement de l'organigramme...
              </div>
            ) : (
              users.map(u => {
                const userCases = getCasesTreatedByUser(u);
                const isSelected = selectedUser?.id === u.id;
                
                return (
                  <div
                    key={u.id}
                    onClick={() => setSelectedUser(u)}
                    className={`p-3 rounded-lg text-left cursor-pointer transition-all flex items-center justify-between border ${
                      isSelected 
                        ? "bg-blue-50/60 border-blue-200 shadow-sm" 
                        : "border-transparent hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <img 
                        src={u.avatar} 
                        alt={u.fullName} 
                        className="w-9 h-9 rounded-full border border-slate-200 shadow-sm shrink-0"
                      />
                      <div className="space-y-0.5">
                        <span className="block text-xs font-bold text-slate-800 leading-tight">{u.fullName}</span>
                        <span className="text-[9px] text-blue-700 font-bold bg-blue-50 px-1 py-0.5 rounded border border-blue-100 uppercase">
                          {u.role}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="block text-xs font-black font-sans text-slate-900 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                        {userCases.length}
                      </span>
                      <span className="text-[8px] text-slate-400 uppercase tracking-widest font-black">Dossiers</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Section: Cases treated by selected user */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col h-[600px]" id="pres-cases-treated">
          {selectedUser ? (
            <>
              <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img src={selectedUser.avatar} className="w-10 h-10 rounded-full border border-slate-200" />
                  <div className="text-left">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Star className="h-4 w-4 text-blue-600" /> Dossiers traités par {selectedUser.fullName}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-500 font-medium">Cabinet d'audience • Habilité aux ordonnances</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="text-[9px] text-emerald-600 font-bold">Actif en Session</span>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> {selectedUser.username}@minjustice.gov.cm
                </div>
              </div>

              {/* Cases treated list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {getCasesTreatedByUser(selectedUser).length === 0 ? (
                  <div className="p-12 text-center border border-dashed border-slate-200 rounded-xl text-slate-500 text-xs font-medium flex flex-col items-center justify-center space-y-2">
                    <HeartPulse className="h-8 w-8 text-slate-300" />
                    <span>Cet agent n'est actuellement affecté à aucun dossier d'instruction sur cette période.</span>
                  </div>
                ) : (
                  getCasesTreatedByUser(selectedUser).map(c => (
                    <div 
                      key={c.id} 
                      className="p-4 bg-slate-50 hover:bg-slate-50/55 rounded-xl border border-slate-200 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 text-left"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[10px] text-blue-600 font-bold bg-white border border-slate-200 px-2 py-0.5 rounded shadow-sm">
                            {c.numDossier}
                          </span>
                          {getPriorityBadge(c.priority)}
                          {getStatusBadge(c.status)}
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 leading-snug">{c.title}</h4>
                        <p className="text-[10px] text-slate-500 max-w-2xl font-medium line-clamp-2">{c.description}</p>
                        
                        <div className="flex gap-4 text-[10px] text-slate-500 pt-1 flex-wrap">
                          <span>Nature: <strong className="text-slate-700 font-semibold">{c.nature}</strong></span>
                          <span>Créé le: <strong className="text-slate-700 font-semibold">{new Date(c.dateCreation).toLocaleDateString("fr-FR")}</strong></span>
                          <span>Pièces versées: <strong className="text-slate-700 font-semibold">{c.documents ? c.documents.length : 0} pièces</strong></span>
                        </div>
                      </div>

                      <div className="shrink-0 flex md:flex-col gap-2 items-start md:items-end justify-between border-t md:border-t-0 border-slate-200 pt-3 md:pt-0">
                        {selectedUser.role === "Juge" && (
                          <button
                            onClick={() => setReassigningCaseId(c.id)}
                            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 hover:border-slate-300 rounded-lg text-[10px] font-bold text-slate-700 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shrink-0"
                          >
                            <ArrowRightLeft className="h-3.5 w-3.5 text-blue-600" /> Réallouer dossier
                          </button>
                        )}
                        <span className="text-[9px] text-slate-400 font-bold font-mono">ID: {c.id}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-xs text-slate-500 font-medium flex-1 flex flex-col justify-center items-center space-y-2">
              <Users className="h-10 w-10 text-slate-300" />
              <span>Veuillez sélectionner un agent du greffe à gauche pour auditer son activité.</span>
            </div>
          )}
        </div>

      </div>

      {/* Global Dossiers Allocation Panel */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm" id="pres-allocation-panel">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5 text-left">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Folder className="h-4 w-4 text-blue-600" /> Registre d'Attribution Générale des Magistrats
            </h3>
            <p className="text-[10px] text-slate-500 font-medium">Basculez instantanément n'importe quel dossier d'un magistrat instructeur à un autre en cliquant sur le sélecteur.</p>
          </div>

          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrer dossier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white w-40 sm:w-56 font-medium"
              />
            </div>

            <select
              value={natureFilter}
              onChange={(e) => setNatureFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] font-semibold focus:outline-none cursor-pointer"
            >
              <option value="All">Toutes Natures</option>
              <option value="Pénal">Pénal</option>
              <option value="Civil">Civil</option>
              <option value="Commercial">Commercial</option>
              <option value="Administratif">Administratif</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto text-xs">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold text-left">
                <td className="p-3">N° Dossier</td>
                <td className="p-3">Parties / Titre</td>
                <td className="p-3">Priorité</td>
                <td className="p-3">Nature</td>
                <td className="p-3">Magistrat Chargé de l'Affaire</td>
                <td className="p-3 text-right">Statut</td>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 font-medium bg-slate-50/50">
                    Aucun dossier ne correspond aux critères de recherche.
                  </td>
                </tr>
              ) : (
                filteredCases.map(c => {
                  const isUpdating = updatingCaseId === c.id;
                  
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-mono text-blue-600 font-bold">{c.numDossier}</td>
                      <td className="p-3 max-w-[300px]">
                        <span className="block font-bold text-slate-900 leading-tight truncate">{c.title}</span>
                        <span className="text-[10px] text-slate-400 block truncate">{c.parties}</span>
                      </td>
                      <td className="p-3">{getPriorityBadge(c.priority)}</td>
                      <td className="p-3">
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold text-[9px] uppercase">{c.nature}</span>
                      </td>
                      <td className="p-3">
                        {isUpdating ? (
                          <span className="text-[10px] text-blue-600 flex items-center gap-1 animate-pulse font-bold">
                            <RefreshCw className="h-3 w-3 animate-spin" /> Réallocation en cours...
                          </span>
                        ) : (
                          <div className="relative">
                            <select
                              value={c.magistratId}
                              onChange={(e) => handleReassignMagistrat(c.id, e.target.value)}
                              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded px-2.5 py-1.5 text-[11px] font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white cursor-pointer shadow-sm pr-6"
                            >
                              {magistratesList.map(mag => (
                                <option key={mag.id} value={mag.id}>
                                  {mag.fullName} ({mag.role})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right">{getStatusBadge(c.status)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Case reallocation dialog modal */}
      {reassigningCaseId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden animate-scale-up text-left">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <ArrowRightLeft className="h-4.5 w-4.5 text-blue-600" /> Réallouer le dossier d'instruction
              </h4>
              <p className="text-[11px] text-slate-500 mt-1">Sélectionnez le magistrat ou président de chambre destinataire.</p>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1.5 bg-blue-50/40 border border-blue-100 rounded-xl p-3 text-xs">
                <div className="text-blue-700 font-bold">Dossier sélectionné :</div>
                <div className="font-bold text-slate-900 font-mono">
                  {cases.find(c => c.id === reassigningCaseId)?.numDossier}
                </div>
                <div className="text-slate-700 font-medium line-clamp-2">
                  {cases.find(c => c.id === reassigningCaseId)?.title}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Magistrat destinataire</label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {magistratesList.map(mag => {
                    const isCurrent = cases.find(c => c.id === reassigningCaseId)?.magistratId === mag.id;
                    return (
                      <div
                        key={mag.id}
                        onClick={() => {
                          if (!isCurrent) handleReassignMagistrat(reassigningCaseId, mag.id);
                        }}
                        className={`p-3.5 rounded-lg border text-xs text-left transition-all flex items-center gap-3 relative ${
                          isCurrent 
                            ? "bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed" 
                            : "border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 cursor-pointer"
                        }`}
                      >
                        <img src={mag.avatar} className="w-8 h-8 rounded-full border border-slate-100" />
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-900 block">{mag.fullName}</span>
                          <span className="text-[9px] text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 uppercase">
                            {mag.role}
                          </span>
                        </div>
                        {isCurrent && (
                          <span className="text-[10px] font-bold text-slate-400 absolute right-3">Actuel</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setReassigningCaseId(null)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-700 cursor-pointer"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
