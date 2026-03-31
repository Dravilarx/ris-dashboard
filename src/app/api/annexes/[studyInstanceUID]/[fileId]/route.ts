import { NextResponse } from 'next/server';
import { getStudyAnnexes } from '@/lib/server/services/legacyRisService';
// import { promises as fs } from 'fs'; // Descomentar para producción con VPN

export async function GET(
  request: Request,
  props: { params: Promise<{ studyInstanceUID: string; fileId: string }> }
) {
  try {
    const params = await props.params;
    const { studyInstanceUID, fileId } = params;

    // Validación y Seguridad: Solo permitimos anexos de estudios válidos y mapeados
    const annexes = await getStudyAnnexes(studyInstanceUID);
    const fileMeta = annexes.find(f => f.id === fileId);

    if (!fileMeta) {
      return new NextResponse('Archivo no autorizado o no encontrado', { status: 404 });
    }

    // Preparar la ruta para el File System
    const rawPath = fileMeta.url;
    // Escapamos las barras invertidas para visualizar correctamente la ruta de red UNC o evitar problemas en Windows
    const escapedPath = rawPath.replace(/\\/g, '\\\\');
    console.log(`[Túnel VPN] Intentando acceder a ruta UNC: ${escapedPath}`);

    // Aquí iría la validación física conectada a la VPN:
    // import fs from 'fs';
    // if (!fs.existsSync(rawPath)) {
    //   console.error(`[Túnel VPN] ERROR: Archivo físico no encontrado en ruta: ${escapedPath}`);
    //   return new NextResponse(`Archivo no encontrado en ruta: ${escapedPath}`, { status: 404 });
    // }
    
    // const fileBuffer = await fs.promises.readFile(rawPath);

    // MOCK para Desarrollo local (Mac): 
    // Como el entorno Unix no resolverá \\Servidor\\ automáticamente sin montar SAMBA, 
    // lanzamos un Buffer de prueba renderizable por el navegador para continuar.
    let fileBuffer: Buffer;
    if (fileMeta.type === 'pdf') {
       // Un PDF válido mínimo en bytes
       fileBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Count 1\n/Kids [ 3 0 R ]\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [ 0 0 612 792 ]\n/Resources << >>\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n72 712 Td\n(Reporte de Anexo VPN Simulado) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000219 00000 n\ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n312\n%%EOF\n', 'utf8');
    } else {
       // Pixel transparente PNG 1x1
       fileBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
    }

    const contentType = fileMeta.type === 'pdf' ? 'application/pdf' : 'image/png';
    const extension = fileMeta.type === 'pdf' ? 'pdf' : 'png';

    // Se envía como un "Stream" con el Content-Type correcto para forzar que el navegador lo renderice (inline) en vez de forzar una descarga (attachment) si usamos iframe.
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${fileMeta.name.replace(/[^a-zA-Z0-9]/g, '_')}.${extension}"`,
        'Cache-Control': 'public, max-age=3600'
      }
    });

  } catch (error) {
    console.error('[File Proxy Error]', error);
    return new NextResponse('Error del túnel VPN de archivos', { status: 500 });
  }
}
