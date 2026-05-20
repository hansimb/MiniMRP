import assert from "node:assert/strict";
import test from "node:test";

import {
  createDesktopDatabase,
  ensureSqliteSchema,
  resetDesktopDatabaseForTests,
  setDesktopDatabaseForTests
} from "../lib/runtime/sqlite/db.ts";
import { buildMrpRows } from "../lib/mappers/mrp.ts";
import { getVersionDetail } from "../lib/runtime/sqlite/queries.ts";

test.afterEach(() => {
  resetDesktopDatabaseForTests();
});

test("opening a completed production entry reuses the stored MRP snapshot instead of current inventory", async () => {
  const db = createDesktopDatabase(":memory:");
  ensureSqliteSchema(db);
  setDesktopDatabaseForTests(db);

  db.exec(`
    insert into products (id, name) values ('product-1', 'Orbit Console');
    insert into product_versions (id, product_id, version_number) values ('version-1', 'product-1', 'Version A');
    insert into components (id, sku, name, category, producer, value, safety_stock)
    values ('component-1', 'IC-OPA2134', 'OPA2134 Op Amp', 'IC', 'Texas Instruments', 'OPA2134', 25);
    insert into component_references (version_id, component_master_id, reference)
    values ('version-1', 'component-1', 'U1'), ('version-1', 'component-1', 'U2');
    insert into inventory (id, component_id, quantity_available, purchase_price)
    values ('inventory-1', 'component-1', 100, 9.99);
    insert into production_entries (id, version_id, quantity, status, completed_at, created_at)
    values ('entry-1', 'version-1', 5, 'completed', '2026-05-20T12:00:00.000Z', '2026-05-20T10:00:00.000Z');
    insert into production_requirements (id, production_entry_id, component_id, gross_requirement, inventory_consumed, inventory_consumed_cost, net_requirement, created_at)
    values ('requirement-1', 'entry-1', 'component-1', 10, 4, 4.8, 6, '2026-05-20T10:00:00.000Z');
  `);

  const detail = await getVersionDetail("version-1", { productionEntryId: "entry-1" });
  const rows = buildMrpRows(detail.item?.components ?? [], 5);

  assert.equal(detail.error, null);
  assert.equal(rows[0]?.grossRequirement, 10);
  assert.equal(rows[0]?.availableInventory, 4);
  assert.equal(rows[0]?.reservedForThisCalculation, 4);
  assert.equal(rows[0]?.reservedForEntry, 4);
  assert.equal(rows[0]?.netRequirement, 6);
});
