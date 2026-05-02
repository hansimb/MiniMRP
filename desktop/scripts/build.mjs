import process from "node:process";
import { spawnProcess } from "./runtime-helpers.mjs";

const nextBuildProcess = spawnProcess(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "build"],
  {
    MINIMRP_RUNTIME: "sqlite",
    NEXT_PUBLIC_MINIMRP_RUNTIME: "sqlite"
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
