import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { pusher, ADMIN_CHANNEL, EVENTS } from "@/lib/pusher";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const courier = await prisma.courier.findUnique({
      where: { id },
      include: {
        deliveries: {
          where: { status: { in: ["assigned", "picked_up"] } },
          orderBy: { assignedAt: "asc" },
        },
        alerts: {
          where: { resolved: false },
          orderBy: { createdAt: "desc" },
        },
        locations: {
          orderBy: { timestamp: "desc" },
          take: 100,
        },
      },
    });

    if (!courier) {
      return NextResponse.json({ error: "Courier not found" }, { status: 404 });
    }

    return NextResponse.json(courier);
  } catch (error) {
    console.error("Error fetching courier:", error);
    return NextResponse.json({ error: "Failed to fetch courier" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const courier = await prisma.courier.update({
      where: { id },
      data: body,
    });

    await pusher.trigger(ADMIN_CHANNEL, EVENTS.COURIERS_UPDATED, {});

    return NextResponse.json(courier);
  } catch (error) {
    console.error("Error updating courier:", error);
    return NextResponse.json({ error: "Failed to update courier" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check courier exists
    const courier = await prisma.courier.findUnique({ where: { id } });
    if (!courier) {
      return NextResponse.json({ error: "Courier not found" }, { status: 404 });
    }

    // 1. Unlink deliveries (keep them, just remove courier assignment)
    await prisma.delivery.updateMany({
      where: { courierId: id },
      data: { courierId: null, status: "pending", assignedAt: null },
    });

    // 2. Delete alerts for this courier
    await prisma.alert.deleteMany({ where: { courierId: id } });

    // 3. Delete GPS location history
    await prisma.courierLocation.deleteMany({ where: { courierId: id } });

    // 4. Delete the courier
    await prisma.courier.delete({ where: { id } });

    await pusher.trigger(ADMIN_CHANNEL, EVENTS.COURIERS_UPDATED, {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting courier:", error);
    return NextResponse.json({ error: "Failed to delete courier" }, { status: 500 });
  }
}
