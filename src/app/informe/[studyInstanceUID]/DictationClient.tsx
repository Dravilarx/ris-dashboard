"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { 
  ArrowLeft, Monitor, Save, Activity, FileText, CheckCircle2, 
  ChevronLeft, ChevronRight, FileDigit, ScanFace, Sparkles,
  Command, Search, Mic, FileWarning, ZoomIn, ZoomOut, RotateCw, Maximize, Clock, Stethoscope,
  Plus, Edit2, Trash2, X, AlertTriangle, AlertCircle
} from 'lucide-react';

export interface Template {
  id: string;
  name: string;
  text: string;
  modality: string;
}

const DEFAULT_TEMPLATES: Template[] = [
  { id: 'm1', name: 'Tórax Normal', modality: 'CR', text: 'TÉCNICA DE ESTUDIO:\nRadiografía de tórax PA y Lateral.\n\nHALLAZGOS:\nNo se observan condensaciones parenquimatosas ni derrames pleurales. Silueta cardiovascular de tamaño y morfología normal. Hilios y mediastino sin alteraciones. Estructuras óseas sin lesiones agudas.\n\nIMPRESIÓN DIAGNÓSTICA:\nEstudio de tórax dentro de límites normales.' },
  { id: 'm2', name: 'Cráneo Normal', modality: 'CT', text: 'TÉCNICA DE ESTUDIO:\nTomografía axial computarizada de cráneo sin contraste.\n\nHALLAZGOS:\nSistema ventricular y espacios subaracnoideos de amplitud normal. No se observan lesiones ocupantes de espacio ni colecciones hemáticas intra o extra axiales. Línea media centrada. Fosa posterior sin alteraciones.\n\nIMPRESIÓN DIAGNÓSTICA:\nTC de cráneo sin alteraciones patológicas agudas o recientes.' },
  { id: 'm3', name: 'Abdomen Total Normal', modality: 'US', text: 'TÉCNICA DE ESTUDIO:\nEcografía de abdomen total.\n\nHALLAZGOS:\nHígado de ecogenicidad, tamaño y morfología conservados. Vasculatura portal normal. Vesícula biliar de paredes finas sin litiasis. Páncreas y bazo sin alteraciones. Ambos riñones de tamaño y grosor cortical normal, sin signos de uropatía obstructiva.\n\nIMPRESIÓN DIAGNÓSTICA:\nEco abdominal dentro de la normalidad.' },
  { id: 'm4', name: 'Cerebro Normal', modality: 'MR', text: 'TÉCNICA DE ESTUDIO:\nResonancia magnética de cerebro sin contraste.\n\nHALLAZGOS:\nSustancia gris y blanca de intensidad de señal conservada. Sistema ventricular y surcos corticales de amplitud normal. No se observan áreas de alteración de señal parenquimatosa.\n\nIMPRESIÓN DIAGNÓSTICA:\nRM de cerebro sin hallazgos patológicos.' }
];
import { EnrichedStudy } from '@/types/ris';
import { useVoiceDictation } from '@/hooks/useVoiceDictation';
import { StudyFile } from '@/lib/server/services/legacyRisService';

export default function DictationClient({ study, annexes }: { study: EnrichedStudy, annexes: StudyFile[] }) {
  const [sections, setSections] = useState({ technique: '', history: '', findings: '', impression: '' });
  const [activeSection, setActiveSection] = useState<'technique' | 'history' | 'findings' | 'impression'>('findings');
  const sectionRefs = {
    technique: useRef<HTMLTextAreaElement>(null),
    history: useRef<HTMLTextAreaElement>(null),
    findings: useRef<HTMLTextAreaElement>(null),
    impression: useRef<HTMLTextAreaElement>(null),
  };
  const [userRole, setUserRole] = useState<'Staff' | 'Residente'>('Residente');
  const [criticalAnswer, setCriticalAnswer] = useState<boolean | null>(null);
  const [criticalPathology, setCriticalPathology] = useState('');
  const [isPendingModalOpen, setIsPendingModalOpen] = useState(false);
  const [pendingReason, setPendingReason] = useState('');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showSignModal, setShowSignModal] = useState(false);

  // IA State
  const [isReviewingAI, setIsReviewingAI] = useState(false);
  const [aiReviewResults, setAiReviewResults] = useState<{ alerts: string[], suggestion: string, correctedSections?: any, corrections?: string[] } | null>(null);
  const [showAIResults, setShowAIResults] = useState(false);
  
  const getFullText = () => [
    'TÍTULO: INFORME RADIOLÓGICO',
    sections.technique ? `TÉCNICA DE ESTUDIO:\n${sections.technique}` : '',
    sections.history ? `ANTECEDENTES:\n${sections.history}` : '',
    sections.findings ? `HALLAZGOS:\n${sections.findings}` : '',
    sections.impression ? `IMPRESIÓN DIAGNÓSTICA:\n${sections.impression}` : ''
  ].filter(Boolean).join('\n\n');

  const [showTemplates, setShowTemplates] = useState(false);
  const [activeAttachment, setActiveAttachment] = useState<StudyFile | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Restaurar borrador previo
  useEffect(() => {
    const saved = localStorage.getItem(`dictation_draft_${study.studyInstanceUID}`);
    if (saved) {
      try { setSections(JSON.parse(saved)); } catch (e) {}
    }
  }, [study.studyInstanceUID]);

  // Auto-guardado cada 30 segundos
  useEffect(() => {
    const saveInterval = setInterval(() => {
      if (!Object.values(sections).some(v => v.trim())) return;
      localStorage.setItem(`dictation_draft_${study.studyInstanceUID}`, JSON.stringify(sections));
      console.log(`[Fail-Safe] Guardado en background. Sincronizando con AMIS 3.0...`);
      setLastSaved(new Date());
    }, 30000);
    return () => clearInterval(saveInterval);
  }, [sections, study.studyInstanceUID]);

  // Reiniciar controles de vista lateral
  useEffect(() => {
    setZoomLevel(1);
    setRotation(0);
  }, [activeAttachment]);

  const { isRecording, isTranscribing, toggleRecording } = useVoiceDictation({
    onTranscriptionSuccess: (transcribedText) => {
      const currentRef = sectionRefs[activeSection]?.current;
      if (currentRef) {
        const start = currentRef.selectionStart;
        const end = currentRef.selectionEnd;
        
        setSections(prev => {
          const before = prev[activeSection].substring(0, start);
          const after = prev[activeSection].substring(end);
          return { ...prev, [activeSection]: before + " " + transcribedText.trim() + after };
        });

        setTimeout(() => {
          currentRef.focus();
          const newPos = start + transcribedText.trim().length + 1;
          currentRef.setSelectionRange(newPos, newPos);
        }, 50);
      } else {
        setSections(prev => ({ ...prev, [activeSection]: prev[activeSection] + " " + transcribedText.trim() }));
      }
    },
    onError: (error) => {
      alert(error);
    }
  });


  const safeTitle = study.studyDescription || 'Estudio sin Descripción';

  const [templates, setTemplates] = useState<Template[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [templatePrompt, setTemplatePrompt] = useState<{
      isOpen: boolean;
      mode: 'create' | 'update' | 'delete';
      targetId?: string;
      title: string;
      isWarning?: boolean;
  } | null>(null);
  const [templatePromptInput, setTemplatePromptInput] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('amis_user_templates');
    if (saved) {
      try { setTemplates(JSON.parse(saved)); } catch (e) { setTemplates(DEFAULT_TEMPLATES); }
    } else {
      setTemplates(DEFAULT_TEMPLATES);
    }
  }, []);

  const saveTemplates = (newArr: Template[]) => {
    setTemplates(newArr);
    localStorage.setItem('amis_user_templates', JSON.stringify(newArr));
  };

  const handleApplyTemplate = (text: string) => {
    let technique = text.match(/TÉCNICA DE ESTUDIO:\s*([\s\S]*?)(?=ANTECEDENTES:|HALLAZGOS:|IMPRESIÓN DIAGNÓSTICA:|$)/i)?.[1]?.trim() || '';
    let history = text.match(/ANTECEDENTES:\s*([\s\S]*?)(?=TÉCNICA DE ESTUDIO:|HALLAZGOS:|IMPRESIÓN DIAGNÓSTICA:|$)/i)?.[1]?.trim() || '';
    let findings = text.match(/HALLAZGOS:\s*([\s\S]*?)(?=TÉCNICA DE ESTUDIO:|ANTECEDENTES:|IMPRESIÓN DIAGNÓSTICA:|$)/i)?.[1]?.trim() || '';
    let impression = text.match(/IMPRESIÓN DIAGNÓSTICA:\s*([\s\S]*?)(?=TÉCNICA DE ESTUDIO:|ANTECEDENTES:|HALLAZGOS:|$)/i)?.[1]?.trim() || '';

    if (!technique && !history && !findings && !impression) {
       setSections(prev => ({ ...prev, [activeSection]: prev[activeSection] + (prev[activeSection] ? "\n" : "") + text.trim() }));
    } else {
       setSections(prev => ({
         ...prev,
         technique: technique || prev.technique,
         history: history || prev.history,
         findings: findings || prev.findings,
         impression: impression || prev.impression
       }));
    }
    setShowTemplates(false);
  };

  const handleAIReview = async () => {
     setIsReviewingAI(true);
     setAiReviewResults(null);
     try {
        const res = await fetch('/api/dictado/review', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
              sections,
              patientMetadata: {
                 sex: study.sex,
                 age: study.age,
                 studyDescription: study.studyDescription,
                 modality: study.modality
              }
           })
        });
        const data = await res.json();
        setAiReviewResults(data);
        setShowAIResults(true);
     } catch (e) {
        console.error("AI Review failed", e);
     } finally {
        setIsReviewingAI(false);
     }
  };

  const currentModality = study.modality || 'UNKNOWN';
  const filteredTemplates = templates.filter(t => 
     t.modality === currentModality && t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateTemplate = () => {
      const text = getFullText().trim();
      if (!text) {
          alert('El panel de dictado está vacío. Escriba algo primero para guardarlo como plantilla.');
          return;
      }
      setTemplatePromptInput('');
      setTemplatePrompt({
          isOpen: true,
          mode: 'create',
          title: `Nombre para la nueva plantilla (${currentModality}):`
      });
  }

  const handleOverwriteTemplate = (e: React.MouseEvent, t: Template) => {
      e.stopPropagation();
      const text = getFullText().trim();
      if (!text) {
          alert('El panel de dictado está vacío. Escriba algo primero para sobrescribir la plantilla.');
          return;
      }
      setTemplatePromptInput(t.name);
      setTemplatePrompt({
          isOpen: true,
          mode: 'update',
          targetId: t.id,
          title: `Actualizar plantilla (edita el nombre si lo deseas):`
      });
  }

  const confirmTemplatePrompt = () => {
      const newName = templatePromptInput.trim();
      
      if (templatePrompt?.mode === 'delete' && templatePrompt.targetId) {
          if (newName.toLowerCase() === 'eliminar') {
              saveTemplates(templates.filter(t => t.id !== templatePrompt.targetId));
          } else {
              alert('Debes escribir "ELIMINAR" para confirmar la acción.');
              return;
          }
          setTemplatePrompt(null);
          return;
      }

      if (!newName) return;
      const text = getFullText().trim();
      if (!text) return;
      
      if (templatePrompt?.mode === 'create') {
          const newTemplates = [...templates, {
              id: Date.now().toString(),
              name: newName,
              text: text,
              modality: currentModality
          }];
          saveTemplates(newTemplates);
      } else if (templatePrompt?.mode === 'update' && templatePrompt.targetId) {
          const newTemplates = templates.map(tm => tm.id === templatePrompt.targetId ? { ...tm, name: newName, text: text } : tm);
          saveTemplates(newTemplates);
      }
      setTemplatePrompt(null);
  }

  const handleDeleteTemplate = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setTemplatePromptInput('');
      setTemplatePrompt({
          isOpen: true,
          mode: 'delete',
          targetId: id,
          title: `¿Eliminar plantilla? Escribe "ELIMINAR" para confirmar:`,
          isWarning: true
      });
  }

  // Keyboard shortcut F2 para grabar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        toggleRecording();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecording]);


  const isAllFilled = sections.technique.trim() && sections.history.trim() && sections.findings.trim() && sections.impression.trim();

  const handleUpdateStatus = async (status: string, reason?: string) => {
    const payload = {
      studyInstanceUID: study.studyInstanceUID,
      status,
      content: getFullText(),
      userRole,
      pendingReason: reason || null,
      critical_alert: criticalAnswer === true ? { active: true, pathology: criticalPathology } : null
    };

    try {
      const res = await fetch('/api/v1/reports/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        if (status === 'VALIDATED') {
          window.location.href = '/dashboard';
        } else if (status === 'PENDING_INFO') {
          setIsPendingModalOpen(false);
          window.location.href = '/dashboard';
        } else {
          alert("Borrador Guardado Exitosamente (Estado REPORTED)");
        }
      } else {
        alert("Error al actualizar estado.");
      }
    } catch (e) {
      alert("Error de red.");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="h-screen bg-[#020408] text-slate-200 flex flex-col overflow-hidden"
    >
      
      {/* Header Premium - Monitor 1 Context */}
      <header className="px-8 py-4 bg-white/[0.02] border-b border-white/5 flex items-center justify-between backdrop-blur-xl z-20 shrink-0">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="p-2 -ml-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors group">
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          </Link>
          
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-cyan-500 font-black tracking-[0.2em] uppercase flex items-center gap-2 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]">
                <Monitor size={12} /> MÓDULO DE DICTADO (MONITOR 1)
              </span>
              {(study.urgencyType || '').toLowerCase().includes('urg') && (
                <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 text-[9px] font-black rounded uppercase flex items-center gap-1 border border-rose-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" /> URGENCIAS
                </span>
              )}
            </div>
            <h1 className="font-extrabold text-2xl tracking-tighter mt-1 text-white">{study.patientFullName}</h1>
          </div>
          
          <div className="h-10 w-px bg-white/10 mx-4" />
          
          <div className="flex flex-col gap-1">
             <div className="flex gap-4">
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-500 font-bold tracking-[0.1em] uppercase">INSTITUCIÓN</span>
                  <span className="font-mono text-sm leading-none mt-0.5 opacity-90">{study.enrichedInstitutionName}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-500 font-bold tracking-[0.1em] uppercase">ESTUDIO</span>
                  <span className="font-mono text-sm leading-none mt-0.5 opacity-90">{study.accessionNumber}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-500 font-bold tracking-[0.1em] uppercase">MODALIDAD</span>
                  <span className="font-mono text-sm leading-none mt-0.5 font-bold text-cyan-400">{study.modality}</span>
                </div>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 pr-4 border-r border-white/10">
               <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-xs font-bold">
                 {study.enrichedRadiologistName.slice(0, 2).replace(/[^a-zA-Z]/g, '').toUpperCase() || 'DR'}
               </div>
               <div className="flex flex-col text-right">
                 <span className="text-[10px] font-black uppercase text-cyan-400 tracking-widest">{study.enrichedRadiologistName}</span>
                 <span className="text-[9px] text-slate-500">Radiólogo Asignado</span>
               </div>
            </div>

             
        </div>
      </header>

      {/* Workspace Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Panel Izquierdo: Contexto Clínico (The Side-Cockpit) */}
        <div className="w-[30%] bg-white/[0.01] border-r border-white/5 flex flex-col overflow-hidden relative backdrop-blur-3xl shadow-[inset_-20px_0_40px_rgba(0,0,0,0.2)]">
           
           {/* SLA Indicator */}
           <div className="px-6 py-3 bg-white/5 border-b border-white/5 flex items-center justify-between">
              <span className="text-[10px] font-black tracking-widest uppercase text-slate-400 flex items-center gap-2">
                <Activity size={12} className="text-cyan-500" /> Tiempo Objetivo
              </span>
              <span className="text-xs font-mono font-bold text-slate-200 bg-black/50 px-2 py-0.5 rounded border border-white/10">
                 SLA {study.expectedSLACriticalMinutes} min
              </span>
           </div>

           {/* Info Paciente Enriquecida */}
           <div className="p-6 border-b border-white/5 shrink-0 flex flex-col gap-5">
              <section>
                <div className="grid grid-cols-2 gap-4">
                   <div className="flex flex-col">
                     <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Identificación</span>
                     <span className="text-sm font-mono mt-0.5 text-slate-200">{study.patientId}</span>
                   </div>
                   <div className="flex flex-col">
                     <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Edad / Sexo</span>
                     <span className="text-sm font-mono mt-0.5 text-slate-200">{study.age} • {study.sex}</span>
                   </div>
                   <div className="col-span-2 flex flex-col">
                     <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Examen Solicitado</span>
                     <span className="text-sm font-medium mt-0.5 text-white/90">{safeTitle}</span>
                   </div>
                </div>
              </section>

              <section>
                <h3 className="text-[10px] font-black tracking-widest uppercase text-slate-500 mb-2 flex items-center gap-2">
                  <FileText size={12} /> Historia Clínica
                </h3>
                <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                   <p className="text-sm text-slate-300 leading-relaxed font-medium">
                     {study.clinicalHistory || 'Sin antecedentes proporcionados por la institución de origen. Favor referirse a las imágenes.'}
                   </p>
                </div>
              </section>
           </div>

           {/* Carrusel de Anexos */}
           <div className="p-6 flex-1 flex flex-col min-h-0 bg-gradient-to-b from-transparent to-[#020408]">
             <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-black tracking-widest uppercase text-slate-400 flex items-center gap-2">
                  <FileDigit size={12} className="text-amber-500" /> Anexos Previos
                </h3>
                <span className="text-[10px] font-mono font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">{annexes.length} / RIS</span>
             </div>

             <div className="relative flex-1 bg-black/50 rounded-xl border border-white/10 overflow-hidden">
                 <div className="p-4 absolute inset-0 w-full flex flex-col gap-3 overflow-y-auto">
                    {annexes.length > 0 ? annexes.map((file) => (
                       <div 
                         key={file.id}
                         onClick={() => setActiveAttachment(file)}
                         className="bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-white/10 transition-colors cursor-pointer group/item"
                       >
                         <div className="flex items-center gap-3">
                           <div className="w-10 h-10 bg-white/10 rounded flex items-center justify-center text-slate-300 group-hover/item:text-white transition-colors">
                             <FileText size={18} />
                           </div>
                           <div className="flex flex-col flex-1 overflow-hidden">
                              <span className="text-sm font-bold truncate text-slate-200">{file.name}</span>
                              <span className="text-[10px] text-slate-500 mt-0.5 uppercase">{file.type} • {(file.sizeBytes || 0) / 1000000} MB</span>
                           </div>
                         </div>
                       </div>
                    )) : (
                       <div className="flex flex-col items-center justify-center h-full text-center">
                         <span className="text-xs font-bold text-slate-500">Documental Vacío</span>
                         <span className="text-[10px] text-slate-600 mt-1">Este examen no tiene escaneos o historial asociado</span>
                       </div>
                    )}
                 </div>
             </div>
           </div>
        </div>

        {/* Panel Central: Editor de Texto 'Vocalis & Groq' (70%) */}
        <div className="flex-1 flex flex-col relative bg-[#020408]">
           
           {/* Editor Toolbar Simulator con Vocalis */}
           <div className="h-14 border-b border-white/5 bg-white/[0.02] flex items-center px-6 justify-between shrink-0">
             
             <div className="flex items-center gap-4">
                <button 
                  onClick={toggleRecording}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-xs transition-all border ${
                    isRecording 
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.3)]' 
                      : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]'
                  }`}
                >
                  {isRecording ? (
                    <div className="flex items-center justify-center gap-0.5 h-3.5 w-4 overflow-hidden">
                      <motion.div animate={{ height: ["40%", "100%", "40%"] }} transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }} className="w-0.5 bg-rose-400 rounded-full" />
                      <motion.div animate={{ height: ["100%", "30%", "100%"] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.1 }} className="w-0.5 bg-rose-400 rounded-full" />
                      <motion.div animate={{ height: ["50%", "100%", "50%"] }} transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: 0.2 }} className="w-0.5 bg-rose-400 rounded-full" />
                      <motion.div animate={{ height: ["80%", "40%", "80%"] }} transition={{ duration: 0.7, repeat: Infinity, ease: "easeInOut", delay: 0.15 }} className="w-0.5 bg-rose-400 rounded-full" />
                      <motion.div animate={{ height: ["30%", "90%", "30%"] }} transition={{ duration: 0.85, repeat: Infinity, ease: "easeInOut", delay: 0.3 }} className="w-0.5 bg-rose-400 rounded-full" />
                    </div>
                  ) : (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
                    </span>
                  )}
                  {!isRecording && <Mic size={14} />}
                  {isRecording ? 'GRABANDO (F2)' : 'AMIS VOICE (F2)'}
                </button>

                {isTranscribing && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 animate-pulse">
                    <Activity size={12} /> Procesando Groq AI...
                  </span>
                )}
             </div>

             <div className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-4 mr-4 px-4 py-1.5 border-r border-white/5">
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Métricas</span>
                    <span className="text-xs font-mono font-bold text-cyan-400">
                      {getFullText().trim().split(/\s+/).filter(w => w.length > 0).length} PALABRAS
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white rounded-md border border-white/10 transition-all"
                >
                  <Command size={14} /> Plantillas
                </button>
                <button 
                  onClick={handleAIReview}
                  disabled={isReviewingAI}
                  className={`px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(168,85,247,0.2)] border border-purple-500/30 ${isReviewingAI ? 'bg-purple-900/50 text-purple-300 animate-pulse' : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'}`}
                >
                  {isReviewingAI ? <RotateCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  Guardia IA
                </button>
             </div>
           </div>

           {/* Editor Area */}
           <div className="flex-1 px-16 py-12 relative overflow-hidden flex justify-center">
              
              <div className="w-full max-w-5xl mx-auto flex flex-col gap-5 px-4 pt-6 pb-28 custom-scrollbar overflow-y-auto">
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-black text-cyan-500/50 uppercase tracking-[0.3em] mb-4 block border-b border-white/10 pb-2">
                    INFORME RADIOLÓGICO
                  </span>
                  
                  <div className={`flex flex-col transition-all duration-300 ${activeSection === 'technique' ? 'opacity-100' : 'opacity-60 hover:opacity-80'}`}>
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-2">
                       TÉCNICA DE ESTUDIO
                       {activeSection === 'technique' && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
                    </span>
                    <textarea
                       ref={sectionRefs.technique}
                       value={sections.technique}
                       onChange={e => setSections(p => ({...p, technique: e.target.value}))}
                       onFocus={() => setActiveSection('technique')}
                       spellCheck={true}
                       lang="es"
                       className="w-full h-auto min-h-[60px] bg-transparent outline-none resize-none p-0 text-[18px] leading-[1.7] text-slate-100 font-medium font-sans tracking-wide"
                       placeholder="Describa la técnica..."
                    />
                  </div>
                  
                  <div className={`flex flex-col transition-all duration-300 mt-8 ${activeSection === 'history' ? 'opacity-100' : 'opacity-60 hover:opacity-80'}`}>
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-2">
                       ANTECEDENTES
                       {activeSection === 'history' && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
                    </span>
                    <textarea
                       ref={sectionRefs.history}
                       value={sections.history}
                       onChange={e => setSections(p => ({...p, history: e.target.value}))}
                       onFocus={() => setActiveSection('history')}
                       spellCheck={true}
                       lang="es"
                       className="w-full h-auto min-h-[60px] bg-transparent outline-none resize-none p-0 text-[18px] leading-[1.7] text-slate-100 font-medium font-sans tracking-wide"
                       placeholder="Indique antecedentes relevantes..."
                    />
                  </div>
                  
                  <div className={`flex flex-col transition-all duration-300 mt-8 ${activeSection === 'findings' ? 'opacity-100' : 'opacity-60 hover:opacity-80'}`}>
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-2">
                       HALLAZGOS
                       {activeSection === 'findings' && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
                    </span>
                    <textarea
                       autoFocus
                       ref={sectionRefs.findings}
                       value={sections.findings}
                       onChange={e => setSections(p => ({...p, findings: e.target.value}))}
                       onFocus={() => setActiveSection('findings')}
                       spellCheck={true}
                       lang="es"
                       className="w-full min-h-[160px] bg-transparent outline-none resize-none p-0 text-[18px] leading-[1.7] text-slate-100 font-medium font-sans tracking-wide"
                       placeholder="Describa los hallazgos principales..."
                    />
                  </div>

                  <div className={`flex flex-col transition-all duration-300 mt-8 ${activeSection === 'impression' ? 'opacity-100' : 'opacity-60 hover:opacity-80'}`}>
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-2">
                       IMPRESIÓN DIAGNÓSTICA
                       {activeSection === 'impression' && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
                    </span>
                    <textarea
                       ref={sectionRefs.impression}
                       value={sections.impression}
                       onChange={e => setSections(p => ({...p, impression: e.target.value}))}
                       onFocus={() => setActiveSection('impression')}
                       spellCheck={true}
                       lang="es"
                       className="w-full min-h-[120px] bg-transparent outline-none resize-none p-0 text-[18px] leading-[1.7] text-slate-100 font-medium font-sans tracking-wide"
                       placeholder="Conclusión del estudio..."
                    />
                  </div>
                </div>

                {/* AI Review Results Overlay */}
                <AnimatePresence>
                  {showAIResults && aiReviewResults && (
                     <motion.div 
                       initial={{ opacity: 0, x: 20 }}
                       animate={{ opacity: 1, x: 0 }}
                       exit={{ opacity: 0, x: 20 }}
                       className="fixed right-8 top-32 w-80 bg-[#080d19]/90 border border-purple-500/30 rounded-2xl backdrop-blur-xl shadow-[0_0_40px_rgba(168,85,247,0.15)] z-40 overflow-hidden"
                     >
                        <div className="bg-purple-500/10 px-4 py-3 border-b border-purple-500/20 flex items-center justify-between">
                           <div className="flex items-center gap-2">
                              <Sparkles size={14} className="text-purple-400" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-purple-300">Auditoría IA Seshat</span>
                           </div>
                           <button onClick={() => setShowAIResults(false)} className="text-slate-500 hover:text-white transition-colors">
                              <X size={14} />
                           </button>
                        </div>
                         <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar flex flex-col gap-3">
                           {/* Alertas de seguridad */}
                           {aiReviewResults.alerts.length > 0 && (
                              <div className="flex flex-col gap-2">
                                 {aiReviewResults.alerts.map((alert, idx) => (
                                    <div key={idx} className={`p-3 rounded-xl border text-[11px] font-medium leading-relaxed ${alert.includes('🚨') ? 'bg-rose-500/10 border-rose-500/20 text-rose-300' : 'bg-amber-500/10 border-amber-500/20 text-amber-300'}`}>
                                       {alert}
                                    </div>
                                 ))}
                              </div>
                           )}

                           {/* Lista de correcciones puntuales */}
                           {aiReviewResults.corrections && aiReviewResults.corrections.length > 0 ? (
                              <div className="space-y-1.5">
                                 <span className="text-[9px] font-black uppercase text-purple-400 tracking-wider">
                                    {aiReviewResults.corrections.length} corrección(es) encontrada(s)
                                 </span>
                                 {aiReviewResults.corrections.map((c, idx) => (
                                    <div key={idx} className="px-3 py-2 rounded-lg bg-slate-400/5 border border-white/5 text-[11px] text-slate-200 font-mono leading-relaxed">
                                       {c}
                                    </div>
                                 ))}
                              </div>
                           ) : (
                              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2 font-bold">
                                 <CheckCircle2 size={14} /> Sin errores ortográficos detectados.
                              </div>
                           )}

                           {/* Comparación por sección */}
                           {aiReviewResults.correctedSections && (
                              <div className="space-y-2 mt-2">
                                 <span className="text-[9px] font-black uppercase text-purple-400 tracking-wider">Vista previa de cambios</span>
                                 {Object.entries(aiReviewResults.correctedSections).map(([key, correctedText]) => {
                                    const originalText = sections[key as keyof typeof sections];
                                    if (!originalText.trim() || originalText.trim() === (correctedText as string).trim()) return null;
                                    const sectionNames: Record<string, string> = { technique: 'Técnica', history: 'Antecedentes', findings: 'Hallazgos', impression: 'Impresión' };
                                    return (
                                       <div key={key} className="p-2.5 rounded-xl bg-slate-400/5 border border-white/5 space-y-1.5">
                                          <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider">{sectionNames[key] || key}</span>
                                          <p className="text-[10px] text-rose-400/60 line-through bg-rose-500/5 px-2 py-1 rounded leading-relaxed">{originalText}</p>
                                          <p className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded font-medium leading-relaxed">{correctedText as string}</p>
                                       </div>
                                    );
                                 })}
                              </div>
                           )}
                        </div>
                        <div className="p-3 bg-purple-500/5 border-t border-purple-500/10 flex flex-col gap-2">
                           {aiReviewResults.correctedSections ? (
                              <button 
                                onClick={() => {
                                   setSections(aiReviewResults.correctedSections);
                                   setShowAIResults(false);
                                }}
                                className="w-full py-2.5 bg-purple-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.4)] flex items-center justify-center gap-2"
                              >
                                 <CheckCircle2 size={14} /> Aplicar {aiReviewResults.corrections?.length || 0} Corrección(es)
                              </button>
                           ) : null}
                           <button onClick={() => setShowAIResults(false)} className="w-full py-2 hover:bg-white/5 text-slate-500 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all">
                              Cerrar
                           </button>
                        </div>
                     </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Panel de Decisiones (Footer) */}
            <div className="bg-[#050810] border-t border-white/5 p-4 flex items-center justify-between shrink-0 relative z-20">
                 <div className="flex items-center gap-4">
                    {/* Auto-Guardado y Patología Crítica */}
                    <div className="flex flex-col gap-1">
                       <span className="text-[10px] text-slate-500 font-mono">
                          {lastSaved ? `Guardado Automático a las ${lastSaved.toLocaleTimeString()}` : 'Borrador sin cambios'}
                       </span>
                       <div className="flex items-center gap-6 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                           <div className="flex flex-col">
                              <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-1">Pausa Clínica Obligatoria</span>
                              <span className="text-[11px] text-white font-bold whitespace-nowrap">¿EXISTEN HALLAZGOS CRÍTICOS?</span>
                           </div>
                           
                           <div className="flex items-center gap-2">
                              <button 
                                onClick={() => setCriticalAnswer(true)}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${criticalAnswer === true ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                              >
                                SI
                              </button>
                              <button 
                                onClick={() => {
                                  setCriticalAnswer(false);
                                  setCriticalPathology(""); // Reset pathology if answer is NO
                                }}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${criticalAnswer === false ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                              >
                                NO
                              </button>
                           </div>

                           {criticalAnswer === true && (
                                <select 
                                  value={criticalPathology}
                                  onChange={e => setCriticalPathology(e.target.value)}
                                  className="bg-black border border-rose-500/50 text-rose-400 text-[10px] px-3 py-1.5 rounded-lg outline-none focus:border-rose-500 animate-in fade-in slide-in-from-left-2 shadow-[0_0_15px_rgba(244,63,94,0.1)]"
                                >
                                  <option value="">Seleccione Patología...</option>
                                  <option value="ACV">ACV</option>
                                  <option value="Neumotórax">Neumotórax</option>
                                  <option value="TEP">TEP</option>
                                  <option value="Paro Cardíaco">Paro Cardíaco</option>
                                  <option value="Hemorragia Activa">Hemorragia Activa</option>
                                </select>
                           )}
                       </div>
                    </div>
                 </div>

                 <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setIsPendingModalOpen(true)}
                      className="px-6 py-2.5 rounded-xl font-bold text-xs text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all tracking-widest"
                    >
                      PENDIENTE
                    </button>

                    <button 
                      onClick={() => handleUpdateStatus('REPORTED')}
                      disabled={!isAllFilled || criticalAnswer === null}
                      className="px-6 py-2.5 rounded-xl font-black text-xs text-white bg-blue-500 hover:bg-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] tracking-widest"
                      title={criticalAnswer === null ? "Debe responder la Pausa Clínica" : "Informar Estudio"}
                    >
                      INFORMAR
                    </button>

                    <button 
                      onClick={() => setShowSignModal(true)}
                      disabled={userRole !== 'Staff' || !isAllFilled || criticalAnswer === null}
                      className="px-6 py-2.5 rounded-xl font-black text-xs text-black bg-[#39FF14] hover:bg-[#32e612] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(57,255,20,0.3)] hover:shadow-[0_0_20px_rgba(57,255,20,0.5)] tracking-widest flex items-center gap-2"
                      title={userRole !== 'Staff' ? "Solo Staff puede validar" : (criticalAnswer === null ? "Debe responder la Pausa Clínica" : "Validar y Firmar")}
                    >
                      <CheckCircle2 size={16} /> VALIDAR Y FIRMAR
                    </button>
                 </div>
              </div>

              {/* Modal Pendiente de Información */}
              <AnimatePresence>
                 {isPendingModalOpen && (
                    <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                    >
                       <motion.div 
                         initial={{ scale: 0.95, opacity: 0, y: 20 }}
                         animate={{ scale: 1, opacity: 1, y: 0 }}
                         exit={{ scale: 0.95, opacity: 0, y: 20 }}
                         className="w-full max-w-md bg-[#050810] border border-amber-500/20 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(245,158,11,0.2)] flex flex-col"
                       >
                          <div className="p-6 border-b border-white/5 bg-gradient-to-r from-amber-500/10 to-transparent">
                             <div className="flex items-center gap-3 mb-1">
                                <AlertTriangle size={20} className="text-amber-500" />
                                <span className="text-lg font-black text-white">Estado Pendiente</span>
                             </div>
                             <p className="text-xs text-slate-400">Seleccione el motivo de la suspensión del dictado.</p>
                          </div>
                          
                          <div className="p-6 flex flex-col gap-4 bg-white/[0.01]">
                             <select 
                               value={pendingReason}
                               onChange={e => setPendingReason(e.target.value)}
                               className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-slate-200 outline-none focus:border-amber-500/50"
                             >
                                <option value="">Seleccione Motivo...</option>
                                <option value="Mala Técnica">Mala Técnica</option>
                                <option value="Faltan Datos Clínicos">Faltan Datos Clínicos</option>
                                <option value="Estudio Incompleto">Estudio Incompleto</option>
                                <option value="Requiere Consulta">Requiere Consulta</option>
                                <option value="Otras Razones">Otras Razones...</option>
                             </select>
                             
                             {pendingReason === 'Otras Razones' && (
                                <textarea 
                                   placeholder="Especifique..."
                                   className="w-full h-20 bg-black border border-white/10 rounded-lg p-3 text-sm text-slate-200 outline-none focus:border-amber-500/50 resize-none"
                                />
                             )}
                          </div>

                          <div className="p-5 bg-black border-t border-white/5 flex items-center justify-end gap-3">
                             <button 
                               onClick={() => setIsPendingModalOpen(false)}
                               className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                             >
                               Cancelar
                             </button>
                             <button 
                               onClick={() => handleUpdateStatus('PENDING_INFO', pendingReason)}
                               disabled={!pendingReason}
                               className="px-6 py-2.5 rounded-xl font-black text-sm text-[#020408] bg-amber-500 hover:bg-amber-400 transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                             >
                               Confirmar Estado
                             </button>
                          </div>
                       </motion.div>
                    </motion.div>
                 )}
              </AnimatePresence>

              {/* Plantillas Overlay */}
              <AnimatePresence>
                {showTemplates && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="absolute top-4 bottom-4 right-4 w-96 bg-[#050810]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-40"
                  >
                     <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                        <div className="flex items-center gap-2">
                          <Command size={18} className="text-cyan-400" />
                          <h3 className="text-sm font-black text-white uppercase tracking-widest">Plantillas</h3>
                          <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-[9px] rounded font-bold uppercase">{currentModality}</span>
                        </div>
                        <button 
                          onClick={() => setShowTemplates(false)}
                          className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                        >
                          <X size={18} />
                        </button>
                     </div>

                     <div className="p-4 border-b border-white/5 bg-black/50">
                        <div className="flex items-center justify-between mb-3">
                           <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Gestión Rápida</span>
                           <button onClick={() => handleCreateTemplate()} className="flex items-center gap-1 text-[10px] font-bold bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded hover:bg-cyan-500/20 transition-colors">
                              <Plus size={12} /> NUEVA
                           </button>
                        </div>
                        
                        {templatePrompt?.isOpen ? (
                            <div className="bg-white/5 border border-amber-500/30 rounded-lg p-3 flex flex-col gap-2 relative">
                                {templatePrompt.isWarning && <div className="absolute top-1 right-2 text-rose-500 text-[10px] font-black uppercase blur-[0.5px]">Advertencia</div>}
                                <span className={`text-[10px] uppercase font-bold tracking-widest ${templatePrompt.isWarning ? 'text-rose-400' : 'text-amber-400'}`}>
                                    {templatePrompt.mode === 'create' ? 'Nueva Plantilla' : templatePrompt.mode === 'update' ? 'Sobrescribir' : 'Eliminar Plantilla'}
                                </span>
                                {templatePrompt.mode !== 'delete' && (
                                    <input 
                                      type="text" 
                                      placeholder="Nombre de la plantilla"
                                      value={templatePromptInput}
                                      onChange={e => setTemplatePromptInput(e.target.value)}
                                      className="w-full bg-black border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-amber-500/50"
                                      autoFocus
                                    />
                                )}
                                {templatePrompt.mode === 'delete' && (
                                   <div className="flex flex-col gap-1">
                                      <p className="text-xs text-slate-300">Para confirmar la eliminación, escriba <span className="text-rose-400 font-mono font-bold">ELIMINAR</span>:</p>
                                      <input 
                                        type="text" 
                                        placeholder="Escriba ELIMINAR"
                                        value={templatePromptInput}
                                        onChange={e => setTemplatePromptInput(e.target.value)}
                                        className="w-full bg-rose-500/10 border border-rose-500/30 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-rose-500"
                                        autoFocus
                                      />
                                   </div>
                                )}
                                <div className="flex justify-end gap-2 mt-1">
                                    <button onClick={() => setTemplatePrompt(null)} className="text-xs px-3 py-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">Cancelar</button>
                                    <button onClick={confirmTemplatePrompt} className={`text-xs px-3 py-1.5 rounded-lg font-black transition-colors text-black ${templatePrompt.isWarning ? 'bg-rose-500 hover:bg-rose-400' : 'bg-amber-500 hover:bg-amber-400'}`}>
                                       {templatePrompt.mode === 'delete' ? 'Eliminar Definitivamente' : 'Aceptar'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                              <input 
                                type="text" 
                                placeholder={`Buscar en ${filteredTemplates.length} plantillas ${currentModality}...`}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm outline-none focus:border-cyan-500/50 text-white placeholder:text-slate-500"
                              />
                            </div>
                        )}
                     </div>

                     {!templatePrompt?.isOpen && (
                         <div className="overflow-y-auto custom-scrollbar flex-1 pb-2">
                            {filteredTemplates.length === 0 ? (
                               <div className="p-6 text-center flex flex-col items-center justify-center gap-2">
                                  <FileDigit size={24} className="text-slate-600" />
                                  <span className="text-slate-500 text-xs font-bold leading-relaxed">No hay plantillas guardadas para la modalidad <span className="text-cyan-400">{currentModality}</span>. Crea una ahora.</span>
                               </div>
                            ) : (
                               filteredTemplates.map((template) => (
                                  <div 
                                    key={template.id}
                                    className="p-4 border-b border-white/5 hover:bg-white/5 cursor-pointer flex items-center justify-between group transition-colors"
                                  >
                                      <div onClick={() => handleApplyTemplate(template.text)} className="flex-1 flex flex-col gap-1 overflow-hidden pr-4" title="Clic para escribir esta plantilla en el panel">
                                         <span className="text-sm font-bold text-slate-200 group-hover:text-cyan-400 transition-colors truncate">{template.name}</span>
                                         <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wide line-clamp-1">{template.text.replace(/\n/g, ' ')}...</span>
                                      </div>
                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                         <button onClick={(e) => handleOverwriteTemplate(e, template)} className="p-1.5 hover:bg-amber-500/20 text-slate-400 hover:text-amber-400 rounded" title="Sobrescribir plantilla con el texto actual del panel">
                                            <Save size={16} />
                                         </button>
                                         <button onClick={(e) => handleDeleteTemplate(e, template.id)} className="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded" title="Eliminar">
                                            <Trash2 size={16} />
                                         </button>
                                      </div>
                                  </div>
                               ))
                            )}
                         </div>
                     )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

      {/* Modal de Firma */}
      <AnimatePresence>
         {showSignModal && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            >
               <motion.div 
                 initial={{ scale: 0.95, opacity: 0, y: 20 }}
                 animate={{ scale: 1, opacity: 1, y: 0 }}
                 exit={{ scale: 0.95, opacity: 0, y: 20 }}
                 className="w-full max-w-xl bg-[#050810] border border-amber-500/20 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col"
               >
                  <div className="p-6 border-b border-white/5 bg-gradient-to-r from-amber-500/10 to-transparent">
                     <div className="flex items-center gap-3 mb-1">
                        <FileWarning size={20} className="text-amber-500" />
                     <span className="text-xl font-black text-white">Congelar y Firmar Documento</span>
                     </div>
                     <p className="text-sm text-slate-400">Verifique la información antes del cierre definitivo de este dictado.</p>
                  </div>
                  
                  <div className="p-6 flex flex-col gap-6 bg-white/[0.01]">
                      <div className="flex items-center gap-4 mb-4 pb-4 border-b border-white/10 justify-between">
                         <div className="flex items-center gap-3">
                           <div className="w-10 h-10 bg-cyan-500/10 border border-cyan-500/30 rounded-lg flex items-center justify-center">
                             <Stethoscope className="text-cyan-400" size={20} />
                           </div>
                           <div className="flex flex-col">
                             <span className="text-sm font-black text-white">CENTRO RADIOLÓGICO AMIS 2030</span>
                             <span className="text-[10px] text-cyan-400 font-mono">ID: {study.accessionNumber}</span>
                           </div>
                         </div>
                         <div className="text-right flex flex-col">
                           <span className="text-xs font-bold text-slate-300">{study.enrichedRadiologistName}</span>
                           <span className="text-[9px] uppercase tracking-widest text-slate-500">MÉDICO RADILÓGO</span>
                         </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                           <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Paciente Destino</span>
                           <span className="font-bold text-slate-200">{study.patientFullName}</span>
                        </div>
                        <div className="flex flex-col gap-2">
                           <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Estudio / Base</span>
                           <span className="font-bold text-slate-200">{safeTitle} ({study.modality})</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                         <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Reporte Final Transcrito</span>
                         <div className="p-5 bg-black/50 rounded-xl border border-white/5 max-h-[180px] overflow-y-auto custom-scrollbar relative">
                            <p className="text-[13px] text-slate-300 leading-[1.8] max-w-full whitespace-pre-wrap">{getFullText() || '--- Informe Vacío ---'}</p>
                         </div>
                      </div>
                   </div>

                  <div className="p-5 bg-black border-t border-white/5 flex items-center justify-end gap-3">
                     <button 
                       onClick={() => setShowSignModal(false)}
                       className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                     >
                       Volver al Editor
                     </button>
                     <Link href="/dashboard">
                        <button className="px-8 py-2.5 rounded-xl font-black text-sm text-[#020408] bg-amber-500 hover:bg-amber-400 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                          <CheckCircle2 size={16} /> Emitir Informe Firmado
                        </button>
                     </Link>
                  </div>
               </motion.div>
            </motion.div>
         )}
      </AnimatePresence>

      {/* Modal Visor Ligero de Anexos */}
      <AnimatePresence>
         {activeAttachment && (
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="fixed inset-0 z-[60] flex items-center justify-center p-8 bg-black/90 backdrop-blur-md"
               onClick={() => setActiveAttachment(null)}
            >
               <motion.div 
                 initial={{ scale: 0.95, opacity: 0, y: 20 }}
                 animate={{ scale: 1, opacity: 1, y: 0 }}
                 exit={{ scale: 0.95, opacity: 0, y: 20 }}
                 className="w-full max-w-5xl h-[85vh] bg-[#050810] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
                 onClick={(e) => e.stopPropagation()}
               >
                  <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <FileText size={18} className="text-cyan-400" />
                        <h2 className="text-sm font-bold text-white">{activeAttachment.name}</h2>
                     </div>
                     <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 mr-4 border-r border-white/10 pr-4">
                          <button onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.25))} className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded transition-colors" title="Zoom Out">
                            <ZoomOut size={14} />
                          </button>
                          <span className="text-[10px] font-mono text-slate-400 w-8 text-center">{Math.round(zoomLevel * 100)}%</span>
                          <button onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.25))} className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded transition-colors" title="Zoom In">
                            <ZoomIn size={14} />
                          </button>
                          <button onClick={() => setRotation(prev => (prev + 90) % 360)} className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded transition-colors ml-2" title="Rotar 90º">
                            <RotateCw size={14} />
                          </button>
                          <button onClick={() => document.getElementById('annex-viewer-container')?.requestFullscreen()} className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded transition-colors ml-1" title="Pantalla Completa">
                            <Maximize size={14} />
                          </button>
                        </div>
                        <a 
                          href={`/api/annexes/${study.studyInstanceUID}/${activeAttachment.id}`}
                          download={`${activeAttachment.name}.${activeAttachment.type === 'pdf' ? 'pdf' : 'jpg'}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-widest text-cyan-400 hover:text-cyan-300 transition-colors px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-md"
                        >
                           <Save size={12} /> Descargar
                        </a>
                        <button 
                          onClick={() => setActiveAttachment(null)}
                          className="text-[10px] uppercase font-bold tracking-widest text-slate-500 hover:text-white transition-colors px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-md"
                        >
                           Cerrar [ESC]
                        </button>
                     </div>
                  </div>
                  
                  <div id="annex-viewer-container" className="flex-1 bg-black/80 p-6 flex flex-col items-center justify-center relative overflow-hidden">
                     {activeAttachment.type === 'image' && (
                        <div className="w-full h-full max-w-5xl flex items-center justify-center overflow-auto rounded-lg border border-white/10 relative">
                           <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay z-0 pointer-events-none"></div>
                           <img 
                             src={`/api/annexes/${study.studyInstanceUID}/${activeAttachment.id}`} 
                             alt={activeAttachment.name}
                             style={{ 
                               transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                               transition: 'transform 0.2s ease-out'
                             }}
                             className="max-w-full max-h-full object-contain drop-shadow-2xl z-10 origin-center"
                           />
                        </div>
                     )}
                     {activeAttachment.type === 'pdf' && (
                        <div className="w-full h-full flex items-center justify-center rounded-lg border border-white/10 overflow-hidden bg-white/90">
                           <iframe 
                             src={`/api/annexes/${study.studyInstanceUID}/${activeAttachment.id}#view=FitH&zoom=${zoomLevel * 100}`} 
                             style={{
                               transform: `rotate(${rotation}deg)`,
                               transition: 'transform 0.2s ease-out'
                             }}
                             className="w-full h-full border-0 transform-gpu"
                             title={activeAttachment.name}
                           />
                        </div>
                     )}
                     
                     <div className="absolute bottom-6 right-6 pointer-events-none">
                       <span className="px-3 py-1 bg-black/80 backdrop-blur border border-white/10 rounded text-[10px] text-slate-400 font-mono shadow-xl relative z-20">
                          {activeAttachment.type.toUpperCase()} / {study.studyInstanceUID}
                       </span>
                     </div>
                  </div>
               </motion.div>
            </motion.div>
         )}
      </AnimatePresence>

    </motion.div>
  );
}
