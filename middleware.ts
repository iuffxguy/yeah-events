import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Resolve the city slug from the incoming request hostname.
 *
 * Production:  yeahcharlotte.com  →  "charlotte"
 *              yeahatlanta.com    →  "atlanta"
 *
 * Local dev:   Falls back to the x-city-slug header so you can test any
 *              city with: -H "x-city-slug: charlotte"
 */
function resolveCitySlug(request: NextRequest): string | null {
  const host = request.headers.get("host") ?? "";

  // Local dev — allow header override
  if (host.includes("localhost") || host.includes("127.0.0.1")) {
    return request.headers.get("x-city-slug") ?? "charlotte";
  }

  // yeahCITY.com → "city"
  const match = host.match(/^yeah([a-z]+)\.com/);
  if (match) return match[1];

  return null;
}

export function middleware(request: NextRequest) {
  // Skip API, static assets, and admin routes
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const citySlug = resolveCitySlug(request);
  if (!citySlug) {
    // No city context — could redirect to a splash page
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.headers.set("x-city-slug", citySlug);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
