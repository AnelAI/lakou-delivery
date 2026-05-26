import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

const DAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"]; // JS: 0=Sun

function getPeriodStart(period: string): Date {
  const now = new Date();
  if (period === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  // week: last 7 days
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - 6);
  return d;
}

function buildDailyBreakdown(
  deliveries: { price: number | null; deliveredAt: Date | null }[]
) {
  const now = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    const amount = deliveries
      .filter((del) => {
        if (!del.deliveredAt) return false;
        const dd = new Date(del.deliveredAt);
        return (
          dd.getFullYear() === d.getFullYear() &&
          dd.getMonth() === d.getMonth() &&
          dd.getDate() === d.getDate()
        );
      })
      .reduce((sum, del) => sum + (del.price ?? 0), 0);
    return { label: DAY_LABELS[d.getDay()], amount: Math.round(amount * 1000) / 1000 };
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const courierId = searchParams.get("courierId");
  const period = searchParams.get("period") ?? "week";

  if (!courierId) {
    return NextResponse.json({ error: "courierId requis" }, { status: 400 });
  }

  const periodStart = getPeriodStart(period);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [periodDeliveries, recentDeliveries] = await Promise.all([
    db.delivery.findMany({
      where: {
        courierId,
        status: "delivered",
        deliveredAt: { gte: periodStart },
      },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        price: true,
        deliveredAt: true,
        deliveryAddress: true,
      },
      orderBy: { deliveredAt: "desc" },
    }),
    db.delivery.findMany({
      where: {
        courierId,
        status: "delivered",
        deliveredAt: { gte: sevenDaysAgo },
      },
      select: { price: true, deliveredAt: true },
    }),
  ]);

  const total = periodDeliveries.reduce((sum, d) => sum + (d.price ?? 0), 0);

  return NextResponse.json({
    total: Math.round(total * 1000) / 1000,
    count: periodDeliveries.length,
    deliveries: periodDeliveries,
    dailyBreakdown: buildDailyBreakdown(recentDeliveries),
  });
}
