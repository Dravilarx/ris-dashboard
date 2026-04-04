/**
 * AMIS RIS 2030 — API de Búsqueda por Identidad Adaptativa
 *
 * Soporta búsqueda de historial clínico usando diferentes fuentes de ID:
 *   - RUT (estándar chileno)
 *   - N° Cobre (Hospital del Cobre — código de empleado CODELCO)
 *   - EXTERNAL_ID (otros sistemas externos)
 *
 * También actúa como "Puente IRAD": cuando el centro usa NUM_COBRE,
 * la petición a IRAD debe incluir ese código como llave de recuperación.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

type PatientIdSource = 'RUT' | 'NUM_COBRE' | 'EXTERNAL_ID';

interface AdaptiveSearchRequest {
  query: string;            // El valor a buscar
  institutionId: number;    // Para determinar automáticamente el tipo de ID
  forceIdSource?: PatientIdSource; // Override manual del tipo de ID
  limit?: number;
}

interface IradRequest {
  idType: PatientIdSource;
  idValue: string;
  institutionCode?: string;
}

/**
 * Construye la solicitud hacia IRAD según el tipo de ID adaptativo
 */
function buildIradRequest(idSource: PatientIdSource, idValue: string, centerCode?: string): IradRequest {
  return {
    idType: idSource,
    idValue,
    institutionCode: centerCode,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: AdaptiveSearchRequest = await request.json();
    const { query, institutionId, forceIdSource, limit = 15 } = body;

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ error: 'Query demasiado corta (mínimo 2 caracteres)' }, { status: 400 });
    }

    // 1. Resolver tipo de ID del centro desde Supabase
    let resolvedIdSource: PatientIdSource = 'RUT';
    let resolvedIdLabel = 'RUT';
    let centerCode: string | undefined;

    if (forceIdSource) {
      // Override manual (ej: desde el UI cuando el médico selecciona manualmente)
      resolvedIdSource = forceIdSource;
    } else if (institutionId) {
      const { data: centerConfig } = await supabase
        .from('b2b_centers')
        .select('patient_id_source, patient_id_label, center_code')
        .eq('legacy_institution_id', institutionId)
        .eq('is_active', true)
        .single();

      if (centerConfig) {
        resolvedIdSource = centerConfig.patient_id_source as PatientIdSource;
        resolvedIdLabel = centerConfig.patient_id_label;
        centerCode = centerConfig.center_code;
      }
    }

    // 2. Construir solicitud a IRAD (simulado — en producción sería un fetch real)
    const iradRequest = buildIradRequest(resolvedIdSource, query.trim(), centerCode);
    
    console.log('[Adaptive Search] Resolving identity:', {
      institutionId,
      resolvedIdSource,
      query: query.trim(),
      iradRequest,
    });

    // 3. En producción: llamar a IRAD con el tipo de ID correcto
    // const iradResponse = await fetch(process.env.IRAD_ENDPOINT!, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.IRAD_API_KEY! },
    //   body: JSON.stringify(iradRequest),
    // });

    // 4. Respuesta simulada para desarrollo
    const mockResults = [
      {
        patientId: resolvedIdSource === 'RUT' ? query.trim() : `RUT-mock-${query}`,
        externalPatientId: resolvedIdSource !== 'RUT' ? query.trim() : null,
        patientFullName: 'PACIENTE DE PRUEBA (IRAD)',
        studies: [],
        idSource: resolvedIdSource,
        idLabel: resolvedIdLabel,
        fromIRAD: true,
      }
    ];

    return NextResponse.json({
      success: true,
      resolvedIdSource,
      resolvedIdLabel,
      iradRequest,
      results: mockResults,
      meta: {
        query: query.trim(),
        institutionId,
        limit,
        timestamp: new Date().toISOString(),
      }
    });

  } catch (error) {
    console.error('[Adaptive Search] Error:', error);
    return NextResponse.json(
      { error: 'Error en búsqueda adaptativa', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * GET: Obtener configuración de identidad de un centro por su ID legacy
 * Útil para que el UI sepa qué tipo de búsqueda usar antes de abrir el historial.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const institutionId = searchParams.get('institutionId');

  if (!institutionId) {
    return NextResponse.json({ error: 'institutionId requerido' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('b2b_centers')
    .select('id, center_name, center_code, patient_id_source, patient_id_label, is_active')
    .eq('legacy_institution_id', parseInt(institutionId))
    .single();

  if (error || !data) {
    // Centro no configurado → devolver defaults RUT
    return NextResponse.json({
      patientIdSource: 'RUT',
      patientIdLabel: 'RUT',
      centerName: 'Centro Estándar',
      configured: false,
    });
  }

  return NextResponse.json({
    patientIdSource: data.patient_id_source,
    patientIdLabel: data.patient_id_label,
    centerName: data.center_name,
    centerCode: data.center_code,
    configured: true,
  });
}
