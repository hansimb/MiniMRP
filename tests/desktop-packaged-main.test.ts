import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("packaged desktop main does not use the packaged app executable as a Node host", () => {
  const source = fs.readFileSync("desktop/electron/packaged-main.mjs", "utf8");

  assert.equal(source.includes("ELECTRON_RUN_AS_NODE"), false);
  assert.equal(source.includes("getEmbeddedNodeHostExecutable"), false);
});

test("desktop distribution includes the complete standalone server bundle", () => {
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const desktopBundleResources = packageJson.build.extraResources.filter(
    (resource: { from?: string }) => resource.from === "dist/desktop-bundle"
  );

  assert.equal(desktopBundleResources.length, 1);
  assert.deepEqual(desktopBundleResources[0], {
    from: "dist/desktop-bundle",
    to: "desktop-bundle",
    filter: ["**/*"]
  });
});

test("packaged desktop main shows a loading window before waiting for the embedded server", () => {
  const source = fs.readFileSync("desktop/electron/packaged-main.mjs", "utf8");

  assert.equal(source.includes("function buildLoadingPageHtml"), true);
  assert.equal(source.includes("window.loadURL(`data:text/html"), true);
  assert.equal(source.includes("const window = createWindow();"), true);
  assert.equal(source.includes("const desktopUrl = await startEmbeddedServer();"), true);
});
