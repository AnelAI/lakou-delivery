import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { pusher, ADMIN_CHANNEL, EVENTS } from "@/lib/pusher";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const courierId = searchParams.get("courierId");

    const deliveries = await prisma.delivery.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(courierId ? { courierId } : {}),
      },
      include: {
        courier: { select: { id: true, name: true, phone: true } },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(deliveries);
  } catch (error) {
    console.error("Error fetching deliveries:", error);
    return NextResponse.json({ error: "Failed to fetch deliveries" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      customerName, customerPhone, pickupAddress, pickupLat, pickupLng,
      deliveryAddress, deliveryLat, deliveryLng, notes, priority, category, merchantId,
    } = body;

    if (
      !customerName || !pickupAddress || !deliveryAddress ||
      pickupLat === undefined || pickupLng === undefined ||
      deliveryLat === undefined || deliveryLng === undefined
    ) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const delivery = await prisma.delivery.create({
      data: {
        orderNumber, customerName,
        customerPhone: customerPhone || "",
        pickupAddress, pickupLat, pickupLng,
        deliveryAddress, deliveryLat, deliveryLng,
        notes:      notes      || null,
        category:   category   || null,
        merchantId: merchantId || null,
        priority:   priority   || 0,
      },
    });

    pusher.trigger(ADMIN_CHANNEL, EVENTS.DELIVERIES_NEW, delivery).catch(console.error);

    return NextResponse.json(delivery, { status: 201 });
  } catch (error) {
    console.error("Error creating delivery:", error);
    return NextResponse.json({ error: "Failed to create delivery" }, { status: 500 });
  }
}
