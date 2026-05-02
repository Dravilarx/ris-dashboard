import React from 'react';
import { getEnrichedStudyByUID } from '@/lib/services/enrichment-service';
import { getStudyAnnexes } from '@/lib/server/services/legacyRisService';
import Link from 'next/link';
import DictationClient from './DictationClient';

export default async function InformePage(props: { params: Promise<{ studyInstanceUID: string }> }) {
  const params = await props.params;
  // Obtenemos los datos completos del paciente enriquecidos con AMIS 3.0
  const study = await getEnrichedStudyByUID(params.studyInstanceUID);
  
  // Extraemos Anexos verdaderos (si los hay)
  const annexes = await getStudyAnnexes(params.studyInstanceUID);

  if (!study) {
    return (
      <div className="bg-[#020408] text-white flex flex-col items-center justify-center h-screen gap-6 px-8">
        {/* Ícono de error */}
        <div className="w-20 h-20 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
          <svg className="text-rose-400 w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
        </div>

        {/* Mensaje */}
        <div className="text-center">
          <h1 className="text-2xl font-black uppercase tracking-widest text-white mb-2">
            Estudio No Localizado
          </h1>
          <p className="text-sm text-slate-500 mb-1">
            El estudio solicitado no fue encontrado en la base de datos legacy.
          </p>
          <p className="font-mono text-[10px] text-slate-600 bg-white/5 px-3 py-1 rounded inline-block">
            UID: {params.studyInstanceUID}
          </p>
        </div>

        {/* Acciones de navegación */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/dashboard"
            className="px-6 py-2.5 bg-violet-500/10 text-violet-400 rounded-xl border border-violet-500/20 hover:bg-violet-500/20 transition-all text-sm font-bold text-center"
          >
            ← Lista del Radiólogo
          </Link>
          <Link
            href="/worklist"
            className="px-6 py-2.5 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20 hover:bg-cyan-500/20 transition-all text-sm font-bold text-center"
          >
            ← Worklist General
          </Link>
        </div>
      </div>
    );
  }

  return (
    <DictationClient study={study} annexes={annexes} />
  );
}
