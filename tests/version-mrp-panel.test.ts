import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("version MRP panel marks assumed unit prices and explains the star footnote", () => {
  const source = fs.readFileSync("features/versions/components/version-mrp-panel.tsx", "utf8");

  assert.equal(source.includes("unitPriceIsEstimate"), true);
  assert.equal(source.includes("* means assumed price based on the latest purchase lot"), true);
  assert.equal(source.includes('row.unitPriceIsEstimate ? "*" : ""'), true);
});
