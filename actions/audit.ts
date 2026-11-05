"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";

export interface AuditLogItem {
  id: string;
  staff: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  recordId: string;
  description: string;
  ip: string;
  date: string;
}

export async function getAdminAuditLogsAction(): Promise<{
  success: boolean;
  data: AuditLogItem[];
  error?: string;
}> {
  try {
    const { data: rawLogs, error } = await supabaseAdmin
      .from("audit_log")
      .select("id, table_name, row_id, action, old_data, new_data, actor_id, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;

    const logs: AuditLogItem[] = (rawLogs || []).map((l: any) => {
      let desc = `${l.action} operation on ${l.table_name}`;
      if (l.action === "UPDATE" && l.new_data) {
        const keys = Object.keys(l.new_data).slice(0, 3).join(", ");
        desc = `Updated fields: ${keys}`;
      } else if (l.action === "INSERT") {
        desc = `Created new record in ${l.table_name}`;
      } else if (l.action === "DELETE") {
        desc = `Deleted record ${l.row_id || ""}`;
      }

      return {
        id: `AUD-${l.id}`,
        staff: l.actor_id ? `Admin (${String(l.actor_id).slice(0, 6)})` : "System / Trigger",
        action: l.action,
        table: l.table_name,
        recordId: l.row_id || "N/A",
        description: desc,
        ip: "Internal Network",
        date: l.created_at,
      };
    });

    return { success: true, data: logs };
  } catch (error: any) {
    console.error("getAdminAuditLogsAction error:", error);
    return { success: false, error: error.message || "Failed to load audit logs", data: [] };
  }
}

