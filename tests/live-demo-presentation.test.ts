import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("app shell clearly identifies the shared temporary live demo", () => {
  const shell = fs.readFileSync("shared/ui/app-shell.tsx", "utf8");
  const styles = fs.readFileSync("app/globals.css", "utf8");

  assert.match(shell, /LIVE DEMO/);
  assert.match(shell, /All visitors share the same demo data\./);
  assert.match(shell, /Do not enter real or sensitive\s+information\./);
  assert.match(styles, /\.live-demo-banner/);
});

test("live demo asks search engines not to index or follow it", () => {
  const layout = fs.readFileSync("app/layout.tsx", "utf8");

  assert.match(layout, /robots:\s*{/);
  assert.match(layout, /index:\s*false/);
  assert.match(layout, /follow:\s*false/);
});
