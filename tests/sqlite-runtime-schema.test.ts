import assert from "node:assert/strict";
import test from "node:test";

import {
  createDesktopDatabase,
  ensureSqliteSchema,
  listSqliteTables,
  resetDesktopDatabaseForTests
} from "../lib/runtime/sqlite/db.ts";

test.afterEach(() => {
  resetDesktopDatabaseForTests();
});

test("sqlite runtime initializes core tables", () => {
  const db = createDesktopDatabase(":memory:");
  ensureSqliteSchema(db);

  const tables = listSqliteTables(db);

  assert.equal(tables.includes("products"), true);
  assert.equal(tables.includes("components"), true);
  assert.equal(tables.includes("product_versions"), true);
});
