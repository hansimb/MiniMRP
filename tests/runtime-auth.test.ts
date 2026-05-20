import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("runtime auth facade files exist", async () => {
  const browserClientModule = await import("../lib/runtime/browser-client.ts");
  const supabaseAuthModule = await import("../lib/runtime/supabase/auth.ts");
  const runtimeAuthSource = fs.readFileSync("lib/runtime/auth.ts", "utf8");
  const runtimeActionsSource = fs.readFileSync("lib/runtime/actions.ts", "utf8");

  assert.equal(typeof browserClientModule.createRuntimeBrowserClient, "function");
  assert.equal(typeof supabaseAuthModule.createBrowserClient, "function");
  assert.equal(typeof supabaseAuthModule.getAdminFlags, "function");
  assert.equal(typeof supabaseAuthModule.isUserAdmin, "function");
  assert.equal(runtimeAuthSource.includes("getRuntimeAdminFlags"), true);
  assert.equal(runtimeAuthSource.includes("requireRuntimeAdminAction"), true);
  assert.equal(runtimeAuthSource.includes("requireRuntimeAdminApiAccess"), true);
  assert.equal(runtimeAuthSource.includes('import("./sqlite/auth.ts")'), true);
  assert.equal(runtimeAuthSource.includes('import(`./${runtimeMode}/auth.ts`)'), false);
  assert.equal(runtimeActionsSource.includes('import("./sqlite/actions.ts")'), true);
  assert.equal(runtimeActionsSource.includes('import(`./${runtimeMode}/actions.ts`)'), false);
  assert.equal(fs.existsSync("lib/runtime/supabase/actions.ts"), true);
  assert.equal(fs.existsSync("lib/runtime/actions.ts"), true);
});
