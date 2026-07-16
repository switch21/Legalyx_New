import { useState, useEffect } from "react";
import { User, Case, Hearing, ActivityLog, AppStats } from "./types";
import LoginScreen from "./components/LoginScreen";
import CasesTab from "./components/CasesTab";
import HearingsTab from "./components/HearingsTab";
import ActivitiesTab from "./components/ActivitiesTab";
import AnalyticsTab from "./components/AnalyticsTab";
import UsersTab from "./components/UsersTab";
import ReportsTab from "./components/ReportsTab";
import PresidentControlTab from "./components/PresidentControlTab";
import { 
  Shield, Scale, Calendar, Terminal, BarChart2, 
  LogOut, ShieldAlert, CheckCircle, RefreshCw, AlertCircle, Users,
  FileText, Award
} from "lucide-react";
import { motion } from "motion/react";
import supabase from "./lib/supabaseClient";
import { mapCaseFromDb, mapHearingFromDb, mapActivityFromDb, getDefaultPermissions } from "./lib/helpers";

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "cases" | "hearings" | "audit" | "users" | "reports" | "president-control">("dashboard");
  
  // App-wide data states
  const [cases, setCases] = useState<Case[]>([]);
  const [hearings, setHearings] = useState<Hearing[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState<AppStats | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    if (user.role === "Administrateur") {
      setActiveTab("users");
    } else {
      setActiveTab("dashboard");
    }
    fetchWorkspaceData();
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab("dashboard");
    setCases([]);
    setHearings([]);
    setActivities([]);
    setStats(null);
  };

  const fetchWorkspaceData = async () => {
    if (!currentUser) return;
    setLoading(true);
    setErrorText("");
    try {
      if (currentUser.role === "Administrateur") {
        // Administrators only fetch non-case/non-hearing resources
        const [activitiesRes, statsRes] = await Promise.all([
          fetchActivities(),
          fetchStats(),
        ]);
        if (activitiesRes) setActivities(activitiesRes);
        if (statsRes) setStats(statsRes);
      } else {
        const [casesRes, hearingsRes, activitiesRes, statsRes] = await Promise.all([
          fetchCases(),
          fetchHearings(),
          fetchActivities(),
          fetchStats(),
        ]);

        if (casesRes) setCases(casesRes);
        if (hearingsRes) setHearings(hearingsRes);
        if (activitiesRes) setActivities(activitiesRes);
        if (statsRes) setStats(statsRes);
      }

    } catch (err) {
      console.error(err);
      setErrorText("Erreur lors de la synchronisation sécurisée avec le serveur central Legalyx.");
    } finally {
      setLoading(false);
    }
  };

  // ========================================================================
  // FETCH DIRECT SUPABASE — Dossiers
  // ========================================================================
  const fetchCases = async (): Promise<Case[] | null> => {
    const { data, error } = await supabase
      .from('cases')
      .select('*, case_documents(*)')
      .order('created_at', { ascending: false });

    if (error) { console.error('[Cases]', error); return null; }

    const rows = data || [];

    // Enrichir avec le nom du magistrat
    const magistratIds = [...new Set(rows.filter(c => c.magistrat_id).map(c => c.magistrat_id))];
    let magMap: Record<string, string> = {};
    if (magistratIds.length > 0) {
      const { data: magistrats } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', magistratIds);
      magMap = Object.fromEntries((magistrats || []).map((m: any) => [m.id, m.full_name]));
    }

    return rows.map((c: any) => mapCaseFromDb(c, c.case_documents, magMap[c.magistrat_id]));
  };

  // ========================================================================
  // FETCH DIRECT SUPABASE — Audiences
  // ========================================================================
  const fetchHearings = async (): Promise<Hearing[] | null> => {
    const { data, error } = await supabase
      .from('hearings')
      .select('*')
      .order('date', { ascending: false });

    if (error) { console.error('[Hearings]', error); return null; }

    const rows = data || [];

    // Enrichir avec les infos des dossiers liés
    const caseIds = [...new Set(rows.map((h: any) => h.case_id))];
    let caseMap: Record<string, any> = {};
    if (caseIds.length > 0) {
      const { data: linkedCases } = await supabase
        .from('cases')
        .select('id, num_dossier, title')
        .in('id', caseIds);
      caseMap = Object.fromEntries((linkedCases || []).map((c: any) => [c.id, c]));
    }

    return rows.map((h: any) => mapHearingFromDb(h, caseMap[h.case_id]));
  };

  // ========================================================================
  // FETCH DIRECT SUPABASE — Activités
  // ========================================================================
  const fetchActivities = async (): Promise<ActivityLog[] | null> => {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) { console.error('[Activities]', error); return null; }

    return (data || []).map(mapActivityFromDb);
  };

  // ========================================================================
  // FETCH DIRECT SUPABASE — Statistiques
  // ========================================================================
  const fetchStats = async (): Promise<AppStats | null> => {
    try {
      const [natureData, statusData, docsResult, hearingsData, urgentResult] = await Promise.all([
        supabase.from('cases').select('nature, priority'),
        supabase.from('cases').select('status'),
        supabase.from('case_documents').select('*', { count: 'exact', head: true }),
        supabase.from('hearings').select('status'),
        supabase.from('cases').select('*', { count: 'exact', head: true }).eq('priority', 'Urgente'),
      ]);

      const natureCounts: Record<string, number> = {};
      (natureData.data || []).forEach((c: any) => {
        natureCounts[c.nature] = (natureCounts[c.nature] || 0) + 1;
      });

      const statusCounts: Record<string, number> = {};
      (statusData.data || []).forEach((c: any) => {
        statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
      });

      const activeHearings = (hearingsData.data || []).filter(
        (h: any) => h.status === 'Planifiée' || h.status === 'En cours'
      ).length;

      const totalCases = natureData.data?.length || 0;

      return {
        totalCases,
        activeHearings,
        urgentCases: urgentResult.count || 0,
        digitizedDocsCount: docsResult.count || 0,
        byNature: [
          { name: 'Pénal', value: natureCounts['Pénal'] || 0 },
          { name: 'Civil', value: natureCounts['Civil'] || 0 },
          { name: 'Administratif', value: natureCounts['Administratif'] || 0 },
          { name: 'Commercial', value: natureCounts['Commercial'] || 0 },
          { name: 'Social', value: natureCounts['Social'] || 0 },
        ],
        byStatus: [
          { name: 'En cours', value: statusCounts['En cours'] || 0 },
          { name: 'En délibéré', value: statusCounts['Mis en délibéré'] || 0 },
          { name: 'Clôturé', value: statusCounts['Clôturé'] || 0 },
          { name: 'Archivé', value: statusCounts['Archivé'] || 0 },
        ],
        monthlyActivity: [
          { month: 'Mai', dossiers: 0, audiences: 0 },
          { month: 'Juin', dossiers: 0, audiences: 0 },
          { month: 'Juillet', dossiers: totalCases, audiences: hearingsData.data?.length || 0 },
        ],
      };
    } catch (err) {
      console.error('[Stats]', err);
      return null;
    }
  };

  // Keep stats in sync when items are added/edited
  useEffect(() => {
    if (currentUser) {
      fetchWorkspaceData();
    }
  }, [currentUser]);

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white" id="main-app">
      
      {/* 1. Header/Navbar */}
      <header className="bg-white border-b border-slate-200 shrink-0 shadow-sm px-4 sm:px-6 lg:px-8 z-20">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white shadow-sm">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-1">
                Legalyx<span className="text-blue-600 font-normal">-CMS</span>
              </span>
              <span className="hidden sm:inline-block text-[10px] text-slate-500 uppercase tracking-widest font-sans font-semibold">
                {currentUser.tribunal}
              </span>
            </div>
          </div>

          {/* Sync status loader */}
          <div className="flex items-center gap-4">
            {loading ? (
              <span className="text-xs text-blue-600 flex items-center gap-1.5 animate-pulse font-sans font-semibold">
                <RefreshCw className="h-3 w-3 animate-spin" /> Synchronisation...
              </span>
            ) : (
              <span 
                onClick={fetchWorkspaceData}
                className="text-[10px] text-slate-500 hover:text-slate-800 flex items-center gap-1 font-sans font-semibold cursor-pointer transition-colors"
                title="Données synchronisées. Cliquer pour rafraîchir."
              >
                <CheckCircle className="h-3 w-3 text-blue-600" /> Connecté au Greffe central
              </span>
            )}

            {/* Profile widget */}
            <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
              <div className="hidden md:block text-right">
                <span className="block text-xs font-semibold text-slate-800 leading-tight">{currentUser.fullName}</span>
                <span className="text-[10px] text-blue-650 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 uppercase">
                  {currentUser.role}
                </span>
              </div>
              <img 
                src={currentUser.avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=120"} 
                alt={currentUser.fullName} 
                className="w-8 h-8 rounded-full border border-slate-200 shadow-sm"
              />
              <button 
                onClick={handleLogout}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 hover:text-red-600 rounded-lg text-slate-500 transition-all cursor-pointer"
                title="Se déconnecter"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* 2. Secondary Ribbon: System notifications & quick tabs switch */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-2.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shrink-0 shadow-sm z-10">
        
        {/* Navigation Tabs */}
        <nav className="flex space-x-1.5" id="nav-tabs">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
              activeTab === "dashboard" 
                ? 'bg-blue-50 border-blue-200 text-blue-600 font-bold shadow-sm' 
                : 'bg-transparent border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <BarChart2 className="h-4 w-4" /> Tableau de Bord
          </button>

          {currentUser.role !== "Administrateur" && (
            <>
              <button
                onClick={() => setActiveTab("cases")}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  activeTab === "cases" 
                    ? 'bg-blue-50 border-blue-200 text-blue-600 font-bold shadow-sm' 
                    : 'bg-transparent border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                <Scale className="h-4 w-4" /> Registre Dossiers
              </button>

              <button
                onClick={() => setActiveTab("hearings")}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  activeTab === "hearings" 
                    ? 'bg-blue-50 border-blue-200 text-blue-600 font-bold shadow-sm' 
                    : 'bg-transparent border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                <Calendar className="h-4 w-4" /> Rôle d'Audience
              </button>
            </>
          )}

          {currentUser.role === "Président" && (
            <button
              onClick={() => setActiveTab("president-control")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                activeTab === "president-control" 
                  ? 'bg-blue-50 border-blue-200 text-blue-600 font-bold shadow-sm' 
                  : 'bg-transparent border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              <Award className="h-4 w-4" /> Supervision Président
            </button>
          )}

          {currentUser.role === "Administrateur" && (
            <>
              <button
                onClick={() => setActiveTab("users")}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  activeTab === "users" 
                    ? 'bg-blue-50 border-blue-200 text-blue-600 font-bold shadow-sm' 
                    : 'bg-transparent border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                <Users className="h-4 w-4" /> Gestion Utilisateurs
              </button>

              <button
                onClick={() => setActiveTab("audit")}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  activeTab === "audit" 
                    ? 'bg-blue-50 border-blue-200 text-blue-600 font-bold shadow-sm' 
                    : 'bg-transparent border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                <Terminal className="h-4 w-4" /> Audit & Traçabilité
              </button>
            </>
          )}

          <button
            onClick={() => setActiveTab("reports")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
              activeTab === "reports" 
                ? 'bg-blue-50 border-blue-200 text-blue-600 font-bold shadow-sm' 
                : 'bg-transparent border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <FileText className="h-4 w-4" /> Rapports
          </button>
        </nav>

        {/* Cameroon Compliance stamp */}
        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-sans font-medium self-start md:self-auto">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500"></span>
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
          <span>CMS MINJUSTICE v1.0.4 • RGPD Cameroun</span>
        </div>
      </div>

      {/* 3. Main content area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 relative">
        
        {errorText && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-700 text-xs shadow-sm animate-fade-in">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-red-500" />
            <div>
              <span className="font-bold block">Échec de transmission :</span>
              {errorText}
            </div>
          </div>
        )}

        {/* Tab switcher */}
        {activeTab === "dashboard" && (
          <AnalyticsTab stats={stats} currentUser={currentUser} />
        )}

        {activeTab === "cases" && currentUser.role !== "Administrateur" && (
          <CasesTab 
            cases={cases} 
            hearings={hearings}
            currentUser={currentUser} 
            onRefreshCases={fetchWorkspaceData} 
          />
        )}

        {activeTab === "hearings" && currentUser.role !== "Administrateur" && (
          <HearingsTab 
            hearings={hearings} 
            cases={cases} 
            currentUser={currentUser} 
            onRefreshHearings={fetchWorkspaceData} 
          />
        )}

        {activeTab === "users" && currentUser.role === "Administrateur" && (
          <UsersTab 
            currentUser={currentUser} 
            onRefreshLogs={fetchWorkspaceData} 
          />
        )}

        {activeTab === "reports" && (
          <ReportsTab 
            currentUser={currentUser} 
            cases={cases} 
            hearings={hearings} 
            activities={activities} 
          />
        )}

        {activeTab === "president-control" && currentUser.role === "Président" && (
          <PresidentControlTab 
            currentUser={currentUser} 
            cases={cases} 
            hearings={hearings} 
            onRefreshData={fetchWorkspaceData} 
          />
        )}

        {activeTab === "audit" && currentUser.role === "Administrateur" && (
          <ActivitiesTab 
            logs={activities} 
            onRefreshLogs={fetchWorkspaceData} 
          />
        )}

      </main>

      {/* 4. Footer */}
      <footer className="bg-white border-t border-slate-200 px-6 py-4 text-center text-[10px] text-slate-400 font-sans font-semibold flex flex-col sm:flex-row sm:justify-between gap-2 shrink-0 shadow-inner">
        <span>© 2026 Legalyx-CMS. Tous droits réservés. République du Cameroun.</span>
        <span>Conception hautement sécurisée pour la modernisation des greffes judiciaires.</span>
      </footer>

    </div>
  );
}