import test from "node:test";
import assert from "node:assert/strict";
import {
  planProductionCompletionConsumption,
  summarizeReservedRequirements
} from "../lib/mappers/production.ts";
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
    inventoryConsumedCost: 0,
    netRequirement: 7,
    activeProductionQuantity: 5,
    activeEntryCount: 2
  });
  assert.deepEqual(summary.c2, {
    grossRequirement: 6,
    inventoryConsumed: 1,
    inventoryConsumedCost: 0,
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
          entry_inventory_consumed: 2,
          active_production_quantity: 6,
          active_entry_count: 1
        }
      }
    ],
    4
  );

  assert.equal(rows[0]?.reservedInventory, 2);
  assert.equal(rows[0]?.reservedForEntry, 2);
  assert.equal(rows[0]?.activeProductionQuantity, 6);
});

test("planProductionCompletionConsumption returns a missing-stock warning when final net requirement is not covered", () => {
  const result = planProductionCompletionConsumption({
    requirements: [
      {
        id: "req-1",
        component_id: "c1",
        gross_requirement: 10,
        inventory_consumed: 4,
        net_requirement: 6
      }
    ],
    lotsByComponent: {
      c1: [
        {
          id: "lot-1",
          component_id: "c1",
          quantity_received: 3,
          quantity_remaining: 3,
          unit_cost: 2,
          received_at: "2026-04-01T10:00:00.000Z",
          source: "purchase",
          notes: null,
          created_at: "2026-04-01T10:00:00.000Z"
        }
      ]
    },
    componentNames: {
      c1: "Harbor 8P Link Header"
    }
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    assert.fail("Expected missing-stock result");
  }

  assert.match(result.message, /Harbor 8P Link Header/);
  assert.match(result.message, /3/);
});

test("planProductionCompletionConsumption consumes remaining net requirement FIFO and clears it", () => {
  const result = planProductionCompletionConsumption({
    requirements: [
      {
        id: "req-1",
        component_id: "c1",
        gross_requirement: 10,
        inventory_consumed: 4,
        net_requirement: 6
      }
    ],
    lotsByComponent: {
      c1: [
        {
          id: "lot-1",
          component_id: "c1",
          quantity_received: 2,
          quantity_remaining: 2,
          unit_cost: 1.5,
          received_at: "2026-04-01T10:00:00.000Z",
          source: "purchase",
          notes: null,
          created_at: "2026-04-01T10:00:00.000Z"
        },
        {
          id: "lot-2",
          component_id: "c1",
          quantity_received: 8,
          quantity_remaining: 8,
          unit_cost: 1.8,
          received_at: "2026-04-02T10:00:00.000Z",
          source: "purchase",
          notes: null,
          created_at: "2026-04-02T10:00:00.000Z"
        }
      ]
    },
    componentNames: {
      c1: "Harbor 8P Link Header"
    }
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    assert.fail("Expected successful completion plan");
  }

  assert.deepEqual(result.requirementUpdates, [
    {
      id: "req-1",
      inventory_consumed: 10,
      inventory_consumed_cost: 10.2,
      net_requirement: 0
    }
  ]);
  assert.deepEqual(
    result.lotUpdates.map((lot) => ({ id: lot.id, quantity_remaining: lot.quantity_remaining })),
    [
      { id: "lot-1", quantity_remaining: 0 },
      { id: "lot-2", quantity_remaining: 4 }
    ]
  );
  assert.deepEqual(result.affectedComponentIds, ["c1"]);
});

test("planProductionCompletionConsumption allows completion when reserved inventory already covers gross requirement", () => {
  const result = planProductionCompletionConsumption({
    requirements: [
      {
        id: "req-1",
        component_id: "c1",
        gross_requirement: 10,
        inventory_consumed: 12,
        net_requirement: 4
      }
    ],
    lotsByComponent: {
      c1: []
    },
    componentNames: {
      c1: "Polaris Amber Beacon"
    }
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    assert.fail("Expected successful completion plan");
  }

  assert.deepEqual(result.requirementUpdates, []);
  assert.deepEqual(result.lotUpdates, []);
  assert.deepEqual(result.affectedComponentIds, []);
});
