import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("app shell uses the browser runtime to decide whether logout is shown", () => {
  const source = fs.readFileSync("shared/ui/app-shell.tsx", "utf8");

  assert.equal(source.includes('from "@/lib/runtime/env";'), true);
  assert.equal(source.includes("getBrowserRuntimeMode"), true);
  assert.equal(source.includes("const runtimeMode = getBrowserRuntimeMode();"), true);
  assert.equal(source.includes("const runtimeMode = getRuntimeMode();"), false);
});

test("app shell shows the package version under the MiniMRP title", () => {
  const source = fs.readFileSync("shared/ui/app-shell.tsx", "utf8");

  assert.equal(source.includes('from "@/package.json";') || source.includes('from "../../package.json";') || source.includes('from "../../../package.json";'), true);
  assert.equal(source.includes("packageJson.version"), true);
  assert.equal(source.includes("Version"), true);
});
