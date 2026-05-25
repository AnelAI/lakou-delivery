import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/couriers/:id/locations
 * Retourne l'historique GPS d'un coursier.
 *
 * Query params:
 *   from    — ISO date début  (ex: 2026-05-25T08:00:00Z)
 *   to      — ISO date fin
 *   limit   — max points retournés (défaut 1000, max 5000)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = req.nextUrl;

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limit = Math.min(
      parseInt(searchParams.get("limit") ?? "1000", 10) || 1000,
      5000
    );

    const timestampFilter: { gte?: Date; lte?: Date } = {};
    if (from) timestampFilter.gte = new Date(from);
    if (to) timestampFilter.lte = new Date(to);

    const locations = await prisma.courierLocation.findMany({
      where: {
        courierId: id,
        ...(Object.keys(timestampFilter).length > 0
          ? { timestamp: timestampFilter }
          : {}),
      },
      orderBy: { timestamp: "asc" },
      take: limit,
      select: {
        lat: true,
        lng: true,
        speed: true,
        heading: true,
        timestamp: true,
      },
    });

    return NextResponse.json(locations);
  } catch (error) {
    console.error("Error fetching courier locations:", error);
    return NextResponse.json(
      { error: "Failed to fetch locations" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/couriers/:id/locations
 * Purge l'historique GPS d'un coursier (admin uniquement).
 * Utile pour la conformité RGPD ou pour libérer de l'espace.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = req.nextUrl;
    const before = searchParams.get("before");

    const where: { courierId: string; timestamp?: { lt: Date } } = {
      courierId: id,
    };
    if (before) where.timestamp = { lt: new Date(before) };

    const { count } = await prisma.courierLocation.deleteMany({ where });

    return NextResponse.json({ deleted: count });
  } catch (error) {
    console.error("Error purging courier locations:", error);
    return NextResponse.json(
      { error: "Failed to purge locations" },
      { status: 500 }
    );
  }
}
