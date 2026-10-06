import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db";
import { haversineDistance, estimateTravelTime } from "@/lib/geo";
import { pusher, ADMIN_CHANNEL, courierChannel, EVENTS } from "@/lib/pusher";
import { notifyAdmin } from "@/lib/web-push";
import { sendCourierFcm } from "@/lib/firebase-admin";
import { ACTIVE_DELIVERY_STATUSES } from "@/lib/delivery-status";

// Fields of the courier that may be sent to clients. Never include accessKey
// or fcmToken: delivery updates are broadcast on a public Pusher channel.
const COURIER_PUBLIC = { select: { id: true, name: true, phone: true } } as const;

// Sets the courier back to "available" if it has no other active delivery.
// One UPDATE with a NOT EXISTS filter instead of a COUNT followed by an UPDATE.
function releaseCourierIfIdle(courierId: string, exceptDeliveryId: string) {
  return prisma.courier.updateMany({
    where: {
      id: courierId,
      deliveries: {
        none: { status: { in: [...ACTIVE_DELIVERY_STATUSES] }, id: { not: exceptDeliveryId } },
      },
    },
    data: { status: "available" },
  });
}

// Raw SQL insert — bypasses generated Prisma model so it works before `prisma generate`
function saveNotif(kind: string, courierName: string, orderNumber: string, customerName: string | null, deliveryId: string) {
  const notifId = crypto.randomUUID();
  const now = new Date();
  prisma.$executeRaw`
    INSERT INTO "DeliveryNotification" (id, kind, "courierName", "orderNumber", "customerName", "deliveryId", read, "createdAt")
    VALUES (${notifId}, ${kind}, ${courierName}, ${orderNumber}, ${customerName}, ${deliveryId}, false, ${now})
  `.catch((e: unknown) => console.error("[saveNotif]", e));
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const delivery = await withRetry(() => prisma.delivery.findUnique({
      where: { id },
      include: { courier: COURIER_PUBLIC },
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

    // Actions that read the current delivery share a single lookup.
    const needsCurrent = ["assign", "unassign", "deliver", "cancel", "acknowledge", "refuse", "arrived"].includes(action);
    const current = needsCurrent
      ? await prisma.delivery.findUnique({
          where: { id },
          include: { courier: { select: { id: true, name: true, fcmToken: true } } },
        })
      : null;
    const previousCourierId = current?.courierId ?? null;

    if (action === "assign" && courierId) {
      const delivery = current;
      const courier = await prisma.courier.findUnique({
        where: { id: courierId },
        select: { currentLat: true, currentLng: true, fcmToken: true },
      });

      if (courier && delivery) {
        // Free previous courier when reassigning
        if (delivery.courierId && delivery.courierId !== courierId) {
          await releaseCourierIfIdle(delivery.courierId, id);
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

        console.log("[ASSIGN] courier.fcmToken:", courier.fcmToken ?? "null — token not registered");
        if (courier.fcmToken) {
          sendCourierFcm(courier.fcmToken, {
            title: "Nouvelle course assignée",
            body: `${delivery.pickupAddress} → ${delivery.deliveryAddress}`,
            data: {
              type: "new_order",
              deliveryId: id,
              orderNumber: delivery.orderNumber,
              pickupAddress: delivery.pickupAddress,
              deliveryAddress: delivery.deliveryAddress,
              customerName: delivery.customerName,
              customerPhone: delivery.customerPhone ?? "",
              pickupLat: String(delivery.pickupLat),
              pickupLng: String(delivery.pickupLng),
              pickupMapsUrl: delivery.pickupMapsUrl ?? "",
              deliveryLat: String(delivery.deliveryLat),
              deliveryLng: String(delivery.deliveryLng),
              deliveryMapsUrl: delivery.deliveryMapsUrl ?? "",
              price: delivery.price != null ? String(delivery.price) : "0",
              notes: delivery.notes ?? "",
              deliveryDescription: delivery.deliveryDescription ?? "",
            },
          }).catch((err) => console.error("[ASSIGN] FCM send error:", err));
        } else {
          console.warn("[ASSIGN] No fcmToken on courier — notification not sent");
        }
      }
    } else if (action === "unassign") {
      const delivery = current;
      if (delivery?.courierId) {
        await releaseCourierIfIdle(delivery.courierId, id);
        if (delivery.courier?.fcmToken) {
          sendCourierFcm(delivery.courier.fcmToken, {
            title: "Course désassignée",
            body: `La course #${delivery.orderNumber} vous a été retirée`,
            data: { type: "cancelled", deliveryId: id, orderNumber: delivery.orderNumber },
          }).catch(console.error);
        }
      }
      updateData = { ...updateData, status: "pending", courierId: null };
    } else if (action === "pickup") {
      updateData = { ...updateData, status: "picked_up", pickedUpAt: new Date() };
    } else if (action === "deliver") {
      updateData = { ...updateData, status: "delivered", deliveredAt: new Date() };

      if (current?.courierId) {
        await releaseCourierIfIdle(current.courierId, id);
      }
    } else if (action === "cancel") {
      if (current?.courierId) {
        await releaseCourierIfIdle(current.courierId, id);
        if (current.courier?.fcmToken) {
          sendCourierFcm(current.courier.fcmToken, {
            title: "Course annulée",
            body: `La course #${current.orderNumber} a été annulée par l'admin`,
            data: { type: "cancelled", deliveryId: id, orderNumber: current.orderNumber },
          }).catch(console.error);
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
    } else if (action === "update-description") {
      updateData = { deliveryDescription: body.deliveryDescription ?? null };
    } else if (action === "acknowledge") {
      if (current?.courier) {
        pusher.trigger(ADMIN_CHANNEL, EVENTS.DELIVERY_ACKNOWLEDGED, {
          courierName: current.courier.name,
          orderNumber: current.orderNumber,
          customerName: current.customerName,
        }).catch(console.error);
        notifyAdmin({
          title: "Course acceptée",
          body: `${current.courier.name} a accepté la course #${current.orderNumber} — ${current.customerName}`,
          tag: `ack-${id}`,
          url: "/",
        }).catch(console.error);
        saveNotif("acknowledged", current.courier.name, current.orderNumber, current.customerName, id);
      }
      updateData = { status: "confirmed", confirmedAt: new Date() };
    } else if (action === "refuse") {
      if (current?.courierId) {
        await releaseCourierIfIdle(current.courierId, id);
        if (current.courier) {
          pusher.trigger(ADMIN_CHANNEL, EVENTS.DELIVERY_REFUSED, {
            courierName: current.courier.name,
            orderNumber: current.orderNumber,
            customerName: current.customerName,
          }).catch(console.error);
          notifyAdmin({
            title: "Course refusée ⚠️",
            body: `${current.courier.name} a refusé la course #${current.orderNumber} — ${current.customerName}`,
            tag: `refuse-${id}`,
            url: "/",
            requireInteraction: true,
          }).catch(console.error);
          saveNotif("refused", current.courier.name, current.orderNumber, current.customerName, id);
        }
      }
      updateData = { status: "pending", courierId: null };
    } else if (action === "arrived") {
      if (current?.courier) {
        pusher.trigger(ADMIN_CHANNEL, EVENTS.DELIVERY_ARRIVED, {
          courierName: current.courier.name,
          orderNumber: current.orderNumber,
          customerName: current.customerName,
        }).catch(console.error);
        notifyAdmin({
          title: "Coursier chez le client",
          body: `${current.courier.name} est arrivé chez ${current.customerName} — #${current.orderNumber}`,
          tag: `arrived-${id}`,
          url: "/",
        }).catch(console.error);
        saveNotif("arrived", current.courier.name, current.orderNumber, current.customerName, id);
      }
      // No status change — just a notification event
      updateData = {};
    }

    const delivery = await prisma.delivery.update({
      where: { id },
      data: updateData,
      include: { courier: COURIER_PUBLIC },
    });

    // Couriers listen on their own channel only (not on "admin", which also
    // carries every GPS update), so notify the old and new courier directly.
    const channels = [ADMIN_CHANNEL];
    for (const cId of [delivery.courierId, previousCourierId]) {
      if (cId && !channels.includes(courierChannel(cId))) channels.push(courierChannel(cId));
    }
    pusher.trigger(channels, EVENTS.DELIVERIES_UPDATED, delivery).catch(console.error);

    // Web push + DB save for courier status changes
    if (action === "pickup" && delivery.courier) {
      notifyAdmin({
        title: "Colis récupéré",
        body: `${delivery.courier.name} a récupéré le colis #${delivery.orderNumber}`,
        tag: `pickup-${id}`,
        url: "/",
      }).catch(console.error);
      saveNotif("picked_up", delivery.courier.name, delivery.orderNumber, delivery.customerName, id);
    } else if (action === "deliver" && delivery.courier) {
      notifyAdmin({
        title: "Course livrée",
        body: `${delivery.courier.name} a livré la commande #${delivery.orderNumber} à ${delivery.customerName}`,
        tag: `deliver-${id}`,
        url: "/",
        requireInteraction: true,
      }).catch(console.error);
      saveNotif("delivered", delivery.courier.name, delivery.orderNumber, delivery.customerName, id);
    }

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
    const deleted = await prisma.delivery.delete({ where: { id }, select: { courierId: true } });
    const channels = deleted.courierId
      ? [ADMIN_CHANNEL, courierChannel(deleted.courierId)]
      : ADMIN_CHANNEL;
    pusher.trigger(channels, EVENTS.DELIVERIES_UPDATED, {}).catch(console.error);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete delivery" }, { status: 500 });
  }
}
