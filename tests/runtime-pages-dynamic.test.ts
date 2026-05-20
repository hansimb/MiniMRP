import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const runtimePages = [
  "app/products/page.tsx",
  "app/purchasing/page.tsx",
  "app/history/page.tsx",
  "app/production/page.tsx",
  "app/settings/page.tsx",
  "app/components/page.tsx",
  "app/inventory/page.tsx",
  "app/products/[id]/page.tsx",
  "app/components/[id]/page.tsx",
  "app/versions/[id]/page.tsx"
];

test("runtime-backed app pages force dynamic rendering", () => {
  for (const pagePath of runtimePages) {
    const source = fs.readFileSync(pagePath, "utf8");
    assert.equal(
      source.includes('export const dynamic = "force-dynamic";'),
      true,
      `${pagePath} should force dynamic rendering`
    );
  }
});
