import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("live demo container builds and runs the existing sqlite runtime", () => {
  const dockerfile = fs.readFileSync("Dockerfile", "utf8");

  assert.match(dockerfile, /FROM node:24-bookworm-slim AS builder/);
  assert.match(dockerfile, /MINIMRP_RUNTIME=sqlite/);
  assert.match(dockerfile, /NEXT_PUBLIC_MINIMRP_RUNTIME=sqlite/);
  assert.match(dockerfile, /MINIMRP_DESKTOP_DATA_DIR=\/data/);
  assert.match(dockerfile, /npm run build/);
  assert.match(dockerfile, /\.next\/standalone/);
  assert.match(dockerfile, /ENTRYPOINT \["node", "docker\/entrypoint\.mjs"\]/);
});

test("container startup preserves existing data and seeds only a new volume", () => {
  const entrypoint = fs.readFileSync("docker/entrypoint.mjs", "utf8");

  assert.match(entrypoint, /minimrp\.sqlite/);
  assert.match(entrypoint, /existsSync/);
  assert.match(entrypoint, /cpSync/);
  assert.match(entrypoint, /server\.js/);
});

test("docker context excludes local and generated data", () => {
  const dockerignore = fs.readFileSync(".dockerignore", "utf8");

  for (const ignoredPath of ["node_modules", ".next", ".git", ".worktrees", ".data", "dist"]) {
    assert.equal(dockerignore.split(/\r?\n/).includes(ignoredPath), true, `${ignoredPath} must be ignored`);
  }
});
