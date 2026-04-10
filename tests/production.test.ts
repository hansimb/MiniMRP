import test from "node:test";
import assert from "node:assert/strict";
import { summarizeReservedRequirements } from "../lib/mappers/production.ts";
import { buildMrpRows } from "../lib/mappers/mrp.ts";

test("summarizeReservedRequirements aggregates reserved values per component", () => {
  const summary = summarizeReservedRequirements([
    {
      component_id: "c1",
      gross_requirement: 12,
      inventory_consumed: 5,
      net_requirement: 7,
      quantity: 3
    },
    {
      component_id: "c1",
      gross_requirement: 4,
      inventory_consumed: 4,
      net_requirement: 0,
      quantity: 2
    },
    {
      component_id: "c2",
      gross_requirement: 6,
      inventory_consumed: 1,
      net_requirement: 5,
      quantity: 3
    }
  ]);

  assert.deepEqual(summary.c1, {
    grossRequirement: 16,
    inventoryConsumed: 9,
    netRequirement: 7,
    activeProductionQuantity: 5,
    activeEntryCount: 2
  });
  assert.deepEqual(summary.c2, {
    grossRequirement: 6,
    inventoryConsumed: 1,
    netRequirement: 5,
    activeProductionQuantity: 3,
    activeEntryCount: 1
  });
});

test("buildMrpRows carries reserved production metadata for UI display", () => {
  const rows = buildMrpRows(
    [
      {
        component: {
          id: "1",
          sku: "MCU-STM32F4",
          name: "STM32 MCU",
          category: "IC",
          producer: "ST",
          value: "STM32F4",
          safety_stock: 5
        },
        references: ["U1"],
        quantity: 1,
        lead_time: 21,
        inventory: {
          id: "inv-1",
          component_id: "1",
          quantity_available: 2,
          purchase_price: 8.2
        },
        reserved: {
          gross_requirement: 6,
          inventory_consumed: 2,
          net_requirement: 4,
          active_production_quantity: 6,
          active_entry_count: 1
        }
      }
    ],
    4
  );

  assert.equal(rows[0]?.reservedInventory, 2);
  assert.equal(rows[0]?.activeProductionQuantity, 6);
});
