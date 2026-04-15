import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import {
  VERSION_BOM_REQUIRED_FIELDS,
  buildVersionBomReferenceRows,
  findUnknownVersionBomSkus,
  normalizeVersionBomRows,
  parseVersionBomBuffer
} from "../lib/import/version-bom.ts";

function buildWorkbookBuffer(rows: Array<Array<string | number>>) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "BOM");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

test("version BOM import exposes the required logical fields", () => {
  assert.deepEqual(VERSION_BOM_REQUIRED_FIELDS, ["sku", "reference"]);
});

test("normalizeVersionBomRows expands repeated SKUs and comma-separated references", () => {
  const rows = normalizeVersionBomRows(
    parseVersionBomBuffer(
      buildWorkbookBuffer([
        ["SKU", "Reference"],
        ["RES-10K", "R1, R2"],
        ["RES-10K", "R3"],
        ["IC-4558", "U1"]
      ])
    )
  );

  assert.deepEqual(rows, [
    { sku: "RES-10K", reference: "R1" },
    { sku: "RES-10K", reference: "R2" },
    { sku: "RES-10K", reference: "R3" },
    { sku: "IC-4558", reference: "U1" }
  ]);
});

test("normalizeVersionBomRows rejects duplicate final references", () => {
  assert.throws(
    () =>
      normalizeVersionBomRows(
        parseVersionBomBuffer(
          buildWorkbookBuffer([
            ["component_sku", "references"],
            ["RES-10K", "R1"],
            ["RES-10K", "R1"]
          ])
        )
      ),
    /Duplicate reference "R1"/i
  );
});

test("normalizeVersionBomRows rejects one reference mapped to multiple SKUs", () => {
  assert.throws(
    () =>
      normalizeVersionBomRows(
        parseVersionBomBuffer(
          buildWorkbookBuffer([
            ["sku", "designator"],
            ["RES-10K", "R1"],
            ["RES-47K", "R1"]
          ])
        )
      ),
    /Reference "R1" is assigned to more than one SKU/i
  );
});

test("buildVersionBomReferenceRows rejects unknown SKUs", () => {
  assert.throws(
    () =>
      buildVersionBomReferenceRows({
        versionId: "ver-1",
        rows: [{ sku: "RES-10K", reference: "R1" }],
        components: [{ id: "cmp-1", sku: "CAP-100N" }]
      }),
    /Unknown SKU in BOM import: RES-10K/i
  );
});

test("findUnknownVersionBomSkus returns a unique sorted list of missing SKUs", () => {
  assert.deepEqual(
    findUnknownVersionBomSkus(
      [
        { sku: "RES-10K", reference: "R1" },
        { sku: "cap-100n", reference: "C1" },
        { sku: "RES-10K", reference: "R2" },
        { sku: "IC-555", reference: "U1" }
      ],
      [{ sku: "CAP-100N" }]
    ),
    ["IC-555", "RES-10K"]
  );
});
