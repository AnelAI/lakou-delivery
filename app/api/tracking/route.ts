import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { haversineDistance, isRouteDeviation, generateSimpleRoute } from "@/lib/geo";
import { pusher, ADMIN_CHANNEL, EVENTS } from "@/lib/pusher";

const PAUSE_THRESHOLD_MINUTES = 5;
const MOVEMENT_THRESHOLD_KM = 0.05;
const DEVIATION_THRESHOLD_KM = 0.5;
// Speed from Flutter geolocator is in m/s; 22.2 m/s ≈ 80 km/h
const SPEED_VIOLATION_MS = 22.2;

// Résout les alertes non résolues d'un type donné ET notifie le dashboard,
// sinon elles restent affichées côté admin jusqu'au prochain rechargement.
async function autoResolveAlerts(courierId: string, type: string, courierName: string) {
  const unresolved = await prisma.alert.findMany({
    where: { courierId, type, resolved: false },
  });
  if (unresolved.length === 0) return;

  const resolvedAt = new Date();
  await prisma.alert.updateMany({
    where: { id: { in: unresolved.map((a) => a.id) } },
    data: { resolved: true, resolvedAt },
  });

  for (const alert of unresolved) {
    pusher.trigger(ADMIN_CHANNEL, EVENTS.ALERTS_UPDATED, {
      ...alert,
      resolved: true,
      resolvedAt,
      courier: { name: courierName },
    }).catch(console.error);
  }
}

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

    const speedVal = speed || 0;
    const headingVal = heading || 0;

    // Save location history
    await prisma.courierLocation.create({
      data: { courierId, lat, lng, speed: speedVal, heading: headingVal },
    });

    // Update courier current position
    const updatedCourier = await prisma.courier.update({
      where: { id: courierId },
      data: {
        currentLat: lat,
        currentLng: lng,
        speed: speedVal,
        heading: headingVal,
        lastSeen: new Date(),
        status: courier.status === "offline" ? "available" : courier.status,
      },
    });

    const effectiveStatus = updatedCourier.status;

    // ── Pause Detection ──────────────────────────────────────────────────────
    if (courier.currentLat !== null && courier.currentLng !== null) {
      const distMoved = haversineDistance(courier.currentLat, courier.currentLng, lat, lng);
      const isMoving = distMoved > MOVEMENT_THRESHOLD_KM;

      if (!isMoving && effectiveStatus === "busy") {
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
        // Auto-résolution : le coursier s'est remis en mouvement
        await autoResolveAlerts(courierId, "unauthorized_pause", courier.name);
      }
    }

    // ── Speed Violation Detection ────────────────────────────────────────────
    if (speedVal > SPEED_VIOLATION_MS && effectiveStatus === "busy") {
      const existingSpeedAlert = await prisma.alert.findFirst({
        where: { courierId, type: "speed_violation", resolved: false },
      });
      if (!existingSpeedAlert) {
        const kmh = Math.round(speedVal * 3.6);
        const alert = await prisma.alert.create({
          data: {
            courierId,
            type: "speed_violation",
            message: `${courier.name} roule à ${kmh} km/h`,
            severity: "critical",
          },
        });
        pusher.trigger(ADMIN_CHANNEL, EVENTS.ALERTS_NEW, {
          ...alert,
          courier: { name: courier.name },
        }).catch(console.error);
      }
    } else {
      // Auto-résolution quand vitesse retombe sous le seuil
      await autoResolveAlerts(courierId, "speed_violation", courier.name);
    }

    // ── Route Deviation Detection ────────────────────────────────────────────
    if (effectiveStatus === "busy") {
      const activeDelivery = await prisma.delivery.findFirst({
        where: {
          courierId,
          status: { in: ["assigned", "picked_up"] },
        },
        orderBy: { assignedAt: "asc" },
      });

      if (activeDelivery) {
        // Ligne droite pickup → livraison comme référence de route (20 points)
        const routePoints = generateSimpleRoute(
          activeDelivery.pickupLat,
          activeDelivery.pickupLng,
          activeDelivery.deliveryLat,
          activeDelivery.deliveryLng,
          20
        );

        const deviated = isRouteDeviation(lat, lng, routePoints, DEVIATION_THRESHOLD_KM);

        if (deviated) {
          const existingDeviation = await prisma.alert.findFirst({
            where: { courierId, type: "route_deviation", resolved: false },
          });
          if (!existingDeviation) {
            const alert = await prisma.alert.create({
              data: {
                courierId,
                type: "route_deviation",
                message: `${courier.name} s'est écarté de son itinéraire (>${DEVIATION_THRESHOLD_KM * 1000}m)`,
                severity: "warning",
              },
            });
            pusher.trigger(ADMIN_CHANNEL, EVENTS.ALERTS_NEW, {
              ...alert,
              courier: { name: courier.name },
            }).catch(console.error);
          }
        } else {
          // Auto-résolution si le coursier est revenu sur l'itinéraire
          await autoResolveAlerts(courierId, "route_deviation", courier.name);
        }
      }
    }

    // Broadcast live position to admin dashboard
    pusher.trigger(ADMIN_CHANNEL, EVENTS.COURIER_LOCATION_UPDATE, {
      courierId,
      lat,
      lng,
      speed: speedVal,
      heading: headingVal,
      name: courier.name,
      status: effectiveStatus,
      timestamp: new Date().toISOString(),
    }).catch(console.error);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in tracking:", error);
    return NextResponse.json({ error: "Failed to update tracking" }, { status: 500 });
  }
}
