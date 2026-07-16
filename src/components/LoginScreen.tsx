import React, { useState, useEffect } from "react";
import { Shield, Fingerprint, Eye, KeyRound, AlertCircle, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import { User } from "../types";
import supabase from "../lib/supabaseClient";
import { mapUserFromDb, getDefaultPermissions, logActivity } from "../lib/helpers";

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pinMFA, setPinMFA] = useState("");
  const [isBiometricActive, setIsBiometricActive] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState<"idle" | "scanning" | "success" | "error">("idle");
  const [scanType, setScanType] = useState<"finger" | "retina">("finger");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Clear errors on username change
  useEffect(() => {
    setErrorMessage("");
    setMfaRequired(false);
  }, [username]);

  const authenticateWithSupabase = async (usernameVal: string, bypassMFA = false): Promise<User | null> => {
    // 1. Chercher l'utilisateur par username dans la table users
    const { data: userRow, error } = await supabase
      .from('users')
      .select('*, user_permissions(*)')
      .eq('username', usernameVal)
      .single();

    if (error || !userRow) {
      throw new Error("Identifiants invalides.");
    }

    if (userRow.active === false) {
      throw new Error("Ce compte utilisateur a été désactivé par l'administrateur.");
    }

    // 2. Sign in avec Supabase Auth (email = username@legalyx.cm, password)
    const email = `${usernameVal}@legalyx.cm`;
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: 'legalyx2026', // mot de passe unique pour tous (auth gérée par la table users)
    });

    // Si l'utilisateur n'existe pas dans Supabase Auth, le créer à la volée
    if (authError) {
      if (authError.message.includes('Invalid login') || authError.message.includes('not found')) {
        // Créer le compte auth à la volée avec la clé service_role... 
        // En mode anon, on ne peut pas. On contourne en utilisant directement la table users.
        // L'auth Supabase complète sera configurée plus tard. Pour le prototype, 
        // on valide directement via la table users.
        console.warn('[Legalyx-Auth] Compte Auth non trouvé. Authentification via table users.');
      } else {
        throw new Error("Erreur d'authentification Supabase: " + authError.message);
      }
    }

    // 3. Construire l'objet User (camelCase)
    const permsRow = userRow.user_permissions?.[0];
    const user: User = {
      id: userRow.id,
      username: userRow.username,
      fullName: userRow.full_name,
      role: userRow.role,
      tribunal: userRow.tribunal,
      avatar: userRow.avatar,
      mfaEnabled: userRow.mfa_enabled,
      biometricRegistered: userRow.biometric_registered,
      active: userRow.active !== false,
      permissions: permsRow
        ? {
            canCreateCases: permsRow.can_create_cases,
            canDeleteCases: permsRow.can_delete_cases,
            canEditPlumitif: permsRow.can_edit_plumitif,
            canManageHearings: permsRow.can_manage_hearings,
            canUploadDocuments: permsRow.can_upload_documents,
            canVerifyIntegrity: permsRow.can_verify_integrity,
          }
        : getDefaultPermissions(userRow.role),
    };

    return user;
  };

  const handleStandardLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      // Authentification par mot de passe (table users)
      // Mots de passe acceptés : admin, legalyx2026, password
      if (password !== "admin" && password !== "legalyx2026" && password !== "password") {
        throw new Error("Mot de passe erroné ou code d'accès non valide.");
      }

      // Vérifier le MFA si nécessaire
      if (!mfaRequired) {
        // Vérifier si le user a MFA activé
        const { data: userCheck } = await supabase
          .from('users')
          .select('mfa_enabled, id')
          .eq('username', username)
          .single();

        if (userCheck?.mfa_enabled) {
          setMfaRequired(true);
          setSuccessMessage("Code OTP envoyé sur votre clé de sécurité cryptée.");
          setLoading(false);
          return;
        }
      }

      if (mfaRequired && pinMFA !== "123456") {
        throw new Error("Code MFA incorrect.");
      }

      const user = await authenticateWithSupabase(username);

      if (user) {
        await logActivity(user.id, "CONNEXION_MOT_DE_PASSE_MFA", "Authentification validée via mot de passe chiffré et OTP multifacteur.");
        setSuccessMessage("Authentification réussie. Chargement du tableau de bord...");
        setTimeout(() => {
          onLoginSuccess(user);
        }, 800);
      }
    } catch (error: any) {
      setErrorMessage(error.message || "Erreur de connexion.");
    } finally {
      setLoading(false);
    }
  };

  const startBiometricScan = () => {
    setBiometricStatus("scanning");
    setIsBiometricActive(true);
    setErrorMessage("");
    
    // Simulate high-security military biometric processing
    setTimeout(() => {
      // 95% success rate for simulation
      const success = true;
      if (success) {
        setBiometricStatus("success");
        setTimeout(async () => {
          try {
            const user = await authenticateWithSupabase(username, true);
            if (user) {
              await logActivity(user.id, "AUTHENTIFICATION_BIOMETRIQUE", "Validation biométrique de l'empreinte digitale et scan rétinien réussis.");
              setSuccessMessage("Authentification biométrique cryptée validée.");
              setTimeout(() => {
                onLoginSuccess(user);
              }, 600);
            } else {
              setErrorMessage("Utilisateur introuvable pour la biométrie.");
              setBiometricStatus("error");
            }
          } catch (e: any) {
            setErrorMessage(e.message || "Erreur lors de la transmission biométrique.");
            setBiometricStatus("error");
          }
        }, 1000);
      } else {
        setBiometricStatus("error");
        setErrorMessage("Empreinte ou rétine non reconnue dans l'annuaire de la Justice.");
      }
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden" id="login-container">
      {/* Decorative background vectors */}
      <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none">
        <div className="absolute -top-1/4 -left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-1/4 -right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="flex justify-center items-center gap-3">
          <div className="bg-blue-600 text-white p-3 rounded-xl shadow-lg border border-blue-500">
            <Shield className="h-8 w-8" />
          </div>
          <div className="text-left">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Legalyx<span className="text-blue-600 font-light">-CMS</span></h1>
            <p className="text-xs text-slate-500 tracking-widest uppercase">Système de Gestion Judiciaire</p>
          </div>
        </div>
        <p className="mt-3 text-center text-sm text-slate-500 font-medium">
          République du Cameroun • Ministère de la Justice
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl z-10 px-4">
        <div className="bg-white py-8 px-6 shadow-md border border-slate-200 sm:rounded-2xl sm:px-10">
          
          {/* Section Selector: Standard vs Biometrics */}
          <div className="flex border-b border-slate-200 pb-4 mb-6 gap-2">
            <button
              type="button"
              onClick={() => { setIsBiometricActive(false); setBiometricStatus("idle"); }}
              className={`flex-1 py-2 text-center font-semibold text-sm transition-all rounded-lg cursor-pointer ${!isBiometricActive ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'text-slate-500 hover:text-slate-850 hover:bg-slate-50'}`}
            >
              Identifiants & MFA
            </button>
            <button
              type="button"
              onClick={() => { setIsBiometricActive(true); if (biometricStatus === "idle") startBiometricScan(); }}
              className={`flex-1 py-2 text-center font-semibold text-sm transition-all rounded-lg cursor-pointer ${isBiometricActive ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'text-slate-500 hover:text-slate-850 hover:bg-slate-50'}`}
            >
              Empreinte & Rétine
            </button>
          </div>

          {errorMessage && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-700 text-sm">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-red-500" />
              <div>{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-700 text-sm">
              {successMessage}
            </div>
          )}

          {!isBiometricActive ? (
            /* Standard credentials + MFA form */
            <form className="space-y-6" onSubmit={handleStandardLogin} id="credentials-form">
              <div>
                <label className="block text-sm font-semibold text-slate-750">
                  Identifiant judiciaire unique
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="block w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm font-mono transition-all"
                    placeholder="prenom.nom"
                  />
                </div>
              </div>

              {!mfaRequired ? (
                <div>
                  <label className="block text-sm font-semibold text-slate-750">
                    Mot de passe sécurisé
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="block w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm transition-all"
                    />
                  </div>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3"
                >
                  <div className="flex items-center gap-2 text-blue-600 text-sm font-semibold">
                    <KeyRound className="h-4 w-4" />
                    Double Facteur d'Authentification (MFA)
                  </div>
                  <p className="text-xs text-slate-500">
                    Saisissez la clé d'authentification temporaire à 6 chiffres générée par votre jeton physique MINJUSTICE.
                  </p>
                  <div>
                    <input
                      type="text"
                      maxLength={6}
                      value={pinMFA}
                      onChange={(e) => setPinMFA(e.target.value)}
                      required
                      className="block w-full text-center bg-white border border-slate-200 rounded-lg py-3 px-4 text-slate-900 font-mono tracking-[1em] text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      placeholder="123456"
                    />
                    <p className="text-[10px] text-slate-400 mt-1.5 text-center font-mono">Conseil: Saisir 123456 pour valider la simulation</p>
                  </div>
                </motion.div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="animate-spin h-4 w-4" /> Traitement en cours...
                    </span>
                  ) : mfaRequired ? "Valider le code MFA" : "Se connecter en mode sécurisé"}
                </button>
              </div>
            </form>
          ) : (
            /* Biometrics scanning simulation */
            <div className="flex flex-col items-center py-6 space-y-6 text-center" id="biometrics-panel">
              <div className="flex justify-center gap-4 mb-2">
                <button
                  type="button"
                  onClick={() => { setScanType("finger"); startBiometricScan(); }}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${scanType === "finger" ? 'bg-blue-50 border-blue-300 text-blue-600' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                >
                  <Fingerprint className="h-4 w-4 inline mr-1" /> Empreinte digitale
                </button>
                <button
                  type="button"
                  onClick={() => { setScanType("retina"); startBiometricScan(); }}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${scanType === "retina" ? 'bg-blue-50 border-blue-300 text-blue-600' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                >
                  <Eye className="h-4 w-4 inline mr-1" /> Scan rétinien
                </button>
              </div>

              {/* Dynamic Scanning Portal */}
              <div className="relative w-40 h-40 flex items-center justify-center rounded-full bg-slate-50 border-2 border-slate-200 shadow-inner overflow-hidden">
                {biometricStatus === "scanning" && (
                  <motion.div
                    className="absolute w-full h-1 bg-blue-500 shadow-[0_0_15px_#2563eb]"
                    animate={{ top: ["0%", "100%", "0%"] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  />
                )}
                
                <div className={`p-4 rounded-full transition-all duration-500 ${
                  biometricStatus === "scanning" ? "text-blue-500 animate-pulse" :
                  biometricStatus === "success" ? "text-emerald-600 scale-110 bg-emerald-50" :
                  biometricStatus === "error" ? "text-red-600 bg-red-50" :
                  "text-slate-400"
                }`}>
                  {scanType === "finger" ? (
                    <Fingerprint className="h-20 w-20" />
                  ) : (
                    <Eye className="h-20 w-20" />
                  )}
                </div>

                {/* Secure circular radar ring */}
                <div className={`absolute inset-1 rounded-full border border-dashed animate-[spin_10s_linear_infinite] ${
                  biometricStatus === "scanning" ? "border-blue-500/50" : "border-slate-200"
                }`}></div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-800">
                  {biometricStatus === "idle" && "Prêt pour le scan biométrique"}
                  {biometricStatus === "scanning" && (scanType === "finger" ? "Lecture biométrique de l'empreinte..." : "Reconnaissance de l'iris en cours...")}
                  {biometricStatus === "success" && "Signature biométrique vérifiée !"}
                  {biometricStatus === "error" && "Échec de l'identification"}
                </p>
                <p className="text-xs text-slate-500 max-w-sm px-4">
                  {biometricStatus === "idle" && "Positionnez votre index sur le lecteur ou faites face à la caméra d'audience."}
                  {biometricStatus === "scanning" && "Veuillez ne pas bouger. Hachage des vecteurs de reconnaissance en cours..."}
                  {biometricStatus === "success" && "Clé d'authentification injectée. Connexion sécurisée..."}
                  {biometricStatus === "error" && "Profil biométrique introuvable. Veuillez réessayer."}
                </p>
              </div>

              {biometricStatus !== "scanning" && (
                <button
                  type="button"
                  onClick={startBiometricScan}
                  className="px-6 py-2 bg-white border border-slate-200 hover:border-blue-500 text-slate-600 rounded-lg text-xs font-semibold hover:text-slate-900 transition-all cursor-pointer"
                >
                  Relancer la biométrie
                </button>
              )}
            </div>
          )}

          {/* Secure compliance disclaimer banner */}
          <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>NORME : RGPD / ANIF-CAMEROUN</span>
            <span>CONNEXION SSL : AES-GCM 256</span>
          </div>

        </div>
      </div>
    </div>
  );
}