"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { 
  ArrowLeft, Monitor, Save, Activity, FileText, CheckCircle2, 
  ChevronLeft, ChevronRight, FileDigit, ScanFace, Sparkles,
  Command, Search, Mic, FileWarning, ZoomIn, ZoomOut, RotateCw, Clock, Stethoscope,
  Plus, Trash2, X, AlertTriangle, AlertCircle, Smartphone, Loader2,
  LayoutGrid, List, ExternalLink, Layout, Minimize2, Eye, Printer, ClipboardList
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react'; 
import { supabase } from '@/lib/supabase';

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
  const [baseSections, setBaseSections] = useState({ technique: '', history: '', findings: '', impression: '' });
  const [highlightColor, setHighlightColor] = useState('text-amber-400');
  const [activeSection, setActiveSection] = useState<'technique' | 'history' | 'findings' | 'impression'>('findings');
  const sectionRefs = {
    technique: useRef<HTMLTextAreaElement>(null),
    history: useRef<HTMLTextAreaElement>(null),
    findings: useRef<HTMLTextAreaElement>(null),
    impression: useRef<HTMLTextAreaElement>(null),
  };

  // Naive text difference renderer for visual highlights
  const renderDiff = (original: string, current: string) => {
    if (original === current) return <span className="text-white/60">{current}</span>;
    if (!original) return <span className={highlightColor}>{current}</span>;

    let startMatch = 0;
    while (startMatch < original.length && startMatch < current.length && original[startMatch] === current[startMatch]) {
      startMatch++;
    }

    let endMatchOriginal = original.length - 1;
    let endMatchCurrent = current.length - 1;
    while (endMatchOriginal >= startMatch && endMatchCurrent >= startMatch && original[endMatchOriginal] === current[endMatchCurrent]) {
      endMatchOriginal--;
      endMatchCurrent--;
    }

    const currentMiddle = current.slice(startMatch, endMatchCurrent + 1);

    return (
      <>
        <span className="text-white/60">{current.substring(0, startMatch)}</span>
        {currentMiddle && <span className={highlightColor}>{currentMiddle}</span>}
        <span className="text-white/60">{current.substring(endMatchCurrent + 1)}</span>
      </>
    );
  };
  // ─── AMIS ROLE SYSTEM ────────────────────────────────────────────────────
  type AmisRole = 'MED_STAFF' | 'MED_CHIEF' | 'MED_RESIDENT' | 'MED_REQUIRES_COSIGN';
  const [userRole, setUserRole] = useState<AmisRole>('MED_RESIDENT');
  const canSign = userRole === 'MED_STAFF' || userRole === 'MED_CHIEF';
  const isResident = userRole === 'MED_RESIDENT' || userRole === 'MED_REQUIRES_COSIGN';
  // ─────────────────────────────────────────────────────────────────────────
  const [criticalAnswer, setCriticalAnswer] = useState<boolean | null>(null);
  const [criticalPathology, setCriticalPathology] = useState('');
  const [isPendingModalOpen, setIsPendingModalOpen] = useState(false);
  const [pendingReason, setPendingReason] = useState('');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showSignModal, setShowSignModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  // ─── HISTORIAL PREVIO — SEMÁFORO DE ACCESO ─────────────────────────────────
  // Gris  = sin historial detectado
  // Azul  = historial disponible, cargando/pendiente de verificación IRAD
  // Verde = historial completo cargado, acceso total habilitado
  type HistorialStatus = 'sin-historial' | 'cargando' | 'disponible';
  const [historialStatus, setHistorialStatus] = useState<HistorialStatus>('sin-historial');
  const [previosStudies, setPreviosStudies] = useState<Array<{
    uid: string; description: string; date: string; modality: string;
    hasPdf: boolean; hasImages: boolean; pdfUrl?: string; imageUrl?: string;
  }>>([]);

  // Simula la consulta de historial previo al montar (en prod: llamar a adaptive-search API)
  useEffect(() => {
    const effectiveId = study.effectivePatientId || study.patientId;
    if (!effectiveId) return;
    setHistorialStatus('cargando');
    // Simulated delay for IRAD/legacy query
    const timer = setTimeout(() => {
      // Mock: si el ID tiene dígitos, simula que encontró estudios
      const hasPrev = effectiveId.replace(/\D/g,'').length > 3;
      if (hasPrev) {
        setPreviosStudies([
          { uid: 'prev-1', description: 'TAC DE TÓRAX SIN CONTRASTE', date: '2025-11-14', modality: 'CT', hasPdf: true, hasImages: true, pdfUrl: '#', imageUrl: '#' },
          { uid: 'prev-2', description: 'RADIOGRAFÍA DE TÓRAX PA', date: '2025-08-22', modality: 'CR', hasPdf: true, hasImages: false, pdfUrl: '#' },
          { uid: 'prev-3', description: 'ECOGRAFIA ABDOMINAL', date: '2025-03-05', modality: 'US', hasPdf: false, hasImages: true, imageUrl: '#' },
        ]);
        setHistorialStatus('disponible');
      } else {
        setPreviosStudies([]);
        setHistorialStatus('sin-historial');
      }
    }, 1800);
    return () => clearTimeout(timer);
  }, [study.effectivePatientId, study.patientId]);
  // ────────────────────────────────────────────────────────────────────────────

  // B2B PENDING ACTION STATES
  const [isPendingCenterModalOpen, setIsPendingCenterModalOpen] = useState(false);
  const [pendingCenterCategory, setPendingCenterCategory] = useState('');
  const [pendingCenterMessage, setPendingCenterMessage] = useState('');

  // REMOTE DICTATION STATES
  const [showRemoteQR, setShowRemoteQR] = useState(false);
  const [remoteStatus, setRemoteStatus] = useState<'disconnected' | 'linked' | 'recording'>('disconnected');
  const [remoteToken, setRemoteToken] = useState<string>('');
  
  // Generating remote token on mount
  useEffect(() => {
    setRemoteToken(Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
  }, []);

  // ─── ADDENDUM / INTERCONSULTA ALERT ──────────────────────────────────────
  // Holds the active PENDING addendum request for this study, if any
  type AddendumRequest = { id: string; request_text: string; requester_name: string | null; status: string };
  const [addendumRequest, setAddendumRequest] = useState<AddendumRequest | null>(null);
  
  // Mock current user for demo consistency with Worklist
  const currentMedicName = 'DR. MARCELO AVILA';

  useEffect(() => {
    if (!study.studyInstanceUID) return;

    // Initial fetch of relevant addendum requests (unresolved)
    const fetchAddendum = async () => {
      const { data } = await supabase
        .from('addendum_requests')
        .select('id, request_text, requester_name, status')
        .eq('study_uid', study.studyInstanceUID)
        .in('status', ['TRIAGE_PENDING', 'ASSIGNED_TO_MEDIC'])
        .maybeSingle();

      if (data) {
        // Alerta visible si está asignado a mí o pendiente de triage (y yo lo estoy revisando)
        const isForMe = data.status === 'ASSIGNED_TO_MEDIC' && 
                        data.requester_name?.toUpperCase() === currentMedicName.toUpperCase();
        
        const isInternalReview = data.status === 'TRIAGE_PENDING';

        if (isForMe || isInternalReview) {
          setAddendumRequest(data);
        } else {
          setAddendumRequest(null);
        }
      } else {
        setAddendumRequest(null);
      }
    };

    fetchAddendum();

    // Realtime subscription for this specific study
    const ch = supabase
      .channel(`addendum-editor-${study.studyInstanceUID}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'addendum_requests',
          filter: `study_uid=eq.${study.studyInstanceUID}`
        },
        () => fetchAddendum()
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [study.studyInstanceUID]);
  // ─────────────────────────────────────────────────────────────────────────

  // IA State
  const [isReviewingAI, setIsReviewingAI] = useState(false);
  const [aiReviewResults, setAiReviewResults] = useState<{ alerts: string[], suggestion: string, correctedSections?: Record<string, string>, corrections?: string[] } | null>(null);
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
      try { setSections(JSON.parse(saved)); } catch {}
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

  // ERGONOMICS & VIEW MODES
  const [annexViewMode, setAnnexViewMode] = useState<'grid' | 'list'>('grid');
  
  // Advanced Viewer States
  const [isViewerDocked, setIsViewerDocked] = useState(false);
  const [viewerOpacity, setViewerOpacity] = useState(1);
  const [isWindowPopout, setIsWindowPopout] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Persistence for user preferences
  useEffect(() => {
    const savedMode = localStorage.getItem('amis_annex_view_mode');
    const savedCollapsed = localStorage.getItem('amis_sidebar_collapsed');
    if (savedMode) setAnnexViewMode(savedMode as 'grid' | 'list');
    if (savedCollapsed) setIsSidebarCollapsed(savedCollapsed === 'true');
  }, []);

  useEffect(() => {
    localStorage.setItem('amis_annex_view_mode', annexViewMode);
  }, [annexViewMode]);

  useEffect(() => {
    localStorage.setItem('amis_sidebar_collapsed', isSidebarCollapsed.toString());
  }, [isSidebarCollapsed]);

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

  // REALTIME ANTENNA (SUPABASE)
  useEffect(() => {
    if (!study.studyInstanceUID) return;

    console.log(`[Antenna] Listening for remote session on study: ${study.studyInstanceUID}`);
    
    // Subscribe to changes in the remote_dictation_sessions table
    const channel = supabase
      .channel(`remote-dictation-${study.studyInstanceUID}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'remote_dictation_sessions', 
          filter: `study_uid=eq.${study.studyInstanceUID}` 
        },
        (payload: { new: any }) => {
          const data = payload.new as any;
          if (!data) return;

          // Connection status
          if (data.status === 'ACTIVE') setRemoteStatus('linked');
          if (data.status === 'RECORDING') setRemoteStatus('recording');
          if (data.status === 'DISCONNECTED') setRemoteStatus('disconnected');

          // Text Injection Logic
          if (data.live_text && data.live_text !== '') {
            let processedText = data.live_text;

            // Procesamiento de Comandos de Puntuación y Formato (Semántica Radiológica)
            processedText = processedText.replace(/punto nueva línea/gi, '.\n');
            processedText = processedText.replace(/punto nueva linea/gi, '.\n'); // Robustness for accents
            processedText = processedText.replace(/punto y aparte/gi, '.\n\n');

            const textToInject = " " + processedText.trim();
            const currentRef = sectionRefs[activeSection]?.current;

            if (currentRef) {
              const start = currentRef.selectionStart;
              const end = currentRef.selectionEnd;
              
              setSections(prev => {
                const text = prev[activeSection];
                const before = text.substring(0, start);
                const after = text.substring(end);
                return { ...prev, [activeSection]: before + textToInject + after };
              });

              // Mantener el foco y mover el cursor al final de la inserción
              setTimeout(() => {
                currentRef.focus();
                const newPos = start + textToInject.length;
                currentRef.setSelectionRange(newPos, newPos);
              }, 50);
            }
          }

          // Command Execution
          if (data.last_command === 'NEXT_SECTION') {
            const flow: Array<'technique' | 'history' | 'findings' | 'impression'> = ['technique', 'history', 'findings', 'impression'];
            const currentIndex = flow.indexOf(activeSection);
            const nextIndex = (currentIndex + 1) % flow.length;
            setActiveSection(flow[nextIndex]);
            sectionRefs[flow[nextIndex]].current?.focus();
          }

          if (data.last_command === 'PREVIOUS_SECTION') {
            const flow: Array<'technique' | 'history' | 'findings' | 'impression'> = ['technique', 'history', 'findings', 'impression'];
            const currentIndex = flow.indexOf(activeSection);
            const nextIndex = currentIndex === 0 ? flow.length - 1 : currentIndex - 1;
            setActiveSection(flow[nextIndex]);
            sectionRefs[flow[nextIndex]].current?.focus();
          }

          if (data.last_command === 'OPEN_SIGN') {
            setShowSignModal(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [study.studyInstanceUID, activeSection]);


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
    const technique = text.match(/TÉCNICA DE ESTUDIO:\s*([\s\S]*?)(?=ANTECEDENTES:|HALLAZGOS:|IMPRESIÓN DIAGNÓSTICA:|$)/i)?.[1]?.trim() || '';
    const history = text.match(/ANTECEDENTES:\s*([\s\S]*?)(?=TÉCNICA DE ESTUDIO:|HALLAZGOS:|IMPRESIÓN DIAGNÓSTICA:|$)/i)?.[1]?.trim() || '';
    const findings = text.match(/HALLAZGOS:\s*([\s\S]*?)(?=TÉCNICA DE ESTUDIO:|ANTECEDENTES:|IMPRESIÓN DIAGNÓSTICA:|$)/i)?.[1]?.trim() || '';
    const impression = text.match(/IMPRESIÓN DIAGNÓSTICA:\s*([\s\S]*?)(?=TÉCNICA DE ESTUDIO:|ANTECEDENTES:|HALLAZGOS:|$)/i)?.[1]?.trim() || '';

    if (!technique && !history && !findings && !impression) {
       setSections(prev => ({ ...prev, [activeSection]: prev[activeSection] + (prev[activeSection] ? "\n" : "") + text.trim() }));
    } else {
       const newSections = {
         technique: technique || sections.technique,
         history: history || sections.history,
         findings: findings || sections.findings,
         impression: impression || sections.impression
       };
       setSections(newSections);
       setBaseSections({
         technique: technique,
         history: history,
         findings: findings,
         impression: impression
       });
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
    // For residents sending to supervisor, override status to PENDING_VALIDATION
    const effectiveStatus = isResident && status === 'VALIDATED' ? 'PENDING_VALIDATION' : status;

    const payload = {
      studyInstanceUID: study.studyInstanceUID,
      status: effectiveStatus,
      content: getFullText(),
      userRole,
      pendingReason: reason || null,
      pendingMessage: pendingCenterMessage || null,
      critical_alert: criticalAnswer === true ? { active: true, pathology: criticalPathology } : null,
      // Resident metadata for supervision inbox
      ...(isResident && { draft_author_role: userRole }),
      // For B2B actions, record who sent it (Staff only name for transparency)
      ...(status === 'PENDING_CENTER_ACTION' && { 
        supervisor_name: currentMedicName,
        pending_category: pendingCenterCategory 
      }),
    };

    try {
      const res = await fetch('/api/v1/reports/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        // AUTO-RESOLUTION: If signing (VALIDATED), mark any pending addendum as RESOLVED
        if (effectiveStatus === 'VALIDATED' && addendumRequest?.id) {
          await supabase
            .from('addendum_requests')
            .update({ status: 'RESOLVED', resolved_at: new Date().toISOString() })
            .eq('id', addendumRequest.id);
          console.log(`[Addendum] Auto-resolved addendum ${addendumRequest.id} upon sign.`);
        }

        if (effectiveStatus === 'VALIDATED') {
          window.location.href = '/dashboard';
        } else if (effectiveStatus === 'PENDING_VALIDATION') {
          // Resident sent to supervisor — redirect to dashboard with confirmation
          window.location.href = '/dashboard?sent_to_supervisor=1';
        } else if (effectiveStatus === 'PENDING_INFO') {
          setIsPendingModalOpen(false);
          window.location.href = '/dashboard';
        } else if (effectiveStatus === 'PENDING_CENTER_ACTION') {
          setIsPendingCenterModalOpen(false);
          window.location.href = '/dashboard?pending_center=1';
        } else {
          alert('Borrador Guardado Exitosamente (Estado REPORTED)');
        }
      } else {
        alert('Error al actualizar estado.');
      }
    } catch {
      alert('Error de red.');
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

            <div className="flex items-center gap-4 px-4 bg-white/5 rounded-xl border border-white/5 h-12">
                <div className="flex items-center gap-2">
                   <div className={`p-2 rounded-lg transition-all duration-500 ${
                     remoteStatus === 'recording' ? 'bg-rose-500/20 text-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)] animate-pulse' :
                     remoteStatus === 'linked' ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]' :
                     'bg-white/5 text-slate-600'
                   }`}>
                     <Smartphone size={18} />
                   </div>
                   <div className="flex flex-col">
                      <span className={`text-[9px] font-black uppercase tracking-[0.2em] leading-none ${
                        remoteStatus === 'recording' ? 'text-rose-400' :
                        remoteStatus === 'linked' ? 'text-emerald-400' :
                        'text-slate-600'
                      }`}>Móvil</span>
                      <span className="text-[10px] font-bold text-white/90">
                        {remoteStatus === 'recording' ? 'DICTANDO...' : remoteStatus === 'linked' ? 'VINCULADO' : 'SYNC OFF'}
                      </span>
                   </div>
                </div>
            </div>
        </div>
      </header>

      {/* ══════ ADDENDUM / INTERCONSULTA ALERT BANNER ══════ */}
      <AnimatePresence>
        {addendumRequest && (
          <motion.div
            initial={{ opacity: 0, y: -20, scaleY: 0.8 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -20, scaleY: 0.8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="relative z-30 shrink-0 overflow-hidden"
          >
            {/* Animated left border sentinel */}
            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-rose-400 via-orange-400 to-rose-500 animate-pulse" />
            <div className="bg-gradient-to-r from-rose-950/80 via-rose-900/60 to-[#020408]/80 border-b border-rose-500/40 backdrop-blur-xl px-8 py-3 flex items-center gap-5 shadow-[0_8px_32px_rgba(244,63,94,0.2)]">
              {/* Pulsing alert icon */}
              <div className="shrink-0 relative">
                <div className="absolute inset-0 rounded-full bg-rose-500/30 animate-ping" />
                <div className="relative w-9 h-9 rounded-full bg-rose-500/20 border border-rose-500/50 flex items-center justify-center">
                  <AlertTriangle size={18} className="text-rose-400" />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[9px] font-black uppercase tracking-[0.25em] text-rose-400">⚠ INTERCONSULTA PENDIENTE</span>
                  {addendumRequest.requester_name && (
                    <span className="text-[9px] font-bold text-rose-300/60 uppercase tracking-widest">
                      • {addendumRequest.requester_name}
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold text-white leading-snug truncate" title={addendumRequest.request_text}>
                  &ldquo;{addendumRequest.request_text}&rdquo;
                </p>
              </div>

              {/* Right badge */}
              <div className="shrink-0 flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[9px] font-black uppercase tracking-widest animate-pulse">
                  RESPONDER EN INFORME
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Workspace Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Panel Izquierdo: Contexto Clínico (The Side-Cockpit) */}
        <motion.div 
          initial={false}
          animate={{ width: isSidebarCollapsed ? '64px' : '30%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="bg-white/[0.01] border-r border-white/5 flex flex-col overflow-hidden relative backdrop-blur-3xl shadow-[inset_-20px_0_40px_rgba(0,0,0,0.2)] z-10"
        >
           {/* Botón de Colapso Flotante */}
           <button 
             onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
             className="absolute top-4 right-4 z-50 p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
           >
             {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
           </button>

           <AnimatePresence mode="wait">
             {!isSidebarCollapsed ? (
               <motion.div 
                 key="expanded-content"
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 exit={{ opacity: 0 }}
                 className="flex flex-col h-full overflow-hidden"
               >
                 {/* SLA Indicator */}
                 <div className="px-6 py-3 bg-white/5 border-b border-white/5 flex items-center justify-between overflow-hidden">
                    <span className="text-[10px] font-black tracking-widest uppercase text-slate-400 flex items-center gap-2 whitespace-nowrap">
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
                           <div className="flex items-center gap-2 mt-0.5">
                             <span className="text-sm font-mono text-slate-200">
                               {study.effectivePatientId || study.patientId}
                             </span>
                             <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-[0.15em] border ${
                               study.patientIdSource === 'NUM_COBRE'
                                 ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                                 : study.patientIdSource === 'EXTERNAL_ID'
                                   ? 'bg-purple-500/15 border-purple-500/30 text-purple-400'
                                   : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'
                             }`}>
                               {study.patientIdLabel || 'RUT'}
                             </span>
                           </div>
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
                       <div className="p-3 bg-black/40 rounded-xl border border-white/5 max-h-[80px] overflow-y-auto">
                          <p className="text-sm text-slate-300 leading-relaxed font-medium">
                            {study.clinicalHistory || 'Sin antecedentes proporcionados por la institución de origen.'}
                          </p>
                       </div>
                     </section>

                     {/* ──────── PANEL HISTORIAL PREVIO — SEMÁFORO ──────── */}
                     <section>
                       <div className="flex items-center justify-between mb-2">
                         <h3 className="text-[10px] font-black tracking-widest uppercase text-slate-500 flex items-center gap-2">
                           <Clock size={12} /> Estudios Previos
                         </h3>
                         {/* SEMÁFORO */}
                         <div className="flex items-center gap-1.5">
                           <div className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
                             historialStatus === 'disponible' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' :
                             historialStatus === 'cargando'   ? 'bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(96,165,250,0.5)]' :
                             'bg-slate-600'
                           }`} />
                           <span className={`text-[8px] font-black uppercase tracking-widest ${
                             historialStatus === 'disponible' ? 'text-emerald-400' :
                             historialStatus === 'cargando'   ? 'text-blue-400' :
                             'text-slate-600'
                           }`}>
                             {historialStatus === 'disponible' ? `${previosStudies.length} PREVIOS` :
                              historialStatus === 'cargando'   ? 'BUSCANDO...' :
                              'SIN HISTORIAL'}
                           </span>
                         </div>
                       </div>
                       {historialStatus === 'disponible' && previosStudies.length > 0 && (
                         <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                           {previosStudies.map(prev => (
                             <div key={prev.uid} className="p-2 rounded-xl bg-emerald-500/5 border border-emerald-500/20 hover:border-emerald-500/40 transition-all group">
                               <div className="flex items-start justify-between gap-1">
                                 <div className="flex flex-col min-w-0">
                                   <span className="text-[10px] font-bold text-white/80 truncate">{prev.description}</span>
                                   <div className="flex items-center gap-1.5 mt-0.5">
                                     <span className="text-[8px] font-mono text-slate-500">{prev.date}</span>
                                     <span className="text-[8px] font-black text-cyan-500/70 border border-cyan-500/20 bg-cyan-500/5 px-1 rounded">{prev.modality}</span>
                                   </div>
                                 </div>
                                 <div className="flex items-center gap-1 shrink-0">
                                   {prev.hasImages && (
                                     <a href={prev.imageUrl || '#'} target="_blank" rel="noopener noreferrer"
                                        title="Abrir imágenes en visor"
                                        className="p-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-colors">
                                       <Monitor size={10} />
                                     </a>
                                   )}
                                   {prev.hasPdf && (
                                     <a href={prev.pdfUrl || '#'} target="_blank" rel="noopener noreferrer"
                                        title="Abrir PDF de informe previo"
                                        className="p-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                                       <FileText size={10} />
                                     </a>
                                   )}
                                 </div>
                               </div>
                             </div>
                           ))}
                         </div>
                       )}
                       {historialStatus === 'cargando' && (
                         <div className="py-3 flex items-center justify-center gap-2 text-blue-400/60">
                           <Loader2 size={14} className="animate-spin" />
                           <span className="text-[10px] font-bold">Consultando IRAD y registros previos...</span>
                         </div>
                       )}
                       {historialStatus === 'sin-historial' && (
                         <div className="py-2 text-center text-slate-600 text-[9px] font-bold uppercase tracking-widest">
                           Sin estudios previos detectados
                         </div>
                       )}
                     </section>
                 </div>

                 {/* Carrusel de Anexos (Filmstrip Visual) */}
                  <div className="p-6 flex-1 flex flex-col min-h-0 bg-gradient-to-b from-transparent to-[#020408]">
                    <div className="flex items-center justify-between mb-4">
                       <h3 className="text-[10px] font-black tracking-widest uppercase text-slate-400 flex items-center gap-2">
                         <FileDigit size={12} className="text-amber-500" /> Historial de Anexos
                       </h3>
                       
                       {/* Selector de Vista (Mode Toggle) */}
                       <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
                          <button 
                            onClick={() => setAnnexViewMode('grid')}
                            className={`p-1.5 rounded-md transition-all ${annexViewMode === 'grid' ? 'bg-amber-500 text-black' : 'text-slate-500 hover:text-slate-300'}`}
                            title="Vista Galería"
                          >
                            <LayoutGrid size={14} />
                          </button>
                          <button 
                            onClick={() => setAnnexViewMode('list')}
                            className={`p-1.5 rounded-md transition-all ${annexViewMode === 'list' ? 'bg-amber-500 text-black' : 'text-slate-500 hover:text-slate-300'}`}
                            title="Vista Compacta"
                          >
                            <List size={14} />
                          </button>
                       </div>
                    </div>

                    <div className="relative flex-1 bg-black/40 rounded-[2rem] border border-white/5 overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
                        <div className={`p-5 absolute inset-0 w-full overflow-y-auto custom-scrollbar ${annexViewMode === 'grid' ? 'grid grid-cols-2 gap-4' : 'flex flex-col gap-2'}`}>
                           {annexes.length > 0 ? [...annexes]
                             .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
                             .map((file) => {
                              const isPDF = file.name.toLowerCase().endsWith('.pdf');
                              const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name);
                              const fileDate = file.date ? new Date(file.date).toLocaleDateString('es-CL', { month: 'short', year: 'numeric' }) : 'S/F';

                              if (annexViewMode === 'grid') {
                                return (
                                  <motion.div 
                                    key={file.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    whileHover={{ y: -5, scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setActiveAttachment(file)}
                                    className="relative group cursor-pointer"
                                  >
                                    <div className="aspect-[3/4] bg-slate-900 rounded-2xl border border-white/10 overflow-hidden shadow-2xl transition-all group-hover:border-amber-500/50 group-hover:shadow-[0_10px_30px_rgba(245,158,11,0.15)] flex items-center justify-center">
                                       {isImage ? (
                                         <img 
                                           src={file.url || '/placeholder-doc.png'} 
                                           alt={file.name}
                                           className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                         />
                                       ) : (
                                         <div className="relative w-full h-full flex flex-col items-center justify-center bg-[#0a0f1d] p-4 text-center">
                                            <FileText size={24} className={isPDF ? "text-rose-500" : "text-blue-500"} />
                                            <span className="text-[8px] font-black uppercase text-slate-500 tracking-[0.2em] mt-2 block">{isPDF ? 'PDF Doc' : 'TXT File'}</span>
                                         </div>
                                       )}
                                       <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black via-black/80 to-transparent pt-8">
                                          <span className="block text-[9px] font-black text-white truncate">{file.name}</span>
                                       </div>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between px-1">
                                       <span className="text-[8px] font-black uppercase tracking-widest text-amber-500/70">{fileDate}</span>
                                    </div>
                                  </motion.div>
                                );
                              } else {
                                // Vista de LISTA Compacta
                                return (
                                  <motion.div
                                    key={file.id}
                                    layout
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    onClick={() => setActiveAttachment(file)}
                                    className="flex items-center gap-3 p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-amber-500/30 transition-all cursor-pointer group"
                                  >
                                    <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center text-slate-500 group-hover:text-amber-500 transition-colors">
                                      {isPDF ? <FileText size={14} /> : isImage ? <ScanFace size={14} /> : <FileDigit size={14} />}
                                    </div>
                                    <div className="flex flex-col flex-1 overflow-hidden">
                                      <span className="text-[11px] font-bold text-slate-200 truncate">{file.name}</span>
                                      <span className="text-[9px] text-slate-500 font-mono tracking-tighter uppercase">{fileDate} • {file.type}</span>
                                    </div>
                                    <ChevronRight size={12} className="text-slate-600 group-hover:text-amber-500 transform group-hover:translate-x-1 transition-all" />
                                  </motion.div>
                                );
                              }
                           }) : (
                              <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                                <ScanFace size={32} className="text-slate-500" />
                                <span className="text-xs font-black uppercase tracking-widest text-slate-400 mt-4">Sin Anexos</span>
                              </div>
                           )}
                        </div>
                    </div>
                  </div>
               </motion.div>
             ) : (
               <motion.div 
                 key="collapsed-content"
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 className="flex flex-col items-center py-20 gap-8"
               >
                 <div className="flex flex-col items-center gap-1 [writing-mode:vertical-lr] rotate-180 text-slate-500">
                    <span className="text-[10px] font-black tracking-[0.3em] uppercase">Contexto Clínico</span>
                 </div>
                 <div className="flex flex-col gap-4">
                    <button onClick={() => setIsSidebarCollapsed(false)} className="p-3 rounded-full bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all">
                       <Activity size={20} />
                    </button>
                    <button onClick={() => setIsSidebarCollapsed(false)} className="p-3 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 transition-all">
                       <FileDigit size={20} />
                    </button>
                 </div>
               </motion.div>
             )}
           </AnimatePresence>
        </motion.div>

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
                  onClick={() => {
                    const colors = ['text-amber-400', 'text-purple-400', 'text-rose-400', 'text-cyan-400'];
                    const currentIdx = colors.indexOf(highlightColor);
                    setHighlightColor(colors[(currentIdx + 1) % colors.length]);
                  }}
                  className={`flex items-center justify-center w-8 h-8 rounded-md border border-white/10 transition-all bg-white/5 hover:bg-white/10 ${highlightColor}`}
                  title="Cambiar Color de Resaltado"
                >
                  <div className={`w-3 h-3 rounded-full bg-current`} />
                </button>
                <button 
                  onClick={() => setBaseSections(sections)}
                  className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-emerald-400 rounded-md border border-white/10 transition-all"
                  title="Reset visual: Asentar todo el texto modificado a color base"
                >
                  <CheckCircle2 size={14} /> Refrescar Color
                </button>
                <button 
                  onClick={handleAIReview}
                  disabled={isReviewingAI}
                  className={`px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(168,85,247,0.2)] border border-purple-500/30 ${isReviewingAI ? 'bg-purple-900/50 text-purple-300 animate-pulse' : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'}`}
                >
                  {isReviewingAI ? <RotateCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  Guardia IA
                </button>

                <button 
                  onClick={() => setShowRemoteQR(!showRemoteQR)}
                  className="flex items-center gap-2 text-xs font-black px-4 py-2 bg-gradient-to-br from-slate-800 to-slate-900 text-white hover:from-cyan-600 hover:to-blue-700 rounded-xl border border-white/10 transition-all shadow-xl active:scale-95 group"
                >
                  <span className="animate-bounce group-hover:animate-none">📱</span> Dictáfono Móvil
                </button>
             </div>
           </div>

           {/* QR OVERLAY */}
           <AnimatePresence>
             {showRemoteQR && (
               <motion.div 
                 initial={{ opacity: 0, scale: 0.9, y: 20 }}
                 animate={{ opacity: 1, scale: 1, y: 0 }}
                 exit={{ opacity: 0, scale: 0.9, y: 20 }}
                 className="absolute inset-0 z-50 flex items-center justify-center p-8 bg-[#020408]/90 backdrop-blur-3xl"
               >
                  <div className="w-full max-w-sm bg-[#0a0f1d] border border-cyan-500/30 rounded-3xl p-8 flex flex-col items-center shadow-[0_0_80px_rgba(6,182,212,0.15)] relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
                    <button 
                      onClick={() => setShowRemoteQR(false)}
                      className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white transition-colors"
                    >
                      <X size={20} />
                    </button>

                    <div className="p-3 bg-cyan-500/10 rounded-2xl mb-4">
                      <Smartphone size={32} className="text-cyan-400" />
                    </div>
                    
                    <h2 className="text-xl font-black text-white tracking-tighter text-center mb-1">Móvil Vinculado</h2>
                    <p className="text-[11px] font-medium text-slate-500 text-center uppercase tracking-widest mb-8">Dictado Remoto encriptado de extremo a extremo</p>

                    <div className="p-6 bg-white rounded-3xl shadow-[0_0_40px_rgba(255,255,255,0.1)] relative">
                      <QRCodeCanvas 
                        value={`https://tu-amis-30.vercel.app/mobile-mic/${remoteToken}?study_uid=${study.studyInstanceUID}`} 
                        size={180} 
                        level="H" 
                        includeMargin={false}
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                         <div className="w-10 h-10 bg-white border-4 border-white rounded-lg flex items-center justify-center">
                            <Activity size={24} className="text-[#020408]" />
                         </div>
                      </div>
                    </div>

                    <div className="mt-8 space-y-4 w-full">
                       <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5">
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                          <span className="text-[10px] font-bold text-slate-300">Escanea para conectar micrófono móvil</span>
                       </div>
                       <button 
                         onClick={() => setShowRemoteQR(false)}
                         className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl text-xs font-black uppercase tracking-widest text-white transition-all"
                       >
                         Continuar con Mic Local (F2)
                       </button>
                    </div>
                  </div>
               </motion.div>
             )}
           </AnimatePresence>

           {/* Editor Area */}
           <div className="flex-1 px-16 py-12 relative overflow-hidden flex justify-center">
              
              <div className="w-full max-w-5xl mx-auto flex flex-col gap-5 px-4 pt-6 pb-28 custom-scrollbar overflow-y-auto">
                <div className="flex flex-col gap-2 relative">
                  <span className="text-xs font-black text-cyan-500/50 uppercase tracking-[0.3em] mb-4 block border-b border-white/10 pb-2">
                    INFORME RADIOLÓGICO
                  </span>
                  
                  <div className={`flex flex-col transition-all duration-300 relative ${activeSection === 'technique' ? 'opacity-100' : 'opacity-60 hover:opacity-80'}`}>
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-2">
                       TÉCNICA DE ESTUDIO
                       {activeSection === 'technique' && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
                    </span>
                    <div className="relative w-full h-auto min-h-[60px] text-[18px] leading-[1.7] font-medium font-sans tracking-wide">
                      <div className="absolute inset-0 pointer-events-none whitespace-pre-wrap break-words">
                         {renderDiff(baseSections.technique, sections.technique)}     
                      </div>
                      <textarea
                         ref={sectionRefs.technique}
                         value={sections.technique}
                         onChange={e => setSections(p => ({...p, technique: e.target.value}))}
                         onFocus={() => setActiveSection('technique')}
                         spellCheck={true}
                         lang="es"
                         className="relative w-full h-full min-h-[60px] bg-transparent outline-none resize-none p-0 text-transparent caret-white"
                         placeholder="Describa la técnica..."
                         style={{ color: 'transparent', WebkitTextFillColor: 'transparent' }}
                      />
                    </div>
                  </div>
                  
                  <div className={`flex flex-col transition-all duration-300 mt-8 relative ${activeSection === 'history' ? 'opacity-100' : 'opacity-60 hover:opacity-80'}`}>
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-2">
                       ANTECEDENTES
                       {activeSection === 'history' && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
                    </span>
                    <div className="relative w-full h-auto min-h-[60px] text-[18px] leading-[1.7] font-medium font-sans tracking-wide">
                      <div className="absolute inset-0 pointer-events-none whitespace-pre-wrap break-words">
                         {renderDiff(baseSections.history, sections.history)}
                      </div>
                      <textarea
                         ref={sectionRefs.history}
                         value={sections.history}
                         onChange={e => setSections(p => ({...p, history: e.target.value}))}
                         onFocus={() => setActiveSection('history')}
                         spellCheck={true}
                         lang="es"
                         className="relative w-full h-full min-h-[60px] bg-transparent outline-none resize-none p-0 text-transparent caret-white"
                         placeholder="Indique antecedentes relevantes..."
                         style={{ color: 'transparent', WebkitTextFillColor: 'transparent' }}
                      />
                    </div>
                  </div>
                  
                  <div className={`flex flex-col transition-all duration-300 mt-8 relative ${activeSection === 'findings' ? 'opacity-100' : 'opacity-60 hover:opacity-80'}`}>
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-2">
                       HALLAZGOS
                       {activeSection === 'findings' && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
                    </span>
                    <div className="relative w-full min-h-[160px] text-[18px] leading-[1.7] font-medium font-sans tracking-wide">
                      <div className="absolute inset-0 pointer-events-none whitespace-pre-wrap break-words">
                        {renderDiff(baseSections.findings, sections.findings)}
                      </div>
                      <textarea
                         autoFocus
                         ref={sectionRefs.findings}
                         value={sections.findings}
                         onChange={e => setSections(p => ({...p, findings: e.target.value}))}
                         onFocus={() => setActiveSection('findings')}
                         spellCheck={true}
                         lang="es"
                         className="relative w-full h-full min-h-[160px] bg-transparent outline-none resize-none p-0 text-transparent caret-white"
                         placeholder="Describa los hallazgos principales..."
                         style={{ color: 'transparent', WebkitTextFillColor: 'transparent' }}
                      />
                    </div>
                  </div>

                  <div className={`flex flex-col transition-all duration-300 mt-8 relative ${activeSection === 'impression' ? 'opacity-100' : 'opacity-60 hover:opacity-80'}`}>
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-2">
                       IMPRESIÓN DIAGNÓSTICA
                       {activeSection === 'impression' && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
                    </span>
                    <div className="relative w-full min-h-[120px] text-[18px] leading-[1.7] font-medium font-sans tracking-wide">
                      <div className="absolute inset-0 pointer-events-none whitespace-pre-wrap break-words">
                         {renderDiff(baseSections.impression, sections.impression)}
                      </div>
                      <textarea
                         ref={sectionRefs.impression}
                         value={sections.impression}
                         onChange={e => setSections(p => ({...p, impression: e.target.value}))}
                         onFocus={() => setActiveSection('impression')}
                         spellCheck={true}
                         lang="es"
                         className="relative w-full h-full min-h-[120px] bg-transparent outline-none resize-none p-0 text-transparent caret-white"
                         placeholder="Conclusión del estudio..."
                         style={{ color: 'transparent', WebkitTextFillColor: 'transparent' }}
                      />
                    </div>
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
                                   setSections(aiReviewResults.correctedSections as { technique: string; history: string; findings: string; impression: string; });
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
                      onClick={() => {
                        setBaseSections(sections);
                        setShowPreview(true);
                      }}
                      className="px-6 py-2.5 rounded-xl font-bold text-xs text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-all tracking-widest flex items-center gap-2"
                    >
                      <Eye size={16} /> VISTA PREVIA PDF
                    </button>

                    <button 
                      onClick={() => setIsPendingCenterModalOpen(true)}
                      className="px-6 py-2.5 rounded-xl font-bold text-xs text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all tracking-widest flex items-center gap-2"
                      title="Enviar a Portal B2B para acción del cliente"
                    >
                      <AlertCircle size={16} /> ENVIAR A B2B
                    </button>

                    <button 
                      onClick={() => {
                        setBaseSections(sections);
                        handleUpdateStatus('REPORTED');
                      }}
                      disabled={!isAllFilled || criticalAnswer === null}
                      className="px-6 py-2.5 rounded-xl font-black text-xs text-white bg-blue-500 hover:bg-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] tracking-widest"
                      title={criticalAnswer === null ? "Debe responder la Pausa Clínica" : "Informar Estudio"}
                    >
                      INFORMAR
                    </button>

                    {/* ── DYNAMIC ACTION BUTTONS based on AMIS Role ── */}
                    {canSign ? (
                      /* MED_STAFF / MED_CHIEF → Primary green sign button */
                      <button 
                        onClick={() => {
                          setBaseSections(sections);
                          setShowSignModal(true);
                        }}
                        disabled={!isAllFilled || criticalAnswer === null}
                        className="px-6 py-2.5 rounded-xl font-black text-xs text-black bg-[#39FF14] hover:bg-[#32e612] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(57,255,20,0.3)] hover:shadow-[0_0_20px_rgba(57,255,20,0.5)] tracking-widest flex items-center gap-2"
                        title={criticalAnswer === null ? 'Debe responder la Pausa Clínica' : 'Validar y Firmar como Responsable Legal'}
                      >
                        <CheckCircle2 size={16} /> VALIDAR Y FIRMAR
                      </button>
                    ) : (
                      /* MED_RESIDENT / MED_REQUIRES_COSIGN → Send to supervisor (orange) */
                      <button
                        onClick={async () => {
                          if (!isAllFilled) return;
                          if (criticalAnswer === null) { alert('Debe responder la Pausa Clínica antes de enviar.'); return; }
                          await handleUpdateStatus('PENDING_VALIDATION');
                        }}
                        disabled={!isAllFilled || criticalAnswer === null}
                        className="px-6 py-2.5 rounded-xl font-black text-xs text-black bg-orange-500 hover:bg-orange-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(249,115,22,0.4)] hover:shadow-[0_0_22px_rgba(249,115,22,0.6)] tracking-widest flex items-center gap-2 active:scale-95"
                        title={criticalAnswer === null ? 'Debe responder la Pausa Clínica' : 'Enviar borrador al supervisor para su firma y validación legal'}
                      >
                        <Stethoscope size={16} /> ENVIAR A MI SUPERVISOR
                      </button>
                    )}
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

              {/* Modal Enviar a Pendiente (Portal B2B) */}
              <AnimatePresence>
                  {isPendingCenterModalOpen && (
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
                          className="w-full max-w-lg bg-[#050810] border border-rose-500/20 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(244,63,94,0.2)] flex flex-col"
                        >
                           <div className="p-6 border-b border-white/5 bg-gradient-to-r from-rose-500/10 to-transparent">
                              <div className="flex items-center gap-3 mb-1">
                                 <AlertCircle size={20} className="text-rose-500" />
                                 <span className="text-lg font-black text-white uppercase tracking-tight">Enviar a Pendiente (B2B)</span>
                              </div>
                              <p className="text-xs text-slate-400">Solicitud de acción requerida por parte del Centro Cliente.</p>
                           </div>
                           
                           <div className="p-6 flex flex-col gap-5 bg-white/[0.01]">
                              <div className="flex flex-col gap-2">
                                <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Categoría del Pendiente</label>
                                <select 
                                  value={pendingCenterCategory}
                                  onChange={e => setPendingCenterCategory(e.target.value)}
                                  className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-slate-200 outline-none focus:border-rose-500/50"
                                >
                                   <option value="">Seleccione Categoría...</option>
                                   <option value="Examen incompleto">Examen incompleto</option>
                                   <option value="Faltan antecedentes">Faltan antecedentes</option>
                                   <option value="Imagen corrupta/ilegible">Imagen corrupta / ilegible</option>
                                   <option value="Requiere validación administrativa">Requiere validación administrativa</option>
                                   <option value="Otro">Otro motivo...</option>
                                </select>
                              </div>
                              
                              <div className="flex flex-col gap-2">
                                <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Mensaje para el Cliente</label>
                                <textarea 
                                   value={pendingCenterMessage}
                                   onChange={e => setPendingCenterMessage(e.target.value)}
                                   placeholder="Detalle exactamente qué necesita del centro cliente..."
                                   className="w-full h-32 bg-black border border-white/10 rounded-xl p-4 text-sm text-slate-200 outline-none focus:border-rose-500/50 resize-none font-medium"
                                />
                                <p className="text-[9px] text-slate-600 italic">Este mensaje será visible por el cliente y firmado por: <span className="text-slate-400 font-bold">{currentMedicName}</span></p>
                              </div>
                           </div>

                           <div className="p-5 bg-black border-t border-white/5 flex items-center justify-end gap-3">
                              <button 
                                onClick={() => setIsPendingCenterModalOpen(false)}
                                className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                              >
                                Cancelar
                              </button>
                              <button 
                                onClick={() => handleUpdateStatus('PENDING_CENTER_ACTION')}
                                disabled={!pendingCenterCategory || !pendingCenterMessage}
                                className="px-8 py-2.5 rounded-xl font-black text-sm text-white bg-rose-600 hover:bg-rose-500 transition-all shadow-[0_0_20px_rgba(244,63,94,0.3)] disabled:opacity-30 disabled:cursor-not-allowed group flex items-center gap-2"
                              >
                                <AlertCircle size={16} className="group-hover:rotate-12 transition-transform" /> ENVIAR SOLICITUD
                              </button>
                           </div>
                        </motion.div>
                     </motion.div>
                  )}
              </AnimatePresence>

              {/* Modal de Vista Previa PDF (A4 Simulator) */}
              <AnimatePresence>
                {showPreview && (
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/90 backdrop-blur-md overflow-y-auto"
                  >
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0, y: 30 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.9, opacity: 0, y: 30 }}
                      className="relative w-full max-w-4xl flex flex-col gap-6"
                    >
                      {/* Control Bar */}
                      <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/10 shrink-0">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                            <Printer size={20} />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-white font-black uppercase text-xs tracking-widest">Vista Previa de Informe</span>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Simulación de Impresión A4</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                           <button className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-black tracking-widest text-slate-400 transition-all flex items-center gap-2">
                             <Save size={14} /> GUARDAR PDF
                           </button>
                           <button 
                             onClick={() => setShowPreview(false)}
                             className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg text-[10px] font-black tracking-widest text-rose-500 transition-all flex items-center gap-2"
                           >
                             <X size={14} /> CERRAR
                           </button>
                        </div>
                      </div>

                      {/* Paper Container */}
                      <div 
                        className="bg-white mx-auto shadow-[0_30px_100px_rgba(0,0,0,0.5)] overflow-y-auto custom-scrollbar-paper"
                        style={{ 
                          width: '100%', 
                          maxWidth: '210mm', 
                          aspectRatio: '1 / 1.414',
                          minHeight: '297mm',
                          color: '#1a1a1a',
                          fontFamily: 'Inter, sans-serif'
                        }}
                      >
                         <div className="p-[20mm] flex flex-col h-full">
                            {/* PDF HEADER */}
                            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
                               <div className="flex flex-col">
                                  <div className="flex items-center gap-2 mb-4">
                                     <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white font-black text-xl">P</div>
                                     <div className="flex flex-col">
                                        <span className="text-lg font-black tracking-tighter leading-none italic uppercase">HOLDING PORTEZUELO</span>
                                        <span className="text-[9px] font-bold text-slate-500 tracking-[0.1em] uppercase">Red de Centros Radiológicos</span>
                                     </div>
                                  </div>
                                  <div className="space-y-1">
                                     <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase font-black tracking-widest">
                                        <ClipboardList size={10} /> {study.modality} - {study.enrichedInstitutionName}
                                     </div>
                                     <div className="text-xl font-black tracking-tight text-slate-900">
                                        {study.studyDescription || 'ESTUDIO RADIOLÓGICO'}
                                     </div>
                                  </div>
                               </div>

                               <div className="bg-slate-50 p-4 border border-slate-100 rounded-xl space-y-2 min-w-[200px]">
                                  <div className="flex flex-col">
                                     <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Paciente</span>
                                     <span className="text-xs font-bold text-slate-900">{study.patientFullName}</span>
                                  </div>
                                  <div className="flex gap-4">
                                     <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{study.patientIdLabel || 'RUT'}</span>
                                        <span className="text-[10px] font-mono font-bold text-slate-800">{study.patientId}</span>
                                     </div>
                                     <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Edad</span>
                                        <span className="text-[10px] font-bold text-slate-800">{study.age || '--'}</span>
                                     </div>
                                  </div>
                                  <div className="flex flex-col pt-1">
                                     <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Fecha</span>
                                     <span className="text-[10px] font-bold text-slate-800">{new Date(study.studyDate).toLocaleDateString('es-CL')}</span>
                                  </div>
                               </div>
                            </div>

                            {/* PDF BODY */}
                            <div className="flex-1 space-y-8 text-sm leading-relaxed">
                               {sections.technique && (
                                  <div>
                                     <h3 className="font-black text-xs uppercase tracking-[0.2em] mb-2 text-slate-400 border-l-4 border-slate-200 pl-3">Técnica</h3>
                                     <p className="whitespace-pre-wrap pl-4">{sections.technique}</p>
                                  </div>
                                )}
                                {sections.history && (
                                  <div>
                                     <h3 className="font-black text-xs uppercase tracking-[0.2em] mb-2 text-slate-400 border-l-4 border-slate-200 pl-3">Antecedentes</h3>
                                     <p className="whitespace-pre-wrap pl-4">{sections.history}</p>
                                  </div>
                                )}
                                {sections.findings && (
                                  <div>
                                     <h3 className="font-black text-xs uppercase tracking-[0.2em] mb-2 text-slate-400 border-l-4 border-slate-200 pl-3">Hallazgos</h3>
                                     <p className="whitespace-pre-wrap pl-4 font-medium">{sections.findings}</p>
                                  </div>
                                )}
                                {sections.impression && (
                                  <div className="pt-4 border-t border-slate-100">
                                     <h3 className="font-black text-xs uppercase tracking-[0.2em] mb-2 text-slate-900 flex items-center gap-2">
                                        <CheckCircle2 size={14} className="text-emerald-600" /> Conclusión
                                     </h3>
                                     <p className="whitespace-pre-wrap pl-6 font-bold">{sections.impression}</p>
                                  </div>
                                )}
                            </div>

                            {/* PDF FOOTER (Signatures) */}
                            <div className="mt-12 pt-8 border-t-2 border-slate-900 flex justify-end">
                               <div className="flex flex-col items-center text-center">
                                  {canSign ? (
                                    <>
                                       <div className="w-48 h-20 mb-2 flex items-center justify-center">
                                          {/* Mock Signature Graphics */}
                                          <div className="font-serif italic text-3xl opacity-30 select-none">
                                            {currentMedicName.split(' ').map(n => n[0]).join('')}
                                          </div>
                                       </div>
                                       <div className="w-56 h-px bg-slate-900 mb-2" />
                                       <span className="text-[11px] font-black uppercase tracking-widest">{currentMedicName}</span>
                                       <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Radiólogo Responsable</span>
                                    </>
                                  ) : (
                                    <div className="flex flex-col items-center py-4 border-2 border-dashed border-slate-200 px-8 rounded-2xl bg-slate-50">
                                       <AlertCircle size={20} className="text-amber-500 mb-2" />
                                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PENDIENTE DE VALIDACIÓN</span>
                                       <span className="text-[9px] text-slate-400">Por Jefatura Médica</span>
                                    </div>
                                  )}
                               </div>
                            </div>
                         </div>
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

            {/* Espacio para el Visor Anclado (Docked View - Side by Side) */}
            <AnimatePresence>
               {isViewerDocked && activeAttachment && (
                 <motion.div
                   initial={{ width: 0, opacity: 0 }}
                   animate={{ width: '40%', opacity: 1 }}
                   exit={{ width: 0, opacity: 0 }}
                   transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                   className="border-l border-white/10 bg-[#050810] flex flex-col overflow-hidden z-20 relative shadow-2xl"
                 >
                    <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between shrink-0">
                       <div className="flex items-center gap-2 overflow-hidden">
                          <FileText size={16} className="text-cyan-400 shrink-0" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-white truncate">{activeAttachment.name}</span>
                       </div>
                       <div className="flex items-center gap-1">
                          <button 
                            onClick={() => setIsViewerDocked(false)}
                            className="p-1.5 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition-colors"
                            title="Desanclar / Volver a Flotante"
                          >
                            <Minimize2 size={14} />
                          </button>
                          <button 
                            onClick={() => setActiveAttachment(null)}
                            className="p-1.5 hover:bg-rose-500/10 rounded-md text-slate-400 hover:text-rose-400 transition-colors"
                          >
                            <X size={14} />
                          </button>
                       </div>
                    </div>
                    
                    <div className="flex-1 overflow-hidden relative group bg-black/50">
                       {activeAttachment.type === 'pdf' ? (
                         <iframe 
                           src={`${activeAttachment.url}#view=FitH`} 
                           className="w-full h-full border-0"
                           title={activeAttachment.name}
                         />
                       ) : (
                         <div className="w-full h-full flex items-center justify-center p-4">
                            <img 
                              src={activeAttachment.url} 
                              alt={activeAttachment.name}
                              className="max-w-full max-h-full object-contain drop-shadow-2xl"
                            />
                         </div>
                       )}
                    </div>
                 </motion.div>
               )}
            </AnimatePresence>
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
                     <button 
                       onClick={async () => {
                         setShowSignModal(false);
                         await handleUpdateStatus('VALIDATED');
                       }}
                       className="px-8 py-2.5 rounded-xl font-black text-sm text-[#020408] bg-amber-500 hover:bg-amber-400 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.3)] active:scale-95"
                     >
                       <CheckCircle2 size={16} /> Firmar y Cerrar
                     </button>
                  </div>
               </motion.div>
            </motion.div>
         )}
      </AnimatePresence>

      {/* Modal Visor Ligero de Anexos */}
       <AnimatePresence>
         {activeAttachment && !isViewerDocked && (
            <motion.div 
               drag
               dragMomentum={false}
               initial={{ opacity: 0, scale: 0.9, x: 100, y: 100 }} 
               animate={{ opacity: viewerOpacity, scale: 1 }} 
               exit={{ opacity: 0, scale: 0.9 }}
               style={{ 
                 width: 'max(400px, 50vw)', 
                 height: 'max(300px, 70vh)',
                 position: 'fixed',
                 top: '10%',
                 left: '25%',
               }}
               className="z-[60] bg-[#050810] border border-white/10 rounded-2xl overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.8)] flex flex-col cursor-auto"
               onClick={(e) => e.stopPropagation()}
            >
                {/* Cabecera del Visor Flotante (Handle del Drag) */}
                <div className="p-3 border-b border-white/10 bg-white/5 flex items-center justify-between shrink-0 cursor-move">
                   <div className="flex items-center gap-3">
                      <div className="flex gap-1.5 mr-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500/50" />
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
                      </div>
                      <FileText size={16} className="text-cyan-400" />
                      <h2 className="text-xs font-bold text-white truncate max-w-[200px]">{activeAttachment.name}</h2>
                   </div>
                   
                   <div className="flex items-center gap-2">
                      {/* Control de Opacidad */}
                      <div className="flex items-center gap-2 px-3 border-r border-white/10 mr-1">
                         <span className="text-[10px] text-slate-500 font-bold uppercase">Opacidad</span>
                         <input 
                           type="range" 
                           min="0.2" 
                           max="1" 
                           step="0.1" 
                           value={viewerOpacity}
                           onChange={(e) => setViewerOpacity(parseFloat(e.target.value))}
                           className="w-16 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                         />
                      </div>

                      <div className="flex items-center gap-1">
                         <button 
                           onClick={() => window.open(activeAttachment.url, '_blank')}
                           className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded transition-colors" 
                           title="Abrir en ventana externa (Pop-out)"
                         >
                           <ExternalLink size={14} />
                         </button>
                         <button 
                           onClick={() => setIsViewerDocked(true)}
                           className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded transition-colors" 
                           title="Anclar a la Vista (Side-by-Side)"
                         >
                           <Layout size={14} />
                         </button>
                         <button 
                           onClick={() => setActiveAttachment(null)}
                           className="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded transition-colors ml-1"
                         >
                           <X size={16} />
                         </button>
                      </div>
                   </div>
                </div>

                {/* Toolbar de Visualización */}
                <div className="px-4 py-2 border-b border-white/5 bg-black/40 flex items-center justify-between shrink-0">
                   <div className="flex items-center gap-1">
                      <button onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.25))} className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded transition-colors">
                        <ZoomOut size={13} />
                      </button>
                      <span className="text-[10px] font-mono text-slate-400 w-8 text-center">{Math.round(zoomLevel * 100)}%</span>
                      <button onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.25))} className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded transition-colors">
                        <ZoomIn size={13} />
                      </button>
                   </div>
                   
                   <div className="flex items-center gap-1">
                      <button onClick={() => setRotation(prev => (prev + 90) % 360)} className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded transition-colors" title="Rotar 90º">
                        <RotateCw size={13} />
                      </button>
                      <a 
                        href={activeAttachment.url}
                        download
                        className="flex items-center gap-1.5 text-[9px] uppercase font-bold tracking-widest text-cyan-400 hover:text-cyan-300 transition-colors px-3 py-1.5 bg-cyan-500/10 rounded-md ml-2"
                      >
                         <Save size={11} /> Descargar
                      </a>
                   </div>
                </div>
                
                {/* Contenedor del Archivo */}
                <div id="annex-viewer-container" className="flex-1 bg-black/80 flex flex-col items-center justify-center relative overflow-hidden">
                   {activeAttachment.type === 'image' && (
                      <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
                         <img 
                           src={activeAttachment.url} 
                           alt={activeAttachment.name}
                           style={{ 
                             transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                             transition: 'transform 0.2s ease-out'
                           }}
                           className="max-w-full max-h-full object-contain drop-shadow-2xl z-10"
                         />
                      </div>
                   )}
                   {activeAttachment.type === 'pdf' && (
                      <div className="w-full h-full flex items-center justify-center bg-white/90">
                         <iframe 
                           src={`${activeAttachment.url}#view=FitH&zoom=${zoomLevel * 100}`} 
                           className="w-full h-full border-0"
                           title={activeAttachment.name}
                         />
                      </div>
                   )}
                </div>
             </motion.div>
         )}
      </AnimatePresence>

    </motion.div>
  );
}
