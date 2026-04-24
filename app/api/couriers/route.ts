import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db";
import { pusher, ADMIN_CHANNEL, EVENTS } from "@/lib/pusher";

export async function GET() {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const couriers = await withRetry(() => prisma.courier.findMany({
      include: {
        deliveries: {
          where: { status: { in: ["assigned", "picked_up"] } },
          orderBy: { assignedAt: "asc" },
        },
        alerts: {
          where: { resolved: false },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        _count: {
          select: {
            deliveries: { where: { status: "delivered" } },
          },
        },
      },
      orderBy: { name: "asc" },
    }));

    // Get today's delivered count per courier in one query
    const todayCounts = await withRetry(() => prisma.delivery.groupBy({
      by: ["courierId"],
      where: {
        status: "delivered",
        deliveredAt: { gte: todayStart },
        courierId: { not: null },
      },
      _count: { id: true },
    }));
    const todayMap = new Map(todayCounts.map((r) => [r.courierId!, r._count.id]));

    const result = couriers.map(({ _count, ...c }) => ({
      ...c,
      deliveredCount: _count.deliveries,
      deliveredToday: todayMap.get(c.id) ?? 0,
    }));
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching couriers:", error);
    return NextResponse.json({ error: "Failed to fetch couriers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, photo } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: "Name and phone are required" }, { status: 400 });
    }

    const courier = await prisma.courier.create({
      data: { name, phone, photo: photo || null },
    });

    pusher.trigger(ADMIN_CHANNEL, EVENTS.COURIERS_UPDATED, {}).catch(console.error);

    return NextResponse.json(courier, { status: 201 });
  } catch (error) {
    console.error("Error creating courier:", error);
    return NextResponse.json({ error: "Failed to create courier" }, { status: 500 });
  }
}
