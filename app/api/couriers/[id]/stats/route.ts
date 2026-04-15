import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Tarif par livraison : 5 DT base + 2 DT × priorité */
export function deliveryPrice(priority: number): number {
  return 5 + priority * 2;
}

function startOf(unit: "day" | "week" | "month"): Date {
  const d = new Date();
  if (unit === "day") {
    d.setHours(0, 0, 0, 0);
  } else if (unit === "week") {
    const day = d.getDay(); // 0=Sun
    d.setDate(d.getDate() - ((day + 6) % 7)); // Monday
    d.setHours(0, 0, 0, 0);
  } else {
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
  }
  return d;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const courier = await prisma.courier.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!courier) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // All delivered deliveries for this courier
    const allDelivered = await prisma.delivery.findMany({
      where: { courierId: id, status: "delivered" },
      orderBy: { deliveredAt: "desc" },
      select: {
        id: true, orderNumber: true, customerName: true,
        pickupAddress: true, deliveryAddress: true,
        priority: true, assignedAt: true, pickedUpAt: true,
        deliveredAt: true, createdAt: true, notes: true, category: true,
        merchant: { select: { name: true } },
      },
    });

    const todayStart  = startOf("day");
    const weekStart   = startOf("week");
    const monthStart  = startOf("month");

    const buckets = {
      today: allDelivered.filter((d) => d.deliveredAt && d.deliveredAt >= todayStart),
      week:  allDelivered.filter((d) => d.deliveredAt && d.deliveredAt >= weekStart),
      month: allDelivered.filter((d) => d.deliveredAt && d.deliveredAt >= monthStart),
      all:   allDelivered,
    };

    const summarise = (rows: typeof allDelivered) => ({
      count:   rows.length,
      revenue: rows.reduce((s, d) => s + deliveryPrice(d.priority), 0),
    });

    // Average delivery time (assignedAt → deliveredAt) in minutes
    const timings = allDelivered
      .filter((d) => d.assignedAt && d.deliveredAt)
      .map((d) => (d.deliveredAt!.getTime() - d.assignedAt!.getTime()) / 60000);
    const avgMinutes = timings.length
      ? Math.round(timings.reduce((a, b) => a + b, 0) / timings.length)
      : null;

    // Active (in-progress) deliveries
    const active = await prisma.delivery.count({
      where: { courierId: id, status: { in: ["assigned", "picked_up"] } },
    });

    // Alerts (unresolved)
    const alertCount = await prisma.alert.count({
      where: { courierId: id, resolved: false },
    });

    return NextResponse.json({
      today:      summarise(buckets.today),
      week:       summarise(buckets.week),
      month:      summarise(buckets.month),
      allTime:    summarise(buckets.all),
      avgMinutes,
      active,
      alertCount,
      history:    buckets.all, // full history
    });
  } catch (error) {
    console.error("Courier stats error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
