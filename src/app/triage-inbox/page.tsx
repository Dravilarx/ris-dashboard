"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, CheckCircle2, UserCheck, Wrench,
  Search, ArrowLeft, Inbox, RefreshCw, Clock
} from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────
type TriageStatus = 'PENDING' | 'TECHNICAL' | 'ASSIGNED';
interface TriageItem {
  id: string;
  study_uid: string;
  request_text: string;
  requester_name: string | null;
  status: TriageStatus;
  created_at: string;
  // Enriched via join
  patient_name?: string;
  accession_number?: string;
  modality?: string;
}

const STATUS_CONFIG = {
  PENDING:   { label: 'Pendiente Asignación', color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30' },
  TECHNICAL: { label: 'Resolución Técnica',   color: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/30' },
  ASSIGNED:  { label: 'Asignado a Médico',    color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TriageInboxPage() {
  const [items, setItems]         = useState<TriageItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState<'ALL' | TriageStatus>('PENDING');
  const [actionItem, setActionItem] = useState<TriageItem | null>(null);
  const [actionType, setActionType] = useState<'technical' | 'assign' | null>(null);
  const [assignTarget, setAssignTarget] = useState('');
  const [saving, setSaving]       = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    // Join with multiris_production for patient/study data
    const { data, error } = await supabase
      .from('addendum_requests')
      .select(`
        id, study_uid, request_text, requester_name, status, created_at
      `)
      .order('created_at', { ascending: false });

    if (error) { console.error('[Triage]', error); setLoading(false); return; }

    // Enrich with study data — in prod this would be a proper join / RPC
    const enriched: TriageItem[] = (data || []).map(row => ({
      ...row,
      patient_name: 'Cargando...', // TODO: JOIN multiris_production via study_uid
      accession_number: row.study_uid.split('|')[0] || row.study_uid,
      modality: '',
    }));

    setItems(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchItems();
    const ch = supabase
      .channel('triage-inbox-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'addendum_requests' }, fetchItems)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchItems]);

  const handleMarkTechnical = async () => {
    if (!actionItem) return;
    setSaving(true);
    await supabase
      .from('addendum_requests')
      .update({ status: 'TECHNICAL' })
      .eq('id', actionItem.id);
    setSaving(false);
    setActionItem(null);
    setActionType(null);
  };

  const handleAssign = async () => {
    if (!actionItem || !assignTarget.trim()) return;
    setSaving(true);
    await supabase
      .from('addendum_requests')
      .update({ status: 'ASSIGNED', requester_name: assignTarget.trim() })
      .eq('id', actionItem.id);
    setSaving(false);
    setActionItem(null);
    setActionType(null);
    setAssignTarget('');
  };

  const filtered = items.filter(item => {
    const matchFilter = filter === 'ALL' || item.status === filter;
    const matchSearch = !search ||
      item.request_text?.toLowerCase().includes(search.toLowerCase()) ||
      item.study_uid?.toLowerCase().includes(search.toLowerCase()) ||
      item.requester_name?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const pendingCount = items.filter(i => i.status === 'PENDING').length;

  return (
    <div className="flex h-screen bg-[#020408] text-slate-200 overflow-hidden font-sans">
      {/* Sidebar accent */}
      <div className="w-1 bg-gradient-to-b from-violet-500 via-purple-600 to-violet-500 shrink-0" />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="px-8 py-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02] backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-5">
            <Link href="/dashboard" className="p-2 -ml-2 text-slate-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
                <Inbox size={20} className="text-violet-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-[0.25em] text-violet-400">SECRETARÍA MÉDICA</span>
                  {pendingCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-black border border-amber-500/30 animate-pulse">
                      {pendingCount} PENDIENTES
                    </span>
                  )}
                </div>
                <h1 className="text-xl font-black text-white tracking-tight mt-0.5">Bandeja de Triage — Addendums</h1>
              </div>
            </div>
          </div>
          <button
            onClick={fetchItems}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all text-[10px] font-black uppercase tracking-widest"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Actualizar
          </button>
        </header>

        {/* Filter + Search Bar */}
        <div className="px-8 py-4 border-b border-white/5 flex items-center gap-4 bg-white/[0.01] shrink-0">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por paciente, UID, clínica..."
              className="w-full bg-white/5 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/40 transition-all"
            />
          </div>
          <div className="flex gap-1">
            {(['ALL', 'PENDING', 'TECHNICAL', 'ASSIGNED'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                  filter === f
                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                    : 'bg-white/5 text-slate-500 border border-white/5 hover:text-white'
                }`}
              >
                {f === 'ALL' ? 'Todos' : STATUS_CONFIG[f].label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto p-8">
          {loading ? (
            <div className="flex items-center justify-center h-40 opacity-30">
              <RefreshCw size={32} className="animate-spin text-violet-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 opacity-20 gap-3">
              <Inbox size={48} className="text-violet-400" />
              <p className="text-sm font-bold text-slate-400">Sin solicitudes {filter !== 'ALL' ? `con estado "${STATUS_CONFIG[filter as TriageStatus]?.label}"` : ''}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {filtered.map(item => {
                  const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING;
                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      className={`p-5 rounded-2xl border ${cfg.bg} ${cfg.border} hover:brightness-110 transition-all`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* Info block */}
                        <div className="flex flex-col gap-2 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${cfg.color} px-2 py-0.5 rounded-full border ${cfg.border} ${cfg.bg}`}>
                              {cfg.label}
                            </span>
                            <span className="text-[9px] font-mono text-slate-500 flex items-center gap-1">
                              <Clock size={9} /> {new Date(item.created_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          </div>

                          {/* Request text — THE EXACT TEXT from the bot/clinic */}
                          <p className="text-sm font-black text-white leading-snug">
                            &ldquo;{item.request_text}&rdquo;
                          </p>

                          <div className="flex items-center gap-3 flex-wrap mt-1">
                            <div className="flex flex-col">
                              <span className="text-[8px] text-slate-600 uppercase tracking-widest font-bold">UID Estudio</span>
                              <span className="text-[10px] font-mono text-slate-400 truncate max-w-[220px]">{item.study_uid}</span>
                            </div>
                            {item.requester_name && (
                              <div className="flex flex-col">
                                <span className="text-[8px] text-slate-600 uppercase tracking-widest font-bold">Solicitante</span>
                                <span className="text-[10px] font-bold text-violet-300">{item.requester_name}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action buttons — only visible for PENDING items */}
                        {item.status === 'PENDING' && (
                          <div className="flex flex-col gap-2 shrink-0">
                            <button
                              onClick={() => { setActionItem(item); setActionType('technical'); }}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-[9px] font-black uppercase tracking-widest hover:bg-cyan-500/25 transition-all"
                            >
                              <Wrench size={11} /> Resolución Técnica
                            </button>
                            <button
                              onClick={() => { setActionItem(item); setActionType('assign'); }}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500/25 transition-all"
                            >
                              <UserCheck size={11} /> Asignar a Médico
                            </button>
                          </div>
                        )}

                        {item.status !== 'PENDING' && (
                          <div className="shrink-0">
                            <CheckCircle2 size={20} className={cfg.color} />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>

      {/* Action Modal */}
      <AnimatePresence>
        {actionItem && actionType && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => { setActionItem(null); setActionType(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              className={`w-full max-w-md rounded-3xl border overflow-hidden shadow-2xl ${
                actionType === 'technical'
                  ? 'bg-[#050810] border-cyan-500/20 shadow-[0_0_60px_rgba(6,182,212,0.15)]'
                  : 'bg-[#050810] border-emerald-500/20 shadow-[0_0_60px_rgba(16,185,129,0.15)]'
              }`}
            >
              <div className={`p-6 border-b border-white/5 ${actionType === 'technical' ? 'bg-cyan-500/10' : 'bg-emerald-500/10'}`}>
                <div className="flex items-center gap-3 mb-1">
                  {actionType === 'technical' ? <Wrench size={20} className="text-cyan-400" /> : <UserCheck size={20} className="text-emerald-400" />}
                  <h2 className={`text-lg font-black ${actionType === 'technical' ? 'text-cyan-300' : 'text-emerald-300'}`}>
                    {actionType === 'technical' ? 'Marcar como Resolución Técnica' : 'Asignar a Médico'}
                  </h2>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">&ldquo;{actionItem.request_text}&rdquo;</p>
              </div>

              <div className="p-6 flex flex-col gap-4">
                {actionType === 'assign' && (
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Nombre del Médico Responsable</label>
                    <input
                      autoFocus
                      value={assignTarget}
                      onChange={e => setAssignTarget(e.target.value)}
                      placeholder="Dr. / Dra. ..."
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-all"
                    />
                  </div>
                )}

                {actionType === 'technical' && (
                  <p className="text-xs text-slate-400">
                    Esta acción indica que el addendum es de naturaleza técnica (error de carga, duplicado, etc.) y <strong className="text-white">no requiere respuesta clínica</strong>. Se notificará a la clínica solicitante.
                  </p>
                )}

                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => { setActionItem(null); setActionType(null); }}
                    className="flex-1 px-4 py-2.5 rounded-xl font-bold text-sm text-slate-400 bg-white/5 hover:bg-white/10 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    disabled={saving || (actionType === 'assign' && !assignTarget.trim())}
                    onClick={actionType === 'technical' ? handleMarkTechnical : handleAssign}
                    className={`flex-1 px-4 py-2.5 rounded-xl font-black text-sm transition-all disabled:opacity-50 ${
                      actionType === 'technical'
                        ? 'bg-cyan-500 hover:bg-cyan-400 text-black'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-black'
                    }`}
                  >
                    {saving ? 'Guardando...' : 'Confirmar'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
