import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { haversineDistance, estimateTravelTime } from "@/lib/geo";
import { pusher, ADMIN_CHANNEL, courierChannel, orderChannel, EVENTS } from "@/lib/pusher";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const delivery = await prisma.delivery.findUnique({
      where: { id },
      include: { courier: true },
    });

    if (!delivery) {
      return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
    }

    return NextResponse.json(delivery);
  } catch {
    return NextResponse.json({ error: "Failed to fetch delivery" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { action, courierId, ...rest } = body;

    let updateData: Record<string, unknown> = { ...rest };

    if (action === "assign" && courierId) {
      const courier = await prisma.courier.findUnique({ where: { id: courierId } });
      const delivery = await prisma.delivery.findUnique({ where: { id } });

      if (courier && delivery) {
        const startLat = courier.currentLat ?? delivery.pickupLat;
        const startLng = courier.currentLng ?? delivery.pickupLng;
        const distToPickup = haversineDistance(startLat, startLng, delivery.pickupLat, delivery.pickupLng);
        const distToDelivery = haversineDistance(delivery.pickupLat, delivery.pickupLng, delivery.deliveryLat, delivery.deliveryLng);
        const totalDist = distToPickup + distToDelivery;

        updateData = {
          ...updateData,
          courierId,
          status: "assigned",
          assignedAt: new Date(),
          distance: Math.round(totalDist * 10) / 10,
          estimatedTime: estimateTravelTime(totalDist),
        };

        await prisma.courier.update({
          where: { id: courierId },
          data: { status: "busy" },
        });

        // Push notification to the specific courier
        pusher.trigger(courierChannel(courierId), EVENTS.DELIVERY_ASSIGNED, {
          delivery: { ...updateData, id },
          message: `Nouvelle course : ${delivery.pickupAddress} → ${delivery.deliveryAddress}`,
        }).catch(console.error);
      }
    } else if (action === "pickup") {
      updateData = { ...updateData, status: "picked_up", pickedUpAt: new Date() };
    } else if (action === "deliver") {
      updateData = { ...updateData, status: "delivered", deliveredAt: new Date() };

      const currentDelivery = await prisma.delivery.findUnique({ where: { id } });
      if (currentDelivery?.courierId) {
        const remaining = await prisma.delivery.count({
          where: {
            courierId: currentDelivery.courierId,
            status: { in: ["assigned", "picked_up"] },
            id: { not: id },
          },
        });
        if (remaining === 0) {
          await prisma.courier.update({
            where: { id: currentDelivery.courierId },
            data: { status: "available" },
          });
        }
      }
    } else if (action === "cancel") {
      updateData = { ...updateData, status: "cancelled", courierId: null };
    } else if (action === "confirm-location") {
      const { lat, lng } = body;
      if (lat === undefined || lng === undefined) {
        return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
      }
      updateData = { deliveryLat: lat, deliveryLng: lng, locationConfirmed: true };
    } else if (action === "confirm-pickup") {
      const { lat, lng, address } = body;
      if (lat === undefined || lng === undefined) {
        return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
      }
      updateData = { pickupLat: lat, pickupLng: lng, ...(address ? { pickupAddress: address } : {}) };
    } else if (action === "acknowledge") {
      const current = await prisma.delivery.findUnique({
        where: { id },
        include: { courier: true },
      });
      if (current?.courierId) {
        const alert = await prisma.alert.create({
          data: {
            courierId: current.courierId,
            type: "acknowledged",
            message: `A pris en compte la course ${current.orderNumber} — ${current.customerName}`,
            severity: "info",
          },
          include: { courier: true },
        });
        pusher.trigger(ADMIN_CHANNEL, EVENTS.ALERTS_NEW, alert).catch(console.error);
      }
      return NextResponse.json({ ok: true });
    }

    const delivery = await prisma.delivery.update({
      where: { id },
      data: updateData,
      include: { courier: true },
    });

    pusher.trigger(ADMIN_CHANNEL, EVENTS.DELIVERIES_UPDATED, delivery).catch(console.error);
    // Notify customer tracking page
    pusher.trigger(orderChannel(delivery.orderNumber), EVENTS.DELIVERY_STATUS_UPDATE, delivery).catch(console.error);

    return NextResponse.json(delivery);
  } catch (error) {
    console.error("Error updating delivery:", error);
    return NextResponse.json({ error: "Failed to update delivery" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.delivery.delete({ where: { id } });
    pusher.trigger(ADMIN_CHANNEL, EVENTS.DELIVERIES_UPDATED, {}).catch(console.error);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete delivery" }, { status: 500 });
  }
}
