import { createRequire } from "module";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import { getDesktopDatabasePath } from "./files.ts";
import { ensureSqliteSchemaSql } from "./schema.ts";

const require = createRequire(import.meta.url);

function getDatabaseSyncClass() {
  return (require("node:sqlite") as typeof import("node:sqlite")).DatabaseSync;
}

let desktopDatabase: DatabaseSyncType | null = null;

export function createDesktopDatabase(filename: string) {
  const DatabaseSync = getDatabaseSyncClass();
  const db = new DatabaseSync(filename);
  db.exec("pragma foreign_keys = on;");

  if (filename !== ":memory:") {
    db.exec("pragma journal_mode = wal;");
  }

  return db;
}

export function ensureSqliteSchema(db: DatabaseSyncType) {
  db.exec(ensureSqliteSchemaSql);
  const appSettingsColumns = (
    db.prepare("pragma table_info(app_settings)").all() as Array<{ name: string }>
  ).map((column) => column.name);

  if (!appSettingsColumns.includes("near_safety_threshold_percent")) {
    db.exec(
      "alter table app_settings add column near_safety_threshold_percent integer not null default 10;"
    );
  }

  db.exec(
    "update app_settings set near_safety_threshold_percent = coalesce(near_safety_threshold_percent, 10) where id = 1;"
  );
}

export function listSqliteTables(db: DatabaseSyncType) {
  return (db
    .prepare("select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name")
    .all() as Array<{ name: string }>)
    .map((row) => row.name);
}

export function getDesktopDatabase() {
  if (!desktopDatabase) {
    desktopDatabase = createDesktopDatabase(getDesktopDatabasePath());
    ensureSqliteSchema(desktopDatabase);
  }

  return desktopDatabase;
}

export function setDesktopDatabaseForTests(db: DatabaseSyncType) {
  desktopDatabase = db;
}

export function resetDesktopDatabaseForTests() {
  desktopDatabase?.close();
  desktopDatabase = null;
}
