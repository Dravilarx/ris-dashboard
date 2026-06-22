"use client";

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
  SortingState,
  VisibilityState,
  ColumnSizingState,
  ColumnResizeMode
} from '@tanstack/react-table';
import { 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  Monitor,
  ClipboardList,
  Search,
  Activity,
  Layers,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  RefreshCcw,
  Stethoscope,
  FolderOpen,
  Shield,
  BarChart2,
  Atom,
  GraduationCap,
  X,
  SlidersHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Study, EnrichedStudy } from '@/types/ris';
import { useDiagnosis } from '@/components/providers/DiagnosisProvider';
import { supabase } from '@/lib/supabase';
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function formatSafeTime(value: unknown): string {
  const d = new Date(value as string);
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

function DraggableTableHeader({ header }: { header: any }) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } =
    useSortable({ id: header.column.id });

  const style: React.CSSProperties = {
    opacity: isDragging ? 0.8 : 1,
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 20 : 0,
    backgroundColor: isDragging ? 'rgba(0,10,20,0.8)' : '',
    position: 'relative',
    width: header.getSize(),
    minWidth: header.getSize(),
  };

  return (
    <th
      ref={setNodeRef}
      style={style}
      className={cn(
        "px-6 py-4 text-[11px] font-black text-text-muted uppercase tracking-[0.2em] border-b border-white/5 whitespace-nowrap",
        isDragging && "shadow-2xl border border-accent rounded-xl bg-accent/5 backdrop-blur-md"
      )}
    >
      <div className="flex items-center gap-2">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-white/20 hover:text-white/60 transition-colors p-1 rounded hover:bg-white/5 focus:outline-none focus:ring-1 focus:ring-accent/50 z-10">
          <Layers size={14} />
        </button>
        <div className="flex-1 cursor-pointer select-none" onClick={header.column.getToggleSortingHandler()}>
          {flexRender(header.column.columnDef.header, header.getContext())}
        </div>
        {header.column.getIsSorted() && (header.column.getIsSorted() === 'asc' ? <ChevronUp size={14} className="text-accent" /> : <ChevronDown size={14} className="text-accent" />)}
      </div>
      {/* Resize handle */}
      {header.column.getCanResize() && (
        <div
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none touch-none group/resize ${
            header.column.getIsResizing() ? 'bg-cyan-400/60' : 'bg-transparent hover:bg-cyan-400/30'
          } transition-colors`}
          style={{ userSelect: 'none' }}
        />
      )}
    </th>
  );
}

/** SLA Indicator Component with Traffic Light Logic */
const calculateElapsed = (studyDate: Date) => {
  // FIX QA: Usa fecha ficticia para simular que todos los estudios históricos sucedieron "Hoy"
  const now = new Date();
  const originalDate = new Date(studyDate);
  if (isNaN(originalDate.getTime())) return 0;

  const fictitiousDbDate = new Date();
  fictitiousDbDate.setHours(originalDate.getHours(), originalDate.getMinutes(), 0, 0);

  // Si la hora original es mayor a la hora actual (ej. estudio 23:00, pero son las 10:00),
  // restamos 1 día para que el tiempo sea positivo y realista.
  if (fictitiousDbDate.getTime() > now.getTime()) {
    fictitiousDbDate.setDate(fictitiousDbDate.getDate() - 1);
  }

  return Math.floor(Math.abs(now.getTime() - fictitiousDbDate.getTime()) / 60000);
};

const SLABadge: React.FC<{ 
  studyDate: Date, 
  urgency: string,
  normalMins: number,
  urgentMins: number,
  critMins: number
}> = ({ studyDate, urgency, normalMins, urgentMins, critMins }) => {
  const [elapsed, setElapsed] = useState(() => calculateElapsed(studyDate));
  
  useEffect(() => {
    const timer = setInterval(() => setElapsed(calculateElapsed(studyDate)), 60000);
    return () => clearInterval(timer);
  }, [studyDate]);

  let color = "bg-emerald-500";
  let label = "Normal";
  
  // Lógica dinámica de Semáforo basada en el Cerebro Administrativo (AMIS 3.0)
  // AMIS 3.0 provée exactamente los minutos correctos basándose en la categoría clínica y modalidad
  const limitCritical = critMins;
  const limitUrgent = urgentMins;

  if (elapsed >= limitCritical) { 
    color = "bg-rose-500 animate-pulse shadow-[0_0_12px_rgba(244,63,94,0.4)]"; 
    label = "CRÍTICO"; 
  } else if (elapsed > limitUrgent) { 
    color = "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]"; 
    label = "ALERTA"; 
  }

  const formatElapsed = (totalMinutes: number) => {
    if (totalMinutes === 0) return 'Reciente';
    const d = Math.floor(totalMinutes / 1440);
    const h = Math.floor((totalMinutes % 1440) / 60);
    const m = totalMinutes % 60;
    
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0 || parts.length === 0) parts.push(`${m}m`);
    
    return parts.join(' ');
  };

  return (
    <div className="flex items-center gap-3">
      <div className={cn("w-2.5 h-2.5 rounded-full", color)} />
      <div className="flex flex-col">
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted/60">{label}</span>
        <span className="text-[10px] font-mono font-bold text-white/80">{formatElapsed(elapsed)} transcurridos</span>
      </div>
    </div>
  );
};

const columnHelper = createColumnHelper<EnrichedStudy>();

export default function WorklistTable({ data }: { data: EnrichedStudy[] }) {
  const { mode, toggleHighContrast } = useDiagnosis();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [eduExportStudyId, setEduExportStudyId] = useState<number | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  
  // ── Column Visibility & Sizing (with localStorage persistence) ────────────
  const STORAGE_KEY_VIS = 'amis_col_visibility_v1';
  const STORAGE_KEY_SZ  = 'amis_col_sizing_v1';
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window === 'undefined') return {};
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_VIS) || '{}'); } catch { return {}; }
  });
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => {
    if (typeof window === 'undefined') return {};
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_SZ) || '{}'); } catch { return {}; }
  });
  const [showColMenu, setShowColMenu] = useState(false);
  const columnResizeMode: ColumnResizeMode = 'onChange';

  // Persist visibility and sizing whenever they change
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_VIS, JSON.stringify(columnVisibility)); } catch {}
  }, [columnVisibility]);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_SZ, JSON.stringify(columnSizing)); } catch {}
  }, [columnSizing]);
  // Estado de disponibilidad del Visor DICOM MedDream
  const [meddreamToast, setMeddreamToast] = useState<'idle' | 'opening' | 'unavailable'>('idle');
  const router = useRouter();

  // ─── AMIS ROLE SYSTEM (demo switcher — replace with auth session in prod) ───────
  type AmisRole = 'MED_STAFF' | 'MED_CHIEF' | 'MED_RESIDENT' | 'MED_REQUIRES_COSIGN' | 'ADMIN_SECRETARY';
  const [currentRole, setCurrentRole] = useState<AmisRole>('MED_STAFF');
  const canSupervise = currentRole === 'MED_STAFF' || currentRole === 'MED_CHIEF';

  // ─── WORKLIST TABS ──────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'worklist' | 'supervision'>('worklist');

  // Pending cosign studies (in prod: query v_supervision_inbox where pending_cosign_by_id = currentUser.id)
  type CosignItem = { id: string; paciente_nombre: string; modalidad: string; draft_author_name: string; accession_number: string; examen_nombre: string; };
  const [pendingCosign, setPendingCosign] = useState<CosignItem[]>([]);

  useEffect(() => {
    if (!canSupervise) return;
    supabase
      .from('v_supervision_inbox')
      .select('id, paciente_nombre, modalidad, draft_author_name, accession_number, examen_nombre')
      .then(({ data: rows }) => {
        if (rows) setPendingCosign(rows as CosignItem[]);
      });

    const ch = supabase
      .channel('supervision-inbox-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'multiris_production' }, async () => {
        const { data: rows } = await supabase.from('v_supervision_inbox').select('id, paciente_nombre, modalidad, draft_author_name, accession_number, examen_nombre');
        if (rows) setPendingCosign(rows as CosignItem[]);
      }).subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [canSupervise]);

  // ─── ADDENDUM REALTIME SCANNER ───────────────────────────────────────────
  // Maps studyInstanceUID → addendum request_text for pending requests
  const [pendingAddendums, setPendingAddendums] = useState<Record<string, string>>({});

  // Mock current user for demo (In prod: get from auth context)
  const currentMedicName = 'DR. MARCELO AVILA';

  const fetchPendingAddendums = useCallback(async () => {
    // Inicia una suscripción de Supabase a la tabla addendum_requests filtrando por médicos asignados o pendientes de triage
    const { data: rows, error } = await supabase
      .from('addendum_requests')
      .select('study_uid, request_text, requester_name, status')
      .in('status', ['TRIAGE_PENDING', 'ASSIGNED_TO_MEDIC']);

    if (error) { console.error('[Addendum Scanner]', error); return; }

    const map: Record<string, string> = {};
    rows?.forEach(r => {
      // Alerta UI para el Radiólogo:
      // Si el status es ASSIGNED_TO_MEDIC y coincide con el ID del radiólogo logueado
      const isForMe = r.status === 'ASSIGNED_TO_MEDIC' &&
                      r.requester_name?.toUpperCase() === currentMedicName.toUpperCase();

      // O si soy secretaria y está pendiente de triage
      const isForSecretary = r.status === 'TRIAGE_PENDING' && currentRole === 'ADMIN_SECRETARY';

      if (isForMe || isForSecretary) {
        map[r.study_uid] = r.request_text;
      }
    });
    setPendingAddendums(map);
  }, [currentRole]);

  useEffect(() => {
    fetchPendingAddendums();

    const channel = supabase
      .channel('addendum-worklist-scanner')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'addendum_requests' },
        () => fetchPendingAddendums()
      )
      .subscribe();

    // Web Push Notification for recovered studies
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }

    const studyChannel = supabase
      .channel('ready-status-scanner')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'multiris_production' }, (payload) => {
          const oldStatus = payload.old?.status;
          const newStatus = payload.new?.status;
          // Asumiendo que READY es 'REPORTING' or 'PENDING_VALIDATION' etc, 
          // Ajustado al modelo de 'PAUSA' -> vuelve a estado operable:
          if (oldStatus === 'PENDING_CENTER_ACTION' && newStatus !== 'PENDING_CENTER_ACTION') {
              if ('Notification' in window && Notification.permission === 'granted') {
                 const pacName = payload.new?.paciente_nombre || 'Desconocido';
                 new Notification('Retorno Prioritario', {
                    body: `Estudio de ${pacName} listo para reportar (recuperado de Pausa).`,
                    icon: '/favicon.ico'
                 });
              }
          }
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(channel); 
      supabase.removeChannel(studyChannel);
    };
  }, [fetchPendingAddendums]);
  // ─────────────────────────────────────────────────────────────────────────

  const handleDeriveToSeshat = async () => {
    const study = data?.find(s => s.id === selectedId);
    if (!study) return;

    try {
      const { error } = await supabase.from('oncology_evaluations').insert({
        external_ref_id: study.accessionNumber,
        patient_id: study.effectivePatientId,
        institution_id: study.institutionId,
        origin: 'multiverse',
        status: 'pending_analysis'
      });

      if (error) {
        console.error('[SESHAT Integration] Error:', error);
        alert('Error al derivar a SESHAT: ' + error.message);
      } else {
        alert('Estudio derivado exitosamente al Comité Oncológico (SESHAT).');
      }
    } catch (err) {
      console.error('[SESHAT Integration] Exception:', err);
      alert('Error en conexión: ' + (err as Error).message);
    }
  };

  const handleDeriveToEdu = async (target: string) => {
    if (eduExportStudyId === null) return;
    const study = data?.find(s => s.id === eduExportStudyId);
    if (!study) return;

    try {
      const { error } = await supabase.from('educational_resources').insert({
        age: study.age,
        sex: study.sex,
        modality: study.modality,
        description: study.studyDescription,
        target_collection: target
      });

      if (error) {
        alert('Error al exportar: ' + error.message);
      } else {
        alert(`Exportado exitosamente a ${target} (Datos anonimizados correctamente)`);
        setEduExportStudyId(null);
      }
    } catch (e) {
      alert('Excepción: ' + (e as Error).message);
    }
  };

  const handleStartDiagnosis = () => {
    const study = data?.find(s => s.id === selectedId);
    if (!study) return;

    // ─── VISOR DICOM (MedDream) ──────────────────────────────────────────────
    // Intentar abrir MedDream en Monitor 2. Si no está disponible (puerto 8080
    // sin servidor), el popup simplemente fallará — NO bloqueamos la navegación.
    const studyUID = study.studyInstanceUID || study.accessionNumber;
    const meddreamUrl = `http://localhost:8080/meddream/?study=${studyUID}`;
    console.log(`[MedDream] Intentando abrir visor DICOM: ${meddreamUrl}`);

    setMeddreamToast('opening');

    // Intentar detectar si MedDream responde antes de abrir la ventana
    fetch('http://localhost:8080/', { mode: 'no-cors', signal: AbortSignal.timeout(2000) })
      .then(() => {
        // MedDream parece disponible — abrir en Monitor 2
        const windowFeatures = 'menubar=no,location=no,resizable=yes,scrollbars=yes,status=no,width=1920,height=1080';
        window.open(meddreamUrl, 'MedDream_Monitor2', windowFeatures);
        setMeddreamToast('idle');
      })
      .catch(() => {
        // MedDream no disponible — notificar pero continuar al informe
        console.warn('[MedDream] Visor DICOM no disponible en localhost:8080');
        setMeddreamToast('unavailable');
        setTimeout(() => setMeddreamToast('idle'), 5000);
      });

    // Siempre navegar al panel de informe (Monitor 1)
    // No esperar MedDream para no bloquear el flujo del radiólogo
    if (study.studyInstanceUID) {
      router.push(`/informe/${study.studyInstanceUID}`);
    } else {
      console.error('[MedDream] studyInstanceUID no disponible para el estudio', study.id);
      setMeddreamToast('unavailable');
    }
  };

  // ─── PRIORIDAD DE RETORNO: estudios resueltos por el centro saltan al tope ───
  const sortedData = useMemo(() => {
    if (!data) return [];
    const returnStudies = data.filter(s => s.isHighPriorityReturn);
    const rest = data.filter(s => !s.isHighPriorityReturn);
    return [...returnStudies, ...rest];
  }, [data]);

  // ─── MAPA DE HISTORIAL PREVIO: detecta pacientes con estudios anteriores ─
  const patientsWithHistory = useMemo(() => {
    const seen = new Set<string>();
    const withHistory = new Set<string>();
    (data || []).forEach(s => {
      const pid = s.effectivePatientId || s.patientId;
      if (seen.has(pid)) { withHistory.add(pid); }
      seen.add(pid);
    });
    return withHistory;
  }, [data]);

    const columns = useMemo(() => [
    columnHelper.accessor('patientFullName', {
      id: 'patientFullName',
      header: 'PACIENTE / IDENTIDAD',
      cell: info => {
        const study = info.row.original;
        const effectiveId = study.effectivePatientId || study.patientId;
        const idLabel = study.patientIdLabel || 'RUT';
        const hasHistory = patientsWithHistory.has(effectiveId);
        const idSource = study.patientIdSource;
        return (
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black tracking-tight uppercase leading-tight text-white/90">{String(info.getValue())}</span>
              {hasHistory && (
                <span title="Paciente con estudios previos" className="text-cyan-400/70 hover:text-cyan-300 transition-colors shrink-0">
                  <FolderOpen size={13} />
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
               <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                 idSource === 'NUM_COBRE' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                 idSource === 'EXTERNAL_ID' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' :
                 'bg-white/5 border-white/5 text-text-muted'
               }`}>
                 {idLabel}: {effectiveId}
               </span>
               <span className="text-[10px] text-text-muted font-bold opacity-40 italic">{study.age} • {study.sex}</span>
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor('enrichedInstitutionName', {
      id: 'institutionName',
      header: 'INSTITUCIÓN',
      cell: info => <span className="text-[11px] font-bold text-white/80 uppercase truncate max-w-[150px] inline-block" title={String(info.getValue())}>{String(info.getValue())}</span>,
    }),
    columnHelper.accessor('urgencyType', {
      id: 'urgencyType',
      header: 'ATENCIÓN',
      cell: info => {
        const val = String(info.getValue()) || 'AMBULATORIO';
        const isUrgent = val.toLowerCase().includes('urg');
        return (
          <span className={cn(
            "text-[10px] font-black tracking-wider uppercase px-2 py-1 rounded",
            isUrgent ? "bg-rose-500/10 text-rose-400" : "bg-white/5 text-text-muted"
          )}>
            {val}
          </span>
        );
      },
    }),
    columnHelper.accessor('studyDate', {
      id: 'studyDate',
      header: 'FECHA TIEMPO 0',
      sortingFn: 'datetime',
      cell: info => (
        <div className="flex flex-col">
          <span className="text-[11px] font-black text-white/60">
            HOY
          </span>
          <span className="text-[10px] font-mono text-text-muted">
            {formatSafeTime(info.getValue())}
          </span>
        </div>
      ),
    }),
    columnHelper.accessor('id' as any, {
       id: 'id',
       header: 'TIEMPO REAL',
       cell: info => <SLABadge 
         studyDate={info.row.original.studyDate} 
         urgency={info.row.original.urgencyType} 
         normalMins={info.row.original.expectedSLANormalMinutes}
         urgentMins={info.row.original.expectedSLAUrgentMinutes}
         critMins={info.row.original.expectedSLACriticalMinutes}
       />,
    }),
    columnHelper.accessor('studyDescription', {
      id: 'studyDescription',
      header: 'DESCRIPCIÓN',
      cell: info => (
        <div className="flex flex-col">
          <span className="text-[11px] font-bold text-white/80 uppercase truncate max-w-[200px]" title={String(info.getValue())}>
            {String(info.getValue())}
          </span>
          <div className="flex mt-1">
             <span className="px-1.5 py-[1px] rounded bg-accent/20 border border-accent/20 text-accent font-black text-[9px] tracking-widest shadow-inner inline-block">
               {info.row.original.modality}
             </span>
          </div>
        </div>
      ),
    }),
    columnHelper.accessor('enrichedRadiologistName', {
      id: 'requestingPhysician',
      header: 'MÉDICO',
      cell: info => <span className="text-[10px] uppercase font-bold text-text-muted truncate max-w-[120px] inline-block" title={String(info.getValue())}>{String(info.getValue()) || 'NO ASIGNADO'}</span>,
    }),
  ], []);

  // Persistent column order loading
  useEffect(() => {
    const savedOrder = localStorage.getItem('ris_worklist_column_order');
    if (savedOrder) {
      setColumnOrder(JSON.parse(savedOrder));
    } else {
      setColumnOrder(columns.map(c => c.id as string));
    }
  }, [columns]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setColumnOrder((order) => {
        const oldIndex = order.indexOf(active.id as string);
        const newIndex = order.indexOf(over.id as string);
        const newOrder = arrayMove(order, oldIndex, newIndex);
        localStorage.setItem('ris_worklist_column_order', JSON.stringify(newOrder));
        return newOrder;
      });
    }
  };

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const table = useReactTable({
    data: sortedData,
    columns,
    columnResizeMode,
    state: { sorting, globalFilter, columnOrder, columnVisibility, columnSizing },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableColumnResizing: true,
  });

  return (
    <div className={cn(
      "w-full h-full flex flex-col transition-all duration-700 relative overflow-hidden",
      mode === 'high-contrast' ? "bg-black brightness-[1.1] contrast-[1.2]" : "bg-transparent"
    )}>
      {/* ─── TOAST DE ESTADO MEDDREAM ─────────────────────────────────────── */}
      <AnimatePresence>
        {meddreamToast !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`absolute top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl border text-xs font-bold shadow-2xl backdrop-blur-xl ${
              meddreamToast === 'opening'
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}
          >
            <Monitor size={14} className={meddreamToast === 'opening' ? 'animate-pulse' : ''} />
            {meddreamToast === 'opening'
              ? 'Conectando con Visor DICOM...'
              : 'Visor DICOM no disponible. Continuando en modo dictado.'}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Search & Tool Bar - Glassmorphism Refined */}
      <div className="p-4 bg-white/[0.02] backdrop-blur-2xl border-b border-white/10 flex justify-between items-center z-50">
        <div className="flex items-center gap-6 flex-1 max-w-2xl text-left">
           <div className="relative flex-1 group">
             <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent transition-colors" />
             <input 
               value={globalFilter ?? ''}
               onChange={e => setGlobalFilter(e.target.value)}
               placeholder="Búsqueda instantánea por RUT, Nombre o Acceso..."
               className="w-full bg-white/5 border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-text-muted/40 focus:outline-none focus:border-accent/40 focus:bg-white/[0.08] transition-all"
             />
           </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={toggleHighContrast}
            className={cn(
              "px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all border",
              mode === 'high-contrast' ? "bg-accent text-background border-accent" : "bg-white/5 border-white/5 text-text-muted hover:bg-white/10"
            )}
          >
            <Layers size={14} /> DIAGNÓSTICO {mode === 'high-contrast' ? 'ON' : 'OFF'}
          </button>
          <div className="h-6 w-[1px] bg-white/10 mx-2" />
          {/* Column settings button */}
          <div className="relative">
            <button
              onClick={() => setShowColMenu(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                showColMenu ? 'bg-violet-500/15 text-violet-300 border-violet-500/30' : 'bg-white/5 border-white/5 text-text-muted hover:bg-white/10 hover:text-white'
              }`}
              title="Ajustar columnas visibles"
            >
              <SlidersHorizontal size={14} /> Columnas
            </button>
            {showColMenu && (
              <div className="absolute right-0 top-full mt-2 z-[200] bg-[#050810] border border-white/10 rounded-2xl shadow-2xl p-3 min-w-[200px] backdrop-blur-xl">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">Visibilidad de columnas</p>
                {table.getAllLeafColumns().map(col => (
                  <label key={col.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer group">
                    <div
                      onClick={() => col.toggleVisibility()}
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0 ${
                        col.getIsVisible()
                          ? 'bg-cyan-500 border-cyan-500'
                          : 'bg-transparent border-white/20 group-hover:border-white/40'
                      }`}
                    >
                      {col.getIsVisible() && <span className="text-black text-[8px] font-black">✓</span>}
                    </div>
                    <span className="text-[10px] text-slate-300 font-semibold capitalize">
                      {typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id}
                    </span>
                  </label>
                ))}
                <button
                  onClick={() => { setColumnVisibility({}); setColumnSizing({}); }}
                  className="mt-2 w-full py-1.5 rounded-lg text-[9px] font-black text-slate-500 hover:text-white hover:bg-white/5 transition-all uppercase tracking-widest"
                >
                  Restablecer todo
                </button>
              </div>
            )}
          </div>
          <div className="flex gap-1">
             <button className="p-2 text-text-muted hover:text-white transition-colors"><Activity size={18} /></button>
          </div>
        </div>
      </div>

      {/* ═══ TAB BAR + ROLE DEMO SWITCHER ═══ */}
      <div className="flex items-center border-b border-white/10 bg-white/[0.01]">
        <button
          onClick={() => setActiveTab('worklist')}
          className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${
            activeTab === 'worklist'
              ? 'text-cyan-400 border-cyan-400'
              : 'text-slate-500 border-transparent hover:text-slate-300'
          }`}
        >
          Worklist Activo
        </button>
        {canSupervise && (
          <button
            onClick={() => setActiveTab('supervision')}
            className={`relative px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${
              activeTab === 'supervision'
                ? 'text-amber-400 border-amber-400'
                : 'text-slate-500 border-transparent hover:text-amber-300'
            }`}
          >
            Pendientes de mi Firma
            {pendingCosign.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-[9px] font-black text-black animate-pulse">
                {pendingCosign.length}
              </span>
            )}
          </button>
        )}
        {currentRole === 'MED_CHIEF' && (
          <button
            onClick={() => setActiveTab('torre-control' as any)}
            className={`relative px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 flex items-center gap-2 ${
              activeTab === ('torre-control' as any)
                ? 'text-violet-400 border-violet-400'
                : 'text-slate-500 border-transparent hover:text-violet-300'
            }`}
          >
            <Shield size={12} /> Torre de Control
          </button>
        )}
        {/* DEV role switcher — replace with auth session in prod */}
        <div className="ml-auto flex items-center gap-2 px-4">
          <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">ROL:</span>
          <select
            value={currentRole}
            onChange={e => { setCurrentRole(e.target.value as AmisRole); setActiveTab('worklist'); }}
            className="text-[9px] bg-slate-900 border border-white/10 text-cyan-400 rounded px-2 py-1 font-black uppercase outline-none"
          >
            <option value="MED_STAFF">MED_STAFF</option>
            <option value="MED_CHIEF">MED_CHIEF</option>
            <option value="MED_RESIDENT">MED_RESIDENT</option>
            <option value="MED_REQUIRES_COSIGN">COSIGN</option>
            <option value="ADMIN_SECRETARY">SECRETARÍA</option>
          </select>
        </div>
      </div>

      {/* ═══ SUPERVISION INBOX (Staff / Chief only) ═══ */}
      <AnimatePresence mode="wait">
        {activeTab === 'supervision' && canSupervise && (
          <motion.div
            key="supervision-panel"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex-1 overflow-auto p-6 space-y-3"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <AlertTriangle size={16} className="text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white tracking-tight">Supervisión de Borradores</h3>
                <p className="text-[10px] text-slate-500">Informes de residentes que requieren tu firma para ser legalmente emitidos.</p>
              </div>
            </div>

            {pendingCosign.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-30">
                <AlertTriangle size={40} className="text-amber-400 mb-3" />
                <p className="text-sm font-bold text-slate-400">Sin informes pendientes de firma</p>
              </div>
            ) : (
              pendingCosign.map(item => (
                <motion.div
                  key={item.id}
                  layout
                  className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 hover:border-amber-400/40 hover:bg-amber-500/10 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-sm font-black text-white tracking-tight">{item.paciente_nombre}</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-mono bg-white/5 px-2 py-0.5 rounded text-slate-400">{item.accession_number}</span>
                        <span className="text-[9px] font-bold uppercase text-cyan-400 tracking-widest">{item.modalidad}</span>
                        <span className="text-[9px] text-slate-500 truncate max-w-[200px]">{item.examen_nombre}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[9px] text-amber-400/70 font-bold uppercase tracking-widest">Borrador por:</span>
                        <span className="text-[9px] font-black text-amber-300">{item.draft_author_name || 'Residente'}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => router.push(`/informe/${item.accession_number}?cosign=true`)}
                      className="shrink-0 ml-4 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-[10px] font-black text-black uppercase tracking-widest flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all active:scale-95"
                    >
                      <CheckCircle2 size={12} /> Revisar y Firmar
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        )}

        {/* ══════ TORRE DE CONTROL — MED_CHIEF EXCLUSIVE ══════ */}
        {activeTab === ('torre-control' as any) && currentRole === 'MED_CHIEF' && (
          <motion.div
            key="torre-control-panel"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex-1 overflow-auto p-6 space-y-4"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
                <Shield size={16} className="text-violet-400" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white tracking-tight">Torre de Control — Jefatura</h3>
                <p className="text-[10px] text-slate-500">Visibilidad total: trazabilidad de reasignaciones, auditoría de estados y supervisión clínica.</p>
              </div>
            </div>

            {/* Tabla de trazabilidad */}
            <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 overflow-hidden">
              <div className="px-4 py-2 border-b border-violet-500/20 flex items-center gap-2">
                <BarChart2 size={12} className="text-violet-400" />
                <span className="text-[9px] font-black uppercase tracking-widest text-violet-400">Trazabilidad de Reasignaciones (últimas 24h)</span>
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5">
                    {['Paciente', 'Examen', 'Reasignado por', 'Receptor', 'Hora', 'Estado'].map(h => (
                      <th key={h} className="px-4 py-2 text-[8px] font-black uppercase tracking-widest text-slate-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { patient: 'DÍAZ MONTOYA, R.', exam: 'TAC CEREBRO', from: 'Dr. Avila', to: 'Dr. Matta', time: '09:14', status: 'INFORMADO' },
                    { patient: 'CAMPOS VERA, L.', exam: 'RM COLUMNA LS', from: 'Sec. Rojas', to: 'Dr. Avila', time: '10:32', status: 'EN PROCESO' },
                    { patient: 'TORRES, M.A.', exam: 'RX TÓRAX PA', from: 'Sistema', to: 'Dr. Matta', time: '11:05', status: 'PENDIENTE' },
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors">
                      <td className="px-4 py-2.5 text-[11px] font-bold text-white/80 uppercase">{row.patient}</td>
                      <td className="px-4 py-2.5 text-[10px] text-slate-400">{row.exam}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-[9px] font-black text-amber-400">{row.from}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-[9px] font-black text-cyan-400">{row.to}</span>
                      </td>
                      <td className="px-4 py-2.5 text-[10px] font-mono text-slate-500">{row.time}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn(
                          "text-[8px] font-black uppercase px-2 py-0.5 rounded-full border",
                          row.status === 'INFORMADO' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                          row.status === 'EN PROCESO' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                          'bg-slate-500/10 border-slate-500/20 text-slate-400'
                        )}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Resumen ejecutivo */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Informados hoy', value: '23', color: 'emerald', icon: '✅' },
                { label: 'En proceso', value: '7', color: 'blue', icon: '🔵' },
                { label: 'Pendientes B2B', value: '2', color: 'amber', icon: '⚠️' },
              ].map(stat => (
                <div key={stat.label} className={`p-4 rounded-2xl bg-${stat.color}-500/5 border border-${stat.color}-500/20`}>
                  <div className="text-2xl font-black text-white">{stat.icon} {stat.value}</div>
                  <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'worklist' && (
          <motion.div
            key="worklist-table"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 overflow-auto scrollbar-hide"
          >

        <DndContext
          collisionDetection={closestCenter}
          modifiers={[restrictToHorizontalAxis]}
          onDragEnd={handleDragEnd}
          sensors={sensors}
        >
          <table className="w-full border-separate border-spacing-0 text-left">
            <thead className="sticky top-0 bg-[#020408]/90 backdrop-blur-sm z-40 border-b border-white/10">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  <SortableContext
                    items={columnOrder}
                    strategy={horizontalListSortingStrategy}
                  >
                    {headerGroup.headers.map(header => (
                      <DraggableTableHeader key={header.id} header={header} />
                    ))}
                  </SortableContext>
                </tr>
              ))}
            </thead>
          <tbody>
            <AnimatePresence mode='popLayout'>
              {table.getRowModel().rows.length > 0 ? table.getRowModel().rows.map(row => {
                const studyUID = row.original.studyInstanceUID;
                const hasPendingAddendum = studyUID && pendingAddendums[studyUID];
                return (
                <motion.tr 
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={row.id} 
                  onClick={() => setSelectedId(row.original.id)}
                  className={cn(
                    "group transition-all duration-300 cursor-pointer border-l-4",
                    selectedId === row.original.id 
                      ? "bg-cyan-900/10 border-cyan-400 outline outline-1 outline-cyan-500/30 shadow-[inset_0_0_20px_rgba(6,182,212,0.05)]" 
                      : row.original.isHighPriorityReturn
                        ? "bg-amber-950/40 border-amber-400 shadow-[inset_0_0_30px_rgba(245,158,11,0.08)] animate-[pulse_4s_ease-in-out_infinite]"
                        : hasPendingAddendum
                          ? "bg-rose-950/30 border-rose-500 hover:bg-rose-950/50 shadow-[inset_0_0_20px_rgba(244,63,94,0.05)]"
                          : "hover:bg-white/[0.04] border-transparent outline-transparent"
                  )}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className={cn(
                      "px-6 py-4 border-b border-white/[0.03] align-middle",
                      row.original.isHighPriorityReturn && "bg-amber-400/5"
                    )}>
                      {/* Inject addendum/priority badge in the patient column */}
                      {cell.column.id === 'patientFullName' && (hasPendingAddendum || row.original.isHighPriorityReturn) ? (
                        <div className="flex flex-col gap-1.5">
                          <div className={cn(
                            "group-hover:translate-x-1 transition-transform duration-300",
                            row.original.isHighPriorityReturn && "font-black"
                          )}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {hasPendingAddendum && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 text-[9px] font-black uppercase tracking-widest animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.3)]">
                                <AlertTriangle size={9} className="shrink-0" />
                                ⚠️ ADDENDUM Requerido
                              </span>
                            )}
                            {row.original.isHighPriorityReturn && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[9px] font-black uppercase tracking-widest animate-[pulse_2s_infinite] shadow-[0_0_8px_rgba(245,158,11,0.3)]">
                                <RefreshCcw size={9} className="shrink-0" />
                                RETORNADO / ALTA PRIORIDAD
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        flexRender(cell.column.columnDef.cell, cell.getContext())
                      )}
                    </td>
                  ))}
                </motion.tr>
                );
              }) : (
                <tr>
                  <td colSpan={5} className="py-20 text-center animate-pulse">
                    <div className="flex flex-col items-center gap-4 opacity-20">
                      <ClipboardList size={64} />
                      <span className="text-sm font-black uppercase tracking-[0.5em]">Sin estudios disponibles para este periodo</span>
                    </div>
                  </td>
                </tr>
              )}
            </AnimatePresence>
          </tbody>
        </table>
        </DndContext>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected Action Bar Footer */}
      <AnimatePresence>
        {selectedId && (
          <motion.div 
            initial={{ y: '100%' }} 
            animate={{ y: 0 }} 
            exit={{ y: '100%' }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute bottom-0 left-0 right-0 p-4 bg-[#050810]/95 backdrop-blur-xl border-t border-white/10 text-white flex justify-between items-center shadow-[0_-20px_50px_rgba(0,0,0,0.5)] z-[100]"
          >
            <div className="flex items-center gap-4">
               {/* Modalidad Icon */}
               <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-center min-w-12">
                 <span className="font-black text-xs text-white/50">{data.find(s => s.id === selectedId)?.modality || 'US'}</span>
               </div>
               <div className="flex flex-col">
                 <span className="text-sm font-black uppercase tracking-tighter text-white">
                    {data.find(s => s.id === selectedId)?.patientFullName}
                 </span>
                 <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
                    {data.find(s => s.id === selectedId)?.studyDescription}
                 </span>
               </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button className="px-5 py-2.5 rounded-xl text-xs font-bold text-text-muted hover:text-white bg-white/5 hover:bg-white/10 transition-all border border-white/5">
                Addendum
              </button>
              <button className="px-5 py-2.5 rounded-xl text-xs font-bold text-text-muted hover:text-white bg-white/5 hover:bg-white/10 transition-all border border-white/5">
                Asignar
              </button>
              <button className="px-5 py-2.5 rounded-xl text-xs font-bold text-text-muted hover:text-white bg-white/5 hover:bg-white/10 transition-all border border-white/5">
                Anexos
              </button>
              <div className="w-[1px] h-8 bg-white/10 mx-2" />

              {currentRole === 'MED_STAFF' && ['CT', 'MRI', 'MR', 'PET'].includes(data.find(s => s.id === selectedId)?.modality || '') && (
                <button 
                  onClick={handleDeriveToSeshat}
                  className="bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/30 px-6 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2"
                  title="Derivar estudio a Comité Oncológico Multiverso"
                >
                  <Atom size={16} /> ENVIAR A SESHAT
                </button>
              )}

              <button 
                onClick={() => setEduExportStudyId(selectedId)}
                className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 px-6 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2"
                title="Exportar para Educación (Anónimo)"
              >
                <GraduationCap size={16} /> EDUCACIÓN
              </button>

              <button 
                onClick={handleStartDiagnosis}
                className="bg-amber-500 hover:bg-amber-400 text-[#020408] px-8 py-2.5 rounded-xl text-xs font-black hover:scale-105 transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] flex items-center gap-3 active:scale-95 group"
              >
                <Monitor size={16} /> INICIAR DIAGNÓSTICO
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {eduExportStudyId !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#020408] border border-white/10 rounded-2xl p-6 shadow-2xl max-w-sm w-full relative"
            >
              <button 
                onClick={() => setEduExportStudyId(null)}
                className="absolute top-4 right-4 text-white/40 hover:text-white"
              >
                <X size={20} />
              </button>
              
              <div className="flex flex-col items-center mb-6 text-center">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                  <GraduationCap className="text-emerald-400" size={24} />
                </div>
                <h3 className="text-lg font-black text-white mb-2">Exportar para Educación</h3>
                <p className="text-xs text-text-muted">
                  El sistema anonimizará este estudio (Edad, Sexo, Modalidad, Hallazgos), eliminando todo PHI (Nombre, RUT, F. Nacimiento) de forma segura.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => handleDeriveToEdu('Universidad (UANTOF)')}
                  className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-white/5 border border-white/10 hover:bg-emerald-500/20 hover:border-emerald-500/30 transition-all text-white text-left flex justify-between items-center group"
                >
                  <span>Universidad (UANTOF)</span>
                  <ArrowRight size={16} className="text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                <button 
                  onClick={() => handleDeriveToEdu('Colección Docente AMIS')}
                  className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-white/5 border border-white/10 hover:bg-emerald-500/20 hover:border-emerald-500/30 transition-all text-white text-left flex justify-between items-center group"
                >
                  <span>Colección Docente AMIS</span>
                  <ArrowRight size={16} className="text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
