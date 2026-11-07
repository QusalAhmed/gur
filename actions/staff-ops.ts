"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertStaffRole, getStaffSession } from "@/lib/admin-guard";
import { mapDatabaseError } from "@/lib/admin-errors";
import { AdminRole } from "@/lib/admin-permissions";

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
    const supabase = await createClient();

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
    const supabase = await createClient();

    // Enforcement: Only an owner can assign 'owner'
    if (params.role === "owner" && session.role !== "owner") {
      return {
        ok: false,
        message: "Permission denied: only an existing Owner can assign the 'Owner' role.",
      };
    }

    const { error } = await supabase.from("staff_members").upsert(
      {
        user_id: params.userId,
        role: params.role,
        created_by: session.user.id,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      const friendly = mapDatabaseError(error);
      return { ok: false, message: friendly.message };
    }

    // Log to audit log
    await supabase.from("audit_log").insert({
      actor_id: session.user.id,
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
    const supabase = await createClient();

    // Prevent removing oneself
    if (session.user.id === userId) {
      return {
        ok: false,
        message: "You cannot revoke your own staff access.",
      };
    }

    const { error } = await supabase.from("staff_members").delete().eq("user_id", userId);

    if (error) {
      const friendly = mapDatabaseError(error);
      return { ok: false, message: friendly.message };
    }

    // Log to audit log
    await supabase.from("audit_log").insert({
      actor_id: session.user.id,
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
