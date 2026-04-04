export interface StudyFile {
  id: string;
  name: string;
  type: 'pdf' | 'image' | 'text';
  url: string;
  sizeBytes?: number;
  date?: string; // ISO String or Local date
}

/**
 * Operación Bóveda de Anexos (SQL Legacy)
 * Simulamos la extracción basada en la auditoría técnica.
 */
export async function getStudyAnnexes(studyInstanceUID: string): Promise<StudyFile[]> {
  try {
    // Simulamos la extracción obtenida de las rutas UNC transformadas a objetos:
    
    return [
      {
        id: 'file-1',
        name: 'Orden Médica Original',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1576091160550-217359f4ecf8?q=80&w=800&auto=format&fit=crop', 
        sizeBytes: 2400000,
        date: new Date(2025, 9, 15).toISOString() // Oct 2025
      },
      {
        id: 'file-2',
        name: 'Informe Previo (2024)',
        type: 'pdf',
        url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        sizeBytes: 1100000,
        date: new Date(2024, 7, 22).toISOString() // Ago 2024
      }
    ];

  } catch (error) {
    console.error('[legacyRisService - getStudyFiles Error]', error);
    return [];
  }
}
