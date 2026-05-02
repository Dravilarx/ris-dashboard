"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";

interface WorklistLiveBarProps {
  /** Total de estudios en la carga inicial del servidor */
  initialTotal: number;
  /** ID del estudio mas reciente en la carga inicial */
  initialLatestId: number | null;
  /** Filtro de tiempo activo para la query de polling */
  timeRange: string;
  /** Pagina actual (para volver a p.1 cuando hay nuevos estudios) */
  currentPage: number;
}

const POLL_INTERVAL_MS = 30_000; // 30 segundos

export default function WorklistLiveBar({
  initialTotal,
  initialLatestId,
  timeRange,
  currentPage,
}: WorklistLiveBarProps) {
  const router = useRouter();
  const [newCount, setNewCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [lastCheck, setLastCheck] = useState<string>("--:--");
  const totalRef = useRef(initialTotal);
  const latestIdRef = useRef(initialLatestId);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/worklist/poll?timeRange=${timeRange}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("poll failed");

      const data = await res.json();
      setIsOnline(true);

      // Nuevos estudios = incremento en total O nuevo ID mas alto
      const hasNewStudies =
        data.total > totalRef.current ||
        (data.latestId !== null &&
          latestIdRef.current !== null &&
          data.latestId > latestIdRef.current);

      if (hasNewStudies) {
        const delta = Math.max(0, data.total - totalRef.current);
        setNewCount((prev) => prev + delta || 1);
        // Actualizar referencias para el siguiente ciclo
        totalRef.current = data.total;
        latestIdRef.current = data.latestId;
      }

      const now = new Date();
      setLastCheck(`${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`);
    } catch {
      setIsOnline(false);
    }
  }, [timeRange]);

  useEffect(() => {
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [poll]);

  const handleRefresh = () => {
    setNewCount(0);
    // Volver a pagina 1 con timeRange actual para ver los estudios nuevos primero
    const params = new URLSearchParams();
    params.set("timeRange", timeRange);
    params.set("page", "1");
    router.push(`/worklist?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest">
      {/* Indicador de conexion */}
      {isOnline ? (
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,1)]" />
          <span className="text-emerald-400">Live</span>
          <span className="text-slate-600 normal-case font-medium">{lastCheck}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-amber-400">
          <WifiOff size={12} />
          <span>Sin conexion</span>
        </div>
      )}

      {/* Notificacion de nuevos estudios */}
      {newCount > 0 && (
        <button
          id="worklist-refresh-new"
          onClick={handleRefresh}
          className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/25 transition-all animate-pulse"
        >
          <RefreshCw size={10} className="shrink-0" />
          <span>{newCount} nuevo{newCount > 1 ? "s" : ""} &middot; Actualizar</span>
        </button>
      )}
    </div>
  );
}
