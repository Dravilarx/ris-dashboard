'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  FileText, ChevronDown, ChevronRight, Search, Plus, Trash2,
  GripVertical, Star, Stethoscope, Brain, Bone, Settings, ArrowLeft, Save, X
} from 'lucide-react';

export interface Snippet {
  id: string;
  title: string;
  text: string;
  shortcut?: string;
  category: string;
  isPinned?: boolean;
  isCustom?: boolean;
}

interface SnippetsPanelProps {
  onInsert: (text: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const DEFAULT_SNIPPETS: Snippet[] = [
  { id: 'normal-rx-torax', title: 'RX Tórax Normal', shortcut: '/rxtorax', category: 'Hallazgos Normales', text: 'Campos pulmonares simétricos, sin evidencia de consolidaciones, masas ni derrames pleurales. Silueta cardíaca de tamaño y morfología normal. Mediastino sin ensanchamiento. Estructuras óseas sin lesiones.' },
  { id: 'normal-tc-cerebro', title: 'TC Cerebro Normal', shortcut: '/tccerebro', category: 'Hallazgos Normales', text: 'Parénquima cerebral de densidad normal, sin evidencia de colecciones hemáticas. Sistema ventricular de tamaño y configuración normal. Estructuras de la línea media centradas. Cisternas basales permeables.' },
  { id: 'normal-tc-abdomen', title: 'TC Abdomen Normal', shortcut: '/tcabdomen', category: 'Hallazgos Normales', text: 'Hígado de tamaño y densidad normal, sin lesiones focales. Vesícula biliar de paredes finas, sin litiasis. Vía biliar no dilatada. Páncreas, bazo y riñones sin alteraciones. No se observa líquido libre.' },
  { id: 'normal-rm-columna', title: 'RM Columna Lumbar Normal', shortcut: '/rmcolumna', category: 'Hallazgos Normales', text: 'Cuerpos vertebrales de altura y señal conservadas. Discos intervertebrales sin protrusiones ni hernias. Canal raquídeo de calibre normal. Cono medular de señal normal terminando a nivel L1-L2.' },
  { id: 'normal-eco-abdominal', title: 'Ecografía Abdominal Normal', shortcut: '/ecoabdomen', category: 'Hallazgos Normales', text: 'Hígado de tamaño y ecogenicidad normal. Vesícula biliar de paredes finas, sin litiasis. Páncreas de ecogenicidad normal. Ambos riñones de tamaño y ecogenicidad normal. No se observa líquido libre.' },
  { id: 'normal-mamografia', title: 'Mamografía Normal', shortcut: '/mamografia', category: 'Hallazgos Normales', text: 'Mamas de composición fibroglandular heterogénea (densidad tipo C según ACR). No se identifican nódulos, distorsiones arquitecturales ni microcalcificaciones sospechosas. BIRADS 1: Negativo.' },
  { id: 'tec-tc-contraste', title: 'TC con Contraste EV', shortcut: '/teccontraste', category: 'Técnicas', text: 'Se realiza estudio tomográfico con adquisiciones en fase simple y tras la administración endovenosa de medio de contraste yodado no iónico, con reconstrucciones multiplanares.' },
  { id: 'tec-rm-protocolo', title: 'RM Protocolo Estándar', shortcut: '/tecrm', category: 'Técnicas', text: 'Se realiza estudio de resonancia magnética con secuencias potenciadas en T1, T2, STIR y difusión (DWI), en planos axial, sagital y coronal, antes y después de la administración endovenosa de gadolinio.' },
  { id: 'tec-rx-simple', title: 'RX Simple', shortcut: '/tecrx', category: 'Técnicas', text: 'Se realizan radiografías digitales en proyecciones anteroposterior y lateral.' },
  { id: 'imp-sin-hallazgos', title: 'Sin Hallazgos Patológicos', shortcut: '/normal', category: 'Impresiones', text: 'Estudio sin hallazgos patológicos significativos en el momento actual.' },
  { id: 'imp-control', title: 'Sugiere Control', shortcut: '/control', category: 'Impresiones', text: 'Se sugiere control imagenológico en el contexto clínico del paciente.' },
  { id: 'imp-correlacionar', title: 'Correlacionar Clínicamente', shortcut: '/correlacionar', category: 'Impresiones', text: 'Hallazgos a correlacionar con antecedentes clínicos y de laboratorio del paciente.' },
  { id: 'hall-derrame-pleural', title: 'Derrame Pleural', shortcut: '/derrame', category: 'Hallazgos Comunes', text: 'Se observa derrame pleural de distribución libre, que se extiende hasta el nivel del tercio medio del hemitórax.' },
  { id: 'hall-hernia-discal', title: 'Hernia Discal', shortcut: '/hernia', category: 'Hallazgos Comunes', text: 'Se identifica hernia discal de tipo protrusión de base amplia, que contacta el saco tecal y desplaza la raíz nerviosa emergente.' },
  { id: 'hall-litiasis', title: 'Litiasis Renal', shortcut: '/litiasis', category: 'Hallazgos Comunes', text: 'Se identifica imagen litiásica a nivel del grupo calicial que condiciona leve ectasia del sistema colector.' },
];

const CATEGORIES = ['Hallazgos Normales', 'Técnicas', 'Impresiones', 'Hallazgos Comunes', 'Antecedentes', 'Favoritos', 'Personalizado'];

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  'Hallazgos Normales': Stethoscope,
  'Técnicas': FileText,
  'Impresiones': Brain,
  'Hallazgos Comunes': Bone,
  'Favoritos': Star,
};

// ─── Empty form state ─────────────────────────────────────────────────────────
const EMPTY_FORM = { title: '', shortcut: '', category: 'Hallazgos Normales', text: '' };

// ─── Component ───────────────────────────────────────────────────────────────
export default function SnippetsPanel({ onInsert, isOpen, onClose }: SnippetsPanelProps) {
  const [view, setView] = useState<'list' | 'crud'>('list');
  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Hallazgos Normales', 'Impresiones']));
  const [customSnippets, setCustomSnippets] = useState<Snippet[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('amis_custom_snippets') || '[]'); } catch { return []; }
  });
  // IDs de snippets predeterminados que el usuario ha ocultado
  const [hiddenDefaultIds, setHiddenDefaultIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try { return new Set(JSON.parse(localStorage.getItem('amis_hidden_snippets') || '[]')); } catch { return new Set(); }
  });

  // CRUD state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const allSnippets = useMemo(
    () => [...DEFAULT_SNIPPETS.filter(s => !hiddenDefaultIds.has(s.id)), ...customSnippets],
    [customSnippets, hiddenDefaultIds]
  );

  const saveCustom = (snippets: Snippet[]) => {
    setCustomSnippets(snippets);
    localStorage.setItem('amis_custom_snippets', JSON.stringify(snippets));
  };

  const filteredSnippets = useMemo(() => {
    if (!search.trim()) return allSnippets;
    const q = search.toLowerCase();
    return allSnippets.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.text.toLowerCase().includes(q) ||
      s.shortcut?.toLowerCase().includes(q)
    );
  }, [allSnippets, search]);

  const groupedSnippets = useMemo(() => {
    const groups: Record<string, Snippet[]> = {};
    filteredSnippets.forEach(s => {
      if (!groups[s.category]) groups[s.category] = [];
      groups[s.category].push(s);
    });
    return groups;
  }, [filteredSnippets]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const handleInsert = useCallback((snippet: Snippet) => { onInsert(snippet.text); }, [onInsert]);

  /** Oculta un snippet predeterminado (lo agrega a la lista negra en localStorage) */
  const hideDefault = useCallback((id: string) => {
    setHiddenDefaultIds(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem('amis_hidden_snippets', JSON.stringify([...next]));
      return next;
    });
  }, []);

  /** Restaura todos los snippets predeterminados ocultados */
  const restoreDefaults = useCallback(() => {
    setHiddenDefaultIds(new Set());
    localStorage.removeItem('amis_hidden_snippets');
  }, []);

  // CRUD actions
  const startCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setView('crud'); };
  const startEdit = (s: Snippet) => {
    setEditingId(s.id);
    setForm({ title: s.title, shortcut: s.shortcut || '', category: s.category, text: s.text });
    setView('crud');
  };
  const handleSave = () => {
    if (!form.title.trim() || !form.text.trim()) return;
    const shortcut = form.shortcut.trim().startsWith('/') ? form.shortcut.trim() : form.shortcut.trim() ? `/${form.shortcut.trim()}` : undefined;
    if (editingId) {
      // Update existing custom snippet
      const updated = customSnippets.map(s => s.id === editingId ? { ...s, ...form, shortcut } : s);
      saveCustom(updated);
    } else {
      // Create new
      const newSnippet: Snippet = { id: `custom-${Date.now()}`, ...form, shortcut, isCustom: true };
      saveCustom([...customSnippets, newSnippet]);
    }
    setView('list');
  };
  const handleDelete = (id: string) => {
    saveCustom(customSnippets.filter(s => s.id !== id));
    setConfirmDelete(null);
    if (editingId === id) setView('list');
  };

  if (!isOpen) return null;

  // ── CRUD View ──────────────────────────────────────────────────────────────
  if (view === 'crud') {
    return (
      <div className="fixed right-0 top-0 bottom-0 w-[360px] bg-slate-900/98 backdrop-blur-xl border-l border-white/10 z-50 flex flex-col shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <button onClick={() => setView('list')} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
              <ArrowLeft size={14} />
            </button>
            <Settings size={14} className="text-cyan-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              {editingId ? 'Editar Snippet' : 'Nuevo Snippet'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"><X size={14} /></button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nombre</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Ej: TC Tórax Normal"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-cyan-500/50 transition-colors"
            />
          </div>

          {/* Shortcut */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Comando <span className="text-slate-600 normal-case font-normal">(e.g. /tctorax)</span></label>
            <input
              value={form.shortcut}
              onChange={e => setForm(f => ({ ...f, shortcut: e.target.value }))}
              placeholder="/micomando"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-cyan-400 placeholder-slate-600 outline-none focus:border-cyan-500/50 transition-colors font-mono"
            />
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Categoría</label>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500/50 transition-colors appearance-none"
            >
              {CATEGORIES.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
            </select>
          </div>

          {/* Text body */}
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Texto del Snippet</label>
            <textarea
              value={form.text}
              onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
              placeholder="Escribe el texto clínico completo que se insertará en el informe..."
              rows={8}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-cyan-500/50 transition-colors resize-none leading-relaxed"
            />
            <span className="text-[9px] text-slate-600 text-right">{form.text.length} caracteres</span>
          </div>

          {/* All custom snippets list for quick edit */}
          {customSnippets.length > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-t border-white/5 pt-3">Mis Snippets</p>
              {customSnippets.map(s => (
                <div key={s.id} className="flex items-center gap-2 p-2.5 bg-white/[0.03] border border-white/5 rounded-xl group">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-slate-300 block truncate">{s.title}</span>
                    {s.shortcut && <code className="text-[9px] text-cyan-500 font-mono">{s.shortcut}</code>}
                  </div>
                  <button onClick={() => startEdit(s)} className="p-1.5 rounded-lg text-slate-600 hover:text-cyan-400 hover:bg-cyan-400/10 transition-all opacity-0 group-hover:opacity-100">
                    <Settings size={11} />
                  </button>
                  {confirmDelete === s.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleDelete(s.id)} className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[9px] font-black rounded-lg border border-red-500/30">Sí</button>
                      <button onClick={() => setConfirmDelete(null)} className="px-2 py-0.5 bg-white/5 text-slate-400 text-[9px] font-black rounded-lg border border-white/10">No</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(s.id)} className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100">
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer: Save + Cancel */}
        <div className="p-4 border-t border-white/10 flex gap-2">
          <button onClick={() => setView('list')} className="flex-1 py-2.5 bg-white/5 text-slate-400 text-sm font-black uppercase tracking-widest rounded-xl border border-white/10 hover:bg-white/10 transition-all">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!form.title.trim() || !form.text.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-cyan-500/20 text-cyan-400 text-sm font-black uppercase tracking-widest rounded-xl border border-cyan-500/30 hover:bg-cyan-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Save size={14} />
            {editingId ? 'Actualizar' : 'Guardar'}
          </button>
        </div>
      </div>
    );
  }

  // ── LIST View ──────────────────────────────────────────────────────────────
  return (
    <div className="fixed right-0 top-0 bottom-0 w-[340px] bg-slate-900/98 backdrop-blur-xl border-l border-white/10 z-50 flex flex-col shadow-2xl shadow-black/50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-cyan-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Snippets Clínicos</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={startCreate}
            title="Nuevo snippet"
            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setView('crud'); }}
            title="Gestionar snippets"
            className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-400/10 transition-colors"
          >
            <Settings size={14} />
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-white/5">
        <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
          <Search size={14} className="text-slate-500 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar snippet o /comando..."
            className="bg-transparent text-sm text-white placeholder-slate-500 flex-1 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-slate-600 hover:text-white transition-colors">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {Object.entries(groupedSnippets).map(([category, snippets]) => {
          const CategoryIcon = CATEGORY_ICONS[category] || FileText;
          const isExpanded = expandedCategories.has(category);
          return (
            <div key={category}>
              <button
                onClick={() => toggleCategory(category)}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-left text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <CategoryIcon size={12} />
                <span className="flex-1">{category}</span>
                <span className="text-[10px] text-slate-600 font-normal">{snippets.length}</span>
              </button>
              {isExpanded && (
                <div className="ml-2 space-y-0.5 mb-2">
                  {snippets.map(snippet => (
                    <div key={snippet.id} className="group flex items-start gap-1.5 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors">
                      {/* Click area para insertar */}
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleInsert(snippet)}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-slate-300 group-hover:text-white transition-colors">{snippet.title}</span>
                          {snippet.shortcut && (
                            <code className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-cyan-400 font-mono border border-white/5">{snippet.shortcut}</code>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-600 line-clamp-1 mt-0.5 leading-relaxed">{snippet.text.substring(0, 80)}…</p>
                      </div>
                      {/* Botones de acción — SIEMPRE VISIBLES */}
                      <div className="flex items-center gap-0.5 shrink-0 ml-1">
                        {snippet.isCustom ? (
                          <>
                            <button onClick={e => { e.stopPropagation(); startEdit(snippet); }} className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-cyan-400/10 transition-all" title="Editar snippet">
                              <Settings size={11} />
                            </button>
                            {confirmDelete === snippet.id ? (
                              <div className="flex items-center gap-0.5">
                                <button onClick={e => { e.stopPropagation(); handleDelete(snippet.id); }} className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[9px] font-black rounded-lg border border-red-500/30 hover:bg-red-500/30">Sí</button>
                                <button onClick={e => { e.stopPropagation(); setConfirmDelete(null); }} className="px-1.5 py-0.5 bg-white/5 text-slate-400 text-[9px] font-black rounded-lg border border-white/10">No</button>
                              </div>
                            ) : (
                              <button onClick={e => { e.stopPropagation(); setConfirmDelete(snippet.id); }} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all" title="Eliminar snippet">
                                <Trash2 size={11} />
                              </button>
                            )}
                          </>
                        ) : (
                          confirmDelete === snippet.id ? (
                            <div className="flex items-center gap-0.5">
                              <button onClick={e => { e.stopPropagation(); hideDefault(snippet.id); setConfirmDelete(null); }} className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[9px] font-black rounded-lg border border-red-500/30 hover:bg-red-500/30">Ocultar</button>
                              <button onClick={e => { e.stopPropagation(); setConfirmDelete(null); }} className="px-1.5 py-0.5 bg-white/5 text-slate-400 text-[9px] font-black rounded-lg border border-white/10">No</button>
                            </div>
                          ) : (
                            <button onClick={e => { e.stopPropagation(); setConfirmDelete(snippet.id); }} className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-all" title="Ocultar snippet predeterminado">
                              <Trash2 size={11} />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {Object.keys(groupedSnippets).length === 0 && (
          <div className="py-12 text-center">
            <p className="text-slate-600 text-sm">Sin resultados para &ldquo;{search}&rdquo;</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-white/5 flex flex-col gap-2">
        {hiddenDefaultIds.size > 0 && (
          <button
            onClick={restoreDefaults}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-amber-500/10 text-amber-400 text-[10px] font-black uppercase tracking-widest rounded-lg border border-amber-500/20 hover:bg-amber-500/20 transition-all"
          >
            Restaurar {hiddenDefaultIds.size} snippet{hiddenDefaultIds.size > 1 ? 's' : ''} oculto{hiddenDefaultIds.size > 1 ? 's' : ''}
          </button>
        )}
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-slate-600">
            Click para insertar · <code className="text-cyan-500">/cmd</code> en el editor
          </p>
          <button
            onClick={startCreate}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-cyan-500/10 text-cyan-400 text-[10px] font-black uppercase tracking-widest rounded-lg border border-cyan-500/20 hover:bg-cyan-500/20 transition-all"
          >
            <Plus size={10} /> Nuevo
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Snippet Command Processor (legacy exact-match, kept for compatibility) ──
export function processSnippetCommand(
  text: string,
  cursorPos: number,
  customSnippets: Snippet[] = []
): { processed: boolean; newText: string; newCursorPos: number } {
  const allSnippets = [...DEFAULT_SNIPPETS, ...customSnippets];
  const beforeCursor = text.substring(0, cursorPos);
  const match = beforeCursor.match(/\/(\w+)\s$/);
  if (!match) return { processed: false, newText: text, newCursorPos: cursorPos };
  const command = '/' + match[1];
  const snippet = allSnippets.find(s => s.shortcut === command);
  if (!snippet) return { processed: false, newText: text, newCursorPos: cursorPos };
  const commandStart = cursorPos - match[0].length;
  const before = text.substring(0, commandStart);
  const after = text.substring(cursorPos);
  const newText = before + snippet.text + ' ' + after;
  const newCursorPos = commandStart + snippet.text.length + 1;
  return { processed: true, newText, newCursorPos };
}
