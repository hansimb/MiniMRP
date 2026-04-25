import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("runtime query facade exists", () => {
  assert.equal(fs.existsSync("lib/runtime/supabase/queries.ts"), true);
});

test("shared app does not import supabase queries or actions directly", () => {
  const roots = ["app", "features"];
  const offendingFiles: string[] = [];

  function walk(currentPath: string) {
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const nextPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        walk(nextPath);
        continue;
      }

      if (!nextPath.endsWith(".ts") && !nextPath.endsWith(".tsx")) {
        continue;
      }

      const source = fs.readFileSync(nextPath, "utf8");
      if (source.includes('@/lib/supabase/queries') || source.includes('@/lib/supabase/actions')) {
        offendingFiles.push(nextPath);
      }
    }
  }

  for (const root of roots) {
    walk(root);
  }

  assert.deepEqual(offendingFiles, []);
});
