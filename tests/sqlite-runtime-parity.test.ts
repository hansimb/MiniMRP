import assert from "node:assert/strict";
import test from "node:test";

import {
  createDesktopDatabase,
  ensureSqliteSchema,
  resetDesktopDatabaseForTests,
  setDesktopDatabaseForTests
} from "../lib/runtime/sqlite/db.ts";
import { getAppSettings, getHistoryEntries, getInventoryOverview, getPartCatalog, getProductList, getProductionOverview, getPurchasingOverview } from "../lib/runtime/sqlite/queries.ts";

test.afterEach(() => {
  resetDesktopDatabaseForTests();
});

test("sqlite runtime returns the same top-level product list shape", async () => {
  const db = createDesktopDatabase(":memory:");
  ensureSqliteSchema(db);
  setDesktopDatabaseForTests(db);

  const result = await getProductList();

  assert.equal(Array.isArray(result.items), true);
  assert.equal("error" in result, true);
  assert.equal(result.error, null);
});

test("sqlite runtime exposes empty shared view shapes on a fresh database", async () => {
  const db = createDesktopDatabase(":memory:");
  ensureSqliteSchema(db);
  setDesktopDatabaseForTests(db);

  const [parts, inventory, production, purchasing, history, settings] = await Promise.all([
    getPartCatalog(),
    getInventoryOverview(),
    getProductionOverview(),
    getPurchasingOverview(),
    getHistoryEntries(),
    getAppSettings()
  ]);

  assert.deepEqual(parts.items, []);
  assert.deepEqual(inventory.items, []);
  assert.deepEqual(production.underProduction, []);
  assert.deepEqual(production.completed, []);
  assert.deepEqual(purchasing.shortages, []);
  assert.deepEqual(purchasing.nearSafety, []);
  assert.deepEqual(history.items, []);
  assert.deepEqual(settings.item, { id: true, default_safety_stock: 25 });
});
