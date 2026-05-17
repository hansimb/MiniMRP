import assert from "node:assert/strict";
import test from "node:test";

import {
  createDesktopDatabase,
  resetDesktopDatabaseForTests,
  setDesktopDatabaseForTests
} from "../lib/runtime/sqlite/db.ts";
import { getHistoryEntries, getProductList, getProductionOverview, getPurchasingOverview } from "../lib/runtime/sqlite/queries.ts";
import { seedSqliteDevDatabase } from "../lib/runtime/sqlite/dev-seed.ts";

test.afterEach(() => {
  resetDesktopDatabaseForTests();
});

test("seedSqliteDevDatabase builds a realistic non-empty desktop dataset", async () => {
  const db = createDesktopDatabase(":memory:");
  setDesktopDatabaseForTests(db);

  const summary = seedSqliteDevDatabase(db);
  const [products, production, purchasing, history] = await Promise.all([
    getProductList(),
    getProductionOverview(),
    getPurchasingOverview(),
    getHistoryEntries()
  ]);

  assert.equal(summary.products >= 5, true);
  assert.equal(summary.versions >= 6, true);
  assert.equal(summary.components >= 20, true);
  assert.equal(summary.inventoryLots >= 20, true);
  assert.equal(summary.productionEntries >= 2, true);

  assert.equal(products.error, null);
  assert.equal(products.items.length, summary.products);

  assert.equal(production.error, null);
  assert.equal(production.underProduction.length >= 1, true);

  assert.equal(purchasing.error, null);
  assert.equal(purchasing.shortages.length >= 1, true);
  assert.equal(purchasing.nearSafety.length >= 1, true);

  assert.equal(history.error, null);
  assert.equal(history.items.length >= 1, true);
});
