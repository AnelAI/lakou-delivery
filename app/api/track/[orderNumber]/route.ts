import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;

    const delivery = await withRetry(() => prisma.delivery.findUnique({
      where: { orderNumber },
      include: {
        courier: {
          select: {
            id: true,
            name: true,
            phone: true,
            currentLat: true,
            currentLng: true,
            speed: true,
            heading: true,
            status: true,
          },
        },
      },
    }));

    if (!delivery) {
      return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
    }

    return NextResponse.json(delivery);
  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
