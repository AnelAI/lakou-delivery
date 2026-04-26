import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db";
import { haversineDistance, estimateTravelTime } from "@/lib/geo";
import { pusher, ADMIN_CHANNEL, courierChannel, orderChannel, EVENTS } from "@/lib/pusher";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const delivery = await withRetry(() => prisma.delivery.findUnique({
      where: { id },
      include: { courier: true },
    }));

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
        // Free previous courier when reassigning
        if (delivery.courierId && delivery.courierId !== courierId) {
          const prevRemaining = await prisma.delivery.count({
            where: {
              courierId: delivery.courierId,
              status: { in: ["assigned", "picked_up"] },
              id: { not: id },
            },
          });
          if (prevRemaining === 0) {
            await prisma.courier.update({
              where: { id: delivery.courierId },
              data: { status: "available" },
            });
          }
        }

        const startLat = courier.currentLat ?? delivery.pickupLat;
        const startLng = courier.currentLng ?? delivery.pickupLng;
        const distToPickup = haversineDistance(startLat, startLng, delivery.pickupLat, delivery.pickupLng);
        const distToDelivery = haversineDistance(delivery.pickupLat, delivery.pickupLng, delivery.deliveryLat, delivery.deliveryLng);
        const totalDist = distToPickup + distToDelivery;

        // Keep existing status if delivery is already in progress (picked_up)
        const newStatus = delivery.status === "picked_up" ? "picked_up" : "assigned";

        updateData = {
          ...updateData,
          courierId,
          status: newStatus,
          assignedAt: new Date(),
          distance: Math.round(totalDist * 10) / 10,
          estimatedTime: estimateTravelTime(totalDist),
        };

        await prisma.courier.update({
          where: { id: courierId },
          data: { status: "busy" },
        });

        pusher.trigger(courierChannel(courierId), EVENTS.DELIVERY_ASSIGNED, {
          delivery: { ...updateData, id },
          message: `Nouvelle course : ${delivery.pickupAddress} → ${delivery.deliveryAddress}`,
        }).catch(console.error);
      }
    } else if (action === "unassign") {
      const delivery = await prisma.delivery.findUnique({ where: { id } });
      if (delivery?.courierId) {
        const remaining = await prisma.delivery.count({
          where: {
            courierId: delivery.courierId,
            status: { in: ["assigned", "picked_up"] },
            id: { not: id },
          },
        });
        if (remaining === 0) {
          await prisma.courier.update({
            where: { id: delivery.courierId },
            data: { status: "available" },
          });
        }
      }
      updateData = { ...updateData, status: "pending", courierId: null };
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
    } else if (action === "update-price") {
      const { price } = body;
      updateData = { price: price != null ? parseFloat(price) : null };
    } else if (action === "update-priority") {
      updateData = { priority: parseInt(body.priority ?? "0") };
    } else if (action === "update-notes") {
      updateData = { notes: body.notes ?? null };
    } else if (action === "acknowledge") {
      const current = await prisma.delivery.findUnique({
        where: { id },
        include: { courier: true },
      });
      if (current?.courier) {
        pusher.trigger(ADMIN_CHANNEL, EVENTS.DELIVERY_ACKNOWLEDGED, {
          courierName: current.courier.name,
          orderNumber: current.orderNumber,
          customerName: current.customerName,
        }).catch(console.error);
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
