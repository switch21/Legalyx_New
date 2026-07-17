import React, { useState, useEffect } from "react";
import { AppStats, User, UserRole } from "../types";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";
import { 
  Scale, Calendar, AlertTriangle, FileCheck, 
  TrendingUp, BarChart2, Award, Zap, FileText,
  Download, ShieldCheck, Check, Lock, Printer,
  Clock, Database, Activity, UserCheck, RefreshCw, ChevronRight, FileDown, ShieldAlert
} from "lucide-react";
import { motion } from "motion/react";

interface AnalyticsTabProps {
  stats: AppStats | null;
  currentUser: User;
}

const COLORS = ["#2563eb", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#ef4444"];

export default function AnalyticsTab({ stats, currentUser }: AnalyticsTabProps) {
  if (!stats) {
    return (
      <div className="flex justify-center items-center h-[300px] text-slate-500 font-medium">
        <RefreshCw className="h-5 w-5 animate-spin text-blue-600 mr-2" />
        Chargement des métriques statistiques en temps réel...
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left animate-fade-in" id="analytics-tab-panel">
      
      {/* 1. KPI cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Cases */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dossiers Enregistrés</span>
            <h3 className="text-2xl font-bold text-slate-900 font-sans">{stats.totalCases}</h3>
            <span className="text-[10px] text-blue-600 font-bold flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> +15% ce trimestre
            </span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
            <Scale className="h-6 w-6" />
          </div>
        </div>

        {/* Card 2: Active hearings */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Audiences Planifiées</span>
            <h3 className="text-2xl font-bold text-slate-900 font-sans">{stats.activeHearings}</h3>
            <span className="text-[10px] text-blue-600 font-bold flex items-center gap-1">
              <Zap className="h-3 w-3 animate-pulse" /> Agenda à jour
            </span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
            <Calendar className="h-6 w-6" />
          </div>
        </div>

        {/* Card 3: Urgent matters */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dossiers Urgents</span>
            <h3 className="text-2xl font-bold text-red-600 font-sans">{stats.urgentCases}</h3>
            <span className="text-[10px] text-red-600 font-bold flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 animate-bounce" /> Traitement prioritaire
            </span>
          </div>
          <div className="p-3 bg-red-50 text-red-600 rounded-xl border border-red-100">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </div>

        {/* Card 4: Digitized Docs */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pièces Numérisées</span>
            <h3 className="text-2xl font-bold text-slate-900 font-sans">{stats.digitizedDocsCount}</h3>
            <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-0.5">
              100% Intégrité SHA-256
            </span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
            <FileCheck className="h-6 w-6" />
          </div>
        </div>

      </div>

      {/* 2. Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart 1: Case by nature (Bar chart) */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 flex flex-col h-[320px] shadow-sm">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-blue-600" /> Répartition des Affaires par Nature Judiciaire
          </h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.byNature} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px" }}
                  labelStyle={{ color: "#475569", fontWeight: "bold" }}
                  itemStyle={{ color: "#2563eb" }}
                />
                <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]}>
                  {stats.byNature.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Case by status (Pie chart) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col h-[320px] shadow-sm">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Award className="h-4 w-4 text-blue-600" /> État d'Avancement des Procédures
          </h3>
          <div className="flex-1 min-h-0 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.byStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.byStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px" }}
                  itemStyle={{ color: "#334155" }}
                />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Center Legend */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-8">
              <span className="text-2xl font-bold text-slate-900 font-sans">{stats.totalCases}</span>
              <span className="text-[9px] text-slate-500 uppercase font-semibold">Dossiers globaux</span>
            </div>
          </div>

          {/* Quick Legend indicators */}
          <div className="grid grid-cols-2 gap-2 mt-2 text-[10px] text-slate-500">
            {stats.byStatus.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-1.5 justify-center">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                <span>{entry.name}: <strong className="text-slate-800 font-sans">{entry.value}</strong></span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* 4. Growth Timeline Line chart */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 h-[280px] shadow-sm">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">
          Évolution Chronologique des Saisines & Audiences
        </h3>
        <div className="h-full pb-8">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.monthlyActivity} margin={{ top: 10, right: 20, left: -20, bottom: 5 }}>
              <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px" }}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 10, color: "#475569" }} />
              <Line type="monotone" dataKey="dossiers" name="Nouveaux Dossiers" stroke="#2563eb" strokeWidth={2.5} activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="audiences" name="Audiences Tenues" stroke="#f59e0b" strokeWidth={2.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
