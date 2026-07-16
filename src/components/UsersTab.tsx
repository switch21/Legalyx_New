import React, { useState, useEffect, useRef } from "react";
import { User, UserRole, UserPermissions, CourtProfile } from "../types";
import { 
  Users, UserPlus, Trash2, ShieldCheck, ShieldAlert, 
  Search, CheckCircle, XCircle, RefreshCw, Key, 
  Fingerprint, MapPin, BadgeHelp, Check, X,
  Building2, Edit3, Layers, Mail, Phone, Calendar as IconCalendar, Shield, PlusCircle,
  Camera, Upload, Eye, Lock
} from "lucide-react";
import { motion } from "motion/react";
import supabase from "../lib/supabaseClient";
import { mapUserFromDb, mapCourtFromDb, getDefaultPermissions, logActivity } from "../lib/helpers";

// Avatar par défaut (silhouette générique)
export const DEFAULT_AVATAR = ""; // vide = icône rendue côté UI

// Validation de la complexité d'un mot de passe
function validatePasswordStrength(pw: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (pw.length < 8) errors.push("Minimum 8 caractères");
  if (!/[A-Z]/.test(pw)) errors.push("Au moins 1 majuscule");
  if (!/[a-z]/.test(pw)) errors.push("Au moins 1 minuscule");
  if (!/[0-9]/.test(pw)) errors.push("Au moins 1 chiffre");
  if (!/[^A-Za-z0-9]/.test(pw)) errors.push("Au moins 1 caractère spécial");
  return { valid: errors.length === 0, errors };
}

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
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR);
  const [role, setRole] = useState<UserRole>("Secrétaire");
  const [tribunal, setTribunal] = useState("TGI du Mfoundi (Yaoundé)");
  const [mfaEnabled, setMfaEnabled] = useState(true);
  const [biometricRegistered, setBiometricRegistered] = useState(true);
  const [submittingUser, setSubmittingUser] = useState(false);

  // Password states
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  // Avatar upload states
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  
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
      const { data, error } = await supabase
        .from('users')
        .select('*, user_permissions(*)')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const mapped = (data || []).map((u: any) => mapUserFromDb(u, u.user_permissions?.[0]));
      setUsers(mapped);
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
      const { data, error } = await supabase
        .from('court_profiles')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      const mapped = (data || []).map(mapCourtFromDb);
      setCourts(mapped);
      if (mapped.length > 0 && !editingUser) {
        setTribunal(mapped[0].name);
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

  // =========================================================================
  // Avatar upload to Supabase Storage
  // =========================================================================
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg("Le fichier doit être une image (JPEG, PNG, WebP).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg("La photo ne doit pas dépasser 2 Mo.");
      return;
    }

    setUploadingAvatar(true);
    setErrorMsg("");

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${editingUser?.id || `new_${Date.now()}`}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      setAvatar(publicUrl);
    } catch (err: any) {
      setErrorMsg("Erreur lors du téléchargement de la photo.");
      console.error(err);
    } finally {
      setUploadingAvatar(false);
    }
  };

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
        // UPDATE PATH — use RPC for full profile update
        const { data: profileOk, error: profileError } = await supabase.rpc("update_user_profile", {
          p_user_id: editingUser.id,
          p_full_name: fullName,
          p_role: role,
          p_tribunal: tribunal,
          p_avatar: avatar || null,
          p_mfa_enabled: mfaEnabled,
          p_biometric_registered: biometricRegistered,
          p_active: editingUser.active !== false,
        });

        setSubmittingUser(false);
        if (profileError) { setErrorMsg(profileError.message || "Erreur lors de la mise à jour de l'agent."); return; }

        // Update password if provided
        if (newPassword && showPasswordSection) {
          if (newPassword !== confirmPassword) {
            setErrorMsg("Les mots de passe ne correspondent pas.");
            return;
          }
          const pwValidation = validatePasswordStrength(newPassword);
          if (!pwValidation.valid) {
            setErrorMsg("Mot de passe non conforme : " + pwValidation.errors.join(", ") + ".");
            return;
          }
          const { error: pwError } = await supabase.rpc("update_user_password", {
            p_user_id: editingUser.id,
            p_new_password: newPassword,
          });
          if (pwError) { setErrorMsg(pwError.message || "Erreur lors de la mise à jour du mot de passe."); return; }
        }

        // Update permissions
        await supabase
          .from('user_permissions')
          .update({
            can_create_cases: permissions.canCreateCases,
            can_delete_cases: permissions.canDeleteCases,
            can_edit_plumitif: permissions.canEditPlumitif,
            can_manage_hearings: permissions.canManageHearings,
            can_upload_documents: permissions.canUploadDocuments,
            can_verify_integrity: permissions.canVerifyIntegrity,
          })
          .eq('user_id', editingUser.id);

        await logActivity(currentUser.id, 'MIS_A_JOUR_PROFIL_AGENT', `Profil mis à jour pour ${fullName} (${role})`);

        setSuccessMsg(`Le profil de l'agent ${fullName} a été mis à jour avec succès.`);
        cancelEditUser();
        fetchUsers();
        if (onRefreshLogs) onRefreshLogs();
      } else {
        // CREATE PATH — validate password
        if (!newPassword) {
          setSubmittingUser(false);
          setErrorMsg("Veuillez définir un mot de passe.");
          return;
        }
        const pwValidation = validatePasswordStrength(newPassword);
        if (!pwValidation.valid) {
          setSubmittingUser(false);
          setErrorMsg("Mot de passe non conforme : " + pwValidation.errors.join(", ") + ".");
          return;
        }
        if (newPassword !== confirmPassword) {
          setSubmittingUser(false);
          setErrorMsg("Les mots de passe ne correspondent pas.");
          return;
        }

        // check uniqueness first
        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .ilike('username', username.trim())
          .single();

        if (existing) {
          setSubmittingUser(false);
          setErrorMsg("Cet identifiant unique est déjà attribué à un autre agent.");
          return;
        }

        const newUserId = `u_${Date.now()}`;

        const { data: newUser, error: userError } = await supabase
          .from('users')
          .insert({
            id: newUserId,
            username: username.toLowerCase().trim(),
            full_name: fullName.trim(),
            role,
            tribunal: tribunal.trim(),
            avatar: avatar || null,
            mfa_enabled: mfaEnabled ?? true,
            biometric_registered: biometricRegistered ?? true,
            password: newPassword,
            active: true,
          })
          .select()
          .single();

        setSubmittingUser(false);
        if (userError) { setErrorMsg(userError.message || "Erreur de création de l'agent."); return; }

        // Insert permissions
        await supabase.from('user_permissions').insert({
          id: `perm_${newUserId}`,
          user_id: newUserId,
          can_create_cases: permissions.canCreateCases ?? false,
          can_delete_cases: permissions.canDeleteCases ?? false,
          can_edit_plumitif: permissions.canEditPlumitif ?? false,
          can_manage_hearings: permissions.canManageHearings ?? false,
          can_upload_documents: permissions.canUploadDocuments ?? false,
          can_verify_integrity: permissions.canVerifyIntegrity ?? false,
        });

        await logActivity(currentUser.id, 'ENREGISTREMENT_UTILISATEUR', `Création du profil de l'agent : ${fullName.trim()} (${role})`);

        setSuccessMsg(`L'officier judiciaire ${fullName} a été enrôlé dans l'annuaire.`);
        setFullName("");
        setUsername("");
        setMfaEnabled(true);
        setBiometricRegistered(true);
        fetchUsers();
        if (onRefreshLogs) onRefreshLogs();
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
    setAvatar(user.avatar || DEFAULT_AVATAR);
    setMfaEnabled(user.mfaEnabled);
    setBiometricRegistered(user.biometricRegistered);
    setNewPassword("");
    setConfirmPassword("");
    setShowPasswordSection(false);
    
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
    setAvatar(DEFAULT_AVATAR);
    setNewPassword("");
    setConfirmPassword("");
    setShowPasswordSection(false);
    
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
      const { data: updated, error } = await supabase
        .from('users')
        .update({ active: newActiveState })
        .eq('id', user.id)
        .select()
        .single();

      if (error) { setErrorMsg(error.message || "Erreur lors du changement de statut."); return; }

      await logActivity(currentUser.id, newActiveState ? 'ACTIVATION_UTILISATEUR' : 'DESACTIVATION_UTILISATEUR', `Statut du compte de ${updated.full_name} modifié à : ${newActiveState ? 'actif' : 'désactivé'}`, 'USER_MANAGEMENT', newActiveState ? 'INFO' : 'WARNING');

      setSuccessMsg(`Le compte de ${user.fullName} est maintenant ${newActiveState ? "actif" : "suspendu"}.`);
      fetchUsers();
      if (onRefreshLogs) onRefreshLogs();
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
      // Supprimer les permissions d'abord
      await supabase.from('user_permissions').delete().eq('user_id', user.id);

      const { error } = await supabase.from('users').delete().eq('id', user.id);
      if (error) { setErrorMsg(error.message || "Erreur lors de la radiation de l'agent."); return; }

      await logActivity(currentUser.id, 'SUPPRESSION_UTILISATEUR', `Compte définitivement supprimé : ${user.fullName} (${user.role})`, 'USER_MANAGEMENT', 'CRITICAL');

      setSuccessMsg(`L'agent ${user.fullName} a été définitivement supprimé de la base sécurisée.`);
      fetchUsers();
      if (onRefreshLogs) onRefreshLogs();
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
        const { data: updated, error } = await supabase
          .from('court_profiles')
          .update({
            name: courtName.trim(),
            type: courtType.trim(),
            president: courtPresident.trim(),
            address: courtAddress?.trim(),
            phone: courtPhone?.trim(),
            email: courtEmail?.trim(),
            jurisdiction_region: courtRegion?.trim(),
            founding_date: courtFoundingDate || null,
            active_chambers: chambers,
          })
          .eq('id', editingCourt.id)
          .select()
          .single();

        setSubmittingCourt(false);
        if (error) { setErrorMsg(error.message || "Erreur lors de la modification du tribunal."); return; }

        await logActivity(currentUser.id, 'MISE_A_JOUR_TRIBUNAL', `Mise à jour du profil du tribunal : ${updated.name}`);

        setSuccessMsg(`Le profil du tribunal ${courtName} a été mis à jour.`);
        cancelEditCourt();
        fetchCourts();
        if (onRefreshLogs) onRefreshLogs();
      } else {
        // CREATE PATH
        const { data: newCourt, error } = await supabase
          .from('court_profiles')
          .insert({
            id: `court_${Date.now()}`,
            name: courtName.trim(),
            type: courtType.trim(),
            president: courtPresident.trim(),
            address: courtAddress?.trim(),
            phone: courtPhone?.trim(),
            email: courtEmail?.trim(),
            jurisdiction_region: courtRegion?.trim(),
            founding_date: courtFoundingDate || null,
            active_chambers: chambers,
          })
          .select()
          .single();

        setSubmittingCourt(false);
        if (error) { setErrorMsg(error.message || "Erreur lors de la création du tribunal."); return; }

        await logActivity(currentUser.id, 'CREATION_PROFIL_TRIBUNAL', `Création du profil du tribunal : ${newCourt.name} (${newCourt.type})`);

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
      const { error } = await supabase.from('court_profiles').delete().eq('id', court.id);
      if (error) { setErrorMsg(error.message || "Erreur lors de la suppression."); return; }

      await logActivity(currentUser.id, 'SUPPRESSION_TRIBUNAL', `Désactivation du profil du tribunal : ${court.name}`, 'COURT_MANAGEMENT', 'WARNING');

      setSuccessMsg(`Le profil du tribunal ${court.name} a été retiré.`);
      fetchCourts();
      if (onRefreshLogs) onRefreshLogs();
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
                      {user.avatar ? (
                        <img 
                          src={user.avatar} 
                          alt={user.fullName}
                          className={`w-10 h-10 rounded-full border shadow-sm ${user.active === false ? "opacity-40 grayscale" : "border-slate-200"}`}
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className={`w-10 h-10 rounded-full border shadow-sm flex items-center justify-center ${user.active === false ? "opacity-40 grayscale bg-slate-200 border-slate-300" : "bg-blue-50 border-blue-200"}`}>
                          <Users className={`h-5 w-5 ${user.active === false ? "text-slate-400" : "text-blue-600"}`} />
                        </div>
                      )}
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
                
                {/* Photo de profil — upload réelle */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Photo d'identité de l'agent
                  </label>
                  
                  <div className="flex items-center gap-4">
                    {/* Aperçu de l'avatar */}
                    <div className="relative shrink-0">
                      {avatar ? (
                        <img 
                          src={avatar} 
                          alt="Aperçu" 
                          className="h-16 w-16 rounded-full object-cover border-2 border-blue-600 shadow-md bg-white"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-full border-2 border-slate-300 shadow-md bg-white flex items-center justify-center text-slate-400">
                          <Users className="h-8 w-8" />
                        </div>
                      )}
                      {avatar && (
                        <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full p-1 shadow">
                          <Check className="h-3 w-3 font-bold" />
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 flex-1">
                      <span className="text-[10px] text-slate-500 font-medium leading-tight block">
                        Téléchargez la photo d'identité officielle de l'agent (JPEG, PNG — max 2 Mo).
                      </span>
                      
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleAvatarUpload}
                      />

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => avatarInputRef.current?.click()}
                          disabled={uploadingAvatar}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {uploadingAvatar ? (
                            <><RefreshCw className="h-3 w-3 animate-spin" /> Envoi...</>
                          ) : (
                            <><Camera className="h-3 w-3" /> Choisir une photo</>
                          )}
                        </button>
                        {avatar && (
                          <button
                            type="button"
                            onClick={() => setAvatar(DEFAULT_AVATAR)}
                            className="flex items-center gap-1 px-2 py-1.5 bg-slate-200 hover:bg-red-100 text-slate-600 hover:text-red-600 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                          >
                            <X className="h-3 w-3" /> Retirer
                          </button>
                        )}
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 font-sans"
                  />
                </div>

                {/* Password fields — always visible (required for create, optional for edit) */}
                {editingUser ? (
                  <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowPasswordSection(!showPasswordSection)}
                      className="flex items-center justify-between w-full text-left"
                    >
                      <span className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                        <Lock className="h-3.5 w-3.5" /> Mot de passe
                      </span>
                      <span className="text-[10px] text-amber-600 font-medium">
                        {showPasswordSection ? "Masquer" : "Modifier"}
                      </span>
                    </button>
                    {showPasswordSection && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-2 pt-1">
                        <input
                          type="password"
                          placeholder="Nouveau mot de passe (min. 8 car., maj., min., chiffre, spécial)"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                        />
                        <input
                          type="password"
                          placeholder="Confirmer le nouveau mot de passe"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                        />
                        {newPassword && confirmPassword && newPassword !== confirmPassword && (
                          <p className="text-[10px] text-red-600 font-medium">Les mots de passe ne correspondent pas.</p>
                        )}
                        {newPassword && newPassword.length > 0 && (
                          (() => {
                            const v = validatePasswordStrength(newPassword);
                            return v.valid ? (
                              <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" /> Mot de passe conforme
                              </p>
                            ) : (
                              <div className="text-[10px] text-red-600 font-medium space-y-0.5">
                                {v.errors.map((e, i) => (
                                  <p key={i} className="flex items-center gap-1">
                                    <XCircle className="h-3 w-3" /> {e}
                                  </p>
                                ))}
                              </div>
                            );
                          })()
                        )}
                      </motion.div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Mot de passe *
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="Définir un mot de passe (min. 8 car., maj., min., chiffre, spécial)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 font-sans"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Confirmer le mot de passe *
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="Ressaisir le mot de passe"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 font-sans"
                      />
                      {confirmPassword && newPassword !== confirmPassword && (
                        <p className="text-[10px] text-red-600 font-medium mt-1">Les mots de passe ne correspondent pas.</p>
                      )}
                      {newPassword && newPassword.length > 0 && (
                        (() => {
                          const v = validatePasswordStrength(newPassword);
                          return v.valid ? (
                            <p className="text-[10px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" /> Mot de passe conforme
                            </p>
                          ) : (
                            <div className="text-[10px] text-red-600 font-medium mt-1 space-y-0.5">
                              {v.errors.map((e, i) => (
                                <p key={i} className="flex items-center gap-1">
                                  <XCircle className="h-3 w-3" /> {e}
                                </p>
                              ))}
                            </div>
                          );
                        })()
                      )}
                    </div>
                  </div>
                )}

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

                {/* Security settings — visible in both create and edit modes */}
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
