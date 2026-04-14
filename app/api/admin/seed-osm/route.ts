import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchOsmMerchants } from "@/lib/osm-merchants";

export async function POST() {
  try {
    const merchants = await fetchOsmMerchants();

    let created = 0;
    let updated = 0;

    for (const m of merchants) {
      const existing = await prisma.merchant.findUnique({ where: { osmId: m.osmId } });

      if (existing) {
        await prisma.merchant.update({
          where: { osmId: m.osmId },
          data: {
            name:     m.name,
            category: m.category,
            address:  m.address,
            lat:      m.lat,
            lng:      m.lng,
            phone:    m.phone,
            website:  m.website,
          },
        });
        updated++;
      } else {
        await prisma.merchant.create({ data: m });
        created++;
      }
    }

    return NextResponse.json({
      success: true,
      total:   merchants.length,
      created,
      updated,
    });
  } catch (error) {
    console.error("OSM seed error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Seed failed" },
      { status: 500 }
    );
  }
}
