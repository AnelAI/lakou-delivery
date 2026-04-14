import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const search   = searchParams.get("search");

    const merchants = await prisma.merchant.findMany({
      where: {
        active: true,
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
