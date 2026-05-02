import React from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import StatsCharts from "@/components/stats/StatsCharts";
import { getStatisticsData } from "@/lib/db/queries";
import type { StatisticsFilters } from "@/lib/db/queries";
import { BarChart2, Calendar, Download } from "lucide-react";

export const metadata = {
  title: "Estadisticas | AMIS RIS 2030",
  description: "Dashboard de produccion, rendimiento y cumplimiento SLA para medicos radiologos.",
};

interface PageProps {
  searchParams: Promise<{
    period?: "today" | "week" | "month" | "custom";
    dateFrom?: string;
    dateTo?: string;
    modality?: string;
    institutionId?: string;
  }>;
}

const PERIOD_LABELS: Record<string, string> = {
  today: "Hoy",
  week:  "Esta Semana",
  month: "Mes Actual",
  custom: "Rango Personalizado",
};

export default async function EstadisticasPage({ searchParams }: PageProps) {
  const { period = "month", dateFrom, dateTo, modality, institutionId } = await searchParams;

  const filters: StatisticsFilters = {
    period,
    dateFrom,
    dateTo,
    modality:      modality || undefined,
    institutionId: institutionId ? parseInt(institutionId) : undefined,
  };

  const data = await getStatisticsData(filters);

  const periods: Array<{ key: StatisticsFilters["period"]; label: string }> = [
    { key: "today", label: "Hoy"       },
    { key: "week",  label: "Semana"    },
    { key: "month", label: "Mes"       },
  ];

  return (
    <DashboardLayout activeView="estadisticas">
      <div className="flex flex-col gap-6 h-full overflow-y-auto pb-8">

        {/* ENCABEZADO */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 shrink-0">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
              <BarChart2 size={12} />
              <span>Panel de Produccion</span>
            </div>
            <h1 className="text-4xl font-black text-white tracking-tighter leading-none">
              Estadisticas
            </h1>
            <p className="text-slate-400 mt-2 font-medium text-sm">
              Productividad, honorarios y cumplimiento SLA &middot; {PERIOD_LABELS[period]}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">

            {/* Selector de periodo */}
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
              {periods.map(({ key, label }) => (
                <a
                  key={key}
                  href={`/estadisticas?period=${key}${modality ? `&modality=${modality}` : ""}${institutionId ? `&institutionId=${institutionId}` : ""}`}
                  className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-300 ${
                    period === key
                      ? "bg-violet-500 text-white shadow-lg shadow-violet-500/30"
                      : "text-slate-500 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {label}
                </a>
              ))}
            </div>

            {/* Selector de rango personalizado */}
            <form method="get" action="/estadisticas" className="flex items-center gap-2">
              <input type="hidden" name="period" value="custom" />
              {modality && <input type="hidden" name="modality" value={modality} />}
              {institutionId && <input type="hidden" name="institutionId" value={institutionId} />}
              <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5">
                <Calendar size={12} className="text-slate-500 shrink-0" />
                <input
                  type="date"
                  name="dateFrom"
                  defaultValue={dateFrom}
                  className="bg-transparent text-[11px] text-slate-300 font-medium outline-none w-[110px]"
                />
                <span className="text-slate-600 text-[10px]">al</span>
                <input
                  type="date"
                  name="dateTo"
                  defaultValue={dateTo}
                  className="bg-transparent text-[11px] text-slate-300 font-medium outline-none w-[110px]"
                />
                <button
                  type="submit"
                  className="ml-1 px-3 py-1 bg-violet-500/20 text-violet-400 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-violet-500/30 transition-all border border-violet-500/30"
                >
                  OK
                </button>
              </div>
            </form>

            {/* Boton exportar (placeholder) */}
            <button
              className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:border-white/20 transition-all"
            >
              <Download size={12} />
              Exportar
            </button>
          </div>
        </div>

        {/* FILTROS DINAMICOS */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
            Filtros:
          </span>

          {/* Modalidad */}
          {["CT", "MR", "US", "RX", "DX", "NM", "MM"].map((mod) => (
            <a
              key={mod}
              href={`/estadisticas?period=${period}${modality === mod ? "" : `&modality=${mod}`}${dateFrom ? `&dateFrom=${dateFrom}` : ""}${dateTo ? `&dateTo=${dateTo}` : ""}${institutionId ? `&institutionId=${institutionId}` : ""}`}
              className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg border transition-all duration-200 ${
                modality === mod
                  ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                  : "bg-white/[0.03] text-slate-500 border-white/5 hover:text-white hover:border-white/20"
              }`}
            >
              {mod}
            </a>
          ))}

          {(modality || institutionId) && (
            <a
              href={`/estadisticas?period=${period}`}
              className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg border border-rose-500/30 text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition-all"
            >
              Limpiar filtros
            </a>
          )}
        </div>

        {/* GRAFICOS (Client Component — necesita Recharts) */}
        <StatsCharts
          data={data}
          period={period}
          modality={modality}
          institutionId={institutionId ? parseInt(institutionId) : undefined}
        />

      </div>
    </DashboardLayout>
  );
}
