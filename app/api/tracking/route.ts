import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db";
import { haversineDistance } from "@/lib/geo";
import { pusher, ADMIN_CHANNEL, EVENTS } from "@/lib/pusher";

const PAUSE_THRESHOLD_MINUTES = 5;
const MOVEMENT_THRESHOLD_KM = 0.05;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { courierId, lat, lng, speed, heading } = body;

    if (!courierId || lat === undefined || lng === undefined) {
      return NextResponse.json({ error: "courierId, lat, lng are required" }, { status: 400 });
    }

    const courier = await prisma.courier.findUnique({ where: { id: courierId } });
    if (!courier) {
      return NextResponse.json({ error: "Courier not found" }, { status: 404 });
    }

    // Save location history
    await prisma.courierLocation.create({
      data: { courierId, lat, lng, speed: speed || 0, heading: heading || 0 },
    });

    // Update courier current position
    const updatedCourier = await prisma.courier.update({
      where: { id: courierId },
      data: {
        currentLat: lat,
        currentLng: lng,
        speed: speed || 0,
        heading: heading || 0,
        lastSeen: new Date(),
        status: courier.status === "offline" ? "available" : courier.status,
      },
    });

    // ── Pause Detection ──────────────────────────────────────────────────────
    if (courier.currentLat !== null && courier.currentLng !== null) {
      const distMoved = haversineDistance(courier.currentLat, courier.currentLng, lat, lng);
      const isMoving = distMoved > MOVEMENT_THRESHOLD_KM;

      if (!isMoving && courier.status === "busy") {
        const recentLocations = await prisma.courierLocation.findMany({
          where: { courierId },
          orderBy: { timestamp: "desc" },
          take: 20,
        });

        if (recentLocations.length >= 2) {
          const oldest = recentLocations[recentLocations.length - 1];
          const newest = recentLocations[0];
          const timeDiffMinutes =
            (newest.timestamp.getTime() - oldest.timestamp.getTime()) / 60000;

          if (timeDiffMinutes >= PAUSE_THRESHOLD_MINUTES) {
            const existingAlert = await prisma.alert.findFirst({
              where: { courierId, type: "unauthorized_pause", resolved: false },
            });

            if (!existingAlert) {
              const alert = await prisma.alert.create({
                data: {
                  courierId,
                  type: "unauthorized_pause",
                  message: `${courier.name} est immobile depuis ${Math.round(timeDiffMinutes)} minutes`,
                  severity: timeDiffMinutes > 10 ? "critical" : "warning",
                },
              });

              pusher.trigger(ADMIN_CHANNEL, EVENTS.ALERTS_NEW, {
                ...alert,
                courier: { name: courier.name },
              }).catch(console.error);
            }
          }
        }
      } else if (isMoving) {
        // Auto-resolve pause alerts when moving again
        await prisma.alert.updateMany({
          where: { courierId, type: "unauthorized_pause", resolved: false },
          data: { resolved: true, resolvedAt: new Date() },
        });
      }
    }

    // Broadcast live position to admin dashboard
    pusher.trigger(ADMIN_CHANNEL, EVENTS.COURIER_LOCATION_UPDATE, {
      courierId,
      lat,
      lng,
      speed: speed || 0,
      heading: heading || 0,
      name: courier.name,
      status: updatedCourier.status,
      timestamp: new Date().toISOString(),
    }).catch(console.error);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in tracking:", error);
    return NextResponse.json({ error: "Failed to update tracking" }, { status: 500 });
  }
}
