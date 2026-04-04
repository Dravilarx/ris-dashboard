"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, Calendar, Clock, Search, Bell, User, LayoutDashboard, 
  FileText, BarChart3, Settings, LogOut, ChevronRight, Filter, 
  Plus, Play, CheckCircle2, AlertCircle, Monitor, Database
} from 'lucide-react';
import Link from 'next/link';

// Mock Data based on RIS types
const MOCK_STATS = [
  { label: 'PENDIENTES', value: '12', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  { label: 'INFORMADOS', value: '45', icon: FileText, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
  { label: 'VALIDADOS', value: '128', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  { label: 'URGENCIAS', value: '3', icon: AlertCircle, color: 'text-rose-400', bg: 'bg-rose-400/10' },
];

const MOCK_WORKLIST = [
  {
    id: 1,
    patientFullName: "MARCELO AVILA R.",
    patientId: "12.345.678-9",
    studyDescription: "TAC DE TÓRAX CON CONTRASTE",
    modality: "CT",
    studyDate: "2026-04-03 14:20",
    examStatus: "Pendiente",
    urgencyType: "Urgencia",
    accessionNumber: "CT-900123"
  },
  {
    id: 2,
    patientFullName: "ELISA CONTRERAS B.",
    patientId: "15.987.654-2",
    studyDescription: "RM DE CEREBRO SIMPLE",
    modality: "MR",
    studyDate: "2026-04-03 15:10",
    examStatus: "Informado",
    urgencyType: "Normal",
    accessionNumber: "MR-880456"
  },
  {
    id: 3,
    patientFullName: "JUAN PEREZ S.",
    patientId: "18.123.456-7",
    studyDescription: "RX DE TÓRAX PA/LAT",
    modality: "CR",
    studyDate: "2026-04-03 15:45",
    examStatus: "Pendiente",
    urgencyType: "Normal",
    accessionNumber: "RX-770890"
  },
  {
    id: 4,
    patientFullName: "ANA MARÍA SOTO",
    patientId: "11.222.333-4",
    studyDescription: "ECOGRAFÍA ABDOMINAL",
    modality: "US",
    studyDate: "2026-04-03 16:00",
    examStatus: "Pendiente",
    urgencyType: "Urgencia",
    accessionNumber: "US-660112"
  },
  {
    id: 5,
    patientFullName: "ROBERTO MATTA P.",
    patientId: "14.555.666-7",
    studyDescription: "TAC DE CRÁNEO SIN CONTRASTE",
    modality: "CT",
    studyDate: "2026-04-03 16:20",
    examStatus: "Validado",
    urgencyType: "Normal",
    accessionNumber: "CT-900124"
  }
];

export default function DashboardPage() {
  const [search, setSearch] = useState('');

  return (
    <div className="flex h-screen bg-[#020408] text-slate-200 overflow-hidden font-sans">
      
      {/* Sidebar Premium */}
      <aside className="w-20 lg:w-64 bg-white/[0.01] border-r border-white/5 flex flex-col shrink-0 transition-all duration-300 backdrop-blur-3xl relative z-30">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.3)]">
            <Activity className="text-white" size={24} />
          </div>
          <div className="hidden lg:flex flex-col">
            <span className="font-black tracking-tighter text-white text-lg leading-none">AMIS 2030</span>
            <span className="text-[10px] text-cyan-500 font-bold tracking-[0.2em] uppercase">RIS DASHBOARD</span>
          </div>
        </div>

        <nav className="flex-1 px-4 mt-8 space-y-2">
          {[
            { label: 'Worklist', icon: LayoutDashboard, active: true },
            { label: 'Reportes', icon: FileText },
            { label: 'Estadísticas', icon: BarChart3 },
            { label: 'Configuración', icon: Settings },
          ].map((item) => (
            <button 
              key={item.label}
              className={`w-full group flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 ${item.active ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.1)]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              <item.icon size={20} className={item.active ? 'text-cyan-400' : 'group-hover:scale-110 transition-transform'} />
              <span className="hidden lg:block font-bold text-sm">{item.label}</span>
              {item.active && <motion.div layoutId="nav-active" className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,1)]" />}
            </button>
          ))}
        </nav>

        <div className="p-4 mt-auto">
          <div className="hidden lg:block p-4 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border border-white/5 mb-4">
             <div className="flex items-center gap-2 mb-2">
                <Database size={16} className="text-cyan-400" />
                <span className="text-[10px] font-black uppercase text-slate-400">Estado de Sincronización</span>
             </div>
             <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '92%' }}
                  className="h-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]" 
                />
             </div>
             <span className="text-[10px] text-slate-500 mt-2 block">92.4% — Nodo Antofagasta</span>
          </div>
          <button className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/5 transition-all">
            <LogOut size={20} />
            <span className="hidden lg:block font-bold text-sm">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
        
        {/* Top Header */}
        <header className="h-20 px-8 flex items-center justify-between bg-white/[0.01] border-b border-white/5 backdrop-blur-md z-20 sticky top-0 shrink-0">
          <div className="flex items-center flex-1 max-w-2xl">
            <div className="relative w-full group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Buscar paciente, RUT o número de acceso..."
                className="w-full bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.07] transition-all placeholder:text-slate-600"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-6 ml-8">
            <button className="relative p-2 text-slate-400 hover:text-white transition-colors group">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-[#020408] shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
              <div className="absolute top-full right-0 mt-2 w-64 p-4 bg-[#0a0f1d] border border-white/10 rounded-2xl opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 transition-all shadow-2xl">
                 <p className="text-xs font-bold text-slate-300">3 Nuevas Urgencias en cola</p>
              </div>
            </button>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-xs font-black uppercase tracking-widest text-white leading-none">Dr. Marcelo Avila</span>
                <span className="text-[10px] text-cyan-500 font-bold mt-1">Staff Radiólogo</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 border border-white/10 flex items-center justify-center text-white shadow-lg overflow-hidden group hover:border-cyan-500/50 transition-colors">
                 <User size={20} />
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar">
          
          <div className="max-w-7xl mx-auto space-y-8">
            
            {/* Page Title & Controls */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div>
                <motion.h2 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-4xl font-black text-white tracking-tighter"
                >
                  Panel de Trabajo
                </motion.h2>
                <p className="text-slate-400 mt-2 font-medium">Gestiona y dictamina estudios radiológicos en tiempo real.</p>
              </div>
              <div className="flex gap-3">
                 <button className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-white/10 transition-all">
                   <Filter size={18} /> Filtrar
                 </button>
                 <button className="px-5 py-2.5 bg-cyan-500 text-white rounded-xl text-sm font-black uppercase tracking-widest flex items-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:bg-cyan-400 transition-all">
                   <Plus size={18} /> Nuevo Examen
                 </button>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
               {MOCK_STATS.map((stat, idx) => (
                 <motion.div 
                   key={stat.label}
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   transition={{ delay: idx * 0.1 }}
                   className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-xl group hover:bg-white/[0.04] transition-all duration-500"
                 >
                    <div className="flex items-center justify-between mb-4">
                       <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                          <stat.icon size={24} />
                       </div>
                       <span className="text-2xl font-black text-white tracking-widest leading-none">{stat.value}</span>
                    </div>
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">{stat.label}</span>
                 </motion.div>
               ))}
            </div>

            {/* Worklist Section */}
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white/[0.01] border border-white/5 rounded-[2.5rem] overflow-hidden backdrop-blur-2xl"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                 <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
                   <LayoutDashboard className="text-cyan-400" size={24} /> Worklist Radiológico
                 </h3>
                 <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,1)]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Live Updates</span>
                 </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/5 text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">
                      <th className="px-8 py-6">Paciente</th>
                      <th className="px-6 py-6">Estudio</th>
                      <th className="px-6 py-6">Modalidad</th>
                      <th className="px-6 py-6 text-center">Estado</th>
                      <th className="px-6 py-6 text-center">Urgencia</th>
                      <th className="px-8 py-6 text-right whitespace-nowrap">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {MOCK_WORKLIST.map((study) => (
                      <tr key={study.id} className="group hover:bg-white/[0.02] transition-colors relative">
                        <td className="px-8 py-6">
                           <div className="flex flex-col">
                              <span className="text-sm font-black text-white tracking-tight leading-none group-hover:text-cyan-400 transition-colors">{study.patientFullName}</span>
                              <span className="text-[10px] font-mono text-slate-500 mt-1">{study.patientId}</span>
                           </div>
                        </td>
                        <td className="px-6 py-6">
                           <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-300 leading-none">{study.studyDescription}</span>
                              <span className="text-[10px] font-mono text-slate-500 mt-1">{study.accessionNumber}</span>
                           </div>
                        </td>
                        <td className="px-6 py-6">
                           <span className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] font-black font-mono text-cyan-400">
                             {study.modality}
                           </span>
                        </td>
                        <td className="px-6 py-6 text-center">
                           <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                             study.examStatus === 'Pendiente' ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20 shadow-[0_0_10px_rgba(251,191,36,0.1)]' :
                             study.examStatus === 'Informado' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                             'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                           }`}>
                             <span className={`w-1.5 h-1.5 rounded-full ${
                               study.examStatus === 'Pendiente' ? 'bg-amber-400 animate-pulse' :
                               study.examStatus === 'Informado' ? 'bg-cyan-400' :
                               'bg-emerald-400'
                             }`} />
                             {study.examStatus}
                           </span>
                        </td>
                        <td className="px-6 py-6 text-center">
                           {study.urgencyType === 'Urgencia' ? (
                             <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/10 text-rose-400 text-[10px] font-black uppercase tracking-widest border border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.1)]">
                               <AlertCircle size={12} className="animate-pulse" /> URGENTE
                             </span>
                           ) : (
                             <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">NORMAL</span>
                           )}
                        </td>
                        <td className="px-8 py-6 text-right">
                           <Link 
                             href={`/informe/${study.accessionNumber}`}
                             className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 text-xs font-black uppercase tracking-widest text-slate-200 border border-white/10 hover:bg-cyan-500 hover:text-white hover:border-cyan-500 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all group/btn"
                           >
                             Dictar <Play size={12} className="fill-current group-hover/btn:scale-110 transition-transform" />
                           </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-8 bg-white/[0.01] border-t border-white/5 flex items-center justify-between">
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Mostrando 5 de 158 estudios</span>
                 <div className="flex gap-2">
                    <button className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-500 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30" disabled>
                       <ChevronRight size={18} className="rotate-180" />
                    </button>
                    <button className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-500 hover:text-white hover:bg-white/10 transition-all">
                       <ChevronRight size={18} />
                    </button>
                 </div>
              </div>
            </motion.section>

          </div>
        </div>

        {/* Global Monitor Simulator Decorator */}
        <div className="fixed bottom-8 left-8 right-8 h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent pointer-events-none z-10" />
        <div className="fixed top-20 bottom-8 right-8 w-px bg-gradient-to-b from-transparent via-cyan-500/10 to-transparent pointer-events-none z-10" />

      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>

    </div>
  );
}
