"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertStaffRole, getActorUuid } from "@/lib/admin-guard";
import { mapDatabaseError } from "@/lib/admin-errors";
import { AdminRole, canAssignRole } from "@/lib/admin-permissions";
import { isValidUuid } from "@/lib/security";

export interface StaffDirectoryMember {
  userId: string;
  name: string;
  phone: string | null;
  role: AdminRole;
  createdAt: string;
}

/**
 * Returns all active staff members from staff_members table joined with profiles.
 */
export async function getStaffMembersAction(): Promise<{
  ok: boolean;
  data: StaffDirectoryMember[];
  message?: string;
}> {
  try {
    await assertStaffRole(["owner", "admin"]);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("staff_members")
      .select(
        `
        user_id,
        role,
        created_at,
        profiles:user_id (
          full_name,
          phone
        )
      `
      )
      .order("created_at", { ascending: true });

    if (error) {
      const friendly = mapDatabaseError(error);
      return { ok: false, data: [], message: friendly.message };
    }

    const members: StaffDirectoryMember[] = (data || []).map((row: any) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return {
        userId: row.user_id,
        name: profile?.full_name || "Staff Member",
        phone: profile?.phone || null,
        role: row.role as AdminRole,
        createdAt: row.created_at,
      };
    });

    return { ok: true, data: members };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { ok: false, data: [], message: friendly.message };
  }
}

/**
 * Updates a staff member's role or grants staff access.
 * Rule: Only the owner can assign the 'owner' role.
 */
export async function assignStaffRoleAction(params: {
  userId: string;
  role: AdminRole;
}): Promise<{ ok: boolean; message?: string }> {
  try {
    const session = await assertStaffRole(["owner", "admin"]);
    if (!isValidUuid(params.userId)) {
      return { ok: false, message: "Invalid staff user ID." };
    }
    const supabase = getSupabaseAdmin();

    // Enforcement: Enforce role assignment hierarchy (admins cannot assign owner)
    if (!canAssignRole(session.role, params.role)) {
      return {
        ok: false,
        message: "Permission denied: your role cannot assign this role.",
      };
    }

    const { data: existingTarget } = await supabase
      .from("staff_members")
      .select("role")
      .eq("user_id", params.userId)
      .maybeSingle();
    if (existingTarget?.role === "owner" && session.role !== "owner") {
      return {
        ok: false,
        message: "Permission denied: only an Owner can modify an Owner account.",
      };
    }

    const actorUuid = getActorUuid(session);
    const { error } = await supabase.from("staff_members").upsert(
      {
        user_id: params.userId,
        role: params.role,
        created_by: actorUuid,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      const friendly = mapDatabaseError(error);
      return { ok: false, message: friendly.message };
    }

    // Log to audit log
    await supabase.from("audit_log").insert({
      actor_id: actorUuid,
      table_name: "staff_members",
      row_id: params.userId,
      action: "UPDATE",
      new_data: { new_role: params.role },
    });

    revalidatePath("/admin/staff");
    return { ok: true };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { ok: false, message: friendly.message };
  }
}

/**
 * Revokes staff access for a user.
 */
export async function revokeStaffAccessAction(
  userId: string
): Promise<{ ok: boolean; message?: string }> {
  try {
    const session = await assertStaffRole(["owner", "admin"]);
    if (!isValidUuid(userId)) {
      return { ok: false, message: "Invalid staff user ID." };
    }
    const supabase = getSupabaseAdmin();

    // Prevent removing oneself
    if (session.user.id === userId) {
      return {
        ok: false,
        message: "You cannot revoke your own staff access.",
      };
    }

    const { data: existingTarget } = await supabase
      .from("staff_members")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    if (existingTarget?.role === "owner" && session.role !== "owner") {
      return {
        ok: false,
        message: "Permission denied: only an Owner can revoke an Owner account.",
      };
    }

    const { error } = await supabase.from("staff_members").delete().eq("user_id", userId);

    if (error) {
      const friendly = mapDatabaseError(error);
      return { ok: false, message: friendly.message };
    }

    // Log to audit log
    await supabase.from("audit_log").insert({
      actor_id: getActorUuid(session),
      table_name: "staff_members",
      row_id: userId,
      action: "DELETE",
    });

    revalidatePath("/admin/staff");
    return { ok: true };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { ok: false, message: friendly.message };
  }
}
