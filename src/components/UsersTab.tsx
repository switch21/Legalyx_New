import React, { useState, useEffect } from "react";
import { User, UserRole, UserPermissions, CourtProfile } from "../types";
import { 
  Users, UserPlus, Trash2, ShieldCheck, ShieldAlert, 
  Search, CheckCircle, XCircle, RefreshCw, Key, 
  Fingerprint, MapPin, BadgeHelp, Check, X,
  Building2, Edit3, Layers, Mail, Phone, Calendar as IconCalendar, Shield, PlusCircle
} from "lucide-react";
import { motion } from "motion/react";

export const AVATAR_PRESETS = [
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=120",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=120",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=120",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=120",
  "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=120",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=120",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=120",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=120",
];

interface UsersTabProps {
  currentUser: User;
  onRefreshLogs?: () => void;
}

export default function UsersTab({ currentUser, onRefreshLogs }: UsersTabProps) {
  // Navigation: agents vs court profiles
  const [subTab, setSubTab] = useState<"agents" | "tribunaux">("agents");

  // Shared state
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // --- Agents Sub-tab States ---
  const [users, setUsers] = useState<User[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  
  // New/Edit User form states
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState(AVATAR_PRESETS[0]);
  const [role, setRole] = useState<UserRole>("Secrétaire");
  const [tribunal, setTribunal] = useState("TGI du Mfoundi (Yaoundé)");
  const [mfaEnabled, setMfaEnabled] = useState(true);
  const [biometricRegistered, setBiometricRegistered] = useState(true);
  const [submittingUser, setSubmittingUser] = useState(false);
  
  // Granular Permissions states for editing/creating
  const [permCreateCases, setPermCreateCases] = useState(true);
  const [permDeleteCases, setPermDeleteCases] = useState(false);
  const [permEditPlumitif, setPermEditPlumitif] = useState(false);
  const [permManageHearings, setPermManageHearings] = useState(false);
  const [permUploadDocuments, setPermUploadDocuments] = useState(true);
  const [permVerifyIntegrity, setPermVerifyIntegrity] = useState(false);

  // Active editing user (null means "creation mode")
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // --- Tribunaux Sub-tab States ---
  const [courts, setCourts] = useState<CourtProfile[]>([]);
  const [courtSearchTerm, setCourtSearchTerm] = useState("");
  
  // New/Edit Court form states
  const [courtName, setCourtName] = useState("");
  const [courtType, setCourtType] = useState("Tribunal de Grande Instance");
  const [courtPresident, setCourtPresident] = useState("");
  const [courtAddress, setCourtAddress] = useState("");
  const [courtPhone, setCourtPhone] = useState("");
  const [courtEmail, setCourtEmail] = useState("");
  const [courtRegion, setCourtRegion] = useState("Centre");
  const [courtFoundingDate, setCourtFoundingDate] = useState("");
  const [courtChambersText, setCourtChambersText] = useState("Chambre Civile, Chambre Pénale, Chambre Commerciale");
  const [submittingCourt, setSubmittingCourt] = useState(false);

  // Active editing court (null means "creation mode")
  const [editingCourt, setEditingCourt] = useState<CourtProfile | null>(null);

  // --- Fetch Data ---
  const fetchUsers = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
      } else {
        setErrorMsg(data.message || "Impossible de charger l'annuaire des agents.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Erreur lors du chargement des agents judiciaires.");
    } finally {
      setLoading(false);
    }
  };

  const fetchCourts = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/courts");
      const data = await res.json();
      if (data.success) {
        setCourts(data.courtProfiles || []);
        // Update default tribunal selection in user form if available
        if (data.courtProfiles && data.courtProfiles.length > 0 && !editingUser) {
          setTribunal(data.courtProfiles[0].name);
        }
      } else {
        setErrorMsg(data.message || "Impossible de charger les profils des tribunaux.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Erreur de connexion lors du chargement des tribunaux.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchCourts();
  }, []);

  // Sync role-based default permissions when switching role in user creation
  useEffect(() => {
    if (!editingUser) {
      // Set typical default values based on chosen role for quicker creation
      switch (role) {
        case "Administrateur":
          setPermCreateCases(false);
          setPermDeleteCases(false);
          setPermEditPlumitif(false);
          setPermManageHearings(false);
          setPermUploadDocuments(false);
          setPermVerifyIntegrity(true);
          break;
        case "Président":
          setPermCreateCases(true);
          setPermDeleteCases(true);
          setPermEditPlumitif(true);
          setPermManageHearings(true);
          setPermUploadDocuments(true);
          setPermVerifyIntegrity(true);
          break;
        case "Juge":
          setPermCreateCases(true);
          setPermDeleteCases(true);
          setPermEditPlumitif(true);
          setPermManageHearings(true);
          setPermUploadDocuments(true);
          setPermVerifyIntegrity(true);
          break;
        case "Greffier":
          setPermCreateCases(true);
          setPermDeleteCases(false);
          setPermEditPlumitif(true);
          setPermManageHearings(true);
          setPermUploadDocuments(true);
          setPermVerifyIntegrity(true);
          break;
        case "Secrétaire":
        default:
          setPermCreateCases(true);
          setPermDeleteCases(false);
          setPermEditPlumitif(false);
          setPermManageHearings(false);
          setPermUploadDocuments(true);
          setPermVerifyIntegrity(false);
          break;
      }
    }
  }, [role, editingUser]);

  // --- Handlers for User Accounts & Permissions ---
  const handleCreateOrUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !username || !tribunal) {
      setErrorMsg("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    setSubmittingUser(true);
    setErrorMsg("");
    setSuccessMsg("");

    const permissions: UserPermissions = {
      canCreateCases: permCreateCases,
      canDeleteCases: permDeleteCases,
      canEditPlumitif: permEditPlumitif,
      canManageHearings: permManageHearings,
      canUploadDocuments: permUploadDocuments,
      canVerifyIntegrity: permVerifyIntegrity
    };

    try {
      if (editingUser) {
        // UPDATE PATH
        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            adminId: currentUser.id,
            fullName,
            role,
            tribunal,
            permissions,
            avatar
          })
        });

        const data = await res.json();
        setSubmittingUser(false);

        if (!res.ok) {
          setErrorMsg(data.message || "Erreur lors de la mise à jour de l'agent.");
          return;
        }

        if (data.success) {
          setSuccessMsg(`Les habilitations de l'agent ${fullName} ont été configurées avec succès.`);
          cancelEditUser();
          fetchUsers();
          if (onRefreshLogs) onRefreshLogs();
        }
      } else {
        // CREATE PATH
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            adminId: currentUser.id,
            username,
            fullName,
            role,
            tribunal,
            mfaEnabled,
            biometricRegistered,
            permissions,
            avatar
          })
        });

        const data = await res.json();
        setSubmittingUser(false);

        if (!res.ok) {
          setErrorMsg(data.message || "Erreur de création de l'agent.");
          return;
        }

        if (data.success) {
          setSuccessMsg(`L'officier judiciaire ${fullName} a été enrôlé dans l'annuaire.`);
          // Reset form
          setFullName("");
          setUsername("");
          setMfaEnabled(true);
          setBiometricRegistered(true);
          fetchUsers();
          if (onRefreshLogs) onRefreshLogs();
        }
      }
    } catch (err) {
      setSubmittingUser(false);
      setErrorMsg("Erreur lors de la communication avec le greffe central.");
    }
  };

  const startEditUser = (user: User) => {
    setEditingUser(user);
    setFullName(user.fullName);
    setUsername(user.username);
    setRole(user.role);
    setTribunal(user.tribunal);
    setAvatar(user.avatar || AVATAR_PRESETS[0]);
    
    // Load granular permissions
    const perms = user.permissions || {
      canCreateCases: true,
      canDeleteCases: false,
      canEditPlumitif: false,
      canManageHearings: false,
      canUploadDocuments: true,
      canVerifyIntegrity: false
    };
    setPermCreateCases(perms.canCreateCases);
    setPermDeleteCases(perms.canDeleteCases);
    setPermEditPlumitif(perms.canEditPlumitif);
    setPermManageHearings(perms.canManageHearings);
    setPermUploadDocuments(perms.canUploadDocuments);
    setPermVerifyIntegrity(perms.canVerifyIntegrity);
  };

  const cancelEditUser = () => {
    setEditingUser(null);
    setFullName("");
    setUsername("");
    setRole("Secrétaire");
    if (courts.length > 0) {
      setTribunal(courts[0].name);
    } else {
      setTribunal("TGI du Mfoundi (Yaoundé)");
    }
    setMfaEnabled(true);
    setBiometricRegistered(true);
    setAvatar(AVATAR_PRESETS[0]);
    
    // Default permissions back
    setPermCreateCases(true);
    setPermDeleteCases(false);
    setPermEditPlumitif(false);
    setPermManageHearings(false);
    setPermUploadDocuments(true);
    setPermVerifyIntegrity(false);
  };

  const handleToggleActive = async (user: User) => {
    setErrorMsg("");
    setSuccessMsg("");
    const newActiveState = user.active === false ? true : false;

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId: currentUser.id,
          active: newActiveState
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Le compte de ${user.fullName} est maintenant ${newActiveState ? "actif" : "suspendu"}.`);
        fetchUsers();
        if (onRefreshLogs) onRefreshLogs();
      } else {
        setErrorMsg(data.message || "Erreur lors du changement de statut.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Erreur lors du changement de statut de l'agent.");
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (user.id === currentUser.id) {
      setErrorMsg("Vous ne pouvez pas détruire votre propre compte administrateur.");
      return;
    }

    const confirmDelete = window.confirm(`Êtes-vous absolument sûr de vouloir radier définitivement l'agent ${user.fullName} ? Toutes ses affectations et signatures biométriques seront suspendues.`);
    if (!confirmDelete) return;

    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch(`/api/users/${user.id}?adminId=${currentUser.id}`, {
        method: "DELETE"
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`L'agent ${user.fullName} a été définitivement supprimé de la base sécurisée.`);
        fetchUsers();
        if (onRefreshLogs) onRefreshLogs();
      } else {
        setErrorMsg(data.message || "Erreur lors de la radiation de l'agent.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Impossible d'exécuter la radiation.");
    }
  };

  // --- Handlers for Court Profiles ---
  const handleCreateOrUpdateCourt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courtName || !courtType || !courtPresident) {
      setErrorMsg("Le nom, le type et le président du tribunal sont requis.");
      return;
    }

    setSubmittingCourt(true);
    setErrorMsg("");
    setSuccessMsg("");

    const chambers = courtChambersText.split(",").map(c => c.trim()).filter(Boolean);

    const payload = {
      adminId: currentUser.id,
      name: courtName,
      type: courtType,
      president: courtPresident,
      address: courtAddress,
      phone: courtPhone,
      email: courtEmail,
      jurisdictionRegion: courtRegion,
      foundingDate: courtFoundingDate,
      activeChambers: chambers
    };

    try {
      if (editingCourt) {
        // UPDATE PATH
        const res = await fetch(`/api/courts/${editingCourt.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        setSubmittingCourt(false);

        if (!res.ok) {
          setErrorMsg(data.message || "Erreur lors de la modification du tribunal.");
          return;
        }

        if (data.success) {
          setSuccessMsg(`Le profil du tribunal ${courtName} a été mis à jour.`);
          cancelEditCourt();
          fetchCourts();
          if (onRefreshLogs) onRefreshLogs();
        }
      } else {
        // CREATE PATH
        const res = await fetch("/api/courts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        setSubmittingCourt(false);

        if (!res.ok) {
          setErrorMsg(data.message || "Erreur lors de la création du tribunal.");
          return;
        }

        if (data.success) {
          setSuccessMsg(`Le nouveau profil de tribunal "${courtName}" a été créé.`);
          setCourtName("");
          setCourtPresident("");
          setCourtAddress("");
          setCourtPhone("");
          setCourtEmail("");
          setCourtFoundingDate("");
          setCourtChambersText("Chambre Civile, Chambre Pénale, Chambre Commerciale");
          fetchCourts();
          if (onRefreshLogs) onRefreshLogs();
        }
      }
    } catch (err) {
      setSubmittingCourt(false);
      setErrorMsg("Impossible d'enregistrer le profil de tribunal.");
    }
  };

  const startEditCourt = (court: CourtProfile) => {
    setEditingCourt(court);
    setCourtName(court.name);
    setCourtType(court.type);
    setCourtPresident(court.president);
    setCourtAddress(court.address || "");
    setCourtPhone(court.phone || "");
    setCourtEmail(court.email || "");
    setCourtRegion(court.jurisdictionRegion || "Centre");
    setCourtFoundingDate(court.foundingDate || "");
    setCourtChambersText(court.activeChambers ? court.activeChambers.join(", ") : "");
  };

  const cancelEditCourt = () => {
    setEditingCourt(null);
    setCourtName("");
    setCourtType("Tribunal de Grande Instance");
    setCourtPresident("");
    setCourtAddress("");
    setCourtPhone("");
    setCourtEmail("");
    setCourtRegion("Centre");
    setCourtFoundingDate("");
    setCourtChambersText("Chambre Civile, Chambre Pénale, Chambre Commerciale");
  };

  const handleDeleteCourt = async (court: CourtProfile) => {
    const confirmDelete = window.confirm(`Voulez-vous supprimer le profil d'activité du tribunal : ${court.name} ? Cette action archivera son historique.`);
    if (!confirmDelete) return;

    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch(`/api/courts/${court.id}?adminId=${currentUser.id}`, {
        method: "DELETE"
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Le profil du tribunal ${court.name} a été retiré.`);
        fetchCourts();
        if (onRefreshLogs) onRefreshLogs();
      } else {
        setErrorMsg(data.message || "Erreur lors de la suppression.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Impossible de supprimer le tribunal.");
    }
  };

  // --- UI Helpers ---
  const getRoleBadge = (userRole: UserRole) => {
    switch (userRole) {
      case "Administrateur":
        return <span className="bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Administrateur</span>;
      case "Juge":
        return <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Juge</span>;
      case "Greffier":
        return <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Greffier</span>;
      case "Secrétaire":
        return <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Secrétaire</span>;
      default:
        return <span className="bg-slate-50 text-slate-700 border border-slate-100 px-2 py-0.5 rounded text-[10px] font-bold uppercase">{userRole}</span>;
    }
  };

  const filteredUsers = users.filter(u => 
    u.fullName.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    u.username.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    u.role.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    u.tribunal.toLowerCase().includes(userSearchTerm.toLowerCase())
  );

  const filteredCourts = courts.filter(c => 
    c.name.toLowerCase().includes(courtSearchTerm.toLowerCase()) ||
    c.type.toLowerCase().includes(courtSearchTerm.toLowerCase()) ||
    c.president.toLowerCase().includes(courtSearchTerm.toLowerCase()) ||
    c.jurisdictionRegion.toLowerCase().includes(courtSearchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 text-left animate-fade-in" id="users-management-tab">
      
      {/* Upper header summary */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-md font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" /> Console de Contrôle Sécurisé de l'Administration
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl font-medium">
            Pilotez l'intégrité de la plateforme judiciaire : configurez l'annuaire des officiers de justice, attribuez des habilitations granulaires pour la séparation des pouvoirs, et créez les profils structurels des tribunaux camerounais.
          </p>
        </div>
        <button
          onClick={subTab === "agents" ? fetchUsers : fetchCourts}
          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-colors cursor-pointer shadow-sm self-start md:self-auto flex items-center gap-1.5 text-xs font-semibold"
        >
          {loading ? <RefreshCw className="h-4 w-4 animate-spin text-blue-600" /> : <RefreshCw className="h-4 w-4" />}
          Rafraîchir les données
        </button>
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex border-b border-slate-200 gap-1">
        <button
          onClick={() => {
            setSubTab("agents");
            setErrorMsg("");
            setSuccessMsg("");
          }}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            subTab === "agents"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users className="h-4 w-4" /> Annuaire des Agents ({users.length})
        </button>
        <button
          onClick={() => {
            setSubTab("tribunaux");
            setErrorMsg("");
            setSuccessMsg("");
          }}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            subTab === "tribunaux"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Building2 className="h-4 w-4" /> Profils des Tribunaux ({courts.length})
        </button>
      </div>

      {/* Alerts */}
      {successMsg && (
        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-sm">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </motion.div>
      )}

      {errorMsg && (
        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-800 text-xs font-semibold flex items-center gap-2 shadow-sm">
          <ShieldAlert className="h-4 w-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </motion.div>
      )}

      {/* SUB-TAB 1: AGENTS & GRANULAR PERMISSIONS */}
      {subTab === "agents" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left/Middle Column: List */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Search */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher par nom, identifiant unique ou tribunal de rattachement..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 font-sans"
                />
              </div>
              {userSearchTerm && (
                <button 
                  onClick={() => setUserSearchTerm("")}
                  className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                >
                  Effacer
                </button>
              )}
              <button
                onClick={() => {
                  cancelEditUser();
                  setTimeout(() => {
                    const formElement = document.getElementById("agent-enrollment-form");
                    if (formElement) {
                      formElement.scrollIntoView({ behavior: "smooth" });
                    }
                  }, 100);
                }}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
              >
                <UserPlus className="h-4.5 w-4.5" />
                <span>Enrôler un agent</span>
              </button>
            </div>

            {/* User List Panel */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-100">
                {filteredUsers.map((user) => (
                  <div key={user.id} className="p-4 hover:bg-slate-50/50 transition-all flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    
                    {/* Profile */}
                    <div className="flex items-start gap-3">
                      <img 
                        src={user.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120"} 
                        alt={user.fullName} 
                        className={`w-10 h-10 rounded-full border shadow-sm ${user.active === false ? "opacity-40 grayscale" : "border-slate-200"}`}
                        referrerPolicy="no-referrer"
                      />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-bold ${user.active === false ? "text-slate-400 line-through" : "text-slate-900"}`}>
                            {user.fullName}
                          </span>
                          {getRoleBadge(user.role)}
                          {user.active === false ? (
                            <span className="bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase">Suspendu</span>
                          ) : (
                            <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase">Actif</span>
                          )}
                        </div>
                        
                        {/* Subtitle details */}
                        <div className="text-[11px] text-slate-500 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                          <span className="font-mono text-blue-600 font-bold">@{user.username}</span>
                          <span className="hidden sm:inline text-slate-300">•</span>
                          <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" /> {user.tribunal}</span>
                        </div>

                        {/* Status checks */}
                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                          <span className={`flex items-center gap-0.5 text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded border ${user.mfaEnabled ? "bg-blue-50/50 text-blue-600 border-blue-100" : "bg-slate-50 text-slate-400 border-slate-200"}`}>
                            <Key className="h-2.5 w-2.5" /> MFA {user.mfaEnabled ? "Activé" : "Désactivé"}
                          </span>
                          <span className={`flex items-center gap-0.5 text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded border ${user.biometricRegistered ? "bg-indigo-50/50 text-indigo-600 border-indigo-100" : "bg-slate-50 text-slate-400 border-slate-200"}`}>
                            <Fingerprint className="h-2.5 w-2.5" /> Biométrie {user.biometricRegistered ? "Enrôlée" : "Non-enrôlée"}
                          </span>
                          
                          {/* Display permission summary tags */}
                          {user.permissions && (
                            <div className="flex gap-1 items-center flex-wrap mt-0.5">
                              {user.permissions.canCreateCases && (
                                <span className="bg-slate-100 text-slate-600 text-[8px] px-1.5 rounded">Enrôlement</span>
                              )}
                              {user.permissions.canDeleteCases && (
                                <span className="bg-red-50 text-red-600 text-[8px] px-1.5 rounded">Suppression</span>
                              )}
                              {user.permissions.canEditPlumitif && (
                                <span className="bg-amber-100 text-amber-700 text-[8px] px-1.5 rounded">Plumitif</span>
                              )}
                              {user.permissions.canManageHearings && (
                                <span className="bg-blue-50 text-blue-600 text-[8px] px-1.5 rounded">Audiences</span>
                              )}
                              {user.permissions.canUploadDocuments && (
                                <span className="bg-emerald-100 text-emerald-800 text-[8px] px-1.5 rounded">Pièces</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-end md:self-auto">
                      
                      {/* Edit Habilitations button */}
                      <button
                        onClick={() => startEditUser(user)}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                          editingUser?.id === user.id
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                        title="Configurer les habilitations"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Habilitations</span>
                      </button>

                      {/* Toggle status */}
                      <button
                        onClick={() => handleToggleActive(user)}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                          user.active === false 
                            ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100" 
                            : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                        }`}
                        title={user.active === false ? "Activer le compte" : "Suspendre temporairement"}
                      >
                        {user.active === false ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                        <span className="hidden sm:inline">{user.active === false ? "Activer" : "Suspendre"}</span>
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteUser(user)}
                        disabled={user.id === currentUser.id}
                        className={`p-2 rounded-lg border text-xs transition-all cursor-pointer ${
                          user.id === currentUser.id 
                            ? "bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed" 
                            : "bg-white border-slate-200 text-red-500 hover:bg-red-50 hover:border-red-300"
                        }`}
                        title="Radier cet agent"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>

                    </div>

                  </div>
                ))}

                {filteredUsers.length === 0 && (
                  <div className="text-center py-12 text-slate-400 italic text-xs">
                    Aucun agent de greffe enregistré ou correspondant à vos critères de filtrage.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Create or Edit Habilitations */}
          <div className="lg:col-span-1">
            <div id="agent-enrollment-form" className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 text-left">
              
              <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    {editingUser ? (
                      <>
                        <Shield className="h-4.5 w-4.5 text-amber-500" /> Habilitations Granulaires
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4.5 w-4.5 text-blue-600" /> Enrôler un Nouvel Agent
                      </>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                    {editingUser 
                      ? `Personnalisation fine des accès pour ${editingUser.fullName}` 
                      : "Génération immédiate d'un identifiant judiciaire sécurisé."}
                  </p>
                </div>
                {editingUser && (
                  <button 
                    onClick={cancelEditUser}
                    className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                    title="Fermer et repasser à la création"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <form onSubmit={handleCreateOrUpdateUser} className="space-y-4">
                
                {/* Photo de profil / Sélecteur d'avatar */}
                <div className="bg-slate-50 p-4.5 rounded-xl border border-slate-200 space-y-3">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Photo d'identité de l'agent
                  </label>
                  
                  <div className="flex items-center gap-4">
                    {/* Grand aperçu de l'avatar sélectionné */}
                    <div className="relative shrink-0">
                      <img 
                        src={avatar} 
                        alt="Aperçu" 
                        className="h-16 w-16 rounded-full object-cover border-2 border-blue-600 shadow-md bg-white"
                      />
                      <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full p-1 shadow">
                        <Check className="h-3 w-3 font-bold" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[10px] text-slate-500 font-medium leading-tight block">
                        Sélectionnez un portrait officiel ci-dessous pour illustrer le profil de l'agent dans l'annuaire judiciaire.
                      </span>
                      
                      {/* Choix des photos miniatures */}
                      <div className="flex flex-wrap gap-2">
                        {AVATAR_PRESETS.map((presetUrl, idx) => {
                          const isSelected = avatar === presetUrl;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setAvatar(presetUrl)}
                              className={`relative h-9 w-9 rounded-full overflow-hidden transition-all duration-250 cursor-pointer ${
                                isSelected 
                                  ? "ring-2 ring-blue-600 ring-offset-2 scale-110 shadow-sm" 
                                  : "opacity-70 hover:opacity-100 hover:scale-105"
                              }`}
                            >
                              <img 
                                src={presetUrl} 
                                alt={`Option ${idx + 1}`} 
                                className="h-full w-full object-cover"
                              />
                              {isSelected && (
                                <div className="absolute inset-0 bg-blue-600/10 flex items-center justify-center">
                                  <div className="bg-blue-600 rounded-full p-0.5">
                                    <Check className="h-2 w-2 text-white" />
                                  </div>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nom complet de l'agent *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: M. le Juge Emmanuel Nsame"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={!!editingUser} // Can't rename identity from here to prevent audit fraud
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 font-sans disabled:opacity-60"
                  />
                </div>

                {!editingUser && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Identifiant judiciaire unique *
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2.5 text-slate-400 text-xs font-mono">@</span>
                      <input
                        type="text"
                        required
                        placeholder="prenom.nom"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-6 pr-3 py-2.5 text-xs font-mono text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Habilitation / Fonction principale *
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-850 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 font-sans"
                  >
                    <option value="Président">Président du Tribunal</option>
                    <option value="Juge">Juge (Magistrat de fond)</option>
                    <option value="Greffier">Greffier d'audience</option>
                    <option value="Secrétaire">Secrétaire de greffe</option>
                    <option value="Administrateur">Administrateur de sécurité</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Tribunal d'attachement *
                  </label>
                  {courts.length > 0 ? (
                    <select
                      value={tribunal}
                      onChange={(e) => setTribunal(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-850 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 font-sans"
                    >
                      {courts.map((c) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                      <option value="Ministère de la Justice (MINJUSTICE)">Ministère de la Justice (MINJUSTICE)</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      placeholder="ex: TGI du Mfoundi (Yaoundé)"
                      value={tribunal}
                      onChange={(e) => setTribunal(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 font-sans"
                    />
                  )}
                </div>

                {/* Granular Permissions Controls Panel */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Shield className="h-3 w-3 text-blue-600" /> Droits d'Accès de Sécurité
                  </span>
                  
                  <div className="space-y-2 text-xs">
                    <label className="flex items-start gap-2.5 cursor-pointer text-slate-700">
                      <input
                        type="checkbox"
                        checked={permCreateCases}
                        onChange={(e) => setPermCreateCases(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-slate-300 mt-0.5"
                      />
                      <div>
                        <span className="font-bold block text-slate-900">Enrôlement de dossiers</span>
                        <span className="text-[10px] text-slate-500 leading-tight block">Peut inscrire de nouvelles affaires au registre général</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer text-slate-700">
                      <input
                        type="checkbox"
                        checked={permDeleteCases}
                        onChange={(e) => setPermDeleteCases(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-slate-300 mt-0.5"
                      />
                      <div>
                        <span className="font-bold block text-slate-900">Suppression de dossiers</span>
                        <span className="text-[10px] text-slate-500 leading-tight block">Droit d'archivage ou radiation d'un dossier du greffe</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer text-slate-700">
                      <input
                        type="checkbox"
                        checked={permEditPlumitif}
                        onChange={(e) => setPermEditPlumitif(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-slate-300 mt-0.5"
                      />
                      <div>
                        <span className="font-bold block text-slate-900">Modification du plumitif</span>
                        <span className="text-[10px] text-slate-500 leading-tight block">Peut rédiger les minutes de séances et les notes d'audience</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer text-slate-700">
                      <input
                        type="checkbox"
                        checked={permManageHearings}
                        onChange={(e) => setPermManageHearings(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-slate-300 mt-0.5"
                      />
                      <div>
                        <span className="font-bold block text-slate-900">Planification d'audiences</span>
                        <span className="text-[10px] text-slate-500 leading-tight block">Fixe la date, l'heure et la composition de la chambre</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer text-slate-700">
                      <input
                        type="checkbox"
                        checked={permUploadDocuments}
                        onChange={(e) => setPermUploadDocuments(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-slate-300 mt-0.5"
                      />
                      <div>
                        <span className="font-bold block text-slate-900">Versement de pièces</span>
                        <span className="text-[10px] text-slate-500 leading-tight block">Peut verser de nouvelles requêtes et pièces chiffrées au dossier</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer text-slate-700">
                      <input
                        type="checkbox"
                        checked={permVerifyIntegrity}
                        onChange={(e) => setPermVerifyIntegrity(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-slate-300 mt-0.5"
                      />
                      <div>
                        <span className="font-bold block text-slate-900">Audit de l'intégrité</span>
                        <span className="text-[10px] text-slate-500 leading-tight block">Peut vérifier la chaîne d'empreinte cryptographique des logs</span>
                      </div>
                    </label>
                  </div>

                </div>

                {!editingUser && (
                  <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-200 space-y-2 text-xs">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sécurité d'enrôlement</span>
                    
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={mfaEnabled}
                        onChange={(e) => setMfaEnabled(e.target.checked)}
                        className="rounded text-blue-600 h-3.5 w-3.5 border-slate-300"
                      />
                      Exiger la double authentification (MFA)
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={biometricRegistered}
                        onChange={(e) => setBiometricRegistered(e.target.checked)}
                        className="rounded text-blue-600 h-3.5 w-3.5 border-slate-300"
                      />
                      Activer le scanner d'empreinte biométrique
                    </label>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submittingUser}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {submittingUser ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" /> Traitement sécurisé...
                    </>
                  ) : editingUser ? (
                    <>
                      <ShieldCheck className="h-4 w-4" /> Sauvegarder les habilitations
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" /> Enregistrer le profil d'agent
                    </>
                  )}
                </button>

              </form>

            </div>
          </div>

        </div>
      )}

      {/* SUB-TAB 2: TRIBUNAUX / COURT PROFILES */}
      {subTab === "tribunaux" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left/Middle Column: List */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Search */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filtrer les tribunaux par nom, type, président ou région d'activité..."
                  value={courtSearchTerm}
                  onChange={(e) => setCourtSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 font-sans"
                />
              </div>
              {courtSearchTerm && (
                <button 
                  onClick={() => setCourtSearchTerm("")}
                  className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                >
                  Effacer
                </button>
              )}
            </div>

            {/* Courts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCourts.map((court) => (
                <div key={court.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4 relative hover:border-blue-200 transition-all">
                  
                  {/* Top info */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-1">
                      <span className="bg-blue-50 text-blue-700 border border-blue-100 text-[9px] font-bold uppercase px-2 py-0.5 rounded">
                        {court.type}
                      </span>
                      <span className="bg-slate-100 text-slate-600 text-[9px] font-bold px-2 py-0.5 rounded font-mono">
                        Région : {court.jurisdictionRegion}
                      </span>
                    </div>

                    <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5 pt-1">
                      <Building2 className="h-4.5 w-4.5 text-blue-600 shrink-0" /> {court.name}
                    </h4>

                    {/* President info */}
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-150 text-xs">
                      <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Président de Chambre</span>
                      <span className="text-slate-850 font-semibold">{court.president}</span>
                    </div>

                    {/* Metadata lines */}
                    <div className="space-y-1 text-slate-500 text-[11px] pt-1.5 font-medium">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" /> {court.address || "Adresse non fournie"}
                      </div>
                      {court.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" /> {court.phone}
                        </div>
                      )}
                      {court.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" /> {court.email}
                        </div>
                      )}
                      {court.foundingDate && (
                        <div className="flex items-center gap-1.5">
                          <IconCalendar className="h-3.5 w-3.5 text-slate-400 shrink-0" /> Créé le {new Date(court.foundingDate).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })}
                        </div>
                      )}
                    </div>

                    {/* Active chambers */}
                    {court.activeChambers && court.activeChambers.length > 0 && (
                      <div className="pt-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Chambres Activement Enrôlées</span>
                        <div className="flex flex-wrap gap-1">
                          {court.activeChambers.map((ch, idx) => (
                            <span key={idx} className="bg-slate-100 text-slate-700 text-[9px] px-2 py-0.5 rounded font-medium border border-slate-200">
                              {ch}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom Actions */}
                  <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                    <button
                      onClick={() => startEditCourt(court)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                      title="Modifier les coordonnées"
                    >
                      <Edit3 className="h-3.5 w-3.5 text-slate-500" /> Modifier
                    </button>
                    <button
                      onClick={() => handleDeleteCourt(court)}
                      className="p-1.5 bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 hover:border-red-200 rounded-lg transition-all cursor-pointer shadow-sm"
                      title="Retirer ce tribunal"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                </div>
              ))}

              {filteredCourts.length === 0 && (
                <div className="text-center py-12 text-slate-400 italic text-xs col-span-2">
                  Aucun profil de tribunal enregistré ou correspondant à vos critères de filtrage.
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Create or Edit Court */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 text-left">
              
              <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    {editingCourt ? (
                      <>
                        <Edit3 className="h-4.5 w-4.5 text-blue-600" /> Modifier le Tribunal
                      </>
                    ) : (
                      <>
                        <PlusCircle className="h-4.5 w-4.5 text-blue-600" /> Enregistrer un Tribunal
                      </>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                    {editingCourt ? `Ajustement des coordonnées de : ${editingCourt.name}` : "Enregistrement officiel d'une nouvelle juridiction au greffe d'État."}
                  </p>
                </div>
                {editingCourt && (
                  <button 
                    onClick={cancelEditCourt}
                    className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                    title="Repasser à la création"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <form onSubmit={handleCreateOrUpdateCourt} className="space-y-4">
                
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nom de la juridiction *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Tribunal de Première Instance de Douala-Bonanjo"
                    value={courtName}
                    onChange={(e) => setCourtName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Type de tribunal *
                  </label>
                  <select
                    value={courtType}
                    onChange={(e) => setCourtType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-850 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 font-sans"
                  >
                    <option value="Tribunal de Grande Instance">Tribunal de Grande Instance (TGI)</option>
                    <option value="Tribunal de Première Instance">Tribunal de Première Instance (TPI)</option>
                    <option value="Cour d'Appel">Cour d'Appel</option>
                    <option value="Tribunal Administratif">Tribunal Administratif</option>
                    <option value="Tribunal Militaire">Tribunal Militaire</option>
                    <option value="Cour Suprême">Cour Suprême</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Magistrat - Président de Tribunal *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: M. le Magistrat Hors Hiérarchie Philippe Ndi"
                    value={courtPresident}
                    onChange={(e) => setCourtPresident(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 font-sans"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Région administrative
                    </label>
                    <select
                      value={courtRegion}
                      onChange={(e) => setCourtRegion(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-850 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 font-sans"
                    >
                      <option value="Centre">Centre</option>
                      <option value="Littoral">Littoral</option>
                      <option value="Ouest">Ouest</option>
                      <option value="Adamaoua">Adamaoua</option>
                      <option value="Extrême-Nord">Extrême-Nord</option>
                      <option value="Nord">Nord</option>
                      <option value="Est">Est</option>
                      <option value="Sud">Sud</option>
                      <option value="Nord-Ouest">Nord-Ouest</option>
                      <option value="Sud-Ouest">Sud-Ouest</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Date de création
                    </label>
                    <input
                      type="date"
                      value={courtFoundingDate}
                      onChange={(e) => setCourtFoundingDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-805 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Adresse physique
                  </label>
                  <input
                    type="text"
                    placeholder="ex: Place de la Justice, Centre Ville, Yaoundé"
                    value={courtAddress}
                    onChange={(e) => setCourtAddress(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 font-sans"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Téléphone
                    </label>
                    <input
                      type="text"
                      placeholder="ex: +237 222-31-45-67"
                      value={courtPhone}
                      onChange={(e) => setCourtPhone(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Courriel de contact
                    </label>
                    <input
                      type="email"
                      placeholder="ex: tgi.mfoundi@minjustice.gov.cm"
                      value={courtEmail}
                      onChange={(e) => setCourtEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Chambres d'instruction (séparées par une virgule)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Chambre Civile I, Chambre Pénale, Chambre d'Instruction"
                    value={courtChambersText}
                    onChange={(e) => setCourtChambersText(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 font-sans"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingCourt}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {submittingCourt ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" /> Enregistrement...
                    </>
                  ) : editingCourt ? (
                    <>
                      <ShieldCheck className="h-4 w-4" /> Mettre à jour la juridiction
                    </>
                  ) : (
                    <>
                      <PlusCircle className="h-4 w-4" /> Enregistrer la juridiction
                    </>
                  )}
                </button>

              </form>

            </div>
          </div>

        </div>
      )}

    </div>
  );
}
