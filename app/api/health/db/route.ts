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

  try {
    const started = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, tookMs: Date.now() - started, env });
  } catch (e) {
    const err = e as { message?: string; name?: string; code?: string };
    return NextResponse.json(
      {
        ok: false,
        env,
        error: {
          name: err?.name ?? null,
          code: err?.code ?? null,
          message: err?.message ?? String(e),
        },
      },
      { status: 200 }, // return 200 so the JSON is easy to read in the browser
    );
  }
}
