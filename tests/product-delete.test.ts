import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("product detail page includes a guarded delete product modal", () => {
  const source = fs.readFileSync("app/products/[id]/page.tsx", "utf8");

  assert.equal(source.includes("Delete product"), true);
  assert.equal(source.includes("Confirm delete"), true);
  assert.equal(source.includes("This will permanently delete the product"), true);
});

test("runtime facade exposes deleteProductAction for both runtimes", () => {
  const contracts = fs.readFileSync("lib/runtime/contracts.ts", "utf8");
  const facade = fs.readFileSync("lib/runtime/actions.ts", "utf8");
  const supabaseFacade = fs.readFileSync("lib/runtime/supabase/actions.ts", "utf8");

  assert.equal(contracts.includes("deleteProductAction: RuntimeAction;"), true);
  assert.equal(facade.includes("export async function deleteProductAction(formData: FormData)"), true);
  assert.equal(facade.includes(".deleteProductAction(formData)"), true);
  assert.equal(supabaseFacade.includes("deleteProductAction"), true);
});

test("product delete action guards against versions and production references only", () => {
  const supabaseSource = fs.readFileSync("lib/supabase/actions/products.ts", "utf8");
  const sqliteSource = fs.readFileSync("lib/runtime/sqlite/actions.ts", "utf8");

  for (const source of [supabaseSource, sqliteSource]) {
    assert.equal(source.includes("Cannot delete product while versions still exist."), true);
    assert.equal(source.includes("Cannot delete product while production history exists."), true);
    assert.equal(source.includes("Cannot delete product while history entries exist."), false);
  }
});
