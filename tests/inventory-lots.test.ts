import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateInventorySummaryFromLots,
  consumeInventoryLotsFifo
} from "../lib/mappers/inventory-lots.ts";

test("calculateInventorySummaryFromLots returns quantity and weighted average from remaining lots", () => {
  const summary = calculateInventorySummaryFromLots([
    {
      id: "lot-1",
      component_id: "component-1",
      quantity_received: 10,
      quantity_remaining: 4,
      unit_cost: 2,
      received_at: "2026-04-01T10:00:00.000Z",
      source: "import",
      notes: null,
      created_at: "2026-04-01T10:00:00.000Z"
    },
    {
      id: "lot-2",
      component_id: "component-1",
      quantity_received: 8,
      quantity_remaining: 8,
      unit_cost: 3,
      received_at: "2026-04-02T10:00:00.000Z",
      source: "purchase",
      notes: null,
      created_at: "2026-04-02T10:00:00.000Z"
    }
  ]);

  assert.deepEqual(summary, {
    quantity_available: 12,
    purchase_price: 2.6667
  });
});

test("consumeInventoryLotsFifo consumes oldest lots first", () => {
  const result = consumeInventoryLotsFifo(
    [
      {
        id: "lot-1",
        component_id: "component-1",
        quantity_received: 5,
        quantity_remaining: 5,
        unit_cost: 1,
        received_at: "2026-04-01T10:00:00.000Z",
        source: "import",
        notes: null,
        created_at: "2026-04-01T10:00:00.000Z"
      },
      {
        id: "lot-2",
        component_id: "component-1",
        quantity_received: 7,
        quantity_remaining: 7,
        unit_cost: 2,
        received_at: "2026-04-02T10:00:00.000Z",
        source: "purchase",
        notes: null,
        created_at: "2026-04-02T10:00:00.000Z"
      }
    ],
    9
  );

  assert.equal(result.inventoryConsumed, 9);
  assert.equal(result.remainingRequirement, 0);
  assert.deepEqual(
    result.updatedLots.map((lot) => ({ id: lot.id, quantity_remaining: lot.quantity_remaining })),
    [
      { id: "lot-1", quantity_remaining: 0 },
      { id: "lot-2", quantity_remaining: 3 }
    ]
  );
});

test("consumeInventoryLotsFifo reports shortage when lots do not fully cover requirement", () => {
  const result = consumeInventoryLotsFifo(
    [
      {
        id: "lot-1",
        component_id: "component-1",
        quantity_received: 2,
        quantity_remaining: 2,
        unit_cost: 1.5,
        received_at: "2026-04-01T10:00:00.000Z",
        source: "import",
        notes: null,
        created_at: "2026-04-01T10:00:00.000Z"
      }
    ],
    5
  );

  assert.equal(result.inventoryConsumed, 2);
  assert.equal(result.remainingRequirement, 3);
  assert.equal(result.updatedLots[0]?.quantity_remaining, 0);
});

test("consumeInventoryLotsFifo keeps decimal quantities stable for inventory lots", () => {
  const result = consumeInventoryLotsFifo(
    [
      {
        id: "lot-1",
        component_id: "component-1",
        quantity_received: 1.2,
        quantity_remaining: 1.2,
        unit_cost: 2.5,
        received_at: "2026-04-01T10:00:00.000Z",
        source: "import",
        notes: null,
        created_at: "2026-04-01T10:00:00.000Z"
      },
      {
        id: "lot-2",
        component_id: "component-1",
        quantity_received: 0.5,
        quantity_remaining: 0.5,
        unit_cost: 3.1,
        received_at: "2026-04-02T10:00:00.000Z",
        source: "purchase",
        notes: null,
        created_at: "2026-04-02T10:00:00.000Z"
      }
    ],
    1.3
  );

  assert.equal(result.inventoryConsumed, 1.3);
  assert.equal(result.remainingRequirement, 0);
  assert.deepEqual(
    result.updatedLots.map((lot) => ({ id: lot.id, quantity_remaining: lot.quantity_remaining })),
    [
      { id: "lot-1", quantity_remaining: 0 },
      { id: "lot-2", quantity_remaining: 0.4 }
    ]
  );
});
