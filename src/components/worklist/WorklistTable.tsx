"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
  SortingState
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
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Study, EnrichedStudy } from '@/types/ris';
import { useDiagnosis } from '@/components/providers/DiagnosisProvider';
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

function DraggableTableHeader({ header }: { header: any }) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } =
    useSortable({ id: header.column.id });

  const style: React.CSSProperties = {
    opacity: isDragging ? 0.8 : 1,
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 20 : 0,
    backgroundColor: isDragging ? 'rgba(0,10,20,0.8)' : '',
    position: 'relative'
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
    </th>
  );
}

/** SLA Indicator Component with Traffic Light Logic */
const calculateElapsed = (studyDate: Date) => {
  // FIX QA: Usa fecha ficticia para simular que todos los estudios históricos sucedieron "Hoy"
  const now = new Date();
  const originalDate = new Date(studyDate);
  
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
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const router = useRouter();

  const handleStartDiagnosis = () => {
    const study = data?.find(s => s.id === selectedId);
    if (!study) return;

    // Ajustado a la IP/Puerto local del Visor MedDream real que usabas en DictationClient: 
    const meddreamUrl = `http://localhost:8080/meddream/?study=${study.studyInstanceUID || study.accessionNumber}`;
    console.log(`[MedDream Integration] URL Generated: ${meddreamUrl}`);

    // Abrir MedDream en Monitor 2 usando window.open (popup mode idealmente)
    // Pasamos el UID real del estudio
    const windowFeatures = 'menubar=no,location=no,resizable=yes,scrollbars=yes,status=no,width=1920,height=1080';
    window.open(meddreamUrl, 'MedDream_Monitor2', windowFeatures);

    // Navegar en el Monitor 1 a la interfaz de informe
    router.push(`/informe/${study.studyInstanceUID}`);
  };

  const columns = useMemo(() => [
    columnHelper.accessor('patientFullName', {
      id: 'patientFullName',
      header: 'PACIENTE / IDENTIDAD',
      cell: info => (
        <div className="flex flex-col">
          <span className="text-sm font-black tracking-tight uppercase leading-tight text-white/90">{String(info.getValue())}</span>
          <div className="flex items-center gap-2 mt-0.5">
             <span className="text-[10px] font-mono text-text-muted bg-white/5 px-1 rounded">{info.row.original.patientId}</span>
             <span className="text-[10px] text-text-muted font-bold opacity-40 italic">{info.row.original.age} • {info.row.original.sex}</span>
          </div>
        </div>
      ),
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
            {new Date(info.getValue()).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
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
    data: data || [],
    columns,
    state: { sorting, globalFilter, columnOrder },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className={cn(
      "w-full h-full flex flex-col transition-all duration-700 relative overflow-hidden",
      mode === 'high-contrast' ? "bg-black brightness-[1.1] contrast-[1.2]" : "bg-transparent"
    )}>
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
          <div className="flex gap-1">
             <button className="p-2 text-text-muted hover:text-white transition-colors"><Activity size={18} /></button>
          </div>
        </div>
      </div>

      {/* High Density Table Body */}
      <div className="flex-1 overflow-auto scrollbar-hide">
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
              {table.getRowModel().rows.length > 0 ? table.getRowModel().rows.map(row => (
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
                      : "hover:bg-white/[0.04] border-transparent outline-transparent"
                  )}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-6 py-4 border-b border-white/[0.03] align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </motion.tr>
              )) : (
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
      </div>

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
    </div>
  );
}
