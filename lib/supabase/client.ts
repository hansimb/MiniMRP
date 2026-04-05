import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

export function createSupabaseClient() {
  const { url, publishableKey } = getSupabaseEnv();

  if (!url || !publishableKey) {
    throw new Error("Supabase environment variables are missing.");
  }

  return createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

