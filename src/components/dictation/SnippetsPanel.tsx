/**
 * SnippetsPanel — Panel lateral de atajos de texto clínicos
 * ═══════════════════════════════════════════════════════════
 * 
 * Categorías de snippets médicos predefinidos + personalizados.
 * Click o drag para insertar en el editor activo.
 * Soporte para comandos rápidos: /normal, /tc, /rm, etc.
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { 
  FileText, ChevronDown, ChevronRight, Search, Plus, Trash2, 
  GripVertical, Star, Stethoscope, Brain, Bone, Heart, Eye
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────
export interface Snippet {
  id: string;
  title: string;
  text: string;
  shortcut?: string; // e.g., "/normal"
  category: string;
  isPinned?: boolean;
  isCustom?: boolean;
}

interface SnippetsPanelProps {
  /** Callback para insertar texto en el editor */
  onInsert: (text: string) => void;
  /** Panel visible */
  isOpen: boolean;
  /** Cerrar panel */
  onClose: () => void;
}

// ─── Snippets Predefinidos ──────────────────────────────────────────────────
const DEFAULT_SNIPPETS: Snippet[] = [
  // HALLAZGOS NORMALES
  {
    id: 'normal-rx-torax',
    title: 'RX Tórax Normal',
    shortcut: '/rxtorax',
    category: 'Hallazgos Normales',
    text: 'Campos pulmonares simétricos, sin evidencia de consolidaciones, masas ni derrames pleurales. Silueta cardíaca de tamaño y morfología normal. Mediastino sin ensanchamiento. Estructuras óseas sin lesiones. Tejidos blandos sin alteraciones.',
  },
  {
    id: 'normal-tc-cerebro',
    title: 'TC Cerebro Normal',
    shortcut: '/tccerebro',
    category: 'Hallazgos Normales',
    text: 'Parénquima cerebral de densidad normal, sin evidencia de colecciones hemáticas intra ni extraaxiales. Sistema ventricular de tamaño y configuración normal. Estructuras de la línea media centradas. Cisternas basales permeables. Estructuras óseas de la calota sin alteraciones. Senos paranasales neumatizados.',
  },
  {
    id: 'normal-tc-abdomen',
    title: 'TC Abdomen Normal',
    shortcut: '/tcabdomen',
    category: 'Hallazgos Normales',
    text: 'Hígado de tamaño y densidad normal, sin lesiones focales. Vesícula biliar de paredes finas, sin litiasis. Vía biliar no dilatada. Páncreas de tamaño y densidad normal. Bazo homogéneo, de tamaño normal. Ambas glándulas suprarrenales sin alteraciones. Riñones de tamaño y morfología normal, con adecuada captación y eliminación del contraste. No se observa líquido libre intraperitoneal. Estructuras vasculares de calibre normal.',
  },
  {
    id: 'normal-rm-columna',
    title: 'RM Columna Lumbar Normal',
    shortcut: '/rmcolumna',
    category: 'Hallazgos Normales',
    text: 'Cuerpos vertebrales de altura y señal conservadas. Discos intervertebrales de altura e intensidad de señal normal, sin protrusiones ni hernias. Canal raquídeo de calibre normal. Cono medular de señal normal, terminando a nivel de L1-L2. Raíces de la cola de caballo sin engrosamiento. Tejidos paravertebrales sin alteraciones.',
  },
  {
    id: 'normal-eco-abdominal',
    title: 'Ecografía Abdominal Normal',
    shortcut: '/ecoabdomen',
    category: 'Hallazgos Normales',
    text: 'Hígado de tamaño y ecogenicidad normal, sin lesiones focales. Vesícula biliar de paredes finas, sin litiasis ni barro biliar. Colédoco de calibre normal. Páncreas de ecogenicidad normal, sin dilatación del conducto pancreático. Bazo homogéneo, de tamaño normal. Ambos riñones de tamaño y ecogenicidad normal, con adecuada diferenciación corticomedular, sin ectasia pielocalicial ni litiasis. Aorta de calibre normal. No se observa líquido libre.',
  },
  {
    id: 'normal-mamografia',
    title: 'Mamografía Normal',
    shortcut: '/mamografia',
    category: 'Hallazgos Normales',
    text: 'Mamas de composición fibroglandular heterogénea (densidad tipo C según ACR). No se identifican nódulos, distorsiones arquitecturales ni microcalcificaciones sospechosas. Región retroareolar sin alteraciones. Axilas sin adenopatías significativas. BIRADS 1: Negativo.',
  },

  // TÉCNICAS
  {
    id: 'tec-tc-contraste',
    title: 'TC con Contraste EV',
    shortcut: '/teccontaste',
    category: 'Técnicas',
    text: 'Se realiza estudio tomográfico con adquisiciones en fase simple y tras la administración endovenosa de medio de contraste yodado no iónico, con reconstrucciones multiplanares.',
  },
  {
    id: 'tec-rm-protocolo',
    title: 'RM Protocolo Estándar',
    shortcut: '/tecrm',
    category: 'Técnicas',
    text: 'Se realiza estudio de resonancia magnética con secuencias potenciadas en T1, T2, STIR y difusión (DWI), en planos axial, sagital y coronal, antes y después de la administración endovenosa de gadolinio.',
  },
  {
    id: 'tec-rx-simple',
    title: 'RX Simple',
    shortcut: '/tecrx',
    category: 'Técnicas',
    text: 'Se realizan radiografías digitales en proyecciones anteroposterior y lateral.',
  },

  // IMPRESIONES FRECUENTES
  {
    id: 'imp-sin-hallazgos',
    title: 'Sin Hallazgos Patológicos',
    shortcut: '/normal',
    category: 'Impresiones',
    text: 'Estudio sin hallazgos patológicos significativos en el momento actual.',
  },
  {
    id: 'imp-control',
    title: 'Sugiere Control',
    shortcut: '/control',
    category: 'Impresiones',
    text: 'Se sugiere control imagenológico en el contexto clínico del paciente.',
  },
  {
    id: 'imp-correlacionar',
    title: 'Correlacionar Clínicamente',
    shortcut: '/correlacionar',
    category: 'Impresiones',
    text: 'Hallazgos a correlacionar con antecedentes clínicos y de laboratorio del paciente.',
  },

  // HALLAZGOS COMUNES
  {
    id: 'hall-derrame-pleural',
    title: 'Derrame Pleural',
    shortcut: '/derrame',
    category: 'Hallazgos Comunes',
    text: 'Se observa derrame pleural de distribución libre, que se extiende hasta el nivel del tercio medio del hemitórax.',
  },
  {
    id: 'hall-hernia-discal',
    title: 'Hernia Discal',
    shortcut: '/hernia',
    category: 'Hallazgos Comunes',
    text: 'Se identifica hernia discal de tipo protrusión de base amplia, que contacta el saco tecal y desplaza la raíz nerviosa emergente.',
  },
  {
    id: 'hall-litiasis',
    title: 'Litiasis Renal',
    shortcut: '/litiasis',
    category: 'Hallazgos Comunes',
    text: 'Se identifica imagen litiásica a nivel del grupo calicial, con densidad de aproximadamente UH, que condiciona leve ectasia del sistema colector.',
  },
];

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  'Hallazgos Normales': Stethoscope,
  'Técnicas': FileText,
  'Impresiones': Brain,
  'Hallazgos Comunes': Bone,
  'Favoritos': Star,
};

// ─── Component ──────────────────────────────────────────────────────────────
export default function SnippetsPanel({ onInsert, isOpen, onClose }: SnippetsPanelProps) {
  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Hallazgos Normales', 'Impresiones']));
  const [customSnippets, setCustomSnippets] = useState<Snippet[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem('amis_custom_snippets') || '[]');
    } catch { return []; }
  });

  const allSnippets = useMemo(() => [...DEFAULT_SNIPPETS, ...customSnippets], [customSnippets]);
  
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
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleInsert = useCallback((snippet: Snippet) => {
    onInsert(snippet.text);
  }, [onInsert]);

  const handleDeleteCustom = useCallback((id: string) => {
    setCustomSnippets(prev => {
      const next = prev.filter(s => s.id !== id);
      localStorage.setItem('amis_custom_snippets', JSON.stringify(next));
      return next;
    });
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 bottom-0 w-[340px] bg-slate-900/98 backdrop-blur-xl border-l border-white/10 z-50 flex flex-col shadow-2xl shadow-black/50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-cyan-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Snippets Clínicos</h3>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
          ✕
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-white/5">
        <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
          <Search size={14} className="text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar snippet o /comando..."
            className="bg-transparent text-sm text-white placeholder-slate-500 flex-1 outline-none"
          />
        </div>
      </div>

      {/* Snippets List */}
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
                <div className="ml-4 space-y-0.5 mb-2">
                  {snippets.map(snippet => (
                    <div
                      key={snippet.id}
                      className="group flex items-start gap-2 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
                      onClick={() => handleInsert(snippet)}
                      title={snippet.text}
                    >
                      <GripVertical size={12} className="text-slate-700 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-300 group-hover:text-white transition-colors">
                            {snippet.title}
                          </span>
                          {snippet.shortcut && (
                            <code className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-cyan-400 font-mono">
                              {snippet.shortcut}
                            </code>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-600 line-clamp-2 mt-0.5 leading-relaxed">
                          {snippet.text.substring(0, 100)}...
                        </p>
                      </div>
                      {snippet.isCustom && (
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteCustom(snippet.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-600 hover:text-red-400 transition-all"
                        >
                          <Trash2 size={10} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <div className="p-3 border-t border-white/5">
        <p className="text-[10px] text-slate-600 text-center">
          Click para insertar · Escribe <code className="text-cyan-500">/comando</code> en el editor
        </p>
      </div>
    </div>
  );
}

// ─── Snippet Command Processor ──────────────────────────────────────────────
/**
 * Procesa comandos de snippet en texto (e.g., "/normal" → texto del snippet)
 * Usar en onChange del textarea para detectar y reemplazar comandos.
 */
export function processSnippetCommand(
  text: string, 
  cursorPos: number,
  customSnippets: Snippet[] = []
): { processed: boolean; newText: string; newCursorPos: number } {
  const allSnippets = [...DEFAULT_SNIPPETS, ...customSnippets];
  
  // Buscar comando justo antes del cursor
  const beforeCursor = text.substring(0, cursorPos);
  const match = beforeCursor.match(/\/(\w+)\s$/);
  
  if (!match) return { processed: false, newText: text, newCursorPos: cursorPos };
  
  const command = '/' + match[1];
  const snippet = allSnippets.find(s => s.shortcut === command);
  
  if (!snippet) return { processed: false, newText: text, newCursorPos: cursorPos };
  
  // Reemplazar comando con texto del snippet
  const commandStart = cursorPos - match[0].length;
  const before = text.substring(0, commandStart);
  const after = text.substring(cursorPos);
  const newText = before + snippet.text + ' ' + after;
  const newCursorPos = commandStart + snippet.text.length + 1;
  
  return { processed: true, newText, newCursorPos };
}
