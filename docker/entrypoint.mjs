import { cpSync, existsSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const dataDirectory = process.env.MINIMRP_DESKTOP_DATA_DIR ?? "/data";
const databasePath = path.join(dataDirectory, "minimrp.sqlite");

mkdirSync(dataDirectory, { recursive: true });

if (!existsSync(databasePath)) {
  cpSync("/opt/minimrp-seed", dataDirectory, {
    recursive: true,
    force: false,
    errorOnExist: false
  });
  console.log(`Initialized MiniMRP demo data in ${dataDirectory}.`);
}

const server = spawn(process.execPath, ["server.js"], {
  stdio: "inherit",
  env: process.env
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}

server.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
