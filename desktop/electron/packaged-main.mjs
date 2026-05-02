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

function buildLoadingPageHtml(title, message) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root {
        color-scheme: light;
      }

      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at top, rgba(199, 167, 106, 0.22), transparent 45%),
          linear-gradient(180deg, #f7f2e8 0%, #efe6d6 100%);
        color: #2f2417;
        font-family: "Segoe UI", "Inter", sans-serif;
      }

      main {
        width: min(420px, calc(100vw - 48px));
        padding: 32px 28px;
        border: 1px solid rgba(115, 89, 44, 0.16);
        border-radius: 18px;
        background: rgba(255, 251, 245, 0.94);
        box-shadow: 0 18px 50px rgba(80, 56, 23, 0.12);
      }

      .eyebrow {
        margin: 0 0 10px;
        font-size: 12px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #7a5e33;
      }

      h1 {
        margin: 0 0 12px;
        font-size: 28px;
        line-height: 1.1;
      }

      p {
        margin: 0;
        font-size: 15px;
        line-height: 1.5;
        color: #5d4a2f;
      }

      .meter {
        margin-top: 22px;
        height: 6px;
        border-radius: 999px;
        overflow: hidden;
        background: rgba(122, 94, 51, 0.14);
      }

      .meter::after {
        content: "";
        display: block;
        width: 38%;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #9e7a3d 0%, #d4ae62 100%);
        animation: loading 1.05s ease-in-out infinite;
      }

      @keyframes loading {
        0% {
          transform: translateX(-120%);
        }
        100% {
          transform: translateX(360%);
        }
      }
    </style>
  </head>
  <body>
    <main>
      <p class="eyebrow">MiniMRP desktop</p>
      <h1>${title}</h1>
      <p>${message}</p>
      <div class="meter" aria-hidden="true"></div>
    </main>
  </body>
</html>`;
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

function createWindow() {
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
  const loadingPageHtml = buildLoadingPageHtml("Opening MiniMRP", "Starting the local desktop workspace.");
  window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(loadingPageHtml)}`);
  return window;
}

function navigateWindowToApp(window, desktopUrl) {
  window.webContents.on("did-finish-load", () => {
    logStartup("windowDidFinishLoad", { desktopUrl });
  });
  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    logStartup("windowDidFailLoad", { errorCode, errorDescription, desktopUrl });
  });

  logStartup("windowLoadUrl", { desktopUrl });
  window.loadURL(desktopUrl);
}

function showStartupError(window, error) {
  const message = error instanceof Error ? error.message : "Unknown startup error.";
  const errorPageHtml = buildLoadingPageHtml("MiniMRP could not start", message);
  logStartup("startupError", { message });
  window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorPageHtml)}`);
}

app.whenReady().then(async () => {
  logStartup("appWhenReady");
  const window = createWindow();

  try {
    const desktopUrl = await startEmbeddedServer();
    navigateWindowToApp(window, desktopUrl);

    app.on("activate", async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        const nextWindow = createWindow();
        navigateWindowToApp(nextWindow, desktopUrl);
      }
    });
  } catch (error) {
    showStartupError(window, error);
  }
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
