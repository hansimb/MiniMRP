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

  assert.deepEqual(desktopBundleResource, {
    from: "dist/desktop-bundle",
    to: "desktop-bundle",
    filter: ["**/*"]
  });
  assert.deepEqual(desktopBundleNodeModulesResource, {
    from: "dist/desktop-bundle/node_modules",
    to: "desktop-bundle/node_modules",
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

test("desktop distribution defaults to NSIS while keeping a portable fallback script", () => {
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

  assert.equal(packageJson.scripts["dist:desktop"], "npm run build:desktop && electron-builder --win nsis");
  assert.equal(packageJson.scripts["dist:desktop:portable"], "npm run build:desktop && electron-builder --win portable");
  assert.deepEqual(packageJson.build.win.target, [
    {
      target: "nsis",
      arch: ["x64"]
    }
  ]);
  assert.deepEqual(packageJson.build.nsis, {
    artifactName: "MiniMRP-Setup-${version}.exe",
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true
  });
  assert.deepEqual(packageJson.build.portable, {
    artifactName: "MiniMRP-Portable-${version}.exe"
  });
});

test("desktop build script compiles the app with sqlite runtime env", () => {
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const buildScriptSource = fs.readFileSync("desktop/scripts/build.mjs", "utf8");

  assert.equal(packageJson.scripts["build:desktop"], "node desktop/scripts/build.mjs");
  assert.equal(buildScriptSource.includes('MINIMRP_DESKTOP_RUNTIME: "1"'), true);
  assert.equal(buildScriptSource.includes('MINIMRP_RUNTIME: "sqlite"'), true);
  assert.equal(buildScriptSource.includes('NEXT_PUBLIC_MINIMRP_RUNTIME: "sqlite"'), true);
  assert.equal(buildScriptSource.includes("MINIMRP_DESKTOP_DATA_DIR"), true);
  assert.equal(buildScriptSource.includes("mkdtempSync"), true);
  assert.equal(buildScriptSource.includes('["run", "build"]'), true);
  assert.equal(buildScriptSource.includes('await import("./prepare-bundle.mjs");'), true);
});
