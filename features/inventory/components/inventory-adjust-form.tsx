"use client";

import { adjustInventoryDeltaAction } from "@/lib/supabase/actions/index";

export function InventoryAdjustForm(props: {
  componentId: string;
  componentName: string;
  currentQuantity: number;
  returnTo?: string;
  formId: string;
}) {
  return (
    <form action={adjustInventoryDeltaAction} className="stack">
      <input type="hidden" name="component_id" value={props.componentId} />
      <input type="hidden" name="returnTo" value={props.returnTo ?? "/inventory"} />
      <input type="hidden" name="mode" value="remove" />
      <div className="small muted">Component: {props.componentName}</div>
      <div className="small muted">Current quantity: {props.currentQuantity}</div>
      <div className="notice">
        Stock will be reduced automatically from the oldest available inventory lots first using FIFO. Edit individual lots from the component page.
      </div>
      <div className="field-group">
        <label htmlFor={`${props.formId}-amount`}>Amount</label>
        <input
          id={`${props.formId}-amount`}
          className="input"
          type="number"
          min="0.0001"
          step="0.0001"
          name="amount"
          required
        />
      </div>
      <button className="button danger" type="submit">
        Use stock
      </button>
    </form>
  );
}
