import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface DbNotif {
  id: string;
  kind: string;
  courierName: string;
  orderNumber: string;
  customerName: string | null;
  deliveryId: string | null;
  read: boolean;
  createdAt: Date;
}

export async function GET() {
  try {
    const rows = await prisma.$queryRaw<DbNotif[]>`
      SELECT id, kind, "courierName", "orderNumber", "customerName", "deliveryId", read, "createdAt"
      FROM "DeliveryNotification"
      ORDER BY "createdAt" DESC
      LIMIT 200
    `;
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[GET /api/notifications]", err);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { kind, courierName, orderNumber, customerName, deliveryId } = body;

    if (!kind || !courierName || !orderNumber) {
      return NextResponse.json({ error: "kind, courierName, orderNumber required" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const now = new Date();
    const cust = customerName ?? null;
    const delId = deliveryId ?? null;

    await prisma.$executeRaw`
      INSERT INTO "DeliveryNotification" (id, kind, "courierName", "orderNumber", "customerName", "deliveryId", read, "createdAt")
      VALUES (${id}, ${kind}, ${courierName}, ${orderNumber}, ${cust}, ${delId}, false, ${now})
    `;

    return NextResponse.json({ id, kind, courierName, orderNumber, customerName: cust, deliveryId: delId, read: false, createdAt: now }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/notifications]", err);
    return NextResponse.json({ error: "Failed to create notification" }, { status: 500 });
  }
}
