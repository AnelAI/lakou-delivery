import { NextResponse } from "next/server";
import { openApiSpec } from "@/lib/openapi";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(openApiSpec, {
    headers: { "Cache-Control": "public, max-age=300, must-revalidate" },
  });
}
