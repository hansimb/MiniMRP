import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("supabase product list counts versions with exact per-product queries instead of filtering a bulk list", () => {
  const source = fs.readFileSync("lib/supabase/queries/products.ts", "utf8");

  assert.equal(source.includes('select("id", { count: "exact", head: true })'), true);
  assert.equal(source.includes("versionsResult.data.filter((version) => version.product_id === product.id).length"), false);
});
