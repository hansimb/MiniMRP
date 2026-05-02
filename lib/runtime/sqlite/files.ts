import fs from "fs";
import os from "os";
import path from "path";

export function getDefaultDesktopDataDirectory() {
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"), "MiniMRP");
  }

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "MiniMRP");
  }

  return path.join(process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share"), "MiniMRP");
}

export function getDesktopDataDirectory() {
  return process.env.MINIMRP_DESKTOP_DATA_DIR ?? getDefaultDesktopDataDirectory();
}

export function ensureDesktopDataDirectory() {
  const directory = getDesktopDataDirectory();
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

export function getDesktopDatabasePath(filename = "minimrp.sqlite") {
  return path.join(ensureDesktopDataDirectory(), filename);
}

export function getDesktopFilesDirectory() {
  const directory = path.join(ensureDesktopDataDirectory(), "files");
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

export function getDesktopScopedFilesDirectory(scope: "products" | "versions") {
  const directory = path.join(getDesktopFilesDirectory(), scope);
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}
