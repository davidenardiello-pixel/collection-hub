import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "../env";

export function getSupabaseAdmin() {
  const { url, serviceRoleKey } = getSupabaseConfig();
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
