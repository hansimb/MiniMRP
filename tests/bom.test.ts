import test from "node:test";
import assert from "node:assert/strict";
import { normalizeReferencesInput, validateVersionComponentReferences } from "../lib/mappers/bom.ts";

test("normalizeReferencesInput defaults empty input to dash", () => {
  assert.deepEqual(normalizeReferencesInput(null), ["-"]);
  assert.deepEqual(normalizeReferencesInput(""), ["-"]);
  assert.deepEqual(normalizeReferencesInput("   "), ["-"]);
});

test("normalizeReferencesInput keeps comma-separated references", () => {
  assert.deepEqual(normalizeReferencesInput("R1, R2, R3"), ["R1", "R2", "R3"]);
});

test("validateVersionComponentReferences rejects duplicate references in the same edit", () => {
  assert.throws(
    () =>
      validateVersionComponentReferences({
        componentId: "component-a",
        references: ["R5", "R5"],
        existingReferences: []
      }),
    /Duplicate reference "R5"/i
  );
});

test("validateVersionComponentReferences rejects references already assigned to another component", () => {
  assert.throws(
    () =>
      validateVersionComponentReferences({
        componentId: "component-a",
        references: ["R5"],
        existingReferences: [
          { component_master_id: "component-a", reference: "R1" },
          { component_master_id: "component-b", reference: "R5" }
        ]
      }),
    /Reference "R5" is already assigned to another component in this BOM/i
  );
});
