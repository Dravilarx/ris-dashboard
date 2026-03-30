import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const result: any[] = await prisma.$queryRaw`SELECT 1 AS ok`;
    return NextResponse.json({
      status: "healthy",
      database: "connected",
      target: "DBMULTIRISQA",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "unhealthy",
        database: "disconnected",
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
