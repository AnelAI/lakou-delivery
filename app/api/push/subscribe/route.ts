import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { endpoint, keys } = body as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: "Invalid subscription object" }, { status: 400 });
    }

    await withRetry(() =>
      prisma.adminPushSubscription.upsert({
        where: { endpoint },
        create: { endpoint, p256dh: keys.p256dh!, auth: keys.auth! },
        update: { p256dh: keys.p256dh!, auth: keys.auth! },
      })
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Push subscribe error:", error);
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { endpoint } = await req.json();
    if (!endpoint) return NextResponse.json({ error: "endpoint required" }, { status: 400 });
    await prisma.adminPushSubscription.deleteMany({ where: { endpoint } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete subscription" }, { status: 500 });
  }
}
