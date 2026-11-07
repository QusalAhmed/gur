import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, verifySessionToken } from "@/lib/admin-auth";
import { AdminRole, canRoleAccessPath } from "@/lib/admin-permissions";

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
 * Returns the current authenticated staff member session or null.
 * Checks both Supabase Auth session (@supabase/ssr cookies) and
 * the Admin Session Token (ADMIN_COOKIE_NAME).
 */
export async function getStaffSession(): Promise<StaffSession | null> {
  try {
    // 1. Check Supabase Auth session via SSR cookies
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (!authError && user) {
      // Query staff_members row
      const { data: staffMember, error: staffError } = await supabase
        .from("staff_members")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (staffMember?.role) {
        // Fetch profile name & avatar
        const { data: profile } = await supabase
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
          role: staffMember.role as AdminRole,
        };
      }
    }

    // 2. Fallback check: ADMIN_COOKIE_NAME session token (for root admin or standalone admin token)
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    if (token) {
      const adminUser = await verifySessionToken(token);
      if (adminUser) {
        return {
          user: {
            id: adminUser.id,
            email: adminUser.email,
            name: adminUser.name,
            avatarUrl: adminUser.avatarUrl,
          },
          role: adminUser.role,
        };
      }
    }

    return null;
  } catch (err: unknown) {
    const errorObj = err as { digest?: string };
    if (
      errorObj?.digest === "HANGING_PROMISE_REJECTION" ||
      errorObj?.digest === "DYNAMIC_SERVER_USAGE"
    ) {
      throw err;
    }
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
