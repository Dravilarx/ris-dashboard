'use client';
/**
 * SeshatExportModal — Modal de Exportación Docente AMIS 2030
 * Permite seleccionar uno o varios destinos antes de confirmar el envío.
 * Usable desde Worklist e Informe.
 */
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, X, Check, Loader2, CheckSquare, Square, AlertCircle } from 'lucide-react';

export interface SeshatDestination {
  id: string;
  label: string;
  description: string;
  color: string;
}

export const SESHAT_DESTINATIONS: SeshatDestination[] = [
  {
    id: 'uantof',
    label: 'Universidad de Antofagasta (UANTOF)',
    description: 'Biblioteca de casos para residentes de radiología UANTOF',
    color: 'emerald',
  },
  {
    id: 'amis_coleccion',
    label: 'Colección Docente AMIS',
    description: 'Repositorio interno AMIS 2030 para formación continua',
    color: 'cyan',
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Metadata del caso a exportar */
  caseInfo?: {
    modality?: string;
    description?: string;
    age?: string;
    sex?: string;
    originUid?: string;
  };
  /** Callback cuando el envío fue exitoso */
  onSuccess?: (destinations: string[]) => void;
  /** Función de inserción (inyectada para evitar acoplamiento) */
  onSend: (destinations: string[]) => Promise<void>;
}

export default function SeshatExportModal({ isOpen, onClose, caseInfo, onSuccess, onSend }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(['uantof', 'amis_coleccion']));
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === SESHAT_DESTINATIONS.length) setSelected(new Set());
    else setSelected(new Set(SESHAT_DESTINATIONS.map(d => d.id)));
  };

  const handleSend = useCallback(async () => {
    if (selected.size === 0) return;
    setStatus('sending');
    setErrorMsg('');
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await onSend([...selected]);
        setStatus('done');
        onSuccess?.([...selected]);
        setTimeout(() => { setStatus('idle'); onClose(); }, 2200);
        return;
      } catch (err: any) {
        if (attempt === MAX_RETRIES) {
          setErrorMsg(err?.message || 'No se pudo conectar con Seshat. Reintenta más tarde.');
          setStatus('error');
        } else {
          await new Promise(r => setTimeout(r, 800 * attempt));
        }
      }
    }
  }, [selected, onSend, onSuccess, onClose]);

  const handleClose = () => { if (status === 'sending') return; setStatus('idle'); onClose(); };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[400] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: 'spring', damping: 22, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md bg-[#070a12] border border-emerald-500/20 rounded-3xl shadow-2xl shadow-emerald-500/10 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/8 bg-gradient-to-r from-emerald-500/8 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl flex items-center justify-center shadow-[0_0_16px_rgba(16,185,129,0.25)]">
                  <GraduationCap size={18} className="text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Enviar a Seshat</h3>
                  <p className="text-[10px] text-emerald-400/70 font-medium">Módulo Docente — Anonimización automática</p>
                </div>
              </div>
              <button onClick={handleClose} disabled={status === 'sending'}
                className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40">
                <X size={15} />
              </button>
            </div>

            {/* Case preview */}
            {caseInfo && (
              <div className="mx-6 mt-4 px-4 py-3 bg-white/[0.03] border border-white/8 rounded-2xl text-[10px] text-slate-400 space-y-0.5">
                <p><span className="text-slate-600 uppercase tracking-wider font-black">Modalidad</span> {caseInfo.modality || '—'}</p>
                <p><span className="text-slate-600 uppercase tracking-wider font-black">Estudio</span> {caseInfo.description || '—'}</p>
                {caseInfo.age && <p><span className="text-slate-600 uppercase tracking-wider font-black">Edad</span> {caseInfo.age} · {caseInfo.sex}</p>}
                <p className="text-emerald-500/60 pt-1">✓ Datos del paciente serán anonimizados antes del envío</p>
              </div>
            )}

            {/* Destinations */}
            <div className="px-6 py-4 space-y-2">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Destinos</p>
                <button onClick={toggleAll} className="text-[9px] text-slate-500 hover:text-white underline transition-colors">
                  {selected.size === SESHAT_DESTINATIONS.length ? 'Desmarcar todo' : 'Seleccionar todo'}
                </button>
              </div>
              {SESHAT_DESTINATIONS.map(dest => {
                const isSelected = selected.has(dest.id);
                return (
                  <button
                    key={dest.id}
                    onClick={() => toggle(dest.id)}
                    className={`w-full flex items-start gap-3 px-4 py-3 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? `bg-${dest.color}-500/10 border-${dest.color}-500/30`
                        : 'bg-white/[0.02] border-white/8 hover:border-white/15'
                    }`}
                  >
                    <div className={`mt-0.5 shrink-0 transition-colors ${isSelected ? `text-${dest.color}-400` : 'text-slate-600'}`}>
                      {isSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                    </div>
                    <div>
                      <p className={`text-xs font-bold transition-colors ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                        {dest.label}
                      </p>
                      <p className="text-[10px] text-slate-600 mt-0.5">{dest.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Error */}
            {status === 'error' && (
              <div className="mx-6 mb-2 flex items-start gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-2xl">
                <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-red-400 font-bold">Error de conexión (3 intentos)</p>
                  <p className="text-[9px] text-red-400/70 mt-0.5">{errorMsg}</p>
                  <p className="text-[9px] text-slate-500 mt-1">El caso se marcó localmente. Reintenta cuando haya conexión.</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={handleClose} disabled={status === 'sending'}
                className="flex-1 py-3 rounded-2xl text-sm font-black uppercase tracking-widest text-slate-400 bg-white/5 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-40">
                Cancelar
              </button>
              <button
                onClick={handleSend}
                disabled={selected.size === 0 || status === 'sending' || status === 'done'}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-black uppercase tracking-widest border transition-all disabled:cursor-not-allowed ${
                  status === 'done'
                    ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-40'
                }`}
              >
                {status === 'sending' && <Loader2 size={14} className="animate-spin" />}
                {status === 'done'    && <Check size={14} />}
                {status === 'sending' ? `Enviando (${selected.size})...` :
                 status === 'done'    ? 'Enviado ✓' :
                 `Enviar a ${selected.size} destino${selected.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
