import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, verifySessionToken } from "@/lib/admin-auth";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const user = token ? await verifySessionToken(token) : null;
  const hasSbCookie = request.cookies.getAll().some(
    (c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token")
  );
  const isAuthenticated = !!user || hasSbCookie;

  // 1. If visiting /admin/login while authenticated, redirect to destination
  if (pathname === "/admin/login") {
    if (isAuthenticated) {
      let next = request.nextUrl.searchParams.get("next") || "/admin";
      if (next.startsWith("/admin/login")) {
        next = "/admin";
      }
      return NextResponse.redirect(new URL(next, request.url));
    }
    return NextResponse.next();
  }

  // 2. Allow Admin Auth endpoints (/api/admin/auth/*)
  if (pathname.startsWith("/api/admin/auth")) {
    return NextResponse.next();
  }

  // 3. Protect Admin API routes (/api/admin/*)
  if (pathname.startsWith("/api/admin")) {
    if (!isAuthenticated) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Admin session required." },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // 4. Protect all other Admin routes (/admin, /admin/orders, etc.)
  if (pathname.startsWith("/admin")) {
    if (!isAuthenticated) {
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
