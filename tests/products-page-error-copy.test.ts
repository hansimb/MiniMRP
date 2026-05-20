import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("products page tailors query error copy to the active runtime", () => {
  const source = fs.readFileSync("app/products/page.tsx", "utf8");

  assert.equal(source.includes("const runtimeMode = getRuntimeMode();"), true);
  assert.equal(source.includes('runtimeMode === "supabase"'), true);
  assert.equal(source.includes("Database query failed while loading products."), true);
  assert.equal(source.includes("Supabase query failed."), true);
});
