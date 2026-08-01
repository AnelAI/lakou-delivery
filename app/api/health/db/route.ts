import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Diagnostic endpoint: reports whether the app can reach the database and, on
// failure, the real Prisma/Neon error — so a 500 on the data routes can be
// diagnosed from the browser without digging through server logs. It never
// exposes credentials: only the host portion of the connection string.
function connectionHost(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host; // host:port only, no user/password
  } catch {
    return "unparseable";
  }
}

export async function GET() {
  const env = {
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasDirectUrl: Boolean(process.env.DIRECT_URL),
    databaseHost: connectionHost(process.env.DATABASE_URL),
    directHost: connectionHost(process.env.DIRECT_URL),
  };

  const result: Record<string, unknown> = { env };

  // 1) Can we reach the database at all?
  try {
    const started = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    result.connection = { ok: true, tookMs: Date.now() - started };
  } catch (e) {
    const err = e as { message?: string; name?: string; code?: string };
    result.connection = {
      ok: false,
      error: { name: err?.name ?? null, code: err?.code ?? null, message: err?.message ?? String(e) },
    };
    return NextResponse.json({ ok: false, ...result }, { status: 200 });
  }

  // 2) Do the tables exist (did the migrations run against THIS database)?
  try {
    const rows = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name`;
    const tables = rows.map((r) => r.table_name);
    const courierCount = await prisma.courier.count();
    result.schema = {
      ok: true,
      tableCount: tables.length,
      tables,
      courierCount,
    };
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (e) {
    const err = e as { message?: string; name?: string; code?: string };
    result.schema = {
      ok: false,
      error: { name: err?.name ?? null, code: err?.code ?? null, message: err?.message ?? String(e) },
    };
    return NextResponse.json({ ok: false, ...result }, { status: 200 });
  }
}
