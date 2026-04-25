import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("runtime query facade exists", () => {
  assert.equal(fs.existsSync("lib/runtime/supabase/queries.ts"), true);
});
