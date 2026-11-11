import { redirect, unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, verifySessionToken } from "@/lib/admin-auth";
import {
  AdminRole,
  canRoleAccessPath,
  isValidAdminRole,
} from "@/lib/admin-permissions";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface StaffSession {
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string;
  };
  role: AdminRole;
}

/**
 * Returns the actor UUID for foreign-key columns (audit_log.actor_id, order_events.actor_id, etc.),
 * coercing synthetic identifiers such as "admin-root" to null.
 */
export function getActorUuid(session: StaffSession | null | undefined): string | null {
  const id = session?.user?.id;
  if (!id || !UUID_REGEX.test(id)) return null;
  return id;
}

/**
 * Returns the current authenticated staff member session or null.
 * Checks both Supabase Auth session (@supabase/ssr cookies) and
 * the HMAC-signed Admin Session Token (ADMIN_COOKIE_NAME), validating
 * active staff membership against staff_members / env root credentials.
 */
export async function getStaffSession(): Promise<StaffSession | null> {
  try {
    const adminClient = getSupabaseAdmin();

    // 1. Check Supabase Auth session via SSR cookies
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (!authError && user) {
      const { data: staffMember } = await adminClient
        .from("staff_members")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (staffMember?.role && isValidAdminRole(staffMember.role)) {
        const { data: profile } = await adminClient
          .from("profiles")
          .select("full_name, avatar_path")
          .eq("id", user.id)
          .maybeSingle();

        const name =
          profile?.full_name ||
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "Staff";

        return {
          user: {
            id: user.id,
            email: user.email || "",
            name,
            avatarUrl: profile?.avatar_path || user.user_metadata?.avatar_url,
          },
          role: staffMember.role,
        };
      }
    }

    // 2. Signed session token (env root owner or persisted staff token)
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    if (token) {
      const adminUser = await verifySessionToken(token);
      if (adminUser) {
        if (adminUser.id === "admin-root") {
          const envAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
          if (
            !envAdminEmail ||
            adminUser.email.trim().toLowerCase() !== envAdminEmail ||
            adminUser.role !== "owner"
          ) {
            return null;
          }
          return {
            user: {
              id: adminUser.id,
              email: adminUser.email,
              name: adminUser.name,
              avatarUrl: adminUser.avatarUrl,
            },
            role: "owner",
          };
        }

        if (UUID_REGEX.test(adminUser.id)) {
          const { data: staffMember } = await adminClient
            .from("staff_members")
            .select("role")
            .eq("user_id", adminUser.id)
            .maybeSingle();

          if (!staffMember?.role || !isValidAdminRole(staffMember.role)) {
            return null;
          }

          return {
            user: {
              id: adminUser.id,
              email: adminUser.email,
              name: adminUser.name,
              avatarUrl: adminUser.avatarUrl,
            },
            role: staffMember.role,
          };
        }
      }
    }

    return null;
  } catch (err: unknown) {
    unstable_rethrow(err);
    console.error("Error verifying staff session:", err);
    return null;
  }
}

/**
 * Enforces that the visitor is a signed-in staff member.
 * Redirects to /admin/login if not authenticated, or to 403 page if not a staff member.
 */
export async function requireStaffMember(targetPath = "/admin"): Promise<StaffSession> {
  const session = await getStaffSession();

  if (!session) {
    redirect(`/admin/login?next=${encodeURIComponent(targetPath)}`);
  }

  if (!canRoleAccessPath(session.role, targetPath)) {
    redirect("/admin/unauthorized");
  }

  return session;
}

/**
 * Enforces specific role level for Server Actions.
 */
export async function assertStaffRole(allowedRoles: AdminRole[]): Promise<StaffSession> {
  const session = await getStaffSession();

  if (!session) {
    throw new Error("LOGIN_REQUIRED: You must be signed in as staff");
  }

  if (!allowedRoles.includes(session.role)) {
    throw new Error("FORBIDDEN: You do not have permission for this action");
  }

  return session;
}
