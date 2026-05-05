import { NextResponse } from "next/server";
import { getMeddreamLaunchInfo } from "@/lib/db/queries";
import { generarToken } from "@/lib/server/services/meddreamService";

/**
 * GET /api/meddream/launch?studyUID=<codexamen>
 *
 * 1) Lee la configuración del visor (id_visor = 2) desde la BD.
 * 2) Genera el token llamando al servicio externo.
 * 3) Devuelve la URL del visor y el token resuelto.
 */
export async function GET(request: Request) {
  const studyUID = new URL(request.url).searchParams.get("studyUID");

  if (!studyUID || studyUID.trim().length === 0) {
    return NextResponse.json(
      { error: "Falta el parámetro 'studyUID'." },
      { status: 400 }
    );
  }

  try {
    const [cfg] = await getMeddreamLaunchInfo(studyUID);
    if (!cfg) {
      return NextResponse.json({ error: "sin config" }, { status: 404 });
    }

    const token = await generarToken(
      cfg.studyInstanceUID,
      cfg.json,
      cfg.aetitle,
      cfg.urlToken,
      cfg.method
    );

    return NextResponse.json({
      urlVisor: cfg.urlVisor,
      token,
      aetitle: cfg.aetitle,
      studyInstanceUID: cfg.studyInstanceUID,
    });
  } catch (e) {
    console.error("[api/meddream/launch] Error:", e);
    return NextResponse.json(
      { error: "Error consultando la configuración del visor." },
      { status: 500 }
    );
  }
}
