import assert from "node:assert/strict";
import test from "node:test";

import { buildMrpRows } from "../lib/mappers/mrp.ts";

test("buildMrpRows includes reserved entry cost in gross cost for existing production entries", () => {
  const rows = buildMrpRows(
    [
      {
        component: {
          id: "component-1",
          sku: "IC-OPA2134",
          name: "OPA2134 Op Amp",
          category: "IC",
          producer: "Texas Instruments",
          value: "OPA2134",
          safety_stock: 25
        },
        references: ["U1", "U2"],
        quantity: 3,
        lead_time: 7,
        inventory: {
          id: "inventory-1",
          component_id: "component-1",
          quantity_available: 0,
          purchase_price: 2.5
        },
        reserved: {
          gross_requirement: 6,
          inventory_consumed: 4,
          inventory_consumed_cost: 4.8,
          net_requirement: 2,
          entry_inventory_consumed: 4,
          entry_inventory_consumed_cost: 4.8,
          active_production_quantity: 2,
          active_entry_count: 1
        }
      }
    ],
    2
  );

  assert.equal(rows[0]?.grossRequirement, 6);
  assert.equal(rows[0]?.reservedForEntry, 4);
  assert.equal(rows[0]?.grossCost, 9.8);
});
