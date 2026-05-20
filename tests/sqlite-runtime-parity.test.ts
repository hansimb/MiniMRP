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
  assert.deepEqual(purchasing.productionShortages, []);
  assert.deepEqual(purchasing.nearSafety, []);
  assert.deepEqual(purchasing.outOfStock, []);
  assert.deepEqual(history.items, []);
  assert.deepEqual(settings.item, {
    id: true,
    default_safety_stock: 25,
    near_safety_threshold_percent: 10
  });
});

test("sqlite schema migration adds near_safety_threshold_percent to legacy app_settings tables", () => {
  const db = createDesktopDatabase(":memory:");
  db.exec(`
    create table app_settings (
      id integer primary key check (id = 1),
      default_safety_stock integer not null default 25
    );
    insert into app_settings (id, default_safety_stock) values (1, 25);
  `);

  ensureSqliteSchema(db);

  const columns = (
    db.prepare("pragma table_info(app_settings)").all() as Array<{ name: string }>
  ).map((column) => column.name);
  const row = db
    .prepare("select id, default_safety_stock, near_safety_threshold_percent from app_settings where id = 1")
    .get() as { id: number; default_safety_stock: number; near_safety_threshold_percent: number };

  assert.equal(columns.includes("near_safety_threshold_percent"), true);
  assert.deepEqual({ ...row }, {
    id: 1,
    default_safety_stock: 25,
    near_safety_threshold_percent: 10
  });
});
