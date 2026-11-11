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

  // Allow Admin Auth endpoints (/api/admin/auth/*)
  if (pathname.startsWith("/api/admin/auth")) {
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  const staffRole = await resolveVerifiedStaffRole(request);
  const isAuthenticated = staffRole !== null;

  // 1. If visiting /admin/login while authenticated as verified staff, redirect safely
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

  // 2. Allow /admin/unauthorized without triggering redirect loops
  if (pathname === "/admin/unauthorized") {
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  // 3. Protect Admin API routes (/api/admin/*)
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

  // 4. Protect all other Admin routes (/admin, /admin/orders, etc.)
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
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
