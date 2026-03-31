import React from 'react';
import { getStudyByUID } from '@/lib/db/queries';
import Link from 'next/link';
import { ArrowLeft, Monitor, Save, Activity, FileText, CheckCircle2 } from 'lucide-react';

export default async function InformePage(props: { params: Promise<{ studyInstanceUID: string }> }) {
  const params = await props.params;
  // Obtenemos los datos completos del paciente
  const study = await getStudyByUID(params.studyInstanceUID);

  if (!study) {
    return (
      <div className="p-10 bg-[#020408] text-white flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl font-black mb-4 uppercase tracking-widest">Estudio no localizado</h1>
        <p className="opacity-50 mb-6 font-mono text-xs">{params.studyInstanceUID}</p>
        <Link href="/dashboard" className="px-6 py-2 bg-accent/20 text-accent rounded-lg border border-accent/20">
          Volver a Worklist
        </Link>
      </div>
    );
  }

  // Formateo seguro para Next Server Components (fechas a string si es necesario)
  const safeTitle = study.studyDescription || 'Estudio sin Descripción';
  
  return (
    <div className="h-screen bg-[#020408] text-white flex flex-col overflow-hidden">
      
      {/* Header Premium - Monitor 1 Context */}
      <header className="px-8 py-4 bg-white/[0.02] border-b border-white/5 flex items-center justify-between backdrop-blur-xl z-10 shrink-0">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="p-2 -ml-2 text-text-muted hover:text-white rounded-lg hover:bg-white/5 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-accent font-black tracking-[0.2em] uppercase">MÓDULO DE DICTADO (MONITOR 1)</span>
              <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 text-[9px] font-black rounded uppercase flex items-center gap-1 border border-rose-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" /> URGENCIAS
              </span>
            </div>
            <h1 className="font-extrabold text-2xl tracking-tighter mt-1">{study.patientFullName}</h1>
          </div>
          
          <div className="h-10 w-px bg-white/10 mx-4" />
          
          <div className="flex flex-col gap-1">
             <div className="flex gap-4">
                <div className="flex flex-col">
                  <span className="text-[9px] text-text-muted font-bold tracking-[0.1em] uppercase">ESTUDIO / ACCESO</span>
                  <span className="font-mono text-sm leading-none mt-0.5 opacity-90">{study.accessionNumber}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-text-muted font-bold tracking-[0.1em] uppercase">MODALIDAD</span>
                  <span className="font-mono text-sm leading-none mt-0.5 opacity-90 text-accent">{study.modality}</span>
                </div>
             </div>
             <span className="text-xs font-bold text-white/50">{safeTitle}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
            <div className="px-4 py-2 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-black rounded-lg flex items-center gap-3">
               <Activity size={16} /> LEYENDO ...
            </div>
            <button className="px-6 py-2 bg-accent text-background text-sm font-black rounded-lg hover:scale-105 transition-all shadow-lg shadow-accent/20 flex items-center gap-2">
               <Save size={16} /> FIRMAR INFORME
            </button>
        </div>
      </header>

      {/* Workspace Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Panel Izquierdo: Contexto Clínico */}
        <div className="w-80 bg-white/[0.01] border-r border-white/5 p-6 overflow-y-auto flex flex-col gap-8">
           <section>
             <h3 className="text-[10px] font-black tracking-widest uppercase text-text-muted mb-4 flex items-center gap-2">
               <FileText size={14} /> Antecedentes 
             </h3>
             <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                <p className="text-sm text-white/80 leading-relaxed font-medium">
                  {study.clinicalHistory || 'Viene para control post operatorio. Paciente refiere dolor leve en la zona abdominal derecha. Sin enfermedades previas conocidas de importancia.'}
                </p>
             </div>
           </section>

           <section>
             <h3 className="text-[10px] font-black tracking-widest uppercase text-text-muted mb-4 flex items-center gap-2">
               <CheckCircle2 size={14} /> Flujo de Tareas 
             </h3>
             <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 opacity-100">
                  <div className="w-4 h-4 rounded-full bg-accent/20 border border-accent flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                  </div>
                  <span className="text-sm font-bold">1. MedDream Abierto</span>
                </div>
                <div className="flex items-center gap-3 opacity-100">
                  <div className="w-4 h-4 rounded-full bg-accent/20 border border-accent flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                  </div>
                  <span className="text-sm font-bold">2. Dictando Informe</span>
                </div>
                <div className="flex items-center gap-3 opacity-30">
                  <div className="w-4 h-4 rounded-full border border-white/40" />
                  <span className="text-sm font-medium">3. Validación y Firma</span>
                </div>
             </div>
           </section>
        </div>

        {/* Panel Central: Editor de Texto */}
        <div className="flex-1 flex flex-col relative">
           <div className="flex-1 p-8">
              <textarea 
                className="w-full h-full bg-transparent resize-none outline-none text-xl leading-relaxed text-white/90 placeholder:text-white/20 font-medium"
                placeholder="El paciente presenta..."
                defaultValue={`TÉCNICA DE ESTUDIO:\n\n\nHALLAZGOS:\n\n\nIMPRESIÓN DIAGNÓSTICA:\n`}
                autoFocus
              />
           </div>
        </div>

      </div>
    </div>
  );
}
