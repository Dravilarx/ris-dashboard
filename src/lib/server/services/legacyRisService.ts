export interface StudyFile {
  id: string;
  name: string;
  type: 'pdf' | 'image' | 'text';
  url: string;
  sizeBytes?: number;
}

/**
 * Operación Bóveda de Anexos (SQL Legacy)
 * Simulamos la extracción basada en la auditoría técnica.
 */
export async function getStudyAnnexes(studyInstanceUID: string): Promise<StudyFile[]> {
  try {
    // EXTRACCIÓN DE RUTAS UNC DESDE SQL LEGACY
    // Se ejecuta una consulta a DB RIS (Tabla: SolicitudAddemdum)
    
    // Si la tabla indexa los adjuntos usando el AccessionNumber en vez del StudyInstanceUID:
    /*
    const query = `
      SELECT 
        Id_Addemdum as id, 
        NombreArchivo as name, 
        TipoArchivo as type, 
        RutaFisica_UNC as url,
        TamanoBytes as sizeBytes
      FROM SolicitudAddemdum 
      WHERE AccessionNumber = @accessionNumber 
         OR StudyInstanceUID = @studyUid
    `;
    const result = await sql.query(query, { studyUid: studyInstanceUID });
    */

    // Simulamos la extracción obtenida de las rutas UNC transformadas a objetos:
    
    return [
      {
        id: 'file-1',
        name: 'Orden Médica Original',
        type: 'image',
        url: '/placeholder/orden_medica.jpg', // Cambiará a https://pacs/wado o API endpoint interno
        sizeBytes: 2400000 // 2.4MB aprox
      },
      {
        id: 'file-2',
        name: 'Informe Previo (2025)',
        type: 'pdf',
        url: '/placeholder/informe_previo.pdf',
        sizeBytes: 1100000 // 1.1MB aprox
      }
    ];

  } catch (error) {
    console.error('[legacyRisService - getStudyFiles Error]', error);
    // En caso de fallo crítico de la VPN, retornar array vacío para no quebrar el cockpit
    return [];
  }
}
