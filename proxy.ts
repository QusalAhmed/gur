import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ADMIN_COOKIE_NAME, verifySessionToken } from "@/lib/admin-auth";
import {
  AdminRole,
  canRoleAccessPath,
  isValidAdminRole,
  sanitizeAdminRedirect,
  KNOWN_ADMIN_SECTIONS,
} from "@/lib/admin-permissions";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveVerifiedStaffRole(request: NextRequest): Promise<AdminRole | null> {
  let adminClient;
  try {
    adminClient = getSupabaseAdmin();
  } catch {
    return null;
  }

  // 1. Check HMAC-signed admin session cookie
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (token) {
    const adminUser = await verifySessionToken(token);
    if (adminUser) {
      if (adminUser.id === "admin-root") {
        const envAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
        if (
          envAdminEmail &&
          adminUser.email.trim().toLowerCase() === envAdminEmail &&
          adminUser.role === "owner"
        ) {
          return "owner";
        }
      } else if (UUID_REGEX.test(adminUser.id)) {
        const { data: staffMember } = await adminClient
          .from("staff_members")
          .select("role")
          .eq("user_id", adminUser.id)
          .maybeSingle();

        if (staffMember?.role && isValidAdminRole(staffMember.role)) {
          return staffMember.role;
        }
      }
    }
  }

  // 2. Fallback: verify Supabase Auth JWT via getUser() and staff_members membership
  const hasSbCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));

  if (hasSbCookie) {
    try {
      const supabaseUrl =
        process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hcfuqyidcxsqyjzmwxiw.supabase.co";
      const supabaseAnonKey =
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        "";

      if (supabaseAnonKey) {
        const ssrSupabase = createServerClient(supabaseUrl, supabaseAnonKey, {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll() {
              // Proxy checks are read-only for auth lookup
            },
          },
        });

        const {
          data: { user },
          error,
        } = await ssrSupabase.auth.getUser();

        if (!error && user) {
          const { data: staffMember } = await adminClient
            .from("staff_members")
            .select("role")
            .eq("user_id", user.id)
            .maybeSingle();

          if (staffMember?.role && isValidAdminRole(staffMember.role)) {
            return staffMember.role;
          }
        }
      }
    } catch {
      return null;
    }
  }

  return null;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const host = request.headers.get("host")?.toLowerCase() || "";
  const hostname = host.split(":")[0];

  const isAdminSubdomain =
    hostname === "admin.khatikhejurgur.shop" ||
    hostname.startsWith("admin.");

  const isMainStorefront =
    hostname === "khatikhejurgur.shop" ||
    hostname === "www.khatikhejurgur.shop";

  // 1. If accessing /admin on the main production domain, redirect permanently (308) to clean subdomain URL
  if (isMainStorefront && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
    const cleanPath = pathname === "/admin" ? "/" : pathname.replace(/^\/admin/, "") || "/";
    const adminUrl = new URL(cleanPath + (search || ""), "https://admin.khatikhejurgur.shop");
    return NextResponse.redirect(adminUrl, { status: 308 });
  }

  // 2. Subdomain routing for admin.khatikhejurgur.shop (or local admin.localhost)
  if (isAdminSubdomain) {
    // A) If someone accesses /admin or /admin/* on the admin subdomain, strip "/admin" with 308 redirect
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      const cleanPath = pathname === "/admin" ? "/" : pathname.replace(/^\/admin/, "") || "/";
      const targetUrl = new URL(cleanPath + (search || ""), request.url);
      return NextResponse.redirect(targetUrl, { status: 308 });
    }

    // B) Allow API routes to pass through as-is
    if (pathname.startsWith("/api")) {
      if (pathname.startsWith("/api/admin/auth")) {
        const res = NextResponse.next();
        res.headers.set("Cache-Control", "no-store");
        return res;
      }
      if (pathname.startsWith("/api/admin")) {
        const staffRole = await resolveVerifiedStaffRole(request);
        if (!staffRole) {
          return NextResponse.json(
            { success: false, error: "Unauthorized: Admin session required." },
            { status: 401, headers: { "Cache-Control": "no-store" } }
          );
        }
        const res = NextResponse.next();
        res.headers.set("Cache-Control", "no-store");
        return res;
      }
      return NextResponse.next();
    }

    // C) Redirect public customer storefront routes (e.g. /product/*, /contact) back to main storefront
    const firstSegment = pathname.split("/")[1]?.toLowerCase();
    const isCleanAdminSection = !firstSegment || KNOWN_ADMIN_SECTIONS.has(firstSegment);

    if (!isCleanAdminSection) {
      const targetOrigin = hostname.endsWith("khatikhejurgur.shop")
        ? "https://khatikhejurgur.shop"
        : `http://${host.replace(/^admin\./, "")}`;
      const storefrontUrl = new URL(pathname + (search || ""), targetOrigin);
      return NextResponse.redirect(storefrontUrl);
    }

    // D) Admin panel clean URL handling: rewrite clean path (e.g. /, /orders, /login) to internal /admin path
    const internalPath = pathname === "/" ? "/admin" : `/admin${pathname}`;
    const staffRole = await resolveVerifiedStaffRole(request);
    const isAuthenticated = staffRole !== null;

    // Login page: /login (rewritten to /admin/login)
    if (pathname === "/login") {
      if (isAuthenticated) {
        const next = sanitizeAdminRedirect(request.nextUrl.searchParams.get("next"), "/");
        const redirectRes = NextResponse.redirect(new URL(next, request.url));
        redirectRes.headers.set("Cache-Control", "no-store");
        return redirectRes;
      }
      const rewriteUrl = new URL("/admin/login" + (search || ""), request.url);
      const res = NextResponse.rewrite(rewriteUrl);
      res.headers.set("Cache-Control", "no-store");
      return res;
    }

    // Unauthorized page: /unauthorized (rewritten to /admin/unauthorized)
    if (pathname === "/unauthorized") {
      const rewriteUrl = new URL("/admin/unauthorized" + (search || ""), request.url);
      const res = NextResponse.rewrite(rewriteUrl);
      res.headers.set("Cache-Control", "no-store");
      return res;
    }

    // Protected Admin routes (/, /orders, /products, etc.)
    if (!staffRole) {
      const loginUrl = new URL("/login", request.url);
      const safeTarget = sanitizeAdminRedirect(pathname + (search || ""), "/");
      loginUrl.searchParams.set("next", safeTarget);
      const redirectRes = NextResponse.redirect(loginUrl);
      redirectRes.headers.set("Cache-Control", "no-store");
      return redirectRes;
    }

    if (!canRoleAccessPath(staffRole, internalPath)) {
      const unauthorizedRes = NextResponse.redirect(new URL("/unauthorized", request.url));
      unauthorizedRes.headers.set("Cache-Control", "no-store");
      return unauthorizedRes;
    }

    // Pass internal pathname to headers for server layout guards
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-admin-pathname", internalPath);
    const rewriteUrl = new URL(internalPath + (search || ""), request.url);
    const res = NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  // 3. Fallback for non-subdomain requests (e.g. localhost testing of /admin or normal storefront)
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminApi = pathname.startsWith("/api/admin");

  if (!isAdminPath && !isAdminApi) {
    return NextResponse.next();
  }

  // Allow Admin Auth endpoints (/api/admin/auth/*)
  if (pathname.startsWith("/api/admin/auth")) {
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  const staffRole = await resolveVerifiedStaffRole(request);
  const isAuthenticated = staffRole !== null;

  if (pathname === "/admin/login") {
    if (isAuthenticated) {
      const next = sanitizeAdminRedirect(request.nextUrl.searchParams.get("next"), "/admin");
      const redirectRes = NextResponse.redirect(new URL(next, request.url));
      redirectRes.headers.set("Cache-Control", "no-store");
      return redirectRes;
    }
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  if (pathname === "/admin/unauthorized") {
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  if (pathname.startsWith("/api/admin")) {
    if (!isAuthenticated) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Admin session required." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  if (pathname.startsWith("/admin")) {
    if (!staffRole) {
      const loginUrl = new URL("/admin/login", request.url);
      const safeTarget = sanitizeAdminRedirect(pathname + (search || ""), "/admin");
      loginUrl.searchParams.set("next", safeTarget);
      const redirectRes = NextResponse.redirect(loginUrl);
      redirectRes.headers.set("Cache-Control", "no-store");
      return redirectRes;
    }

    if (!canRoleAccessPath(staffRole, pathname)) {
      const unauthorizedRes = NextResponse.redirect(new URL("/admin/unauthorized", request.url));
      unauthorizedRes.headers.set("Cache-Control", "no-store");
      return unauthorizedRes;
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-admin-pathname", pathname);
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static image/font assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
