import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { pusher, ADMIN_CHANNEL, EVENTS } from "@/lib/pusher";
import { FINISHED_DELIVERY_STATUSES } from "@/lib/delivery-status";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const courierId = searchParams.get("courierId");
    // historyDays=N keeps every open delivery but only the finished ones
    // (delivered/cancelled) from the last N calendar days, so the payload no
    // longer grows with the whole history.
    const historyDays = parseInt(searchParams.get("historyDays") ?? "", 10);

    let historyFilter = {};
    if (historyDays > 0) {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      since.setDate(since.getDate() - (historyDays - 1));
      historyFilter = {
        OR: [
          { status: { notIn: [...FINISHED_DELIVERY_STATUSES] } },
          { deliveredAt: { gte: since } },
          { createdAt: { gte: since } },
        ],
      };
    }

    const deliveries = await prisma.delivery.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(courierId ? { courierId } : {}),
        ...historyFilter,
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
      customerName, customerPhone, pickupAddress, pickupLat, pickupLng, pickupMapsUrl,
      deliveryAddress, deliveryLat, deliveryLng, deliveryMapsUrl, notes, priority, category, merchantId,
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
        pickupMapsUrl:   pickupMapsUrl   || null,
        deliveryAddress, deliveryLat: Number(deliveryLat), deliveryLng: Number(deliveryLng),
        deliveryMapsUrl: deliveryMapsUrl || null,
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
