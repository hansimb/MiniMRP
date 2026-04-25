"use client";

import { updatePartSafetyStockAction } from "@/lib/runtime/actions";

export function InventoryEditForm(props: {
  inventoryId: string;
  componentId: string;
  componentName: string;
  currentQuantity: number;
  currentSafetyStock: number;
}) {
  return (
    <form action={updatePartSafetyStockAction} className="stack">
      <input type="hidden" name="id" value={props.componentId} />
      <input type="hidden" name="returnTo" value="/inventory" />
      <div className="small muted">Component: {props.componentName}</div>
      <div className="small muted">Current quantity: {props.currentQuantity}</div>
      <div className="field-group">
        <label htmlFor={`safety-stock-${props.inventoryId}`}>Safety stock</label>
        <input
          id={`safety-stock-${props.inventoryId}`}
          className="input"
          type="number"
          min="0"
          step="1"
          name="safety_stock"
          defaultValue={props.currentSafetyStock}
        />
      </div>
      <button className="button primary" type="submit">
        Update safety stock
      </button>
    </form>
  );
}
