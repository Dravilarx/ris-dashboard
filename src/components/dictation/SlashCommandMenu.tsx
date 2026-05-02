"use client";

/**
 * SlashCommandMenu — Menú flotante de snippets activado por '/' en el editor
 * ═══════════════════════════════════════════════════════════════════════════
 * - Se activa cuando el usuario escribe '/' en cualquier sección del informe
 * - Filtra en tiempo real con fuzzy search sobre título, shortcut y texto
 * - Navegación con ↑↓, selección con Tab/Enter, cierre con Escape
 * - Auto-resalta el único resultado cuando queda uno solo
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Command, CornerDownLeft, Hash, Star } from 'lucide-react';
import type { Snippet } from './SnippetsPanel';

interface SlashCommandMenuProps {
  query: string;
  snippets: Snippet[];
  onSelect: (snippet: Snippet) => void;
  onClose: () => void;
  /** Rect del textarea activo para posicionamiento aproximado */
  anchorRect?: DOMRect;
  /** Categorías relevantes para el campo activo (contexto inteligente) */
  sectionCategories?: string[];
  /** Etiqueta legible del campo activo, p.ej. 'Hallazgos' */
  sectionLabel?: string;
}

// ─── Fuzzy scorer ────────────────────────────────────────────────────────────
function fuzzyScore(snippet: Snippet, query: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();

  // Score por coincidencia exacta en shortcut (máximo peso)
  const shortcutScore = snippet.shortcut?.toLowerCase().includes(q) ? 4 : 0;
  const titleExact    = snippet.title.toLowerCase().includes(q) ? 2 : 0;
  const textScore     = snippet.text.toLowerCase().includes(q)  ? 0.5 : 0;

  // Fuzzy char-by-char en el título
  let fuzzy = 0;
  if (!titleExact) {
    const h = snippet.title.toLowerCase();
    let j = 0;
    for (let i = 0; i < h.length && j < q.length; i++) {
      if (h[i] === q[j]) { fuzzy += 0.2; j++; }
    }
    if (j < q.length) fuzzy = 0; // no coincidieron todos los caracteres
  }

  return shortcutScore + titleExact + textScore + fuzzy;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Hallazgos Normales': 'text-emerald-400 bg-emerald-400/10',
  'Técnicas':           'text-blue-400 bg-blue-400/10',
  'Impresiones':        'text-violet-400 bg-violet-400/10',
  'Hallazgos Comunes':  'text-amber-400 bg-amber-400/10',
  'Favoritos':          'text-rose-400 bg-rose-400/10',
  'Antecedentes':       'text-sky-400 bg-sky-400/10',
  'Personalizado':      'text-slate-400 bg-white/5',
};

/** Etiquetas amigables para mostrar el contexto de sección */
const SECTION_LABELS: Record<string, string> = {
  technique: 'Técnica de Estudio',
  history:   'Antecedentes',
  findings:  'Hallazgos',
  impression:'Impresión Diagnóstica',
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function SlashCommandMenu({
  query,
  snippets,
  onSelect,
  onClose,
  anchorRect,
  sectionCategories,
  sectionLabel,
}: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  // ── Context filter + favorites-first sort + fuzzy score ──────────────────
  const filtered = useMemo(() => {
    // Step 1: restrict to section context
    const inContext = sectionCategories && sectionCategories.length > 0
      ? snippets.filter(s => sectionCategories.includes(s.category))
      : snippets;

    const pool = inContext.length > 0 ? inContext : snippets;

    // Step 2: fuzzy filter
    let results: Snippet[];
    if (!query) {
      results = pool.slice(0, 10);
    } else {
      results = pool
        .map(s => ({ snippet: s, score: fuzzyScore(s, query) }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(x => x.snippet)
        .slice(0, 10);
    }

    // Step 3: favorites bubble to top
    const favs    = results.filter(s => s.isFavorite);
    const nonFavs = results.filter(s => !s.isFavorite);
    return [...favs, ...nonFavs].slice(0, 8);
  }, [query, snippets, sectionCategories]);

  const isContextFiltered = !!(sectionCategories && sectionCategories.length > 0);

  // Reset selection when results change
  useEffect(() => { setSelectedIndex(0); }, [filtered]);

  // Keyboard navigation — captured in capture phase so it runs before textarea
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Tab' || e.key === 'Enter') {
      if (filtered[selectedIndex]) {
        e.preventDefault();
        e.stopPropagation();
        onSelect(filtered[selectedIndex]);
      }
    }
  }, [filtered, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [handleKey]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (filtered.length === 0) return null;

  // ── Positioning ──────────────────────────────────────────────────────────
  let style: React.CSSProperties = { position: 'fixed', zIndex: 1000 };
  if (anchorRect) {
    const spaceBelow = window.innerHeight - anchorRect.bottom;
    if (spaceBelow > 250) {
      style = { ...style, top: anchorRect.bottom + 8, left: Math.max(8, anchorRect.left + 40) };
    } else {
      style = { ...style, bottom: window.innerHeight - anchorRect.top + 8, left: Math.max(8, anchorRect.left + 40) };
    }
  } else {
    style = { ...style, bottom: 120, left: '50%', transform: 'translateX(-50%)' };
  }

  const singleResult = filtered.length === 1;

  return (
    <div
      style={{ ...style, width: '440px', maxWidth: 'calc(100vw - 24px)' }}
      className="bg-[#06080f]/98 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-black/90 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 bg-cyan-500/20 border border-cyan-500/30 rounded-lg flex items-center justify-center">
            <Command size={10} className="text-cyan-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {isContextFiltered && sectionLabel ? `Contexto: ${sectionLabel}` : 'Snippets Clínicos'}
            </span>
            {isContextFiltered && filtered.some(s => s.isFavorite) && (
              <span className="text-[8px] text-amber-400/70 font-medium">⭐ Favoritos primero</span>
            )}
          </div>
          {query && (
            <span className="px-2 py-0.5 bg-cyan-500/15 text-cyan-300 text-[10px] font-black rounded-full border border-cyan-500/25 font-mono">
              /{query}
            </span>
          )}
        </div>
        <div className="hidden lg:flex items-center gap-2 text-[9px] text-slate-600">
          <span className="flex items-center gap-0.5">
            <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-slate-500 font-mono">↑↓</kbd>
            <span>navegar</span>
          </span>
          <span className="flex items-center gap-0.5">
            <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-slate-500 font-mono">⏎</kbd>
            <span>insertar</span>
          </span>
          <span className="flex items-center gap-0.5">
            <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-slate-500 font-mono">Esc</kbd>
            <span>cerrar</span>
          </span>
        </div>
      </div>

      {/* Results list */}
      <ul ref={listRef} className="max-h-[260px] overflow-y-auto">
        {filtered.map((snippet, idx) => {
          const isSelected = idx === selectedIndex;
          const catStyle = CATEGORY_COLORS[snippet.category] || 'text-slate-400 bg-white/5';

          return (
            <li
              key={snippet.id}
              onClick={() => onSelect(snippet)}
              className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-all duration-150 ${
                isSelected
                  ? 'bg-cyan-500/8 border-l-[3px] border-cyan-400'
                  : 'hover:bg-white/[0.04] border-l-[3px] border-transparent'
              }`}
            >
              {/* Left: shortcut badge */}
              <div className="shrink-0 mt-0.5">
                {snippet.shortcut ? (
                  <code className={`inline-block px-1.5 py-0.5 text-[9px] font-black rounded-lg border border-current/20 ${catStyle}`}>
                    {snippet.shortcut}
                  </code>
                ) : (
                  <Hash size={12} className="text-slate-600 mt-0.5" />
                )}
              </div>

              {/* Center: title + preview */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  {snippet.isFavorite && (
                    <span title="Favorito" className="text-amber-400"><Star size={9} fill="currentColor" /></span>
                  )}
                  <span className={`text-[12px] font-bold ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                    {snippet.title}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider border border-current/20 ${catStyle}`}>
                    {snippet.category}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 line-clamp-1 leading-relaxed">
                  {snippet.text.substring(0, 85)}…
                </p>
              </div>

              {/* Right: enter icon if selected */}
              {isSelected && (
                <div className="shrink-0 self-center">
                  <div className="w-6 h-6 bg-cyan-500/20 border border-cyan-500/30 rounded-lg flex items-center justify-center">
                    <CornerDownLeft size={10} className="text-cyan-400" />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Solo un resultado: resaltado verde */}
      {singleResult && (
        <div className="px-4 py-2 border-t border-emerald-500/10 bg-emerald-500/5 flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          <p className="text-[9px] text-emerald-400 font-black uppercase tracking-widest">
            Resultado único — presiona Enter para insertar
          </p>
        </div>
      )}
    </div>
  );
}
