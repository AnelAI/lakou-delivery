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
      deliveryDescription, locationConfirmed, price,
    } = body;

    if (
      !customerName || !pickupAddress || !deliveryAddress ||
      pickupLat === undefined || pickupLng === undefined ||
      deliveryLat === undefined || deliveryLng === undefined
    ) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const parsedPrice = price !== null && price !== undefined && price !== ""
      ? parseFloat(String(price))
      : null;

    const delivery = await prisma.delivery.create({
      data: {
        orderNumber, customerName,
        customerPhone: customerPhone || "",
        pickupAddress, pickupLat: Number(pickupLat), pickupLng: Number(pickupLng),
        deliveryAddress, deliveryLat: Number(deliveryLat), deliveryLng: Number(deliveryLng),
        notes:               notes               || null,
        deliveryDescription: deliveryDescription || null,
        locationConfirmed:   locationConfirmed   !== false,
        category:   category   || null,
        merchantId: merchantId || null,
        priority:   Number(priority)   || 0,
        ...(parsedPrice !== null && !isNaN(parsedPrice) ? { price: parsedPrice } : {}),
      },
    });

    pusher.trigger(ADMIN_CHANNEL, EVENTS.DELIVERIES_NEW, delivery).catch(console.error);

    return NextResponse.json(delivery, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error creating delivery:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
