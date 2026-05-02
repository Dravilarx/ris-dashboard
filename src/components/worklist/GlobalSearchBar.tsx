"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";

interface GlobalSearchBarProps {
  /** Valor inicial del campo q (desde URL params del servidor) */
  initialQuery?: string;
}

const DEBOUNCE_MS = 400;

export default function GlobalSearchBar({ initialQuery = "" }: GlobalSearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sincronizar con URL (por si el usuario navega con botones del browser)
  useEffect(() => {
    setValue(initialQuery);
  }, [initialQuery]);

  const navigate = useCallback(
    (q: string) => {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (q.trim().length >= 2) {
        params.set("q", q.trim());
        params.set("page", "1");
      } else {
        // Sin query: volver al worklist normal con filtro de hoy
        const currentTimeRange = searchParams.get("timeRange") ?? "today";
        params.set("timeRange", currentTimeRange);
      }
      router.push(`/worklist?${params.toString()}`);
      setTimeout(() => setIsLoading(false), 600);
    },
    [router, searchParams]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setValue(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.trim().length === 0) {
      // Limpiar instantaneo: volver al worklist normal
      navigate("");
      return;
    }

    if (val.trim().length < 2) return; // esperar al menos 2 caracteres

    debounceRef.current = setTimeout(() => navigate(val), DEBOUNCE_MS);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && value.trim().length >= 2) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      navigate(value);
    }
    if (e.key === "Escape") {
      handleClear();
    }
  };

  const handleClear = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setValue("");
    navigate("");
    inputRef.current?.focus();
  };

  const isSearchActive = value.trim().length >= 2;

  return (
    <div
      className={`relative flex items-center gap-2 w-full max-w-xl transition-all duration-300 ${
        isSearchActive
          ? "ring-1 ring-cyan-500/50"
          : "ring-0"
      } rounded-xl`}
    >
      {/* Icono izquierdo */}
      <div className="absolute left-4 flex items-center pointer-events-none">
        {isLoading ? (
          <Loader2 size={16} className="text-cyan-400 animate-spin" />
        ) : (
          <Search size={16} className={isSearchActive ? "text-cyan-400" : "text-slate-500"} />
        )}
      </div>

      {/* Input */}
      <input
        ref={inputRef}
        id="worklist-global-search"
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Buscar por RUT, nombre o N de acceso... (busqueda historica global)"
        autoComplete="off"
        className={`w-full pl-10 pr-10 py-3 rounded-xl text-sm font-medium border transition-all duration-300
          bg-white/[0.03] text-white placeholder:text-slate-600
          border-white/10 focus:outline-none focus:bg-white/[0.05]
          ${isSearchActive ? "border-cyan-500/40 bg-white/[0.05]" : "hover:border-white/20"}`}
      />

      {/* Boton limpiar */}
      {value.length > 0 && (
        <button
          id="worklist-search-clear"
          onClick={handleClear}
          aria-label="Limpiar busqueda"
          className="absolute right-3 p-1 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
