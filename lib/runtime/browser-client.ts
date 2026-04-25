import { getRuntimeMode } from "./env.ts";

export async function createRuntimeBrowserClient() {
  const runtimeMode = getRuntimeMode();
  const runtimeAuth = await import(`./${runtimeMode}/auth.ts`);
  return runtimeAuth.createBrowserClient();
}
