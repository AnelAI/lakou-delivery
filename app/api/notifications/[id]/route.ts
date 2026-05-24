import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const read: boolean = body.read ?? true;

    await prisma.$executeRaw`
      UPDATE "DeliveryNotification" SET read = ${read} WHERE id = ${id}
    `;

    return NextResponse.json({ id, read });
  } catch (err) {
    console.error("[PATCH /api/notifications/:id]", err);
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.$executeRaw`DELETE FROM "DeliveryNotification" WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/notifications/:id]", err);
    return NextResponse.json({ error: "Failed to delete notification" }, { status: 500 });
  }
}
