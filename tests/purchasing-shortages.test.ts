import assert from "node:assert/strict";
import test from "node:test";

import {
  createDesktopDatabase,
  ensureSqliteSchema,
  resetDesktopDatabaseForTests,
  setDesktopDatabaseForTests
} from "../lib/runtime/sqlite/db.ts";
import { getPurchasingOverview } from "../lib/runtime/sqlite/queries.ts";

test.afterEach(() => {
  resetDesktopDatabaseForTests();
});

function seedShortageScenario(input: { quantityAvailable: number; storedNetRequirement: number; safetyStock?: number }) {
  const db = createDesktopDatabase(":memory:");
  ensureSqliteSchema(db);
  setDesktopDatabaseForTests(db);

  db.exec(`
    insert into products (id, name) values ('product-1', 'Atlas Mixer');
    insert into product_versions (id, product_id, version_number) values ('version-1', 'product-1', 'Version A');
    insert into components (id, sku, name, category, producer, value, safety_stock)
    values ('component-1', 'IC-OPA2134', 'OPA2134 Op Amp', 'IC', 'Texas Instruments', 'OPA2134', ${input.safetyStock ?? 25});
    insert into inventory (id, component_id, quantity_available, purchase_price)
    values ('inventory-1', 'component-1', ${input.quantityAvailable}, 2.78);
    insert into production_entries (id, version_id, quantity, status, completed_at, created_at)
    values ('entry-1', 'version-1', 5, 'under_production', null, '2026-05-20T10:00:00.000Z');
    insert into production_requirements (id, production_entry_id, component_id, gross_requirement, inventory_consumed, net_requirement, inventory_consumed_cost, created_at)
    values ('requirement-1', 'entry-1', 'component-1', 40, 0, ${input.storedNetRequirement}, 0, '2026-05-20T10:00:00.000Z');
  `);
}

test("getPurchasingOverview drops a stored production shortage once current inventory covers it", async () => {
  seedShortageScenario({ quantityAvailable: 100, storedNetRequirement: 40 });

  const overview = await getPurchasingOverview();

  assert.equal(overview.error, null);
  assert.deepEqual(overview.productionShortages, []);
});

test("getPurchasingOverview recalculates production shortage quantities against current inventory", async () => {
  seedShortageScenario({ quantityAvailable: 10, storedNetRequirement: 40, safetyStock: 25 });

  const overview = await getPurchasingOverview();
  const item = overview.productionShortages[0]?.items[0];

  assert.equal(overview.error, null);
  assert.equal(overview.productionShortages.length, 1);
  assert.equal(item?.sku, "IC-OPA2134");
  assert.equal(item?.quantity_available, 10);
  assert.equal(item?.net_need, 30);
  assert.equal(item?.recommended_order_quantity, 55);
});
