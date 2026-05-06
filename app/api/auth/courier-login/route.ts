import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { key } = await req.json();

    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "Clé manquante" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const courier = await (prisma as any).courier.findFirst({
      where: { accessKey: key.trim().toUpperCase() },
      select: {
        id: true,
        name: true,
        phone: true,
        photo: true,
        status: true,
      },
    });

    if (!courier) {
      return NextResponse.json({ error: "Clé incorrecte" }, { status: 401 });
    }

    return NextResponse.json(courier);
  } catch (error) {
    console.error("[courier-login]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
