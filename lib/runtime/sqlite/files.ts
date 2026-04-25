import fs from "fs";
import path from "path";

const DEFAULT_DESKTOP_DATA_DIR = path.join(process.cwd(), ".data", "desktop");

export function getDesktopDataDirectory() {
  return process.env.MINIMRP_DESKTOP_DATA_DIR ?? DEFAULT_DESKTOP_DATA_DIR;
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
