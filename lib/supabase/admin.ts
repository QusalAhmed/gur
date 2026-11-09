import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "./client";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hcfuqyidcxsqyjzmwxiw.supabase.co";

let adminClient: SupabaseClient | null = null;

export function isServiceRoleConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  );
}

export function getSupabaseAdmin(): SupabaseClient {
  // In browser context, always reuse the singleton client to prevent multiple GoTrueClient instances
  if (typeof window !== "undefined") {
    return getSupabaseClient();
  }

  if (adminClient) return adminClient;

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "";

  adminClient = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      storageKey: "sb-admin-service-role-key",
    },
  });

  return adminClient;
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseAdmin();
    const val = (client as any)[prop];
    return typeof val === "function" ? val.bind(client) : val;
  },
});


