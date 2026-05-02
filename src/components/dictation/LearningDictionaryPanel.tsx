'use client';

/**
 * LearningDictionaryPanel — AMIS 2030 v3.0
 * CRUD completo: Crear · Editar inline · Borrar · Borrar todo
 * Campo de contexto: palabras clave que condicionan la corrección (como bazo/vaso)
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  BookOpen, Trash2, X, Search, ArrowRight,
  ChevronDown, ChevronRight, Volume2, Save, AlertCircle,
  Pencil, Check, Tag, RotateCcw
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface DictionaryEntry {
  id: string;
  heard: string;       // Término incorrecto que llega del dictado
  correct: string;     // Término correcto que debe quedar
  section?: string;    // Campo donde aplica (vacío = todos)
  contextKeywords?: string; // Palabras clave del contexto (ej: "páncreas, hígado")
  notes?: string;
}

export const SECTION_NAMES: Record<string, string> = {
  technique:  'Técnica',
  history:    'Antecedentes',
  findings:   'Hallazgos',
  impression: 'Impresión',
};

const BUILT_IN_RULES = [
  {
    rule: 'Bazo / Vaso (abdominal)',
    desc: 'Contexto: páncreas, hígado, hilio, esplénico → "vaso" se corrige a "bazo"',
    color: 'text-emerald-400 bg-emerald-400/5 border-emerald-400/15',
  },
  {
    rule: 'Vaso / Bazo (vascular)',
    desc: 'Contexto: doppler, carótida, arteria, vena, fístula → "bazo" se corrige a "vaso"',
    color: 'text-blue-400 bg-blue-400/5 border-blue-400/15',
  },
  {
    rule: 'Números → Dígitos',
    desc: 'Medidas siempre con dígitos: "3.5 cm", "45 UH", "35%". Nunca con letras.',
    color: 'text-amber-400 bg-amber-400/5 border-amber-400/15',
  },
];

// ─── Storage helpers ───────────────────────────────────────────────────────────
const STORAGE_KEY = 'amis_dictionary';
export function getDictionary(): DictionaryEntry[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveDictionary(entries: DictionaryEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  isOpen: boolean;
  onClose: () => void;
  prefillHeard?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function LearningDictionaryPanel({ isOpen, onClose, prefillHeard }: Props) {
  const [entries, setEntries] = useState<DictionaryEntry[]>(() => getDictionary());
  const [search, setSearch] = useState('');
  const [showBuiltIn, setShowBuiltIn] = useState(false);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [heard, setHeard]                     = useState('');
  const [correct, setCorrect]                 = useState('');
  const [section, setSection]                 = useState('');
  const [contextKeywords, setContextKeywords] = useState('');
  const [notes, setNotes]                     = useState('');
  const [formError, setFormError]             = useState('');
  const [justSaved, setJustSaved]             = useState(false);

  // ── Edit state ──────────────────────────────────────────────────────────────
  const [editId, setEditId]                         = useState<string | null>(null);
  const [editHeard, setEditHeard]                   = useState('');
  const [editCorrect, setEditCorrect]               = useState('');
  const [editSection, setEditSection]               = useState('');
  const [editContext, setEditContext]               = useState('');
  const [editNotes, setEditNotes]                   = useState('');

  // ── Confirm delete ───────────────────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmClear, setConfirmClear]   = useState(false);

  // Pre-cargar palabra desde selección de texto
  useEffect(() => {
    if (prefillHeard && isOpen) {
      setHeard(prefillHeard.trim());
      setCorrect('');
      setContextKeywords('');
      setNotes('');
      setFormError('');
      // Focus the "correct" input after a tick
      setTimeout(() => {
        document.getElementById('dict-correct-input')?.focus();
      }, 120);
    }
  }, [prefillHeard, isOpen]);

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter(e =>
      e.heard.toLowerCase().includes(q) ||
      e.correct.toLowerCase().includes(q) ||
      e.contextKeywords?.toLowerCase().includes(q) ||
      e.notes?.toLowerCase().includes(q)
    );
  }, [entries, search]);

  // ── Add ─────────────────────────────────────────────────────────────────────
  const handleAdd = useCallback(() => {
    if (!heard.trim()) { setFormError('Escribe el término escuchado'); return; }
    if (!correct.trim()) { setFormError('Escribe el término correcto'); return; }
    if (entries.some(e => e.heard.toLowerCase() === heard.trim().toLowerCase())) {
      setFormError('Ya existe una entrada con ese término'); return;
    }
    const entry: DictionaryEntry = {
      id: `dict-${Date.now()}`,
      heard: heard.trim(),
      correct: correct.trim(),
      section: section || undefined,
      contextKeywords: contextKeywords.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    const updated = [entry, ...entries];
    setEntries(updated);
    saveDictionary(updated);
    setHeard(''); setCorrect(''); setSection(''); setContextKeywords(''); setNotes('');
    setFormError('');
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  }, [heard, correct, section, contextKeywords, notes, entries]);

  // ── Delete one ──────────────────────────────────────────────────────────────
  const handleDelete = useCallback((id: string) => {
    const updated = entries.filter(e => e.id !== id);
    setEntries(updated);
    saveDictionary(updated);
    setConfirmDelete(null);
    if (editId === id) setEditId(null);
  }, [entries, editId]);

  // ── Delete all ──────────────────────────────────────────────────────────────
  const handleClearAll = useCallback(() => {
    setEntries([]);
    saveDictionary([]);
    setConfirmClear(false);
    setEditId(null);
  }, []);

  // ── Start edit ──────────────────────────────────────────────────────────────
  const startEdit = (entry: DictionaryEntry) => {
    setEditId(entry.id);
    setEditHeard(entry.heard);
    setEditCorrect(entry.correct);
    setEditSection(entry.section || '');
    setEditContext(entry.contextKeywords || '');
    setEditNotes(entry.notes || '');
    setConfirmDelete(null);
  };

  // ── Save edit ───────────────────────────────────────────────────────────────
  const saveEdit = useCallback(() => {
    if (!editId || !editHeard.trim() || !editCorrect.trim()) return;
    const updated = entries.map(e =>
      e.id === editId
        ? { ...e, heard: editHeard.trim(), correct: editCorrect.trim(),
            section: editSection || undefined,
            contextKeywords: editContext.trim() || undefined,
            notes: editNotes.trim() || undefined }
        : e
    );
    setEntries(updated);
    saveDictionary(updated);
    setEditId(null);
  }, [editId, editHeard, editCorrect, editSection, editContext, editNotes, entries]);

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 bottom-0 w-[380px] bg-[#060912]/98 backdrop-blur-xl border-l border-white/10 z-[150] flex flex-col shadow-2xl shadow-black/60">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 bg-gradient-to-r from-violet-500/6 to-transparent">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-violet-500/20 border border-violet-500/30 rounded-xl flex items-center justify-center">
            <BookOpen size={14} className="text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Diccionario</h3>
            <p className="text-[9px] text-slate-500 font-medium">
              {entries.length} corrección{entries.length !== 1 ? 'es' : ''} · Gemma 2
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {entries.length > 0 && (
            confirmClear ? (
              <div className="flex items-center gap-1">
                <button onClick={handleClearAll} className="px-2 py-1 bg-red-500/20 text-red-400 text-[9px] font-black rounded-lg border border-red-500/30 hover:bg-red-500/30 transition-all">Vaciar todo</button>
                <button onClick={() => setConfirmClear(false)} className="px-2 py-1 bg-white/5 text-slate-400 text-[9px] font-black rounded-lg border border-white/10 transition-all">No</button>
              </div>
            ) : (
              <button onClick={() => setConfirmClear(true)} title="Vaciar diccionario" className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-all">
                <RotateCcw size={13} />
              </button>
            )
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col">

        {/* ── Add Form ───────────────────────────────────────────────────────── */}
        <div className="p-4 border-b border-white/5 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            {prefillHeard ? '✏️ Corregir palabra seleccionada' : 'Agregar corrección'}
          </p>

          {/* Heard → Correct */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[9px] text-slate-600 uppercase tracking-widest font-black block mb-1">Escucha</label>
              <div className="flex items-center gap-1.5 bg-red-500/5 border border-red-500/20 rounded-xl px-3 py-2.5">
                <Volume2 size={11} className="text-red-400 shrink-0" />
                <input
                  value={heard}
                  onChange={e => { setHeard(e.target.value); setFormError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('dict-correct-input')?.focus(); }}}
                  placeholder="término incorrecto"
                  className="bg-transparent text-sm text-white placeholder-slate-600 outline-none w-full"
                />
              </div>
            </div>
            <ArrowRight size={14} className="text-slate-600 shrink-0 mt-4" />
            <div className="flex-1">
              <label className="text-[9px] text-slate-600 uppercase tracking-widest font-black block mb-1">Correcto</label>
              <div className="flex items-center gap-1.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-3 py-2.5">
                <BookOpen size={11} className="text-emerald-400 shrink-0" />
                <input
                  id="dict-correct-input"
                  value={correct}
                  onChange={e => { setCorrect(e.target.value); setFormError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }}}
                  placeholder="término correcto"
                  className="bg-transparent text-sm text-white placeholder-slate-600 outline-none w-full"
                />
              </div>
            </div>
          </div>

          {/* Context Keywords */}
          <div>
            <label className="text-[9px] text-slate-600 uppercase tracking-widest font-black block mb-1 flex items-center gap-1">
              <Tag size={9} /> Contexto <span className="text-slate-700 normal-case font-normal">(palabras que activan esta regla — opcional)</span>
            </label>
            <input
              value={contextKeywords}
              onChange={e => setContextKeywords(e.target.value)}
              placeholder="ej: páncreas, hígado, esplénico"
              className="w-full bg-amber-500/5 border border-amber-500/15 rounded-xl px-3 py-2 text-xs text-amber-200 placeholder-slate-600 outline-none focus:border-amber-500/40 transition-colors"
            />
            {contextKeywords && (
              <p className="text-[9px] text-amber-500/60 mt-1 px-1">
                La corrección se aplica solo si alguna de estas palabras aparece en el mismo campo
              </p>
            )}
          </div>

          {/* Section + Notes row */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[9px] text-slate-600 uppercase tracking-widest font-black block mb-1">Campo</label>
              <select
                value={section}
                onChange={e => setSection(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-violet-500/50 transition-colors appearance-none"
              >
                <option value="" className="bg-slate-900">Todos</option>
                {Object.entries(SECTION_NAMES).map(([k, v]) => (
                  <option key={k} value={k} className="bg-slate-900">{v}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[9px] text-slate-600 uppercase tracking-widest font-black block mb-1">Nota</label>
              <input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="opcional"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>
          </div>

          {formError && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertCircle size={11} className="text-red-400 shrink-0" />
              <p className="text-[10px] text-red-400">{formError}</p>
            </div>
          )}

          <button
            onClick={handleAdd}
            disabled={!heard.trim() || !correct.trim()}
            className={`w-full flex items-center justify-center gap-2 py-2.5 text-sm font-black uppercase tracking-widest rounded-xl border transition-all ${
              justSaved
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-violet-500/20 text-violet-400 border-violet-500/30 hover:bg-violet-500/30 disabled:opacity-30 disabled:cursor-not-allowed'
            }`}
          >
            {justSaved ? <>✓ Guardado</> : <><Save size={13} /> Agregar al diccionario</>}
          </button>
        </div>

        {/* ── Built-in Rules ─────────────────────────────────────────────────── */}
        <div className="border-b border-white/5">
          <button
            onClick={() => setShowBuiltIn(v => !v)}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors"
          >
            {showBuiltIn ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            Reglas del sistema
            <span className="ml-auto text-[9px] font-normal text-slate-600">{BUILT_IN_RULES.length} activas</span>
          </button>
          {showBuiltIn && (
            <div className="px-4 pb-3 space-y-2">
              {BUILT_IN_RULES.map((r, i) => (
                <div key={i} className={`p-2.5 rounded-xl border text-[10px] leading-relaxed ${r.color}`}>
                  <p className="font-black mb-0.5">{r.rule}</p>
                  <p className="opacity-75">{r.desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Search ─────────────────────────────────────────────────────────── */}
        {entries.length > 0 && (
          <div className="px-4 py-2.5 border-b border-white/5">
            <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
              <Search size={12} className="text-slate-500 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar en el diccionario..."
                className="bg-transparent text-xs text-white placeholder-slate-500 flex-1 outline-none"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-slate-600 hover:text-white transition-colors">
                  <X size={10} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Entry list ─────────────────────────────────────────────────────── */}
        <div className="flex-1 p-3 space-y-2 overflow-y-auto">
          {filtered.length === 0 && entries.length === 0 && (
            <div className="py-10 text-center">
              <BookOpen size={24} className="text-slate-700 mx-auto mb-3" />
              <p className="text-slate-600 text-xs font-medium">Diccionario vacío</p>
              <p className="text-slate-700 text-[10px] mt-1">Selecciona una palabra en el editor para empezar</p>
            </div>
          )}

          {filtered.map(entry => (
            <div key={entry.id} className="group rounded-2xl border border-white/5 bg-white/[0.02] hover:border-white/10 transition-all overflow-hidden">

              {editId === entry.id ? (
                /* ── Inline Edit Mode ── */
                <div className="p-3 space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[8px] text-slate-600 uppercase tracking-widest font-black block mb-1">Escucha</label>
                      <input value={editHeard} onChange={e => setEditHeard(e.target.value)}
                        className="w-full bg-red-500/8 border border-red-500/20 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-red-500/40" />
                    </div>
                    <ArrowRight size={12} className="text-slate-600 shrink-0 mt-5" />
                    <div className="flex-1">
                      <label className="text-[8px] text-slate-600 uppercase tracking-widest font-black block mb-1">Correcto</label>
                      <input value={editCorrect} onChange={e => setEditCorrect(e.target.value)}
                        className="w-full bg-emerald-500/8 border border-emerald-500/20 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-emerald-500/40" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[8px] text-amber-500/60 uppercase tracking-widest font-black block mb-1 flex items-center gap-1"><Tag size={8} /> Contexto</label>
                    <input value={editContext} onChange={e => setEditContext(e.target.value)}
                      placeholder="ej: páncreas, hígado"
                      className="w-full bg-amber-500/5 border border-amber-500/15 rounded-lg px-2.5 py-1.5 text-xs text-amber-200 placeholder-slate-600 outline-none focus:border-amber-500/30" />
                  </div>
                  <div className="flex gap-2">
                    <select value={editSection} onChange={e => setEditSection(e.target.value)}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none appearance-none">
                      <option value="" className="bg-slate-900">Todos</option>
                      {Object.entries(SECTION_NAMES).map(([k, v]) => <option key={k} value={k} className="bg-slate-900">{v}</option>)}
                    </select>
                    <input value={editNotes} onChange={e => setEditNotes(e.target.value)}
                      placeholder="Nota..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 outline-none focus:border-violet-500/50" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={saveEdit} disabled={!editHeard.trim() || !editCorrect.trim()}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-black uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/20 disabled:opacity-30 transition-all">
                      <Check size={11} /> Guardar
                    </button>
                    <button onClick={() => setEditId(null)}
                      className="flex-1 py-1.5 text-[10px] font-black uppercase text-slate-400 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                /* ── View Mode ── */
                <div className="p-2.5">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-500/10 text-red-300 border border-red-500/15 rounded-md font-mono">{entry.heard}</span>
                        <ArrowRight size={9} className="text-slate-600 shrink-0" />
                        <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/15 rounded-md font-mono font-bold">{entry.correct}</span>
                        {entry.section && (
                          <span className="text-[8px] px-1 py-0.5 bg-violet-500/10 text-violet-400 border border-violet-500/15 rounded font-black uppercase tracking-wider">
                            {SECTION_NAMES[entry.section] || entry.section}
                          </span>
                        )}
                      </div>
                      {entry.contextKeywords && (
                        <div className="flex items-center gap-1 mt-1">
                          <Tag size={8} className="text-amber-500/60 shrink-0" />
                          <p className="text-[9px] text-amber-400/70 font-mono">si: {entry.contextKeywords}</p>
                        </div>
                      )}
                      {entry.notes && <p className="text-[9px] text-slate-600 mt-0.5 italic">{entry.notes}</p>}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(entry)} title="Editar"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-cyan-400/10 transition-all">
                        <Pencil size={11} />
                      </button>
                      {confirmDelete === entry.id ? (
                        <>
                          <button onClick={() => handleDelete(entry.id)} className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[9px] font-black rounded-lg border border-red-500/30 hover:bg-red-500/30 transition-all">Sí</button>
                          <button onClick={() => setConfirmDelete(null)} className="px-1.5 py-0.5 bg-white/5 text-slate-400 text-[9px] font-black rounded-lg border border-white/10 transition-all">No</button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmDelete(entry.id)} title="Eliminar"
                          className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-all">
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-white/5 bg-white/[0.01]">
        <p className="text-[9px] text-slate-600 text-center">
          {entries.length} regla{entries.length !== 1 ? 's' : ''} personalizadas · Activas con F4 (Gemma 2)
        </p>
      </div>
    </div>
  );
}
