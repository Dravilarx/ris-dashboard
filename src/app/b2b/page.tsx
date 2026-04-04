"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, Search, Bell, User, LayoutDashboard, 
  FileText, Upload, AlertCircle, Clock, CheckCircle2,
  ChevronRight, Filter, Info, MessageSquare, ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock studies for B2B portal
// Tipos de identidad adaptativa
type PatientIdSource = 'RUT' | 'NUM_COBRE' | 'EXTERNAL_ID';

interface B2BStudy {
  id: string;
  patientName: string;
  studyName: string;
  date: string;
  status: string;
  modality: string;
  patientIdSource: PatientIdSource;
  patientIdLabel: string;
  effectivePatientId: string;
  pendingReason?: string;
  pendingMessage?: string;
  supervisor?: string;
}

const B2B_STUDIES: B2BStudy[] = [
  {
    id: '1',
    patientName: 'JUAN PABLO DUARTE',
    studyName: 'RM DE CEREBRO CON CONTRASTE',
    date: '2026-04-04 09:30',
    status: 'PENDING_CENTER_ACTION',
    pendingReason: 'Estudio Incompleto',
    pendingMessage: 'Faltan las secuencias T2 Flair solicitadas en el protocolo institucional. El equipo técnico debe verificar si se guardaron en el PACS local del centro.',
    supervisor: 'Dr. Marcelo Avila (Staff)',
    modality: 'MR',
    patientIdSource: 'NUM_COBRE',
    patientIdLabel: 'N° Cobre',
    effectivePatientId: '78443',
  },
  {
    id: '2',
    patientName: 'MARIA PAZ CORTES',
    studyName: 'TAC DE ABDOMEN Y PELVIS',
    date: '2026-04-04 10:15',
    status: 'REPORTED',
    modality: 'CT',
    patientIdSource: 'NUM_COBRE',
    patientIdLabel: 'N° Cobre',
    effectivePatientId: '91204',
  },
  {
    id: '3',
    patientName: 'RICARDO LAGOS W.',
    studyName: 'RX DE TORAX PA',
    date: '2026-04-03 16:45',
    status: 'PENDING_CENTER_ACTION',
    pendingReason: 'Faltan antecedentes',
    pendingMessage: 'Favor adjuntar informe de biopsia previa para correlación clínico-radiológica. Sin esto no se puede emitir el informe final.',
    supervisor: 'Dr. Roberto Matta (Director)',
    modality: 'CR',
    patientIdSource: 'RUT',
    patientIdLabel: 'RUT',
    effectivePatientId: '14.234.567-8',
  }
];

export default function B2BPortalPage() {
  const [selectedStudy, setSelectedStudy] = useState<B2BStudy | null>(null);

  return (
    <div className="flex h-screen bg-[#020306] text-slate-200 overflow-hidden font-sans selection:bg-rose-500/30">
      
      {/* Sidebar B2B */}
      <aside className="w-64 bg-white/[0.01] border-r border-white/5 flex flex-col backdrop-blur-3xl z-30">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-rose-700 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(244,63,94,0.3)]">
              <Building2 className="text-white" size={24} />
            </div>
            <div className="flex flex-col">
              <span className="font-black tracking-tighter text-white text-lg leading-none">PORTAL B2B</span>
              <span className="text-[9px] text-rose-500 font-bold tracking-[0.2em] uppercase mt-0.5">Centro Cliente AMIS</span>
            </div>
          </div>

          <nav className="space-y-2">
            {[
              { label: 'Visión General', icon: LayoutDashboard, active: true },
              { label: 'Exámenes', icon: FileText },
              { label: 'Alertas Resolutivas', icon: AlertCircle, count: 2 },
              { label: 'Configuración', icon: ShieldCheck },
            ].map((item) => (
              <button 
                key={item.label}
                className={cn(
                  "w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 group",
                  item.active ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" : "text-slate-500 hover:text-white hover:bg-white/5"
                )}
              >
                <item.icon size={18} className={cn(item.active ? "text-rose-400" : "group-hover:scale-110 transition-transform")} />
                <span className="font-bold text-xs">{item.label}</span>
                {item.count && (
                  <span className="ml-auto bg-rose-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black animate-pulse">
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-6">
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-rose-400 font-bold text-xs">C1</div>
             <div className="flex flex-col overflow-hidden">
                <span className="text-[10px] font-black text-white truncate uppercase">Centro San Lorenzo</span>
                <span className="text-[8px] text-slate-500 font-bold truncate">PLAN PREMIUM B2B</span>
             </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto custom-scrollbar relative">
        
        {/* Header content header */}
        <header className="h-20 px-8 flex items-center justify-between border-b border-white/5 backdrop-blur-md sticky top-0 bg-[#020306]/50 z-20">
           <div className="flex flex-col">
              <h1 className="text-xl font-black text-white tracking-tight">Worklist Resolutivo</h1>
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">Gestiona estudios con acciones pendientes</p>
           </div>

           <div className="flex items-center gap-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Buscar paciente..."
                  className="bg-white/5 border border-white/5 rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-rose-500/30 transition-all w-64"
                />
              </div>
              <button className="p-2 bg-white/5 border border-white/5 rounded-xl text-slate-400 hover:text-white transition-all">
                <Bell size={18} />
              </button>
           </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto w-full space-y-8">
           
           {/* Section Action Required */}
           <section className="space-y-4">
              <div className="flex items-center gap-2">
                 <AlertCircle size={18} className="text-rose-500" />
                 <h2 className="text-sm font-black uppercase tracking-widest text-slate-300">ESTUDIOS CON ACCIÓN REQUERIDA</h2>
              </div>

              <div className="grid gap-3">
                {B2B_STUDIES.filter(s => s.status === 'PENDING_CENTER_ACTION').map((study) => (
                  <motion.div 
                    key={study.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="group bg-[#0A0505] border border-rose-500/30 rounded-[2rem] overflow-hidden hover:border-rose-500/60 transition-all shadow-[0_10px_30px_rgba(244,63,94,0.05)]"
                  >
                     <div className="p-4 bg-gradient-to-r from-rose-500/10 to-transparent border-b border-rose-500/20 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <span className="bg-rose-500 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-[0_0_15px_rgba(244,63,94,0.5)]">
                              ACCIÓN REQUERIDA
                           </span>
                           <span className="text-[10px] text-rose-300 font-bold uppercase tracking-widest flex items-center gap-1">
                              <Info size={12} /> {study.pendingReason}
                           </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">{study.date}</span>
                     </div>

                     <div className="p-6 flex flex-col lg:flex-row gap-6">
                        <div className="flex-1 space-y-4">
                           <div className="flex items-start justify-between">
                              <div>
                                 <h3 className="text-2xl font-black text-white tracking-tighter leading-none group-hover:text-rose-400 transition-colors uppercase">{study.patientName}</h3>
                                 <div className="flex items-center gap-3 mt-2">
                                   <p className="text-sm font-bold text-slate-400">{study.studyName} <span className="text-rose-500/50">|</span> <span className="font-mono text-[11px] bg-white/5 px-2 py-0.5 rounded ml-2">{study.modality}</span></p>
                                   <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${study.patientIdSource === 'NUM_COBRE' ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' : study.patientIdSource === 'EXTERNAL_ID' ? 'bg-purple-500/15 border-purple-500/30 text-purple-400' : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'}`}>
                                     ID: {study.effectivePatientId} [{study.patientIdLabel}]
                                   </span>
                                 </div>
                              </div>
                           </div>

                           <div className="bg-black/40 border border-white/5 rounded-2xl p-5 relative">
                              <MessageSquare size={16} className="absolute top-4 right-4 text-rose-500/30" />
                              <p className="text-sm text-slate-300 leading-relaxed font-medium pr-8">
                                 {study.pendingMessage}
                              </p>
                              <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2">
                                 <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center">
                                    <User size={12} className="text-rose-400" />
                                 </div>
                                 <span className="text-[10px] font-black uppercase text-slate-500">Médico Informante:</span>
                                 <span className="text-[10px] font-black text-slate-300 uppercase underline decoration-rose-500/50 underline-offset-4">{study.supervisor}</span>
                              </div>
                           </div>
                        </div>

                        <div className="lg:w-72 flex flex-col gap-3 justify-center">
                           <button 
                             onClick={() => setSelectedStudy(study)}
                             className="w-full h-14 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-[0_10px_20px_rgba(244,63,94,0.2)] transition-all active:scale-95 group"
                           >
                             <Upload size={18} className="group-hover:-translate-y-0.5 transition-transform" /> SUBIR DATOS / RESOLVER
                           </button>
                           <button className="w-full h-12 rounded-2xl bg-white/5 border border-white/10 text-slate-400 hover:text-white font-bold text-[10px] uppercase tracking-widest transition-all">
                             Contactar con Soporte Médico
                           </button>
                        </div>
                     </div>
                  </motion.div>
                ))}
              </div>
           </section>

           {/* Rest of the list (Grayed out/Normal) */}
           <section className="space-y-4 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-slate-500" />
                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-600">HISTORIAL Y OTROS ESTUDIOS</h2>
                 </div>
                 <button className="text-[10px] font-black uppercase text-rose-500 hover:text-rose-400 transition-colors tracking-widest">VER TODOS LOS REPORTES</button>
              </div>

              <div className="bg-white/[0.01] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                 <table className="w-full text-left border-collapse">
                    <thead>
                       <tr className="border-b border-white/5 text-[9px] font-black uppercase text-slate-600 tracking-[0.2em]">
                          <th className="px-8 py-5">Paciente</th>
                          <th className="px-6 py-5 whitespace-nowrap">Estudio</th>
                          <th className="px-6 py-5 text-center">Mod</th>
                          <th className="px-6 py-5 text-center">Estado</th>
                          <th className="px-8 py-5 text-right">Acción</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                       {B2B_STUDIES.filter(s => s.status !== 'PENDING_CENTER_ACTION').map(study => (
                          <tr key={study.id} className="hover:bg-white/[0.02] transition-colors group">
                             <td className="px-8 py-5">
                                <div className="flex flex-col gap-1">
                                <span className="text-xs font-black text-slate-300 group-hover:text-white transition-colors">{study.patientName}</span>
                                <span className={`self-start inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black border ${study.patientIdSource === 'NUM_COBRE' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-500'}`}>
                                  {study.effectivePatientId} · {study.patientIdLabel}
                                </span>
                             </div>
                             </td>
                             <td className="px-6 py-5">
                                <span className="text-xs font-bold text-slate-500">{study.studyName}</span>
                             </td>
                             <td className="px-6 py-5 text-center">
                                <span className="text-[10px] font-mono text-slate-600">{study.modality}</span>
                             </td>
                             <td className="px-6 py-5 text-center">
                                <span className="flex items-center justify-center gap-2 text-[9px] font-black text-emerald-500/70 border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 rounded-full uppercase tracking-tighter">
                                   <CheckCircle2 size={10} /> LISTO
                                </span>
                             </td>
                             <td className="px-8 py-5 text-right">
                                <button className="p-2 text-slate-600 hover:text-rose-400 transition-colors">
                                   <FileText size={18} />
                                </button>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </section>

        </div>

        {/* Modal Resolución */}
        <AnimatePresence>
           {selectedStudy && (
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#020306]/95 backdrop-blur-xl"
             >
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0, y: 40 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 40 }}
                  className="w-full max-w-2xl bg-[#0A0B0F] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8)]"
                >
                   <div className="p-8 border-b border-white/5 bg-gradient-to-r from-rose-500/20 to-transparent flex items-center justify-between">
                      <div className="flex flex-col">
                         <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Resolver Pendiente</h3>
                         <span className="text-[10px] text-rose-400 font-bold tracking-[0.2em] mt-1 uppercase">Paciente: {selectedStudy.patientName}</span>
                      </div>
                      <button 
                        onClick={() => setSelectedStudy(null)}
                        className="bg-white/5 border border-white/10 p-2 rounded-xl text-slate-400 hover:text-white transition-all"
                      >
                         <AlertCircle size={20} className="rotate-45" />
                      </button>
                   </div>

                   <div className="p-10 space-y-8">
                      <div className="p-6 bg-rose-500/5 border border-rose-500/10 rounded-3xl">
                         <div className="flex items-center gap-2 mb-3">
                            <Info size={16} className="text-rose-500" />
                            <span className="text-[11px] font-black uppercase tracking-widest text-rose-500">Instrucción del Médico</span>
                         </div>
                         <p className="text-sm text-slate-300 font-medium italic leading-relaxed">
                            &ldquo;{selectedStudy.pendingMessage}&rdquo;
                         </p>
                      </div>

                      <div className="space-y-4">
                         <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Upload size={14} className="text-rose-500" /> Adjuntar Información Solicitada (JPG o PDF)
                         </label>
                         <div className="h-40 border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center group hover:border-rose-500/50 hover:bg-rose-500/5 transition-all cursor-pointer">
                            <Upload size={32} className="text-slate-600 group-hover:text-rose-500 group-hover:-translate-y-2 transition-all" />
                            <p className="text-xs font-bold text-slate-500 mt-4">Arrastra archivos aquí o <span className="text-rose-500">haz clic para buscar</span></p>
                            <span className="text-[9px] text-slate-600 mt-2 uppercase tracking-tighter">Máximo 25MB por archivo</span>
                         </div>
                      </div>

                      <div className="space-y-4">
                         <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Respuesta Técnica / Comentarios</label>
                         <textarea 
                           placeholder="Detalle la resolución de este pendiente para el médico informante..."
                           className="w-full h-32 bg-black/50 border border-white/10 rounded-3xl p-6 text-sm text-slate-200 outline-none focus:border-rose-500/50 transition-all resize-none shadow-inner"
                         />
                      </div>
                   </div>

                   <div className="p-8 bg-black/50 border-t border-white/5 flex items-center justify-end gap-4">
                      <button 
                        onClick={() => setSelectedStudy(null)}
                        className="px-8 py-3 rounded-2xl text-xs font-black text-slate-500 hover:text-white transition-all uppercase tracking-widest"
                      >
                         Descartar
                      </button>
                      <button 
                        onClick={() => {
                          alert('Resolución enviada. El estudio regresará a la worklist del radiólogo.');
                          setSelectedStudy(null);
                        }}
                        className="px-10 py-4 rounded-2xl bg-rose-500 text-white font-black text-xs uppercase tracking-[0.2em] shadow-[0_15px_30px_rgba(244,63,94,0.3)] hover:scale-[1.02] active:scale-95 transition-all"
                      >
                         Enviar al Radiólogo
                      </button>
                   </div>
                </motion.div>
             </motion.div>
           )}
        </AnimatePresence>

      </main>

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.1); }
      `}</style>

    </div>
  );
}
