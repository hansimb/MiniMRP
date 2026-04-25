import { calculateInventorySummaryFromLots } from "../../mappers/inventory-lots.ts";
import type { InventoryLot } from "../../types/domain.ts";
import { createId, getRows, run } from "./shared.ts";

export function syncInventorySummaryForComponent(componentId: string) {
  const lots = getRows<InventoryLot>(
    `
      select id, component_id, quantity_received, quantity_remaining, unit_cost, received_at, source, notes, created_at
      from inventory_lots
      where component_id = :componentId
    `,
    { componentId }
  );
  const summary = calculateInventorySummaryFromLots(lots);
  const existing = getRows<{ id: string }>(
    "select id from inventory where component_id = :componentId",
    { componentId }
  )[0];

  if (existing) {
    run(
      `
        update inventory
        set quantity_available = :quantity_available,
            purchase_price = :purchase_price
        where component_id = :componentId
      `,
      {
        componentId,
        quantity_available: summary.quantity_available,
        purchase_price: summary.purchase_price
      }
    );
    return;
  }

  run(
    `
      insert into inventory (id, component_id, quantity_available, purchase_price)
      values (:id, :componentId, :quantity_available, :purchase_price)
    `,
    {
      id: createId(),
      componentId,
      quantity_available: summary.quantity_available,
      purchase_price: summary.purchase_price
    }
  );
}
