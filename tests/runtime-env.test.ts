import assert from "node:assert/strict";
import test from "node:test";

import {
  getBrowserRuntimeMode,
  getRuntimeMode,
  getServerRuntimeMode
} from "../lib/runtime/env.ts";

const originalRuntimeMode = process.env.MINIMRP_RUNTIME;
const originalPublicRuntimeMode = process.env.NEXT_PUBLIC_MINIMRP_RUNTIME;
const originalDesktopRuntime = process.env.MINIMRP_DESKTOP_RUNTIME;

test.afterEach(() => {
  if (originalRuntimeMode === undefined) {
    delete process.env.MINIMRP_RUNTIME;
  } else {
    process.env.MINIMRP_RUNTIME = originalRuntimeMode;
  }

  if (originalPublicRuntimeMode === undefined) {
    delete process.env.NEXT_PUBLIC_MINIMRP_RUNTIME;
  } else {
    process.env.NEXT_PUBLIC_MINIMRP_RUNTIME = originalPublicRuntimeMode;
  }

  if (originalDesktopRuntime === undefined) {
    delete process.env.MINIMRP_DESKTOP_RUNTIME;
    return;
  }

  process.env.MINIMRP_DESKTOP_RUNTIME = originalDesktopRuntime;
});

test("getRuntimeMode defaults to supabase", () => {
  delete process.env.MINIMRP_RUNTIME;

  assert.equal(getRuntimeMode(), "supabase");
});

test("getRuntimeMode accepts supabase", () => {
  process.env.MINIMRP_RUNTIME = "supabase";

  assert.equal(getRuntimeMode(), "supabase");
});

test("getRuntimeMode accepts sqlite", () => {
  process.env.MINIMRP_RUNTIME = "sqlite";

  assert.equal(getRuntimeMode(), "sqlite");
});

test("getRuntimeMode accepts the public runtime env fallback", () => {
  delete process.env.MINIMRP_RUNTIME;
  process.env.NEXT_PUBLIC_MINIMRP_RUNTIME = "sqlite";

  assert.equal(getBrowserRuntimeMode(), "sqlite");
});

test("getServerRuntimeMode ignores the public runtime env fallback", () => {
  delete process.env.MINIMRP_RUNTIME;
  process.env.NEXT_PUBLIC_MINIMRP_RUNTIME = "sqlite";

  assert.equal(getServerRuntimeMode(), "supabase");
});

test("getRuntimeMode stays server-safe by ignoring the public runtime env fallback", () => {
  delete process.env.MINIMRP_RUNTIME;
  process.env.NEXT_PUBLIC_MINIMRP_RUNTIME = "sqlite";

  assert.equal(getRuntimeMode(), "supabase");
});

test("getRuntimeMode rejects unsupported runtime values", () => {
  process.env.MINIMRP_RUNTIME = "desktop";

  assert.throws(() => getRuntimeMode(), /MINIMRP_RUNTIME/);
});

test("getServerRuntimeMode treats desktop runtime flag as sqlite when runtime env is missing", () => {
  delete process.env.MINIMRP_RUNTIME;
  process.env.MINIMRP_DESKTOP_RUNTIME = "1";

  assert.equal(getServerRuntimeMode(), "sqlite");
});

test("getRuntimeMode treats desktop runtime flag as sqlite when runtime env is missing", () => {
  delete process.env.MINIMRP_RUNTIME;
  process.env.MINIMRP_DESKTOP_RUNTIME = "1";

  assert.equal(getRuntimeMode(), "sqlite");
});
