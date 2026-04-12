import type { InventoryLot } from "@/lib/types/domain";

function roundCurrency(value: number) {
  return Math.round(value * 10000) / 10000;
}

function roundQuantity(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function calculateInventorySummaryFromLots(lots: InventoryLot[]) {
  const activeLots = lots.filter((lot) => lot.quantity_remaining > 0);
  const quantity_available = roundQuantity(activeLots.reduce((total, lot) => total + lot.quantity_remaining, 0));

  if (quantity_available <= 0) {
    return {
      quantity_available: 0,
      purchase_price: null as number | null
    };
  }

  const weightedValue = activeLots.reduce(
    (total, lot) => total + lot.quantity_remaining * lot.unit_cost,
    0
  );

  return {
    quantity_available,
    purchase_price: roundCurrency(weightedValue / quantity_available)
  };
}

export function calculateInventoryLotValue(lot: InventoryLot) {
  return roundCurrency(lot.quantity_remaining * lot.unit_cost);
}

export function calculateInventoryValueFromLots(lots: InventoryLot[]) {
  const activeLots = lots.filter((lot) => lot.quantity_remaining > 0);
  if (activeLots.length === 0) {
    return null;
  }

  return roundCurrency(
    activeLots.reduce((total, lot) => total + lot.quantity_remaining * lot.unit_cost, 0)
  );
}

export function consumeInventoryLotsFifo(lots: InventoryLot[], requiredQuantity: number) {
  const updatedLots = lots
    .map((lot) => ({ ...lot }))
    .sort((left, right) => {
      const receivedDelta = new Date(left.received_at).getTime() - new Date(right.received_at).getTime();
      if (receivedDelta !== 0) {
        return receivedDelta;
      }

      return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
    });

  let quantityToConsume = requiredQuantity;
  let inventoryConsumed = 0;

  for (const lot of updatedLots) {
    if (quantityToConsume <= 0) {
      break;
    }

    const consumed = Math.min(lot.quantity_remaining, quantityToConsume);
    lot.quantity_remaining = roundQuantity(lot.quantity_remaining - consumed);
    quantityToConsume = roundQuantity(quantityToConsume - consumed);
    inventoryConsumed = roundQuantity(inventoryConsumed + consumed);
  }

  return {
    updatedLots,
    inventoryConsumed,
    remainingRequirement: roundQuantity(Math.max(quantityToConsume, 0))
  };
}
