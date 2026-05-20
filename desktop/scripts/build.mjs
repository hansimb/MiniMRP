import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnProcess } from "./runtime-helpers.mjs";

const buildDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "minimrp-desktop-build-"));
const nextBuildOutputDir = path.join(process.cwd(), ".next");

try {
  fs.rmSync(nextBuildOutputDir, { recursive: true, force: true });

  const nextBuildProcess = spawnProcess(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "build"],
    {
      MINIMRP_DESKTOP_RUNTIME: "1",
      MINIMRP_RUNTIME: "sqlite",
      NEXT_PUBLIC_MINIMRP_RUNTIME: "sqlite",
      MINIMRP_DESKTOP_DATA_DIR: buildDataDir
    }
  );

  const exitCode = await new Promise((resolve, reject) => {
    nextBuildProcess.on("error", reject);
    nextBuildProcess.on("exit", (code) => resolve(code ?? 0));
  });

  if (exitCode !== 0) {
    process.exit(exitCode);
  }

  await import("./prepare-bundle.mjs");
} finally {
  fs.rmSync(buildDataDir, { recursive: true, force: true });
}
