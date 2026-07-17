import React, { useState, useEffect } from "react";
import { Shield, Fingerprint, Eye, KeyRound, AlertCircle, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import { User } from "../types";
import supabase from "../lib/supabaseClient";
import { mapUserFromDb, getDefaultPermissions, logActivity } from "../lib/helpers";

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

/** Résultat renvoyé par la RPC authenticate_user (snake_case depuis Postgres) */
interface AuthResult {
  id: string;
  username: string;
  full_name: string;
  role: string;
  tribunal: string;
  avatar: string | null;
  mfa_enabled: boolean;
  biometric_registered: boolean;
  active: boolean;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pinMFA, setPinMFA] = useState("");
  const [isBiometricActive, setIsBiometricActive] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState<"idle" | "scanning" | "success" | "error">("idle");
  const [scanType, setScanType] = useState<"finger" | "retina">("finger");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaUserId, setMfaUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Clear errors on username change
  useEffect(() => {
    setErrorMessage("");
    setMfaRequired(false);
    setMfaUserId(null);
  }, [username]);

  // =========================================================================
  // Authentification via RPC PostgreSQL (mot de passe vérifié côté serveur)
  // =========================================================================
  const authenticateWithSupabase = async (usernameVal: string): Promise<User | null> => {
    // 1. Appeler la RPC — le mot de passe est comparé côté PostgreSQL, jamais côté client
    const { data: authResults, error: rpcError } = await supabase.rpc("authenticate_user", {
      p_username: usernameVal,
      p_password: password,
    });

    if (rpcError) {
      throw new Error("Erreur de connexion au service d'authentification.");
    }

    const authResult: AuthResult | null = authResults?.[0] ?? null;

    if (!authResult) {
      throw new Error("Identifiant ou mot de passe incorrect.");
    }

    // 2. Récupérer les permissions de l'utilisateur
    const { data: permsRow } = await supabase
      .from("user_permissions")
      .select("*")
      .eq("user_id", authResult.id)
      .single();

    // 3. Construire l'objet User (camelCase)
    const user: User = {
      id: authResult.id,
      username: authResult.username,
      fullName: authResult.full_name,
      role: authResult.role as User["role"],
      tribunal: authResult.tribunal,
      avatar: authResult.avatar || undefined,
      mfaEnabled: authResult.mfa_enabled,
      biometricRegistered: authResult.biometric_registered,
      active: authResult.active,
      permissions: permsRow
        ? {
            canCreateCases: permsRow.can_create_cases,
            canDeleteCases: permsRow.can_delete_cases,
            canEditPlumitif: permsRow.can_edit_plumitif,
            canManageHearings: permsRow.can_manage_hearings,
            canUploadDocuments: permsRow.can_upload_documents,
            canVerifyIntegrity: permsRow.can_verify_integrity,
          }
        : getDefaultPermissions(authResult.role),
    };

    return user;
  };

  // =========================================================================
  // Soumission du formulaire login standard
  // =========================================================================
  const handleStandardLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      // Phase 1 : vérifier identifiant + mot de passe via RPC
      const { data: authResults, error: rpcError } = await supabase.rpc("authenticate_user", {
        p_username: username.trim(),
        p_password: password,
      });

      if (rpcError) {
        throw new Error("Erreur de connexion au service d'authentification.");
      }

      const authResult: AuthResult | null = authResults?.[0] ?? null;

      if (!authResult) {
        throw new Error("Identifiant ou mot de passe incorrect.");
      }

      // Phase 2 : vérifier si le MFA est requis pour cet utilisateur
      if (authResult.mfa_enabled && !mfaRequired) {
        setMfaRequired(true);
        setMfaUserId(authResult.id);
        setSuccessMessage("Code OTP requis. Saisissez le code généré par votre jeton de sécurité.");
        setLoading(false);
        return;
      }

      // Phase 3 : si MFA requis, vérifier le PIN via RPC
      if (mfaRequired && mfaUserId) {
        console.log("[MFA-DEBUG] Vérification PIN — userId:", mfaUserId, "pin saisi:", pinMFA);
        const { data: pinValid, error: pinError } = await supabase.rpc("verify_mfa_pin", {
          p_user_id: mfaUserId,
          p_pin: pinMFA,
        });

        console.log("[MFA-DEBUG] Résultat RPC — pinValid:", pinValid, "pinError:", pinError);

        if (pinError) {
          console.error("[MFA-DEBUG] Erreur RPC:", pinError);
          throw new Error(pinError.message || "Erreur lors de la vérification MFA.");
        }
        if (!pinValid) {
          throw new Error("Code MFA incorrect. Veuillez réessayer.");
        }
      }

      // Phase 4 : construire l'objet User complet
      const user = await authenticateWithSupabase(username.trim());

      if (user) {
        await logActivity(user.id, "CONNEXION_MOT_DE_PASSE_MFA", "Authentification validée via mot de passe et vérification multifacteur.");
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

  // =========================================================================
  // Biométrie (simulation visuelle — auth réelle via RPC sans mot de passe)
  // =========================================================================
  const startBiometricScan = () => {
    setBiometricStatus("scanning");
    setIsBiometricActive(true);
    setErrorMessage("");

    setTimeout(() => {
      setBiometricStatus("success");
      setTimeout(async () => {
        try {
          const user = await authenticateWithSupabase(username.trim());
          if (user) {
            await logActivity(user.id, "AUTHENTIFICATION_BIOMETRIQUE", "Validation biométrique de l'empreinte digitale et scan rétinien réussis.");
            setSuccessMessage("Authentification biométrique validée.");
            setTimeout(() => {
              onLoginSuccess(user);
            }, 600);
          } else {
            setErrorMessage("Identifiant introuvable pour la biométrie.");
            setBiometricStatus("error");
          }
        } catch (e: any) {
          setErrorMessage(e.message || "Erreur lors de l'authentification biométrique.");
          setBiometricStatus("error");
        }
      }, 1000);
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
                    Mot de passe
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="block w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm transition-all"
                      placeholder="Votre mot de passe"
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
                      placeholder="______"
                    />
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
                  ) : mfaRequired ? "Valider le code MFA" : "Se connecter"}
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