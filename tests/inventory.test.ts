import test from "node:test";
import assert from "node:assert/strict";
import { applyInventoryAdjustment } from "../lib/mappers/inventory.ts";

test("applyInventoryAdjustment adds quantity", () => {
  assert.equal(applyInventoryAdjustment(10, "add", 5), 15);
});

test("applyInventoryAdjustment removes quantity without going below zero", () => {
  assert.equal(applyInventoryAdjustment(10, "remove", 4), 6);
  assert.equal(applyInventoryAdjustment(3, "remove", 10), 0);
});
