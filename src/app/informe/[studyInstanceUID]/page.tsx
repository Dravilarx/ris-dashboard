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
      <div className="p-10 bg-[#020408] text-white flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl font-black mb-4 uppercase tracking-widest">Estudio no localizado</h1>
        <p className="opacity-50 mb-6 font-mono text-xs">{params.studyInstanceUID}</p>
        <Link href="/dashboard" className="px-6 py-2 bg-accent/20 text-accent rounded-lg border border-accent/20 hover:bg-accent/30 transition-colors">
          Volver a Worklist
        </Link>
      </div>
    );
  }

  return (
    <DictationClient study={study} annexes={annexes} />
  );
}
