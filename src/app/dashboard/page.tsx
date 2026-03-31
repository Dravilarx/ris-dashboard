import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import WorklistTable from '@/components/worklist/WorklistTable';
import { getWorklist } from '@/lib/db/queries';
import { WorklistFilters } from '@/types/ris';

export const metadata = {
  title: 'Bandeja de Diagnóstico | AMIS RIS 2030',
  description: 'Sistema de gestión de exámenes radiológicos de alta performance.',
};

interface PageProps {
  searchParams: Promise<{
    timeRange?: 'today' | '24h' | 'all';
    status?: string;
  }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const { timeRange = 'today', status } = await searchParams;
  
  const filters: WorklistFilters = {
    timeRange,
    examStatusId: status ? parseInt(status) : undefined,
  };

  // Fetching real data synchronized with the time range toggle
  const { data: studies } = await getWorklist({ page: 1, pageSize: 150 }, filters);

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full gap-6">
        {/* Header de Sección con Quick Toggles */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-accent to-white bg-clip-text text-transparent leading-none">
              Workflow Radiológico
            </h1>
            <p className="text-sm text-text-muted mt-1 uppercase tracking-widest font-medium opacity-60">
              Misión Crítica • {timeRange === 'today' ? 'Hoy' : timeRange === '24h' ? 'Últimas 24h' : 'Histórico Total'}
            </p>
          </div>
          
          <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl glass-panel border-white/10">
             {['today', '24h', 'all'].map((range) => (
                <a
                  key={range}
                  href={`/dashboard?timeRange=${range}`}
                  className={`px-4 py-2 text-[10px] font-black uppercase tracking-tighter rounded-lg transition-all duration-300 ${
                    timeRange === range 
                      ? 'bg-accent text-background shadow-lg shadow-accent/20' 
                      : 'text-text-muted hover:bg-white/5'
                  }`}
                >
                  {range === 'today' ? 'Hoy' : range === '24h' ? '24h' : 'Todo'}
                </a>
             ))}
          </div>
        </div>

        {/* Dashboard Grid / Worklist Container */}
        <div className="flex-1 min-h-0 flex flex-col glass-panel rounded-2xl overflow-hidden border-white/5 scrollbar-hide">
          <WorklistTable data={studies || []} />
        </div>
      </div>
    </DashboardLayout>
  );
}
