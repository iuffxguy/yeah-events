import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "yeah-events.com";

/**
 * Resolve the city slug from the incoming request hostname.
 *
 * Production:  yeahcharlotte.com  →  "charlotte"
 *              yeah-charlotte.com  →  "charlotte"
 *              charlotte.yeah-events.com  →  "charlotte"
 *
 * Local dev:   Reads the `x-city-slug` header so you can test any city by
 *              passing `-H "x-city-slug: charlotte"` to your requests, or
 *              set it in next.config rewrites.
 */
function resolveCitySlug(request: NextRequest): string | null {
  const host = request.headers.get("host") ?? "";

  // Local dev — allow header override
  if (host.includes("localhost") || host.includes("127.0.0.1")) {
    return request.headers.get("x-city-slug") ?? "charlotte";
  }

  // Pattern: yeahCITY.com  e.g. yeahcharlotte.com
  const yeahPrefix = host.match(/^yeah([a-z]+)\.com/);
  if (yeahPrefix) return yeahPrefix[1];

  // Pattern: yeah-CITY.com  e.g. yeah-charlotte.com
  const yeahDash = host.match(/^yeah-([a-z-]+)\.com/);
  if (yeahDash) return yeahDash[1].replace(/-/g, "");

  // Pattern: CITY.yeah-events.com subdomain
  const subdomain = host.replace(`.${BASE_DOMAIN}`, "");
  if (subdomain && subdomain !== host && subdomain !== "www") return subdomain;

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
