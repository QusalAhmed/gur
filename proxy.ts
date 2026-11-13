import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ADMIN_COOKIE_NAME, verifySessionToken } from "@/lib/admin-auth";
import {
  AdminRole,
  canRoleAccessPath,
  isValidAdminRole,
  sanitizeAdminRedirect,
} from "@/lib/admin-permissions";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const KNOWN_ADMIN_SECTIONS = new Set([
  "login",
  "unauthorized",
  "orders",
  "products",
  "inventory",
  "batches",
  "warehouses",
  "suppliers",
  "customers",
  "combos",
  "categories",
  "businesses",
  "quotes",
  "reviews",
  "messages",
  "payments",
  "settings",
  "shipping",
  "coupons",
  "staff",
  "audit",
  "outbox",
  "analytics",
  "incomplete",
  "shipments",
  "posts",
  "faqs",
]);

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

  // 1. If accessing /admin on the main production domain, redirect permanently (308) to admin subdomain
  if (isMainStorefront && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
    const adminUrl = new URL(pathname + (search || ""), "https://admin.khatikhejurgur.shop");
    return NextResponse.redirect(adminUrl, { status: 308 });
  }

  // 2. Subdomain routing for admin.khatikhejurgur.shop (or local admin.localhost)
  if (isAdminSubdomain) {
    // A) Root "/" on admin subdomain redirects to "/admin"
    if (pathname === "/") {
      const targetUrl = new URL("/admin", request.url);
      return NextResponse.redirect(targetUrl);
    }

    // B) Known shorthand admin paths (e.g. /login, /orders, /products, etc.) redirect to /admin/*
    const firstSegment = pathname.split("/")[1]?.toLowerCase();
    if (firstSegment && KNOWN_ADMIN_SECTIONS.has(firstSegment)) {
      const targetUrl = new URL(`/admin${pathname}${search || ""}`, request.url);
      return NextResponse.redirect(targetUrl);
    }

    // C) Customer storefront routes on the admin subdomain redirect to the main storefront
    if (!pathname.startsWith("/admin") && !pathname.startsWith("/api")) {
      const targetOrigin = hostname.endsWith("khatikhejurgur.shop")
        ? "https://khatikhejurgur.shop"
        : `http://${host.replace(/^admin\./, "")}`;
      const storefrontUrl = new URL(pathname + (search || ""), targetOrigin);
      return NextResponse.redirect(storefrontUrl);
    }
  }

  // 3. Early pass-through for public storefront routes:
  // Avoid running admin staff role lookups & database queries on public routes
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminApi = pathname.startsWith("/api/admin");

  if (!isAdminPath && !isAdminApi) {
    return NextResponse.next();
  }

  // 4. Allow Admin Auth endpoints (/api/admin/auth/*)
  if (pathname.startsWith("/api/admin/auth")) {
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  const staffRole = await resolveVerifiedStaffRole(request);
  const isAuthenticated = staffRole !== null;

  // 5. If visiting /admin/login while authenticated as verified staff, redirect safely
  if (pathname === "/admin/login") {
    if (isAuthenticated) {
      const next = sanitizeAdminRedirect(request.nextUrl.searchParams.get("next"));
      const redirectRes = NextResponse.redirect(new URL(next, request.url));
      redirectRes.headers.set("Cache-Control", "no-store");
      return redirectRes;
    }
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  // 6. Allow /admin/unauthorized without triggering redirect loops
  if (pathname === "/admin/unauthorized") {
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  // 7. Protect Admin API routes (/api/admin/*)
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

  // 8. Protect all other Admin routes (/admin, /admin/orders, etc.)
  if (pathname.startsWith("/admin")) {
    if (!staffRole) {
      const loginUrl = new URL("/admin/login", request.url);
      const safeTarget = sanitizeAdminRedirect(pathname + (search || ""));
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
