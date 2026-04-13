import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { pusher, ADMIN_CHANNEL, EVENTS } from "@/lib/pusher";

export async function GET() {
  try {
    const couriers = await prisma.courier.findMany({
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
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(couriers);
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

    await pusher.trigger(ADMIN_CHANNEL, EVENTS.COURIERS_UPDATED, {});

    return NextResponse.json(courier, { status: 201 });
  } catch (error) {
    console.error("Error creating courier:", error);
    return NextResponse.json({ error: "Failed to create courier" }, { status: 500 });
  }
}
