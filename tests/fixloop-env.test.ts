import test from "node:test";
import assert from "node:assert/strict";

import {
  getFixLoopBrowserEnv,
  hasFixLoopBrowserEnv
} from "../lib/fixloop/env.ts";

test("getFixLoopBrowserEnv returns the project name plus browser-safe Supabase settings", () => {
  process.env.AGENTIC_FIX_LOOP_PROJECT_NAME = "MiniMRP";
  process.env.NEXT_PUBLIC_AGENTIC_FIX_LOOP_SUPABASE_URL =
    "https://example.supabase.co";
  process.env.NEXT_PUBLIC_AGENTIC_FIX_LOOP_SUPABASE_ANON_KEY =
    "sb_publishable_test";

  assert.deepEqual(getFixLoopBrowserEnv(), {
    projectName: "MiniMRP",
    url: "https://example.supabase.co",
    anonKey: "sb_publishable_test"
  });
});

test("hasFixLoopBrowserEnv is false if the project name is missing", () => {
  delete process.env.AGENTIC_FIX_LOOP_PROJECT_NAME;
  process.env.NEXT_PUBLIC_AGENTIC_FIX_LOOP_SUPABASE_URL =
    "https://example.supabase.co";
  process.env.NEXT_PUBLIC_AGENTIC_FIX_LOOP_SUPABASE_ANON_KEY =
    "sb_publishable_test";

  assert.equal(hasFixLoopBrowserEnv(), false);
});

test("hasFixLoopBrowserEnv is false when ENABLE_FIXLOOP is false", () => {
  process.env.ENABLE_FIXLOOP = "false";
  process.env.AGENTIC_FIX_LOOP_PROJECT_NAME = "MiniMRP";
  process.env.NEXT_PUBLIC_AGENTIC_FIX_LOOP_SUPABASE_URL =
    "https://example.supabase.co";
  process.env.NEXT_PUBLIC_AGENTIC_FIX_LOOP_SUPABASE_ANON_KEY =
    "sb_publishable_test";

  assert.equal(hasFixLoopBrowserEnv(), false);
});
