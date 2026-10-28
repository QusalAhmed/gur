import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, verifySessionToken } from "@/lib/admin-auth";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // 1. Allow Admin Login page without authentication
  if (pathname === "/admin/login") {
    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (token) {
      const user = await verifySessionToken(token);
      if (user) {
        // User already has an authenticated session -> redirect to target or admin root
        const next = request.nextUrl.searchParams.get("next") || "/admin";
        return NextResponse.redirect(new URL(next, request.url));
      }
    }
    return NextResponse.next();
  }

  // 2. Allow Admin Auth endpoints (/api/admin/auth/*)
  if (pathname.startsWith("/api/admin/auth")) {
    return NextResponse.next();
  }

  // 3. Protect Admin API routes (/api/admin/*)
  if (pathname.startsWith("/api/admin")) {
    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    const user = token ? await verifySessionToken(token) : null;
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Admin session required." },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // 4. Protect all other Admin routes (/admin, /admin/orders, etc.)
  if (pathname.startsWith("/admin")) {
    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    const user = token ? await verifySessionToken(token) : null;
    if (!user) {
      const loginUrl = new URL("/admin/login", request.url);
      const target = pathname + (search || "");
      loginUrl.searchParams.set("next", target);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
