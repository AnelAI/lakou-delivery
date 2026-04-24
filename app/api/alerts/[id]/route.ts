import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db";
import { pusher, ADMIN_CHANNEL, EVENTS } from "@/lib/pusher";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const alert = await prisma.alert.update({
      where: { id },
      data: {
        ...body,
        ...(body.resolved ? { resolvedAt: new Date() } : {}),
      },
      include: { courier: { select: { id: true, name: true } } },
    });

    pusher.trigger(ADMIN_CHANNEL, EVENTS.ALERTS_UPDATED, alert).catch(console.error);

    return NextResponse.json(alert);
  } catch {
    return NextResponse.json({ error: "Failed to update alert" }, { status: 500 });
  }
}
