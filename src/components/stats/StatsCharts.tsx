"use client";

import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import type { StatisticsData } from "@/lib/db/queries";

// =====================================================================
// TARIFA REFERENCIAL POR MODALIDAD (CLP - ajustable)
// =====================================================================
const MODALITY_FEE: Record<string, number> = {
  MR:      18000,
  CT:      12000,
  NM:      15000,
  US:       8000,
  MM:       6000,
  DX:       2500,
  RX:       2000,
  CR:       2000,
  PT:      20000,
  XA:      10000,
  DEFAULT:  5000,
};

function getFee(modality: string): number {
  return MODALITY_FEE[modality?.toUpperCase()] ?? MODALITY_FEE.DEFAULT;
}

function formatCLP(n: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n);
}

// =====================================================================
// TOOLTIP CUSTOMIZADO (estilo AMIS 2030)
// =====================================================================
const AmisTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0a0f1a] border border-white/10 rounded-2xl px-4 py-3 text-[11px] shadow-2xl min-w-[120px]">
      {label && <p className="text-slate-400 font-semibold mb-2">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span style={{ color: p.color }} className="font-black uppercase tracking-widest">
            {p.name}
          </span>
          <span className="text-white font-black tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// =====================================================================
// PROPS
// =====================================================================
interface StatsChartsProps {
  data: StatisticsData;
  period: string;
  modality?: string;
  institutionId?: number;
}

// =====================================================================
// COMPONENTE PRINCIPAL
// =====================================================================
export default function StatsCharts({ data }: StatsChartsProps) {
  const { summary, byDay, byModality, byInstitution, sla } = data;

  // Honorarios proyectados: suma de (informed * fee_por_modalidad)
  const totalHonorarios = useMemo(() => {
    return byModality.reduce((acc, row) => acc + row.informed * getFee(row.modality), 0);
  }, [byModality]);

  const slaPercent =
    sla.total > 0 ? Math.round((sla.on_time / sla.total) * 100) : 100;

  const slaData = [
    { name: "A Tiempo", value: sla.on_time },
    { name: "Vencidos",  value: sla.overdue  },
  ];

  const SLA_COLORS = ["#10b981", "#f43f5e"];

  const informedRate =
    summary.total > 0 ? Math.round((summary.informed / summary.total) * 100) : 0;

  // KPI Cards
  const kpiCards = [
    {
      label: "Total Examenes",
      value: summary.total.toLocaleString("es-CL"),
      sub: `${informedRate}% informados`,
      color: "text-cyan-400",
      bg: "bg-cyan-400/10",
      border: "border-cyan-400/20",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.08)]",
    },
    {
      label: "Informados",
      value: summary.informed.toLocaleString("es-CL"),
      sub: `${summary.validated} validados`,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
      border: "border-emerald-400/20",
      glow: "shadow-[0_0_20px_rgba(16,185,129,0.1)]",
    },
    {
      label: "Honorarios Proyectados",
      value: formatCLP(totalHonorarios),
      sub: `${summary.informed} prestaciones`,
      color: "text-violet-400",
      bg: "bg-violet-400/10",
      border: "border-violet-400/20",
      glow: "shadow-[0_0_20px_rgba(167,139,250,0.1)]",
    },
    {
      label: "Cumplimiento SLA",
      value: `${slaPercent}%`,
      sub: `${sla.overdue} vencido${sla.overdue !== 1 ? "s" : ""}`,
      color: slaPercent >= 90 ? "text-emerald-400" : slaPercent >= 70 ? "text-amber-400" : "text-rose-400",
      bg: slaPercent >= 90 ? "bg-emerald-400/10" : slaPercent >= 70 ? "bg-amber-400/10" : "bg-rose-400/10",
      border: slaPercent >= 90 ? "border-emerald-400/20" : slaPercent >= 70 ? "border-amber-400/20" : "border-rose-400/20",
      glow: slaPercent >= 90
        ? "shadow-[0_0_20px_rgba(16,185,129,0.1)]"
        : slaPercent >= 70
        ? "shadow-[0_0_20px_rgba(251,191,36,0.08)]"
        : "shadow-[0_0_20px_rgba(244,63,94,0.1)]",
    },
  ];

  return (
    <div className="flex flex-col gap-8">

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className={`p-6 bg-white/[0.02] border ${card.border} rounded-3xl backdrop-blur-xl group hover:bg-white/[0.04] transition-all duration-500 ${card.glow}`}
          >
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                {card.label}
              </span>
              <span className={`text-2xl font-black tracking-tight ${card.color} tabular-nums leading-none`}>
                {card.value}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">{card.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* GRAFICOS FILA 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* GRAFICO DE BARRAS: Produccion por dia */}
        <div className="lg:col-span-2 bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-xl">
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">
            Produccion Diaria
          </h3>
          {byDay.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-slate-600 text-sm">
              Sin datos para el periodo seleccionado
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byDay} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="study_date"
                  tick={{ fill: "#64748b", fontSize: 10, fontWeight: 700 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => {
                    const d = new Date(v + "T12:00:00");
                    return `${d.getDate()}/${d.getMonth() + 1}`;
                  }}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 10, fontWeight: 700 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<AmisTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="informed" name="Informados" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending"  name="Pendientes" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* DONUT SLA */}
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-xl flex flex-col">
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">
            Cumplimiento SLA
          </h3>
          {sla.total === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">Sin datos</div>
          ) : (
            <div className="flex flex-col items-center gap-4 flex-1">
              <div className="relative">
                <PieChart width={180} height={180}>
                  <Pie
                    data={slaData}
                    cx={85}
                    cy={85}
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {slaData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={SLA_COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-[#0a0f1a] border border-white/10 rounded-xl px-3 py-2 text-[11px]">
                          <span className="font-black text-white">{payload[0].name}: {payload[0].value}</span>
                        </div>
                      );
                    }}
                  />
                </PieChart>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span
                    className={`text-2xl font-black tabular-nums ${
                      slaPercent >= 90 ? "text-emerald-400" : slaPercent >= 70 ? "text-amber-400" : "text-rose-400"
                    }`}
                  >
                    {slaPercent}%
                  </span>
                  <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">
                    A Tiempo
                  </span>
                </div>
              </div>
              <div className="flex gap-6 text-[10px] font-black uppercase tracking-widest">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-slate-400">A Tiempo ({sla.on_time})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                  <span className="text-slate-400">Vencidos ({sla.overdue})</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* GRAFICOS FILA 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Produccion por modalidad */}
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-xl">
          <div className="flex items-start justify-between mb-6">
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
              Produccion por Modalidad
            </h3>
            <span className="text-[9px] font-black uppercase tracking-widest text-violet-400 bg-violet-400/10 border border-violet-400/20 px-2 py-1 rounded-lg">
              Con honorarios
            </span>
          </div>
          {byModality.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-600 text-sm">Sin datos</div>
          ) : (
            <div className="flex flex-col gap-3">
              {byModality.slice(0, 8).map((row) => {
                const pct = row.total > 0 ? Math.round((row.informed / row.total) * 100) : 0;
                const honorarios = row.informed * getFee(row.modality);
                return (
                  <div key={row.modality} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-white">
                          {row.modality || "N/D"}
                        </span>
                        <span className="text-[9px] text-slate-600 font-medium">
                          {row.total} exam
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] text-violet-400 font-black tabular-nums">
                          {formatCLP(honorarios)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-black tabular-nums w-8 text-right">
                          {pct}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-700 group-hover:bg-emerald-400"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Produccion por centro */}
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-xl">
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">
            Produccion por Centro Medico
          </h3>
          {byInstitution.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-600 text-sm">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={byInstitution.slice(0, 6)}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: "#64748b", fontSize: 10, fontWeight: 700 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  dataKey="institution_name"
                  type="category"
                  width={130}
                  tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 600 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) =>
                    v.length > 18 ? v.substring(0, 16) + "..." : v
                  }
                />
                <Tooltip content={<AmisTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="informed" name="Informados" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                <Bar dataKey="total"    name="Total"      fill="rgba(255,255,255,0.07)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>
    </div>
  );
}
