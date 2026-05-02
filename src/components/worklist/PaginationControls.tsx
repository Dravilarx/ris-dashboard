"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  total: number;
  pageSize: number;
  timeRange: string;
  /** Cuando se navega en resultados de busqueda, preserva el query en la URL */
  searchQuery?: string;
}

/**
 * Genera el rango de numeros de pagina visible.
 * Muestra siempre la primera y ultima pagina, y una ventana de 2 paginas
 * a cada lado de la pagina actual. Las brechas se rellenan con "...".
 */
function buildPageRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "...")[] = [1];
  const range = 2;

  if (current - range > 2) pages.push("...");

  for (let i = Math.max(2, current - range); i <= Math.min(total - 1, current + range); i++) {
    pages.push(i);
  }

  if (current + range < total - 1) pages.push("...");
  pages.push(total);

  return pages;
}

export default function PaginationControls({
  currentPage,
  totalPages,
  total,
  pageSize,
  timeRange,
  searchQuery,
}: PaginationControlsProps) {
  const router = useRouter();

  const startRecord = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, total);

  const navigateTo = (page: number) => {
    if (page < 1 || page > totalPages) return;
    const params = new URLSearchParams();
    params.set("page", String(page));
    if (searchQuery && searchQuery.trim().length >= 2) {
      params.set("q", searchQuery.trim());
    } else if (timeRange && timeRange !== "today") {
      params.set("timeRange", timeRange);
    }
    router.push(`/worklist?${params.toString()}`);
  };

  const pages = buildPageRange(currentPage, totalPages);

  if (totalPages <= 1) {
    return (
      <div className="px-8 py-4 border-t border-white/5 flex items-center justify-between bg-white/[0.01] shrink-0">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
          Mostrando {total} de {total} examen{total !== 1 ? "es" : ""}
        </span>
      </div>
    );
  }

  return (
    <div className="px-8 py-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/[0.01] shrink-0">

      {/* Indicador de estado */}
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
        Mostrando{" "}
        <span className="text-cyan-400">{startRecord}–{endRecord}</span>{" "}
        de{" "}
        <span className="text-white">{total}</span>{" "}
        examenes
      </span>

      {/* Controles de navegacion */}
      <nav className="flex items-center gap-1" aria-label="Paginacion del Worklist">

        {/* Anterior */}
        <button
          id="worklist-prev-page"
          onClick={() => navigateTo(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Pagina anterior"
          className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all duration-200 disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Numeros de pagina */}
        {pages.map((p, idx) =>
          p === "..." ? (
            <span
              key={`ellipsis-${idx}`}
              className="w-8 text-center text-slate-600 text-xs select-none"
            >
              ...
            </span>
          ) : (
            <button
              key={`page-${p}`}
              id={`worklist-page-${p}`}
              onClick={() => navigateTo(p as number)}
              aria-label={`Ir a pagina ${p}`}
              aria-current={currentPage === p ? "page" : undefined}
              className={`w-8 h-8 rounded-lg text-[11px] font-black transition-all duration-200 ${
                currentPage === p
                  ? "bg-cyan-500 text-[#020408] shadow-[0_0_15px_rgba(6,182,212,0.4)] scale-110"
                  : "text-slate-500 hover:text-white hover:bg-white/10"
              }`}
            >
              {p}
            </button>
          )
        )}

        {/* Siguiente */}
        <button
          id="worklist-next-page"
          onClick={() => navigateTo(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Pagina siguiente"
          className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all duration-200 disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <ChevronRight size={16} />
        </button>

      </nav>
    </div>
  );
}
