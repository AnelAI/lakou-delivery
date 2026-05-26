import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const search   = searchParams.get("search");
    const admin    = searchParams.get("admin") === "true";

    const merchants = await prisma.merchant.findMany({
      where: {
        ...(admin ? {} : { active: true }),
        ...(category && category !== "all" ? { category } : {}),
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(merchants);
  } catch (error) {
    console.error("Error fetching merchants:", error);
    return NextResponse.json({ error: "Failed to fetch merchants" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, category, lat, lng, address, phone, website } = body;

    if (!name || !category || lat == null || lng == null) {
      return NextResponse.json({ error: "Champs requis: name, category, lat, lng" }, { status: 400 });
    }

    const merchant = await prisma.merchant.create({
      data: {
        name: String(name).trim(),
        category: String(category),
        lat: Number(lat),
        lng: Number(lng),
        address: address ? String(address).trim() : null,
        phone: phone ? String(phone).trim() : null,
        website: website ? String(website).trim() : null,
        active: true,
      },
    });

    return NextResponse.json(merchant, { status: 201 });
  } catch (error) {
    console.error("Error creating merchant:", error);
    return NextResponse.json({ error: "Failed to create merchant" }, { status: 500 });
  }
}
