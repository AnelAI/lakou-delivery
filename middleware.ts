import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

// Routes accessibles sans connexion
const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth",
  "/api/deliveries",
  "/api/merchants",
  "/api/tracking",
  "/api/track",
  "/api/stats",
  "/order",
  "/track",
  "/courier",
  "/_next",
  "/favicon",
  "/icons",
  "/manifest",
  "/sw.js",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (verifySessionToken(token)) return NextResponse.next();

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
