import { NextRequest, NextResponse } from "next/server";
import type { Alert } from "@prisma/client";
import { prisma } from "@/lib/db";
import { haversineDistance, isRouteDeviation, generateSimpleRoute } from "@/lib/geo";
import { pusher, ADMIN_CHANNEL, EVENTS } from "@/lib/pusher";
import { ACTIVE_DELIVERY_STATUSES } from "@/lib/delivery-status";

const PAUSE_THRESHOLD_MINUTES = 5;
const MOVEMENT_THRESHOLD_KM = 0.05;
const DEVIATION_THRESHOLD_KM = 0.5;
// Speed from Flutter geolocator is in m/s; 22.2 m/s ≈ 80 km/h
const SPEED_VIOLATION_MS = 22.2;
// Positions arriving faster than this are dropped: protects the DB and Pusher
// quotas from clients (PWA or Flutter) that send on every GPS fix.
const MIN_SERVER_INTERVAL_MS = 3_000;

type AlertType = "unauthorized_pause" | "speed_violation" | "route_deviation";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { courierId, lat, lng, speed, heading } = body;

    if (!courierId || lat === undefined || lng === undefined) {
      return NextResponse.json({ error: "courierId, lat, lng are required" }, { status: 400 });
    }

    const courier = await prisma.courier.findUnique({
      where: { id: courierId },
      select: { id: true, name: true, status: true, currentLat: true, currentLng: true, lastSeen: true },
    });
    if (!courier) {
      return NextResponse.json({ error: "Courier not found" }, { status: 404 });
    }

    const now = new Date();
    if (courier.lastSeen && now.getTime() - courier.lastSeen.getTime() < MIN_SERVER_INTERVAL_MS) {
      return NextResponse.json({ success: true, throttled: true });
    }

    const speedVal = speed || 0;
    const headingVal = heading || 0;
    const effectiveStatus = courier.status === "offline" ? "available" : courier.status;
    const isBusy = effectiveStatus === "busy";

    // History insert, position update and the alert/delivery lookups are
    // independent, so run them in one round trip instead of sequentially.
    const [, , openAlerts, activeDelivery] = await Promise.all([
      prisma.courierLocation.create({
        data: { courierId, lat, lng, speed: speedVal, heading: headingVal, timestamp: now },
      }),
      prisma.courier.update({
        where: { id: courierId },
        data: {
          currentLat: lat,
          currentLng: lng,
          speed: speedVal,
          heading: headingVal,
          lastSeen: now,
          status: effectiveStatus,
        },
        select: { id: true },
      }),
      prisma.alert.findMany({
        where: {
          courierId,
          resolved: false,
          type: { in: ["unauthorized_pause", "speed_violation", "route_deviation"] },
        },
      }),
      isBusy
        ? prisma.delivery.findFirst({
            where: { courierId, status: { in: [...ACTIVE_DELIVERY_STATUSES] } },
            orderBy: { assignedAt: "asc" },
            select: { pickupLat: true, pickupLng: true, deliveryLat: true, deliveryLng: true },
          })
        : Promise.resolve(null),
    ]);

    const openByType = new Map<string, Alert[]>();
    for (const a of openAlerts) {
      openByType.set(a.type, [...(openByType.get(a.type) ?? []), a]);
    }
    const toCreate: { type: AlertType; message: string; severity: string }[] = [];
    const toResolve: AlertType[] = [];

    // ── Pause Detection ──────────────────────────────────────────────────────
    if (courier.currentLat !== null && courier.currentLng !== null) {
      const distMoved = haversineDistance(courier.currentLat, courier.currentLng, lat, lng);
      const isMoving = distMoved > MOVEMENT_THRESHOLD_KM;

      if (!isMoving && isBusy && !openByType.has("unauthorized_pause")) {
        const recentLocations = await prisma.courierLocation.findMany({
          where: { courierId },
          orderBy: { timestamp: "desc" },
          take: 20,
          select: { timestamp: true },
        });

        if (recentLocations.length >= 2) {
          const oldest = recentLocations[recentLocations.length - 1];
          const newest = recentLocations[0];
          const timeDiffMinutes =
            (newest.timestamp.getTime() - oldest.timestamp.getTime()) / 60000;

          if (timeDiffMinutes >= PAUSE_THRESHOLD_MINUTES) {
            toCreate.push({
              type: "unauthorized_pause",
              message: `${courier.name} est immobile depuis ${Math.round(timeDiffMinutes)} minutes`,
              severity: timeDiffMinutes > 10 ? "critical" : "warning",
            });
          }
        }
      } else if (isMoving) {
        // Auto-résolution : le coursier s'est remis en mouvement
        toResolve.push("unauthorized_pause");
      }
    }

    // ── Speed Violation Detection ────────────────────────────────────────────
    if (speedVal > SPEED_VIOLATION_MS && isBusy) {
      if (!openByType.has("speed_violation")) {
        toCreate.push({
          type: "speed_violation",
          message: `${courier.name} roule à ${Math.round(speedVal * 3.6)} km/h`,
          severity: "critical",
        });
      }
    } else {
      // Auto-résolution quand vitesse retombe sous le seuil
      toResolve.push("speed_violation");
    }

    // ── Route Deviation Detection ────────────────────────────────────────────
    if (activeDelivery) {
      // Ligne droite pickup → livraison comme référence de route (20 points)
      const routePoints = generateSimpleRoute(
        activeDelivery.pickupLat,
        activeDelivery.pickupLng,
        activeDelivery.deliveryLat,
        activeDelivery.deliveryLng,
        20
      );

      if (isRouteDeviation(lat, lng, routePoints, DEVIATION_THRESHOLD_KM)) {
        if (!openByType.has("route_deviation")) {
          toCreate.push({
            type: "route_deviation",
            message: `${courier.name} s'est écarté de son itinéraire (>${DEVIATION_THRESHOLD_KM * 1000}m)`,
            severity: "warning",
          });
        }
      } else {
        // Auto-résolution si le coursier est revenu sur l'itinéraire
        toResolve.push("route_deviation");
      }
    }

    // Résout les alertes ouvertes ET notifie le dashboard, sinon elles restent
    // affichées côté admin jusqu'au prochain rechargement.
    const resolving = toResolve.flatMap((t) => openByType.get(t) ?? []);
    const [created] = await Promise.all([
      Promise.all(toCreate.map((data) => prisma.alert.create({ data: { courierId, ...data } }))),
      resolving.length > 0
        ? prisma.alert.updateMany({
            where: { id: { in: resolving.map((a) => a.id) } },
            data: { resolved: true, resolvedAt: now },
          })
        : Promise.resolve(null),
    ]);

    const courierRef = { name: courier.name };
    const events = [
      ...created.map((alert) => ({
        channel: ADMIN_CHANNEL,
        name: EVENTS.ALERTS_NEW,
        data: { ...alert, courier: courierRef },
      })),
      ...resolving.map((alert) => ({
        channel: ADMIN_CHANNEL,
        name: EVENTS.ALERTS_UPDATED,
        data: { ...alert, resolved: true, resolvedAt: now, courier: courierRef },
      })),
      // Broadcast live position to admin dashboard
      {
        channel: ADMIN_CHANNEL,
        name: EVENTS.COURIER_LOCATION_UPDATE,
        data: {
          courierId,
          lat,
          lng,
          speed: speedVal,
          heading: headingVal,
          name: courier.name,
          status: effectiveStatus,
          timestamp: now.toISOString(),
        },
      },
    ];
    // One HTTP call to Pusher for all events (max 10 per batch).
    for (let i = 0; i < events.length; i += 10) {
      pusher.triggerBatch(events.slice(i, i + 10)).catch(console.error);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in tracking:", error);
    return NextResponse.json({ error: "Failed to update tracking" }, { status: 500 });
  }
}
