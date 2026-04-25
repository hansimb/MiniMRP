import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseBrowserEnv } from "./env.ts";

export function createSupabaseBrowserClient() {
  const { url, publishableKey } = getSupabaseBrowserEnv();

  if (!url || !publishableKey) {
    throw new Error("Supabase browser environment variables are missing.");
  }

  return createBrowserClient(url, publishableKey);
}
