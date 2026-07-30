import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// ── Neon serverless driver ─────────────────────────────────────────────────
// On Vercel's serverless runtime, raw TCP connections to Neon's pooler
// (port 5432) are unreliable — they work locally but intermittently fail in
// production with "Can't reach database server". The Neon serverless driver
// talks to Neon over WebSocket instead, which is the connection path Neon
// supports for serverless/edge environments. In Node (no global WebSocket) we
// must supply the constructor explicitly.
neonConfig.webSocketConstructor = ws;

// ── Connection-error detection ─────────────────────────────────────────────
// Neon free tier auto-suspends after 5 min of inactivity. Waking the compute
// takes ~5-10 s, during which connection attempts throw this error. The retry
// below rides out that window so the first request after idle still succeeds.
function isNeonColdStart(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientInitializationError) return true;
  if (e instanceof Error) {
    const m = e.message.toLowerCase();
    return (
      m.includes("can't reach database") ||
      m.includes("connection refused") ||
      m.includes("econnrefused") ||
      m.includes("econnreset") ||
      m.includes("etimedout") ||
      m.includes("server closed the connection") ||
      m.includes("connect econnrefused")
    );
  }
  return false;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// ── Singleton with auto-retry middleware ───────────────────────────────────
function createPrisma() {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaNeon(pool);
  const client = new PrismaClient({ adapter, log: ["error"] });

  // $use wraps every query; retries on Neon cold-start errors with backoff.
  // (deprecated in Prisma 5 but still fully functional until Prisma 6)
  client.$use(async (params, next) => {
    const MAX = 5;
    for (let attempt = 0; attempt <= MAX; attempt++) {
      try {
        return await next(params);
      } catch (e) {
        if (attempt < MAX && isNeonColdStart(e)) {
          // wait 1.5 s, 3 s, 4.5 s … giving Neon time to wake up
          await sleep(1500 * (attempt + 1));
          continue;
        }
        throw e;
      }
    }
  });

  return client;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ── Manual helper (use in routes that need explicit retry outside a query) ─
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 5,
  baseDelayMs = 1500,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt < retries && isNeonColdStart(e)) {
        await sleep(baseDelayMs * (attempt + 1));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}
