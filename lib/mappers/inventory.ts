export type InventoryAdjustmentMode = "add" | "remove";

export function applyInventoryAdjustment(
  currentQuantity: number,
  mode: InventoryAdjustmentMode,
  amount: number
) {
  if (mode === "remove") {
    return Math.max(currentQuantity - amount, 0);
  }

  return currentQuantity + amount;
}
