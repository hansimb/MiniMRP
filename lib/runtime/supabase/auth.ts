import { createSupabaseBrowserClient } from "../../supabase/browser-client.ts";

export function createBrowserClient() {
  return createSupabaseBrowserClient();
}

export async function getAdminFlags() {
  const { getCurrentAdminFlags } = await import("../../auth/admin-state.ts");
  return getCurrentAdminFlags();
}

export async function isUserAdmin(userId: string) {
  const { isUserAdmin } = await import("../../auth/admin-state.ts");
  return isUserAdmin(userId);
}
