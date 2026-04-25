import { app, BrowserWindow } from "electron";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

const startupLogPath = path.join(process.env.TEMP ?? process.cwd(), "MiniMRP-desktop-startup.log");

function logStartup(message, extra = null) {
  const line = `[${new Date().toISOString()}] ${message}${extra ? ` ${JSON.stringify(extra)}` : ""}\n`;
  fs.appendFileSync(startupLogPath, line);
}

process.on("uncaughtException", (error) => {
  logStartup("uncaughtException", {
    message: error instanceof Error ? error.message : String(error)
  });
});

process.on("unhandledRejection", (reason) => {
  logStartup("unhandledRejection", {
    reason: reason instanceof Error ? reason.message : String(reason)
  });
});

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

async function findAvailablePort(preferredPort, attempts = 20) {
  for (let index = 0; index < attempts; index += 1) {
    const candidate = preferredPort + index;
    if (await isPortAvailable(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Could not find an available desktop port starting from ${preferredPort}.`);
}

async function waitForServer(url, attempts = 120) {
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

function stopServer() {
  // The embedded Next server runs inside the Electron main process and exits with the app.
}

async function startEmbeddedServer() {
  const preferredPort = Number(process.env.MINIMRP_DESKTOP_PORT ?? "3001");
  const port = await findAvailablePort(preferredPort);
  const bundleRoot = path.join(process.resourcesPath, "desktop-bundle");
  const serverEntry = path.join(bundleRoot, "server.js");

  logStartup("startEmbeddedServer", {
    preferredPort,
    port,
    bundleRoot,
    serverEntry
  });

  process.env.NODE_ENV = "production";
  process.env.PORT = String(port);
  process.env.HOSTNAME = "127.0.0.1";
  process.env.MINIMRP_RUNTIME = "sqlite";
  process.env.NEXT_PUBLIC_MINIMRP_RUNTIME = "sqlite";

  await import(pathToFileURL(serverEntry).href);

  const desktopUrl = `http://127.0.0.1:${port}`;
  await waitForServer(`${desktopUrl}/products`);
  logStartup("embeddedServerReady", { desktopUrl });
  return desktopUrl;
}

function createWindow(desktopUrl) {
  const window = new BrowserWindow({
    show: false,
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: "#f4f1e8",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.once("ready-to-show", () => {
    logStartup("windowReadyToShow");
    window.show();
  });
  window.webContents.on("did-finish-load", () => {
    logStartup("windowDidFinishLoad", { desktopUrl });
  });
  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    logStartup("windowDidFailLoad", { errorCode, errorDescription, desktopUrl });
  });

  logStartup("windowLoadUrl", { desktopUrl });
  window.loadURL(desktopUrl);
}

app.whenReady().then(async () => {
  logStartup("appWhenReady");
  const desktopUrl = await startEmbeddedServer();
  createWindow(desktopUrl);

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(desktopUrl);
    }
  });
});

app.on("before-quit", () => {
  logStartup("beforeQuit");
  stopServer();
});

app.on("window-all-closed", () => {
  logStartup("windowAllClosed");
  if (process.platform !== "darwin") {
    stopServer();
    app.quit();
  }
});
