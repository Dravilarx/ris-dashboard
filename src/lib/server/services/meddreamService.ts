/**
 * Genera un token de visor (MedDream) llamando al endpoint configurado.
 * Equivalente al método C# `generarToken`.
 *
 * @param codExamen  StudyInstanceUID / codexamen del estudio
 * @param json       Plantilla JSON con placeholders #CODEXAMEN# y #AETITLE#
 * @param aetitle    AE Title del estudio
 * @param urlToken   URL del endpoint generador de token
 * @param metodo     Método HTTP (POST, GET, etc.)
 * @returns El cuerpo de la respuesta como string, o "" en caso de error.
 */
export async function generarToken(
  codExamen: string,
  json: string,
  aetitle: string,
  urlToken: string,
  metodo: string
): Promise<string> {
  try {
    const body = json
      .replace(/#CODEXAMEN#/g, codExamen)
      .replace(/#AETITLE#/g, aetitle);

    const res = await fetch(urlToken, {
      method: metodo,
      headers: {
        Accept: "text/plain",
        "Content-Type": "application/json",
        Authorization: "No Auth",
      },
      body,
    });

    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}