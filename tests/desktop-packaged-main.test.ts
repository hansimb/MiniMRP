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
  const desktopBundleResource = packageJson.build.extraResources.find(
    (resource: { from?: string }) => resource.from === "dist/desktop-bundle"
  );
  const desktopBundleNodeModulesResource = packageJson.build.extraResources.find(
    (resource: { from?: string }) => resource.from === "dist/desktop-bundle/node_modules"
  );

  assert.deepEqual(desktopBundleResource.filter, ["**/*"]);
  assert.deepEqual(desktopBundleNodeModulesResource, {
    from: "dist/desktop-bundle/node_modules",
    to: "desktop-bundle/node_modules",
    filter: ["**/*"]
  });
});
