import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const resolved = searchParams.get("resolved");
    const courierId = searchParams.get("courierId");

    const alerts = await withRetry(() => prisma.alert.findMany({
      where: {
        ...(resolved !== null ? { resolved: resolved === "true" } : {}),
        ...(courierId ? { courierId } : {}),
      },
      include: {
        courier: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }));

    return NextResponse.json(alerts);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}
