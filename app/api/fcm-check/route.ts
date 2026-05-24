import { NextResponse } from "next/server";
import { sendCourierFcm } from "@/lib/firebase-admin";
import { prisma } from "@/lib/db";

// GET /api/fcm-check
// Vérifie la configuration Firebase et l'état des tokens FCM des coursiers
export async function GET() {
  const firebaseConfigured = !!(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_PRIVATE_KEY &&
    process.env.FIREBASE_CLIENT_EMAIL
  );

  const couriers = await prisma.courier.findMany({
    select: { id: true, name: true, fcmToken: true },
  });

  const summary = couriers.map((c) => ({
    name: c.name,
    hasToken: !!c.fcmToken,
    tokenPrefix: c.fcmToken ? c.fcmToken.substring(0, 20) + "..." : null,
  }));

  return NextResponse.json({
    firebaseConfigured,
    projectId: process.env.FIREBASE_PROJECT_ID ?? "MISSING",
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? "MISSING",
    couriers: summary,
  });
}

// POST /api/fcm-check  body: { courierId }
// Envoie une notification de test au coursier spécifié
export async function POST(req: Request) {
  const { courierId } = await req.json();

  const courier = await prisma.courier.findUnique({
    where: { id: courierId },
    select: { name: true, fcmToken: true },
  });

  if (!courier) {
    return NextResponse.json({ error: "Courier not found" }, { status: 404 });
  }

  if (!courier.fcmToken) {
    return NextResponse.json({
      ok: false,
      error: "Courier has no FCM token — open the mobile app and login first",
    });
  }

  try {
    await sendCourierFcm(courier.fcmToken, {
      title: "Test notification",
      body: `Test envoyé à ${courier.name} — ${new Date().toLocaleTimeString()}`,
      data: { type: "test" },
    });
    return NextResponse.json({ ok: true, message: `Notification sent to ${courier.name}` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
