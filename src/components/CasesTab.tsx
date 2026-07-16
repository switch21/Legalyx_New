import React, { useState, useRef } from "react";
import { Case, CaseDocument, User, Hearing } from "../types";
import { 
  Folder, Plus, Search, FileText, UploadCloud, Hash, Trash2, 
  Eye, ShieldCheck, Scale, AlertTriangle, CheckCircle, Clock, FileLock,
  Calendar, MapPin, Paperclip, History
} from "lucide-react";
import { motion } from "motion/react";

interface CasesTabProps {
  cases: Case[];
  hearings: Hearing[];
  currentUser: User;
  onRefreshCases: () => void;
}

export default function CasesTab({ cases, hearings, currentUser, onRefreshCases }: CasesTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterNature, setFilterNature] = useState<string>("All");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  
  // New Case Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [numDossier, setNumDossier] = useState("");
  const [title, setTitle] = useState("");
  const [parties, setParties] = useState("");
  const [description, setDescription] = useState("");
  const [nature, setNature] = useState<Case["nature"]>("Pénal");
  const [priority, setPriority] = useState<Case["priority"]>("Moyenne");
  const [tribunal, setTribunal] = useState(currentUser.tribunal || "TGI du Mfoundi (Yaoundé)");
  
  // Document Upload state
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Secret notes saving state
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesDeliberation, setNotesDeliberation] = useState("");

  // Hearings tracking & schedule state for the selected case
  const [showAddHearing, setShowAddHearing] = useState(false);
  const [newHearingDate, setNewHearingDate] = useState("");
  const [newHearingTime, setNewHearingTime] = useState("09:00");
  const [newHearingRoom, setNewHearingRoom] = useState("Chambre Civile I");
  const [newHearingNotes, setNewHearingNotes] = useState("");
  const [schedulingHearing, setSchedulingHearing] = useState(false);
  const [selectedHearingForUpload, setSelectedHearingForUpload] = useState<string>("");

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numDossier || !title) return;

    try {
      const response = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          numDossier,
          title,
          description,
          tribunal,
          nature,
          parties,
          priority
        })
      });

      const data = await response.json();
      if (data.success) {
        setShowAddForm(false);
        setNumDossier("");
        setTitle("");
        setParties("");
        setDescription("");
        onRefreshCases();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveDeliberationNotes = async () => {
    if (!selectedCase) return;
    setSavingNotes(true);
    try {
      const response = await fetch(`/api/cases/${selectedCase.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          notesDeliberation
        })
      });
      const data = await response.json();
      if (data.success) {
        setSelectedCase(data.case);
        onRefreshCases();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingNotes(false);
    }
  };

  const handleUpdateStatus = async (newStatus: Case["status"]) => {
    if (!selectedCase) return;
    try {
      const response = await fetch(`/api/cases/${selectedCase.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          status: newStatus
        })
      });
      const data = await response.json();
      if (data.success) {
        setSelectedCase(data.case);
        onRefreshCases();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Drag and Drop implementation
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0] && selectedCase) {
      const file = e.dataTransfer.files[0];
      await uploadDocument(file, selectedHearingForUpload);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && selectedCase) {
      const file = e.target.files[0];
      await uploadDocument(file, selectedHearingForUpload);
    }
  };

  const handleFileChangeForHearing = async (e: React.ChangeEvent<HTMLInputElement>, hearingId: string) => {
    if (e.target.files && e.target.files[0] && selectedCase) {
      const file = e.target.files[0];
      await uploadDocument(file, hearingId);
    }
  };

  const uploadDocument = async (file: File, hearingId?: string) => {
    if (!selectedCase) return;
    setUploading(true);
    
    // Simulate uploading a judicial document with client-side info
    const simulatedSize = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
    
    try {
      const response = await fetch(`/api/cases/${selectedCase.id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          name: file.name,
          type: getFileType(file.name),
          size: simulatedSize,
          hearingId: hearingId || undefined
        })
      });

      const data = await response.json();
      if (data.success) {
        setSelectedCase(data.case);
        onRefreshCases();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
      setSelectedHearingForUpload("");
    }
  };

  const handleCreateHearingForCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !newHearingDate) return;
    setSchedulingHearing(true);

    try {
      const response = await fetch("/api/hearings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          caseId: selectedCase.id,
          date: newHearingDate,
          time: newHearingTime,
          room: newHearingRoom,
          notes: newHearingNotes
        })
      });

      const data = await response.json();
      if (data.success) {
        setNewHearingDate("");
        setNewHearingNotes("");
        setShowAddHearing(false);
        onRefreshCases();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSchedulingHearing(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!selectedCase) return;
    if (!confirm("Voulez-vous supprimer ce document numérisé définitivement ? Cette action sera consignée dans les rapports d'audit de sécurité.")) return;

    try {
      const response = await fetch(`/api/cases/${selectedCase.id}/documents/${docId}?userId=${currentUser.id}`, {
        method: "DELETE"
      });
      const data = await response.json();
      if (data.success) {
        setSelectedCase(data.case);
        onRefreshCases();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getFileType = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (['pdf', 'doc', 'docx'].includes(ext)) return 'Mémoire / Requête';
    if (['jpg', 'png', 'jpeg'].includes(ext)) return 'Preuve / Pièce';
    return 'Acte d\'huissier';
  };

  // Filters
  const filteredCases = cases.filter(c => {
    const matchesSearch = 
      c.numDossier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.parties.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesNature = filterNature === "All" || c.nature === filterNature;
    const matchesStatus = filterStatus === "All" || c.status === filterStatus;
    
    return matchesSearch && matchesNature && matchesStatus;
  });

  // Render priority badges
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

  const getStatusIcon = (s: Case["status"]) => {
    switch (s) {
      case "En cours":
        return <Clock className="h-4 w-4 text-blue-500" />;
      case "Mis en délibéré":
        return <Scale className="h-4 w-4 text-amber-500" />;
      case "Clôturé":
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      default:
        return <Folder className="h-4 w-4 text-slate-400" />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="cases-tab-view">
      
      {/* 1. Left Section: Cases List & Search */}
      <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 flex flex-col h-[calc(100vh-180px)] shadow-sm" id="cases-sidebar">
        
        {/* Header with Search and add button */}
        <div className="p-4 border-b border-slate-200 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <h2 className="text-md font-bold text-slate-900 flex items-center gap-2">
              <Folder className="h-5 w-5 text-blue-600" /> Registre des Dossiers ({filteredCases.length})
            </h2>
            {/* Limit case creation to users with explicit enrôlement permissions */}
            {currentUser.permissions?.canCreateCases && (
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors cursor-pointer shadow-sm"
                title="Enregistrer un nouveau dossier"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher n° dossier, parties, titre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all focus:bg-white"
            />
          </div>

          {/* Quick Filter chips */}
          <div className="flex gap-2 text-[10px]">
            <select
              value={filterNature}
              onChange={(e) => setFilterNature(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-600 font-semibold focus:outline-none focus:bg-white cursor-pointer"
            >
              <option value="All">Toutes Natures</option>
              <option value="Pénal">Pénal</option>
              <option value="Civil">Civil</option>
              <option value="Administratif">Administratif</option>
              <option value="Commercial">Commercial</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-600 font-semibold focus:outline-none focus:bg-white cursor-pointer"
            >
              <option value="All">Tous Statuts</option>
              <option value="En cours">En cours</option>
              <option value="Mis en délibéré">Délibéré</option>
              <option value="Clôturé">Clôturé</option>
              <option value="Archivé">Archivé</option>
            </select>
          </div>
        </div>

        {/* Scrollable list of Cases */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100" id="cases-list">
          {filteredCases.map((c) => (
            <div
              key={c.id}
              onClick={() => {
                setSelectedCase(c);
                setNotesDeliberation(c.notesDeliberation || "");
              }}
              className={`p-4 text-left cursor-pointer transition-colors ${selectedCase?.id === c.id ? 'bg-blue-50/50 border-r-2 border-blue-600 shadow-inner' : 'hover:bg-slate-50/70'}`}
            >
              <div className="flex justify-between items-start gap-1">
                <span className="font-mono text-xs font-semibold text-slate-600 select-all">{c.numDossier}</span>
                {getPriorityBadge(c.priority)}
              </div>
              <h3 className="text-xs font-bold text-slate-900 mt-1.5 line-clamp-2">{c.title}</h3>
              <p className="text-[10px] text-slate-500 mt-1 truncate">{c.parties}</p>
              
              <div className="flex justify-between items-center mt-3 text-[10px] text-slate-500">
                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-semibold">{c.nature}</span>
                <span className="flex items-center gap-1 font-medium">{getStatusIcon(c.status)} {c.status}</span>
              </div>
            </div>
          ))}

          {filteredCases.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-xs font-medium">
              Aucun dossier correspondant trouvé.
            </div>
          )}
        </div>
      </div>

      {/* 2. Middle & Right: Selected Case View / Add Form */}
      <div className="lg:col-span-2 flex flex-col h-[calc(100vh-180px)] overflow-y-auto bg-white rounded-xl border border-slate-200 p-6 shadow-sm" id="cases-main-pane">
        
        {showAddForm ? (
          /* Case Creation Form */
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Scale className="h-5 w-5 text-blue-600" /> Enregistrement et Numérisation de Dossier
              </h2>
              <button onClick={() => setShowAddForm(false)} className="text-slate-500 hover:text-slate-900 text-xs font-bold cursor-pointer">Annuler</button>
            </div>

            <form onSubmit={handleCreateCase} className="space-y-4 text-left">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase">Numéro Unique de Dossier</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: TGI-YDE/2026/750-PEN"
                    value={numDossier}
                    onChange={(e) => setNumDossier(e.target.value)}
                    className="mt-1 block w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase">Juridiction Saisie</label>
                  <input
                    type="text"
                    required
                    value={tribunal}
                    onChange={(e) => setTribunal(e.target.value)}
                    className="mt-1 block w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase">Intitulé de l'Affaire (Libellé principal)</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Affaire X contre Y ou Ministère Public contre Accusé"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 block w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase">Nature Civile/Pénale</label>
                  <select
                    value={nature}
                    onChange={(e) => setNature(e.target.value as Case["nature"])}
                    className="mt-1 block w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 focus:outline-none cursor-pointer focus:bg-white"
                  >
                    <option value="Pénal">Pénal</option>
                    <option value="Civil">Civil</option>
                    <option value="Administratif">Administratif</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Social">Social</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase">Degré d'Urgence</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Case["priority"])}
                    className="mt-1 block w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 focus:outline-none cursor-pointer focus:bg-white"
                  >
                    <option value="Basse">Basse</option>
                    <option value="Moyenne">Moyenne</option>
                    <option value="Haute">Haute</option>
                    <option value="Urgente">Urgente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase">Parties Impliquées</label>
                  <input
                    type="text"
                    required
                    placeholder="Demandeur vs Défendeur"
                    value={parties}
                    onChange={(e) => setParties(e.target.value)}
                    className="mt-1 block w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase">Résumé / Infractions reprochées / Prétentions</label>
                <textarea
                  rows={4}
                  placeholder="Éléments constitutifs de la saisine, pièces initiales et observations de greffe..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 block w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans focus:bg-white"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg transition-colors cursor-pointer shadow-sm"
                >
                  Enregistrer le dossier dans la base de données sécurisée
                </button>
              </div>
            </form>
          </motion.div>
        ) : selectedCase ? (
          /* Case Details View */
          <div className="space-y-6 text-left" id="selected-case-details">
            
            {/* Header */}
            <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-blue-600 select-all font-bold">
                    {selectedCase.numDossier}
                  </span>
                  <span className="bg-blue-50 text-blue-600 border border-blue-100 px-2.5 py-1 rounded text-xs font-bold">
                    {selectedCase.nature}
                  </span>
                  {getPriorityBadge(selectedCase.priority)}
                </div>
                <h1 className="text-xl font-bold text-slate-900 mt-3 leading-tight">{selectedCase.title}</h1>
                <p className="text-xs text-slate-500 mt-1.5 font-sans">
                  Juridiction : <span className="font-semibold text-slate-800">{selectedCase.tribunal}</span> • Date d'enrôlement : {new Date(selectedCase.dateCreation).toLocaleDateString("fr-FR")}
                </p>
              </div>

              {/* Status Update dropdown */}
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Statut Juridique</label>
                <select
                  value={selectedCase.status}
                  onChange={(e) => handleUpdateStatus(e.target.value as Case["status"])}
                  className="bg-transparent text-xs font-bold text-blue-600 focus:outline-none cursor-pointer"
                >
                  <option value="En cours">En cours</option>
                  <option value="Mis en délibéré">Mis en délibéré</option>
                  <option value="Clôturé">Clôturé</option>
                  <option value="Archivé">Archivé</option>
                </select>
              </div>
            </div>

            {/* Parties details & Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 bg-slate-50/50 p-4 rounded-xl border border-slate-200">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Résumé de la cause</h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed whitespace-pre-line font-sans">{selectedCase.description}</p>
                
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mt-4">Parties contractantes / Procédure</h3>
                <p className="text-xs text-blue-650 font-bold mt-1 font-sans">{selectedCase.parties}</p>
              </div>

              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Composition</h3>
                  <div className="mt-3 space-y-2">
                    <div className="text-xs text-slate-700">
                      <span className="text-slate-500 font-light block">Magistrat de fond :</span>
                      <span className="font-semibold">{selectedCase.magistratName}</span>
                    </div>
                    <div className="text-xs text-slate-700">
                      <span className="text-slate-500 font-light block">Garant de greffe :</span>
                      <span className="font-semibold">Mme Thérèse Atangana</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-[10px] font-mono text-slate-500 mt-4 shadow-sm">
                  <span className="text-blue-600 flex items-center gap-1 font-bold mb-1">
                    <ShieldCheck className="h-3 w-3" /> Base de Données Cryptée
                  </span>
                  Enregistrement intègre et scellé.
                </div>
              </div>
            </div>

            {/* Securitized Document Digitizer Tab */}
            <div className="space-y-4 border-t border-slate-100 pt-6 mt-6">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600" /> Dossier Judiciaire Numérique ({selectedCase.documents?.length || 0} Pièces)
              </h3>

              {/* Drag and Drop Zone */}
              {currentUser.permissions?.canUploadDocuments ? (
                <div 
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                    dragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-blue-400"
                  }`}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    multiple={false} 
                  />
                  <UploadCloud className="h-8 w-8 text-slate-400 mx-auto" />
                  <p className="text-xs font-bold text-slate-700 mt-2">Glissez-déposez le document juridique ou cliquez pour explorer</p>
                  <p className="text-[10px] text-slate-500 mt-1">Sert d'outil de numérisation sécurisée • Formats: PDF, DOCX, JPEG certifiés (Max 25MB)</p>
                  {uploading && <div className="text-blue-600 text-xs mt-2 animate-pulse font-semibold">Signature cryptographique et injection en cours...</div>}
                  
                  {/* Dropdown inside upload zone to associate with specific hearing */}
                  {hearings.filter(h => h.caseId === selectedCase.id).length > 0 && (
                    <div className="mt-4 max-w-xs mx-auto text-left" onClick={(e) => e.stopPropagation()}>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Associer à une audience spécifique (Optionnel) :</label>
                      <select
                        value={selectedHearingForUpload}
                        onChange={(e) => setSelectedHearingForUpload(e.target.value)}
                        className="mt-1 block w-full bg-white border border-slate-200 rounded p-1 text-[11px] text-slate-700 focus:outline-none cursor-pointer font-sans"
                      >
                        <option value="">-- Document général (hors audience) --</option>
                        {hearings
                          .filter(h => h.caseId === selectedCase.id)
                          .map(h => (
                            <option key={h.id} value={h.id}>Audience du {new Date(h.date).toLocaleDateString("fr-FR")} à {h.time} ({h.room})</option>
                          ))
                        }
                      </select>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border border-slate-200 bg-slate-50/50 rounded-xl p-6 text-center shadow-inner">
                  <FileLock className="h-8 w-8 text-slate-400 mx-auto" />
                  <p className="text-xs font-bold text-slate-600 mt-2">Dépôt de pièces restreint</p>
                  <p className="text-[10px] text-slate-500 mt-1">Vos habilitations de sécurité actuelles ne vous autorisent pas à verser de nouvelles pièces au dossier.</p>
                </div>
              )}

              {/* Document List */}
              <div className="space-y-2">
                {selectedCase.documents?.map((doc) => (
                  <div key={doc.id} className="bg-slate-50/50 p-3.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-lg text-slate-500 border border-slate-200 shadow-sm">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 truncate max-w-sm">{doc.name}</h4>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5 font-medium flex-wrap">
                          <span>{doc.size}</span>
                          <span>•</span>
                          <span>Numérisé par {doc.uploadedBy} le {new Date(doc.date).toLocaleDateString("fr-FR")}</span>
                          {doc.hearingId && (
                            <>
                              <span>•</span>
                              <span className="bg-blue-50 text-blue-700 font-bold px-1.5 py-0.2 rounded border border-blue-100 text-[8px] flex items-center gap-0.5 uppercase tracking-wide">
                                <Calendar className="h-2.5 w-2.5" /> Audience du {new Date(hearings.find(h => h.id === doc.hearingId)?.date || "").toLocaleDateString("fr-FR")}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 self-start sm:self-center shadow-sm">
                      <div className="flex flex-col text-[9px] font-mono text-slate-500 pr-3 border-r border-slate-200">
                        <span className="text-[10px] text-blue-600 flex items-center gap-0.5 font-bold">
                          <Hash className="h-2.5 w-2.5" /> SHA-256
                        </span>
                        <span className="truncate w-36" title={doc.hash}>{doc.hash}</span>
                      </div>

                      <div className="flex items-center gap-1 pl-1">
                        <button 
                          className="p-1 text-slate-400 hover:text-slate-800 transition-colors" 
                          title="Visualiser la pièce numérisée"
                          onClick={() => alert(`Visualisation sécurisée du document : ${doc.name}\nEmpreinte de hachage : ${doc.hash}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {/* Only users with delete permissions can remove files */}
                        {currentUser.permissions?.canDeleteCases && (
                          <button 
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="p-1 text-red-500 hover:text-red-700 transition-colors cursor-pointer" 
                            title="Détruire la pièce"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {(!selectedCase.documents || selectedCase.documents.length === 0) && (
                  <p className="text-center text-xs text-slate-400 italic py-4">Aucun document numérique lié à ce dossier actuellement.</p>
                )}
              </div>
            </div>

            {/* Hearing Tracking & Timeline Section */}
            <div className="space-y-4 border-t border-slate-100 pt-6 mt-6 text-left">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <History className="h-4 w-4 text-blue-600" /> Suivi des Audiences & Chronologie ({hearings.filter(h => h.caseId === selectedCase.id).length} Événements)
                </h3>
                
                {/* Scheduling button for Clerk / Secretary */}
                {(currentUser.role === "Secrétaire" || currentUser.role === "Greffier") && (
                  <button
                    onClick={() => setShowAddHearing(!showAddHearing)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5" /> Fixer Date Audience
                  </button>
                )}
              </div>

              {/* Form to schedule a new hearing */}
              {showAddHearing && (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Fixer une nouvelle audience pour ce dossier</h4>
                  <form onSubmit={handleCreateHearingForCase} className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Date d'Audience</label>
                        <input
                          type="date"
                          required
                          value={newHearingDate}
                          onChange={(e) => setNewHearingDate(e.target.value)}
                          className="mt-1 block w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Heure</label>
                        <input
                          type="time"
                          required
                          value={newHearingTime}
                          onChange={(e) => setNewHearingTime(e.target.value)}
                          className="mt-1 block w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Salle d'Audience / Chambre</label>
                      <input
                        type="text"
                        required
                        placeholder="ex: Chambre Civile I - Salle 3"
                        value={newHearingRoom}
                        onChange={(e) => setNewHearingRoom(e.target.value)}
                        className="mt-1 block w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Consignes préalables ou motif du renvoi</label>
                      <textarea
                        rows={2}
                        placeholder="Motifs d'ajournement, ordre du jour, citation à comparaître..."
                        value={newHearingNotes}
                        onChange={(e) => setNewHearingNotes(e.target.value)}
                        className="mt-1 block w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddHearing(false)}
                        className="px-3 py-1.5 bg-slate-200 text-slate-700 hover:bg-slate-350 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        disabled={schedulingHearing}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-sm"
                      >
                        {schedulingHearing ? "Enregistrement..." : "Planifier l'audience"}
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

              {/* Chronological list of hearings (audiences) */}
              <div className="space-y-4">
                {hearings
                  .filter(h => h.caseId === selectedCase.id)
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map((h, idx, arr) => {
                    const linkedDocs = selectedCase.documents?.filter(d => d.hearingId === h.id) || [];
                    return (
                      <div key={h.id} className="relative flex gap-4 text-left">
                        {/* Timeline line */}
                        {idx < arr.length - 1 && (
                          <div className="absolute left-3 top-6 bottom-0 w-0.5 bg-slate-200"></div>
                        )}
                        
                        {/* Timeline dot */}
                        <div className="z-10 mt-1">
                          <span className={`flex h-6.5 w-6.5 items-center justify-center rounded-full border-2 bg-white text-xs shadow-sm ${
                            h.status === "Terminée" ? "border-emerald-500 text-emerald-600" :
                            h.status === "En cours" ? "border-blue-500 text-blue-600 animate-pulse" :
                            h.status === "Reportée" ? "border-red-400 text-red-500" :
                            "border-amber-400 text-amber-500"
                          }`}>
                            <Calendar className="h-3 w-3" />
                          </span>
                        </div>

                        {/* Card body */}
                        <div className="flex-1 bg-slate-50/70 hover:bg-slate-50 border border-slate-200 rounded-xl p-4 transition-all shadow-sm">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-2.5">
                            <div className="space-y-0.5">
                              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <span className="text-slate-500">Audience {idx + 1} •</span>
                                {new Date(h.date).toLocaleDateString("fr-FR", {day: "numeric", month: "long", year: "numeric"})} à {h.time}
                              </h4>
                              <p className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {h.room} • Rédigé par {h.greffierName || "Greffier"}
                              </p>
                            </div>
                            <div className="self-start sm:self-center">
                              <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                                h.status === "Terminée" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                                h.status === "En cours" ? "bg-blue-50 text-blue-700 border-blue-100 animate-pulse" :
                                h.status === "Reportée" ? "bg-red-50 text-red-700 border-red-100" :
                                "bg-amber-50 text-amber-700 border-amber-200"
                              }`}>{h.status}</span>
                            </div>
                          </div>

                          <div className="mt-3 text-xs space-y-3">
                            {/* Raw Notes / Consignes */}
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Consignes / Notes d'Audience</span>
                              <p className="text-xs text-slate-600 leading-relaxed font-sans">{h.notes || "Aucune note consignée pour cette audience."}</p>
                            </div>

                            {/* AI Structured Minutes/Compte Rendu if available */}
                            {h.compteRendu && (
                              <div className="bg-white border border-slate-100 rounded-lg p-3 shadow-inner">
                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 uppercase mb-2 inline-block">
                                  Procès-verbal scellé par IA
                                </span>
                                <p className="text-[11px] text-slate-700 leading-relaxed font-sans whitespace-pre-line border-l-2 border-emerald-500 pl-2.5">
                                  {h.compteRendu}
                                </p>
                              </div>
                            )}

                            {/* Linked Documents supplied at this specific hearing */}
                            <div className="border-t border-slate-200/60 pt-3 mt-3 space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                                  <Paperclip className="h-3.5 w-3.5 text-blue-600" /> Documents fournis lors de cette audience ({linkedDocs.length})
                                </span>

                                {/* Quick inline upload for this specific hearing */}
                                {currentUser.permissions?.canUploadDocuments && (
                                  <div>
                                    <input 
                                      type="file" 
                                      id={`file-hearing-${h.id}`} 
                                      className="hidden" 
                                      onChange={(e) => handleFileChangeForHearing(e, h.id)} 
                                    />
                                    <label 
                                      htmlFor={`file-hearing-${h.id}`} 
                                      className="cursor-pointer inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 border border-blue-200 rounded text-[9px] font-bold transition-all shadow-sm"
                                    >
                                      <Plus className="h-2.5 w-2.5" /> Fournir pièce
                                    </label>
                                  </div>
                                )}
                              </div>

                              {linkedDocs.length > 0 ? (
                                <div className="space-y-1.5 mt-2">
                                  {linkedDocs.map((doc) => (
                                    <div key={doc.id} className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between gap-3 text-[11px]">
                                      <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-slate-400" />
                                        <div>
                                          <span className="font-bold text-slate-800 line-clamp-1">{doc.name}</span>
                                          <span className="text-[9px] text-slate-400 block font-medium">Déposé par {doc.uploadedBy} • {doc.size}</span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1.5 font-mono text-[9px]">
                                        <span className="bg-slate-50 text-slate-500 px-1 py-0.2 rounded border border-slate-100 hidden sm:inline" title={doc.hash}>SHA: {doc.hash.substring(0, 10)}...</span>
                                        <button 
                                          className="p-1 text-slate-400 hover:text-slate-800"
                                          title="Visualiser la pièce"
                                          onClick={() => alert(`Visualisation sécurisée du document : ${doc.name}\nEmpreinte de hachage : ${doc.hash}`)}
                                        >
                                          <Eye className="h-3.5 w-3.5" />
                                        </button>
                                        {currentUser.permissions?.canDeleteCases && (
                                          <button 
                                            onClick={() => handleDeleteDocument(doc.id)}
                                            className="p-1 text-red-500 hover:text-red-700 transition-colors cursor-pointer" 
                                            title="Détruire la pièce"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[10px] text-slate-400 italic font-sans">Aucune pièce fournie pour cette audience de plaidoiries.</p>
                              )}
                            </div>

                          </div>
                        </div>
                      </div>
                    );
                  })}

                {hearings.filter(h => h.caseId === selectedCase.id).length === 0 && (
                  <div className="border border-dashed border-slate-200 rounded-xl p-6 text-center text-slate-400">
                    <Calendar className="h-8 w-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-600 mt-2">Aucune audience fixée pour l'instant</p>
                    <p className="text-[10px] text-slate-500 mt-1">Utilisez l'outil ci-dessus pour planifier une première audience de plaidoiries ou de délibéré.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Judges-Only Secret Deliberation notes / Plumitif editing */}
            {currentUser.permissions?.canEditPlumitif ? (
              <div className="border-t border-slate-200 pt-6 mt-6 bg-blue-50/20 p-4 rounded-xl border border-blue-100 shadow-sm text-left">
                <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                  <FileLock className="h-4 w-4 text-blue-600" /> Cabinet du Juge : Notes Confidentielles de Délibération
                </h3>
                <p className="text-[10px] text-slate-500 mt-1 font-medium">
                  Ce volet d'audience confidentiel est crypté à la volée. Il est strictement réservé aux agents dotés de l'habilitation de modification du plumitif conformément aux règles déontologiques.
                </p>
                <div className="mt-3">
                  <textarea
                    rows={3}
                    value={notesDeliberation}
                    onChange={(e) => setNotesDeliberation(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans shadow-inner"
                    placeholder="Inscrire ici les notes secrètes de délibéré, pistes de verdict et orientations privées..."
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={handleSaveDeliberationNotes}
                      disabled={savingNotes}
                      className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all cursor-pointer shadow-sm"
                    >
                      {savingNotes ? "Sauvegarde chiffrée..." : "Enregistrer les notes de délibéré"}
                    </button>
                  </div>
                </div>
              </div>
            ) : selectedCase.notesDeliberation ? (
              /* Inform secret is there but un-retrievable */
              <div className="border-t border-slate-200 pt-6 mt-6 bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center gap-3 shadow-sm">
                <FileLock className="h-6 w-6 text-slate-400 shrink-0 animate-pulse" />
                <div className="text-[10px] text-slate-500 text-left">
                  <h4 className="font-bold text-slate-700 uppercase">Cabinet d'Instruction Scellé</h4>
                  Des délibérations écrites confidentielles ont été consignées par le magistrat en charge. Votre niveau d'accréditation (<span className="font-bold text-blue-650">{currentUser.role}</span>) ne vous permet pas de consulter ou d'éditer ce volet.
                </div>
              </div>
            ) : null}

          </div>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400" id="empty-case-view">
            <Scale className="h-16 w-16 text-slate-300 stroke-1" />
            <h3 className="text-sm font-semibold text-slate-700 mt-4">Aucun dossier sélectionné</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1">Sélectionnez un dossier dans le registre de gauche pour consulter l'instruction numérique, le coffre-fort de documents et l'état des délibérations.</p>
          </div>
        )}
      </div>

    </div>
  );
}
