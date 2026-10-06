import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Durées de conservation
const LOCATION_RETENTION_DAYS = 30;
const NOTIFICATION_RETENTION_DAYS = 60;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * GET /api/cron/purge
 * Appelé une fois par jour par le cron Vercel (voir vercel.json).
 * Supprime l'historique GPS et les notifications anciennes pour que la base
 * ne grossisse pas indéfiniment.
 * Protégé par CRON_SECRET : Vercel envoie `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [locations, notifications] = await Promise.all([
      prisma.courierLocation.deleteMany({
        where: { timestamp: { lt: daysAgo(LOCATION_RETENTION_DAYS) } },
      }),
      prisma.$executeRaw`
        DELETE FROM "DeliveryNotification"
        WHERE "createdAt" < ${daysAgo(NOTIFICATION_RETENTION_DAYS)}
      `,
    ]);

    return NextResponse.json({ deletedLocations: locations.count, deletedNotifications: notifications });
  } catch (error) {
    console.error("Error in purge cron:", error);
    return NextResponse.json({ error: "Purge failed" }, { status: 500 });
  }
}
