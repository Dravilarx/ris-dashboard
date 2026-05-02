'use client';

/**
 * LearningDictionaryPanel — Panel de Entrenamiento Lingüístico AMIS 2030
 * ════════════════════════════════════════════════════════════════════════
 * Permite al médico registrar pares "Término Escuchado → Término Correcto"
 * que Gemma 2 usará como referencia obligatoria al refinar el informe.
 *
 * Persistencia: localStorage('amis_dictionary')
 * Consumido por: /api/dictado/refine → prompt de Gemma 2
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  BookOpen, Plus, Trash2, X, Search, ArrowRight,
  ChevronDown, ChevronRight, Volume2, Save, AlertCircle
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface DictionaryEntry {
  id: string;
  heard: string;    // Lo que el sistema de voz transcribe mal (ej: "esponja")
  correct: string;  // Lo que debe quedar en el informe (ej: "espondilolistesis")
  section?: string; // Campo donde aplica ('findings', 'impression', etc.) o undefined = todos
  notes?: string;   // Anotación opcional (contexto, ejemplo)
}

export const SECTION_NAMES: Record<string, string> = {
  technique:  'Técnica',
  history:    'Antecedentes',
  findings:   'Hallazgos',
  impression: 'Impresión',
};

// ─── Built-in rules (informativas, siempre activas) ───────────────────────────
const BUILT_IN_RULES = [
  {
    rule: 'Bazo / Vaso (abdomen)',
    desc: 'En contexto abdominal (páncreas, hígado, hilio, esplénico, retroperitoneo): "vaso" → "bazo"',
    color: 'text-emerald-400 bg-emerald-400/5 border-emerald-400/15',
  },
  {
    rule: 'Vaso / Bazo (vascular)',
    desc: 'En contexto vascular (doppler, flujo, carótida, fístula, arteria, vena): "bazo" → "vaso"',
    color: 'text-blue-400 bg-blue-400/5 border-blue-400/15',
  },
  {
    rule: 'B/V chileno',
    desc: 'Sensible al seseo y confusión B/V. Usa el contexto anatómico para desambiguar.',
    color: 'text-amber-400 bg-amber-400/5 border-amber-400/15',
  },
];

// ─── Storage helpers ──────────────────────────────────────────────────────────
const STORAGE_KEY = 'amis_dictionary';

export function getDictionary(): DictionaryEntry[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function saveDictionary(entries: DictionaryEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// ─── Props ───────────────────────────────────────────────────────────────────
interface LearningDictionaryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  prefillHeard?: string; // Palabra pre-cargada desde selección de texto
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function LearningDictionaryPanel({ isOpen, onClose, prefillHeard }: LearningDictionaryPanelProps) {
  const [entries, setEntries] = useState<DictionaryEntry[]>(() => getDictionary());
  const [search, setSearch] = useState('');
  const [showBuiltIn, setShowBuiltIn] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // New entry form
  const [heard, setHeard] = useState('');
  const [correct, setCorrect] = useState('');
  const [section, setSection] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  // Pre-cargar palabra desde selección de texto externa
  useEffect(() => {
    if (prefillHeard && isOpen) {
      setHeard(prefillHeard.trim());
      setFormError('');
    }
  }, [prefillHeard, isOpen]);

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter(e =>
      e.heard.toLowerCase().includes(q) ||
      e.correct.toLowerCase().includes(q) ||
      e.notes?.toLowerCase().includes(q)
    );
  }, [entries, search]);

  const handleAdd = useCallback(() => {
    if (!heard.trim()) { setFormError('Escribe el término escuchado'); return; }
    if (!correct.trim()) { setFormError('Escribe el término correcto'); return; }
    if (entries.some(e => e.heard.toLowerCase() === heard.trim().toLowerCase())) {
      setFormError('Ya existe una entrada con ese término');
      return;
    }
    const newEntry: DictionaryEntry = {
      id: `dict-${Date.now()}`,
      heard: heard.trim(),
      correct: correct.trim(),
      section: section || undefined,
      notes: notes.trim() || undefined,
    };
    const updated = [newEntry, ...entries];
    setEntries(updated);
    saveDictionary(updated);
    setHeard(''); setCorrect(''); setSection(''); setNotes('');
    setFormError('');
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  }, [heard, correct, section, notes, entries]);

  const handleDelete = useCallback((id: string) => {
    const updated = entries.filter(e => e.id !== id);
    setEntries(updated);
    saveDictionary(updated);
    setConfirmDelete(null);
  }, [entries]);

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 bottom-0 w-[360px] bg-slate-900/98 backdrop-blur-xl border-l border-white/10 z-50 flex flex-col shadow-2xl shadow-black/50">
      {/* ── Header ── */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-violet-500/20 border border-violet-500/30 rounded-xl flex items-center justify-center">
            <BookOpen size={13} className="text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Diccionario</h3>
            <p className="text-[9px] text-slate-500 font-medium">Aprendizaje para Gemma 2</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* ── Add form ── */}
        <div className="p-4 border-b border-white/5 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Agregar corrección
          </p>

          {/* Heard → Correct row */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[9px] text-slate-600 uppercase tracking-widest font-black block mb-1">Escucha</label>
              <div className="flex items-center gap-1.5 bg-red-500/5 border border-red-500/20 rounded-xl px-3 py-2.5">
                <Volume2 size={11} className="text-red-400 shrink-0" />
                <input
                  value={heard}
                  onChange={e => { setHeard(e.target.value); setFormError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('dict-correct')?.focus(); }}}
                  placeholder="esponja"
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
                  id="dict-correct"
                  value={correct}
                  onChange={e => { setCorrect(e.target.value); setFormError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }}}
                  placeholder="espondilolistesis"
                  className="bg-transparent text-sm text-white placeholder-slate-600 outline-none w-full"
                />
              </div>
            </div>
          </div>

          {/* Section filter */}
          <div>
            <label className="text-[9px] text-slate-600 uppercase tracking-widest font-black block mb-1">
              Aplica en campo <span className="text-slate-700 normal-case font-normal">(opcional — vacío = todos)</span>
            </label>
            <select
              value={section}
              onChange={e => setSection(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50 transition-colors appearance-none"
            >
              <option value="" className="bg-slate-900">Todos los campos</option>
              {Object.entries(SECTION_NAMES).map(([k, v]) => (
                <option key={k} value={k} className="bg-slate-900">{v}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[9px] text-slate-600 uppercase tracking-widest font-black block mb-1">
              Nota / Contexto <span className="text-slate-700 normal-case font-normal">(opcional)</span>
            </label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ej: Solo aplica en columna lumbar"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-violet-500/50 transition-colors"
            />
          </div>

          {/* Error */}
          {formError && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertCircle size={11} className="text-red-400 shrink-0" />
              <p className="text-[10px] text-red-400">{formError}</p>
            </div>
          )}

          {/* Save button */}
          <button
            onClick={handleAdd}
            disabled={!heard.trim() || !correct.trim()}
            className={`w-full flex items-center justify-center gap-2 py-2.5 text-sm font-black uppercase tracking-widest rounded-xl border transition-all ${
              justSaved
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-violet-500/20 text-violet-400 border-violet-500/30 hover:bg-violet-500/30 disabled:opacity-30 disabled:cursor-not-allowed'
            }`}
          >
            {justSaved ? (
              <>✓ Guardado en el diccionario</>
            ) : (
              <><Save size={13} /> Agregar al diccionario</>
            )}
          </button>
        </div>

        {/* ── Built-in rules (always active) ── */}
        <div className="border-b border-white/5">
          <button
            onClick={() => setShowBuiltIn(v => !v)}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors"
          >
            {showBuiltIn ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            Reglas anatómicas activas
            <span className="ml-auto text-[9px] font-normal text-slate-600">{BUILT_IN_RULES.length} reglas</span>
          </button>
          {showBuiltIn && (
            <div className="px-4 pb-3 space-y-2">
              {BUILT_IN_RULES.map((r, i) => (
                <div key={i} className={`p-2.5 rounded-xl border text-[10px] leading-relaxed ${r.color}`}>
                  <p className="font-black mb-0.5">{r.rule}</p>
                  <p className="opacity-75">{r.desc}</p>
                </div>
              ))}
              <p className="text-[9px] text-slate-600 italic pt-1">
                Estas reglas son parte del sistema AMIS y no se pueden eliminar.
              </p>
            </div>
          )}
        </div>

        {/* ── Custom dictionary ── */}
        <div className="flex-1 flex flex-col">
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
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {filtered.length === 0 && entries.length === 0 && (
              <div className="py-10 text-center">
                <BookOpen size={24} className="text-slate-700 mx-auto mb-3" />
                <p className="text-slate-600 text-xs font-medium">Diccionario vacío</p>
                <p className="text-slate-700 text-[10px] mt-1">Agrega tu primera corrección arriba</p>
              </div>
            )}
            {filtered.map(entry => (
              <div key={entry.id} className="group flex items-start gap-2.5 p-2.5 bg-white/[0.03] border border-white/5 rounded-xl hover:border-white/10 transition-all">
                {/* Pair */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 bg-red-500/10 text-red-300 border border-red-500/15 rounded-md font-mono">
                      {entry.heard}
                    </span>
                    <ArrowRight size={9} className="text-slate-600 shrink-0" />
                    <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/15 rounded-md font-mono font-bold">
                      {entry.correct}
                    </span>
                    {entry.section && (
                      <span className="text-[8px] px-1 py-0.5 bg-violet-500/10 text-violet-400 border border-violet-500/15 rounded font-black uppercase tracking-wider">
                        {SECTION_NAMES[entry.section] || entry.section}
                      </span>
                    )}
                  </div>
                  {entry.notes && (
                    <p className="text-[9px] text-slate-600 mt-1 italic">{entry.notes}</p>
                  )}
                </div>
                {/* Delete */}
                {confirmDelete === entry.id ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => handleDelete(entry.id)} className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[9px] font-black rounded-lg border border-red-500/30 hover:bg-red-500/30">Sí</button>
                    <button onClick={() => setConfirmDelete(null)} className="px-1.5 py-0.5 bg-white/5 text-slate-400 text-[9px] font-black rounded-lg border border-white/10">No</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(entry.id)}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-all shrink-0"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="p-3 border-t border-white/5">
        <p className="text-[9px] text-slate-600 text-center">
          {entries.length} corrección{entries.length !== 1 ? 'es' : ''} en el diccionario · Activas al refinar con F4
        </p>
      </div>
    </div>
  );
}
