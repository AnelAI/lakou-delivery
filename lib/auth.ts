import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.ADMIN_SECRET ?? "fallback-secret-change-me";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours
export const SESSION_COOKIE = "lakou_admin_session";

export function createSessionToken(): string {
  const ts = Date.now().toString();
  const sig = createHmac("sha256", SECRET).update(ts).digest("hex");
  return `${ts}.${sig}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const dotIdx = token.lastIndexOf(".");
  if (dotIdx === -1) return false;
  const ts = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  const expected = createHmac("sha256", SECRET).update(ts).digest("hex");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  } catch {
    return false;
  }
  const age = Date.now() - parseInt(ts, 10);
  return age >= 0 && age < SESSION_DURATION_MS;
}

export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  if (!expected) return false;
  try {
    return timingSafeEqual(Buffer.from(input), Buffer.from(expected));
  } catch {
    return false;
  }
}
