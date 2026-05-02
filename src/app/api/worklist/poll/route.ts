import { getWorklistStats } from "@/lib/db/queries";
import { getWorklist } from "@/lib/db/queries";

/**
 * GET /api/worklist/poll
 *
 * Endpoint liviano para detectar nuevos estudios sin recargar la pagina.
 * Retorna: total de estudios, ID y timestamp del mas reciente.
 * El cliente compara con su estado anterior para detectar cambios.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = (searchParams.get("timeRange") ?? "today") as "today" | "24h" | "all";

    // Dos queries ultra-rapidas en paralelo
    const [stats, latest] = await Promise.all([
      getWorklistStats(timeRange),
      getWorklist({ page: 1, pageSize: 1 }, { timeRange }),
    ]);

    const latestStudy = latest.data[0];

    return Response.json({
      total: stats.total,
      latestId: latestStudy?.id ?? null,
      latestTimestamp: latestStudy?.studyDate ?? null,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[worklist/poll] Error:", err);
    return Response.json({ error: "Poll failed" }, { status: 500 });
  }
}
