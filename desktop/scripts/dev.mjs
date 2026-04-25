import process from "node:process";
import { findAvailablePort, spawnProcess, waitForServer } from "./runtime-helpers.mjs";

const preferredPort = Number(process.env.MINIMRP_DESKTOP_PORT ?? "3001");
const port = await findAvailablePort(preferredPort);
const desktopUrl = `http://127.0.0.1:${port}`;

if (port !== preferredPort) {
  console.log(`Desktop dev port ${preferredPort} was busy, using ${port} instead.`);
}

const nextProcess = spawnProcess(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)],
  {
    MINIMRP_RUNTIME: "sqlite",
    NEXT_PUBLIC_MINIMRP_RUNTIME: "sqlite"
  }
);

const shutdown = () => {
  if (!nextProcess.killed) {
    nextProcess.kill();
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

nextProcess.on("exit", (code) => {
  process.exit(code ?? 0);
});

await waitForServer(`${desktopUrl}/login`);

const electronProcess = spawnProcess(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["electron", "desktop/electron/main.mjs"],
  {
    MINIMRP_RUNTIME: "sqlite",
    NEXT_PUBLIC_MINIMRP_RUNTIME: "sqlite",
    MINIMRP_DESKTOP_URL: desktopUrl
  }
);

electronProcess.on("exit", (code) => {
  shutdown();
  process.exit(code ?? 0);
});
