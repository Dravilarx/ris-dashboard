/**
 * FloatingAIMenu — Menú flotante IA que aparece al seleccionar texto
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Detecata selección de texto en textareas → muestra botones de IA:
 *   [✨ Refinar] [📋 Formalizar] [📝 Resumir]
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, FileText, AlignLeft, Loader2, X } from 'lucide-react';

interface FloatingAIMenuProps {
  /** Ref del contenedor que tiene los textareas */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Callback para refinar texto seleccionado */
  onRefine?: (text: string) => Promise<string>;
  /** Callback para formalizar texto */
  onFormalize?: (text: string) => Promise<string>;
  /** Callback para resumir texto */
  onSummarize?: (text: string) => Promise<string>;
  /** Callback genérico: recibe acción + texto, retorna texto procesado */
  onAction?: (action: 'refine' | 'formalize' | 'summarize', text: string) => Promise<string>;
}

export default function FloatingAIMenu({
  containerRef,
  onRefine,
  onFormalize,
  onSummarize,
  onAction,
}: FloatingAIMenuProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState('');
  const [activeTextarea, setActiveTextarea] = useState<HTMLTextAreaElement | null>(null);
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Detectar selección de texto en textareas
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleSelectionChange = () => {
      // Buscar textarea activo con selección
      const active = document.activeElement;
      if (!(active instanceof HTMLTextAreaElement)) {
        setVisible(false);
        return;
      }

      // Verificar que el textarea está dentro del contenedor
      if (!container.contains(active)) {
        setVisible(false);
        return;
      }

      const start = active.selectionStart;
      const end = active.selectionEnd;
      const text = active.value.substring(start, end).trim();

      if (text.length < 5) {
        setVisible(false);
        return;
      }

      // Calcular posición del menú (debajo de la selección)
      const rect = active.getBoundingClientRect();
      // Aproximar posición vertical basada en líneas
      const lineHeight = parseInt(getComputedStyle(active).lineHeight || '20');
      const textBefore = active.value.substring(0, start);
      const linesBefore = textBefore.split('\n').length;
      
      const x = rect.left + rect.width / 2;
      const y = rect.top + Math.min(linesBefore * lineHeight + lineHeight, rect.height) - active.scrollTop;

      setSelectedText(text);
      setActiveTextarea(active);
      setSelectionRange({ start, end });
      setPosition({ x, y });
      setVisible(true);
    };

    // Usar mouseup y keyup para detectar selección
    const handleMouseUp = () => setTimeout(handleSelectionChange, 50);
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.shiftKey || e.key === 'Shift') setTimeout(handleSelectionChange, 50);
    };

    container.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('keyup', handleKeyUp);

    return () => {
      container.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('keyup', handleKeyUp);
    };
  }, [containerRef]);

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!visible) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setVisible(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [visible]);

  // Ejecutar acción de IA
  const executeAction = useCallback(async (action: 'refine' | 'formalize' | 'summarize') => {
    if (!selectedText || !activeTextarea || !selectionRange) return;
    
    setProcessing(action);
    
    try {
      let result: string | undefined;
      
      if (onAction) {
        result = await onAction(action, selectedText);
      } else if (action === 'refine' && onRefine) {
        result = await onRefine(selectedText);
      } else if (action === 'formalize' && onFormalize) {
        result = await onFormalize(selectedText);
      } else if (action === 'summarize' && onSummarize) {
        result = await onSummarize(selectedText);
      }
      
      if (result && activeTextarea) {
        // Reemplazar el texto seleccionado con el resultado
        const before = activeTextarea.value.substring(0, selectionRange.start);
        const after = activeTextarea.value.substring(selectionRange.end);
        const newValue = before + result + after;
        
        // Trigger React onChange
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value'
        )?.set;
        nativeInputValueSetter?.call(activeTextarea, newValue);
        activeTextarea.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Seleccionar el texto nuevo
        setTimeout(() => {
          activeTextarea.focus();
          activeTextarea.setSelectionRange(selectionRange.start, selectionRange.start + result.length);
        }, 50);
      }
      
      setVisible(false);
    } catch (err: any) {
      console.error('[FloatingAI]', err);
    } finally {
      setProcessing(null);
    }
  }, [selectedText, activeTextarea, selectionRange, onAction, onRefine, onFormalize, onSummarize]);

  if (!visible) return null;

  const actions = [
    { key: 'refine' as const, icon: Sparkles, label: 'Refinar', color: 'from-violet-500 to-purple-600' },
    { key: 'formalize' as const, icon: FileText, label: 'Formalizar', color: 'from-cyan-500 to-blue-600' },
    { key: 'summarize' as const, icon: AlignLeft, label: 'Resumir', color: 'from-emerald-500 to-teal-600' },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] animate-in fade-in slide-in-from-bottom-2 duration-150"
      style={{
        left: `${position.x}px`,
        top: `${position.y + 8}px`,
        transform: 'translateX(-50%)',
      }}
    >
      {/* Arrow */}
      <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-slate-800 border-l border-t border-white/10" />
      
      {/* Menu body */}
      <div className="flex items-center gap-1 bg-slate-800/95 backdrop-blur-xl rounded-xl p-1.5 border border-white/10 shadow-2xl shadow-black/50">
        {actions.map(({ key, icon: Icon, label, color }) => (
          <button
            key={key}
            onClick={() => executeAction(key)}
            disabled={processing !== null}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider
              transition-all duration-150 whitespace-nowrap
              ${processing === key
                ? 'bg-gradient-to-r ' + color + ' text-white shadow-lg scale-95'
                : processing
                  ? 'opacity-40 cursor-not-allowed text-slate-500'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white active:scale-95'
              }
            `}
          >
            {processing === key ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Icon size={12} />
            )}
            {label}
          </button>
        ))}
        
        {/* Close */}
        <button
          onClick={() => setVisible(false)}
          className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X size={12} />
        </button>
      </div>
      
      {/* Selected text preview */}
      <div className="mt-1 px-3 py-1 bg-slate-900/90 rounded-lg border border-white/5 max-w-[300px]">
        <p className="text-[10px] text-slate-500 truncate">
          &quot;{selectedText.substring(0, 60)}{selectedText.length > 60 ? '...' : ''}&quot;
        </p>
      </div>
    </div>
  );
}
