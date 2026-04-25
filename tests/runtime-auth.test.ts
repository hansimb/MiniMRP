import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("runtime auth facade files exist", async () => {
  const browserClientModule = await import("../lib/runtime/browser-client.ts");
  const supabaseAuthModule = await import("../lib/runtime/supabase/auth.ts");
  const runtimeAuthSource = fs.readFileSync("lib/runtime/auth.ts", "utf8");

  assert.equal(typeof browserClientModule.createRuntimeBrowserClient, "function");
  assert.equal(typeof supabaseAuthModule.createBrowserClient, "function");
  assert.equal(typeof supabaseAuthModule.getAdminFlags, "function");
  assert.equal(typeof supabaseAuthModule.isUserAdmin, "function");
  assert.equal(runtimeAuthSource.includes("getRuntimeAdminFlags"), true);
  assert.equal(runtimeAuthSource.includes("requireRuntimeAdminAction"), true);
  assert.equal(runtimeAuthSource.includes("requireRuntimeAdminApiAccess"), true);
  assert.equal(fs.existsSync("lib/runtime/supabase/actions.ts"), true);
});
