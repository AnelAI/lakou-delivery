import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const [
      totalCouriers,
      activeCouriers,
      pendingDeliveries,
      activeDeliveries,
      deliveredToday,
      activeAlerts,
    ] = await Promise.all([
      prisma.courier.count(),
      prisma.courier.count({ where: { status: { in: ["available", "busy"] } } }),
      prisma.delivery.count({ where: { status: "pending" } }),
      prisma.delivery.count({ where: { status: { in: ["assigned", "picked_up"] } } }),
      prisma.delivery.count({
        where: {
          status: "delivered",
          deliveredAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      prisma.alert.count({ where: { resolved: false } }),
    ]);

    return NextResponse.json({
      totalCouriers,
      activeCouriers,
      pendingDeliveries,
      activeDeliveries,
      deliveredToday,
      activeAlerts,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
