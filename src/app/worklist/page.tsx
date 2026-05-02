import React, { Suspense } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import WorklistTable from "@/components/worklist/WorklistTable";
import PaginationControls from "@/components/worklist/PaginationControls";
import WorklistLiveBar from "@/components/worklist/WorklistLiveBar";
import GlobalSearchBar from "@/components/worklist/GlobalSearchBar";
import { fetchEnrichedWorklist } from "@/lib/services/enrichment-service";
import { getWorklistStats } from "@/lib/db/queries";
import type { WorklistFilters } from "@/types/ris";
import {
  Clock,
  FileText,
  CheckCircle2,
  AlertCircle,
  Plus,
  LayoutDashboard,
  History,
  SearchX,
} from "lucide-react";

export const metadata = {
  title: "Panel de Trabajo | AMIS RIS 2030",
  description: "Worklist unificado con paginacion del lado del servidor y busqueda historica global.",
};

const PAGE_SIZE = 30;

interface PageProps {
  searchParams: Promise<{
    timeRange?: "today" | "24h" | "all";
    status?: string;
    page?: string;
    q?: string;
  }>;
}

export default async function WorklistPage({ searchParams }: PageProps) {
  const { timeRange = "today", status, page: pageParam, q } = await searchParams;

  const currentPage = Math.max(1, parseInt(pageParam ?? "1") || 1);
  const isSearchMode = typeof q === "string" && q.trim().length >= 2;

  const filters: WorklistFilters = isSearchMode
    ? { q: q.trim() }
    : {
        timeRange,
        examStatusId: status ? parseInt(status) : undefined,
      };

  // En modo busqueda: no hay stats por filtro de tiempo, ambas queries en paralelo
  const [{ data: studies, total, totalPages }, stats] = await Promise.all([
    fetchEnrichedWorklist({ page: currentPage, pageSize: PAGE_SIZE }, filters),
    isSearchMode
      ? Promise.resolve({ pending: 0, informed: 0, validated: 0, urgent: 0, total: 0 })
      : getWorklistStats(timeRange),
  ]);

  const safeStudies = studies ?? [];

  const timeLabel =
    timeRange === "today" ? "Hoy" :
    timeRange === "24h"   ? "Ultimas 24h" :
                            "Historico Total";

  const statCards = [
    { label: "PENDIENTES",  value: stats.pending,  icon: Clock,         color: "text-amber-400",  bg: "bg-amber-400/10",  border: "border-amber-400/20",  glow: "shadow-[0_0_20px_rgba(251,191,36,0.08)]" },
    { label: "INFORMADOS",  value: stats.informed,  icon: FileText,      color: "text-cyan-400",   bg: "bg-cyan-400/10",   border: "border-cyan-400/20",   glow: "shadow-[0_0_20px_rgba(6,182,212,0.08)]"  },
    { label: "VALIDADOS",   value: stats.validated, icon: CheckCircle2,  color: "text-emerald-400",bg: "bg-emerald-400/10",border: "border-emerald-400/20",glow: "shadow-[0_0_20px_rgba(16,185,129,0.08)]" },
    { label: "URGENCIAS",   value: stats.urgent,    icon: AlertCircle,   color: "text-rose-400",   bg: "bg-rose-400/10",   border: "border-rose-400/20",   glow: "shadow-[0_0_20px_rgba(244,63,94,0.12)]"  },
  ];

  return (
    <DashboardLayout activeView="worklist">
      <div className="flex flex-col h-full gap-6">

        {/* ENCABEZADO + FILTROS */}
        <div className="flex flex-col gap-4 shrink-0">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div>
              {isSearchMode ? (
                <>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                    <History size={12} />
                    <span>Busqueda historica global</span>
                  </div>
                  <h1 className="text-4xl font-black text-white tracking-tighter leading-none">
                    Resultados: <span className="text-cyan-400">&ldquo;{q}&rdquo;</span>
                  </h1>
                  <p className="text-slate-400 mt-2 font-medium text-sm">
                    Consultando toda la base de datos &middot; {total} coincidencias encontradas
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-4xl font-black text-white tracking-tighter leading-none">
                    Panel de Trabajo
                  </h1>
                  <p className="text-slate-400 mt-2 font-medium text-sm">
                    Ordenado por vencimiento SLA multicentro &middot; {timeLabel}
                  </p>
                </>
              )}
            </div>

            {!isSearchMode && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
                  {(["today", "24h", "all"] as const).map((range) => (
                    <a
                      key={range}
                      href={`/worklist?timeRange=${range}`}
                      className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-300 ${
                        timeRange === range
                          ? "bg-cyan-500 text-[#020408] shadow-lg shadow-cyan-500/30"
                          : "text-slate-500 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {range === "today" ? "Hoy" : range === "24h" ? "24h" : "Todo"}
                    </a>
                  ))}
                </div>
                <button className="px-5 py-2.5 bg-cyan-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.35)] hover:bg-cyan-400 transition-all active:scale-95">
                  <Plus size={16} />
                  Nuevo Examen
                </button>
              </div>
            )}
          </div>

          {/* BUSCADOR GLOBAL — siempre visible, independiente del modo */}
          <Suspense fallback={null}>
            <GlobalSearchBar initialQuery={q ?? ""} />
          </Suspense>
        </div>

        {/* TARJETAS KPI — ocultas en modo busqueda */}
        {!isSearchMode && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
            {statCards.map((stat) => (
              <div
                key={stat.label}
                className={`p-6 bg-white/[0.02] border ${stat.border} rounded-3xl backdrop-blur-xl group hover:bg-white/[0.04] transition-all duration-500 ${stat.glow}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                    <stat.icon size={22} />
                  </div>
                  <span className="text-3xl font-black text-white tracking-widest leading-none tabular-nums">
                    {stat.value}
                  </span>
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* WORKLIST */}
        <div className="flex-1 min-h-0 flex flex-col bg-white/[0.01] border border-white/5 rounded-[2rem] overflow-hidden backdrop-blur-2xl">

          {/* Header de la seccion */}
          <div className="px-8 py-5 border-b border-white/5 flex items-center justify-between shrink-0">
            <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-3">
              <LayoutDashboard className="text-cyan-400" size={20} />
              {isSearchMode ? "Historial del Paciente" : "Worklist Radiologico"}
            </h3>

            <div className="flex items-center gap-6">
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">
                {isSearchMode
                  ? `${total} resultado${total !== 1 ? "s" : ""} encontrado${total !== 1 ? "s" : ""}`
                  : `Pagina ${currentPage} de ${totalPages ?? 1} · SLA Activo`}
              </span>

              {/* Live bar solo en modo worklist normal */}
              {!isSearchMode && (
                <Suspense fallback={
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-emerald-400">Live</span>
                  </div>
                }>
                  <WorklistLiveBar
                    initialTotal={stats.total}
                    initialLatestId={safeStudies[0]?.id ?? null}
                    timeRange={timeRange}
                    currentPage={currentPage}
                  />
                </Suspense>
              )}
            </div>
          </div>

          {/* Sin resultados de busqueda */}
          {isSearchMode && safeStudies.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-12">
              <SearchX size={48} className="text-slate-600" />
              <div>
                <p className="text-white font-black text-lg">Sin resultados</p>
                <p className="text-slate-500 text-sm mt-1">
                  No se encontraron examenes para <span className="text-cyan-400">&ldquo;{q}&rdquo;</span>
                </p>
              </div>
              <a
                href="/worklist"
                className="px-5 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-400 hover:text-white text-[11px] font-black uppercase tracking-widest transition-all"
              >
                Volver al Worklist
              </a>
            </div>
          )}

          {/* Tabla interactiva
              key fuerza remount limpio al cambiar pagina o filtro
              garantiza limpieza de globalFilter, sorting y selectedId entre paginas
          */}
          {safeStudies.length > 0 && (
            <div className="flex-1 min-h-0 overflow-hidden">
              <WorklistTable
                key={`worklist-p${currentPage}-${timeRange}-${q ?? ""}`}
                data={safeStudies}
              />
            </div>
          )}

          {/* Controles de paginacion */}
          {(total ?? 0) > 0 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages ?? 1}
              total={total ?? 0}
              pageSize={PAGE_SIZE}
              timeRange={isSearchMode ? "" : timeRange}
              searchQuery={isSearchMode ? (q ?? "") : undefined}
            />
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
