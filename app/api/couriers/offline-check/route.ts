import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { pusher, ADMIN_CHANNEL, EVENTS } from "@/lib/pusher";

// Un coursier est considéré hors ligne après 5 minutes sans mise à jour GPS
const OFFLINE_THRESHOLD_MINUTES = 5;

/**
 * POST /api/couriers/offline-check
 * Marque comme "offline" les coursiers dont lastSeen dépasse le seuil.
 * Crée une alerte pour chaque coursier passé hors ligne.
 * Appelé périodiquement par le dashboard admin (toutes les 60s).
 */
export async function POST() {
  try {
    const cutoff = new Date(Date.now() - OFFLINE_THRESHOLD_MINUTES * 60 * 1000);

    // Trouver les coursiers actifs (non-offline) qui n'ont plus donné signe de vie
    // et qui n'ont PAS explicitement choisi d'être en ligne (manuallyOnline = false)
    const stale = await prisma.courier.findMany({
      where: {
        status: { not: "offline" },
        manuallyOnline: false,
        lastSeen: { lt: cutoff },
        // Seulement ceux qui ont déjà envoyé une position (lastSeen not null)
        NOT: { lastSeen: null },
      },
      select: { id: true, name: true, status: true },
    });

    if (stale.length === 0) {
      return NextResponse.json({ markedOffline: 0 });
    }

    const staleIds = stale.map((c) => c.id);

    // Marquer comme offline en une seule requête
    await prisma.courier.updateMany({
      where: { id: { in: staleIds } },
      data: { status: "offline" },
    });

    // Créer une alerte pour chaque coursier passé hors ligne (si pas déjà ouverte).
    // Une seule requête pour les alertes existantes, puis les créations en parallèle.
    const existing = await prisma.alert.findMany({
      where: { courierId: { in: staleIds }, type: "offline", resolved: false },
      select: { courierId: true },
    });
    const alreadyAlerted = new Set(existing.map((a) => a.courierId));
    const created = await Promise.all(
      stale
        .filter((c) => !alreadyAlerted.has(c.id))
        .map((c) =>
          prisma.alert
            .create({
              data: {
                courierId: c.id,
                type: "offline",
                message: `${c.name} ne répond plus (aucune position depuis ${OFFLINE_THRESHOLD_MINUTES} min)`,
                severity: "warning",
              },
            })
            .then((alert) => ({ ...alert, courier: { name: c.name } }))
        )
    );

    // Un seul appel Pusher : nouvelles alertes + statuts des coursiers changés
    const events = [
      ...created.map((data) => ({ channel: ADMIN_CHANNEL, name: EVENTS.ALERTS_NEW, data })),
      { channel: ADMIN_CHANNEL, name: EVENTS.COURIERS_UPDATED, data: {} },
    ];
    for (let i = 0; i < events.length; i += 10) {
      pusher.triggerBatch(events.slice(i, i + 10)).catch(console.error);
    }

    return NextResponse.json({ markedOffline: stale.length });
  } catch (error) {
    console.error("Error in offline-check:", error);
    return NextResponse.json({ error: "Failed to run offline check" }, { status: 500 });
  }
}
