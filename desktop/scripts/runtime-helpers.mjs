import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

export function spawnProcess(command, args, extraEnv = {}) {
  if (process.platform === "win32") {
    const comspec = process.env.ComSpec ?? "cmd.exe";
    const commandLine = [command, ...args].join(" ");

    return spawn(comspec, ["/d", "/s", "/c", commandLine], {
      stdio: "inherit",
      shell: false,
      env: {
        ...process.env,
        ...extraEnv
      }
    });
  }

  return spawn(command, args, {
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      ...extraEnv
    }
  });
}

export async function waitForServer(url, attempts = 120) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Server not ready yet.
    }

    await delay(500);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => resolve(false));
    server.listen({ host: "127.0.0.1", port }, () => {
      server.close(() => resolve(true));
    });
  });
}

export async function findAvailablePort(preferredPort, attempts = 20) {
  for (let index = 0; index < attempts; index += 1) {
    const candidate = preferredPort + index;
    if (await isPortAvailable(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Could not find an available desktop port starting from ${preferredPort}.`);
}
