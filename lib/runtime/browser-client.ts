import { getRuntimeMode } from "./env.ts";

export async function createRuntimeBrowserClient() {
  const runtimeMode = getRuntimeMode();

  if (runtimeMode === "sqlite") {
    const runtimeAuth = await import("./sqlite/browser-auth.ts");
    return runtimeAuth.createBrowserClient();
  }

  const runtimeAuth = await import("./supabase/browser-auth.ts");
  return runtimeAuth.createBrowserClient();
}
