import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const merchant = await prisma.merchant.findUnique({ where: { id } });
    if (!merchant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const deliveries = await prisma.delivery.findMany({
      where: { merchantId: id },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        customerPhone: true,
        deliveryAddress: true,
        status: true,
        priority: true,
        price: true,
        createdAt: true,
        assignedAt: true,
        deliveredAt: true,
        courier: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(deliveries);
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
