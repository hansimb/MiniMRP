import { deleteInventoryLotAction, updateInventoryLotAction } from "@/lib/runtime/actions";
import type { InventoryLot } from "@/lib/types/domain";
import { ModalTrigger } from "@/shared/ui";

function toDatetimeLocal(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export function InventoryLotActions(props: {
  lot: InventoryLot;
  componentName: string;
  returnTo: string;
}) {
  return (
    <div className="action-row">
      <ModalTrigger buttonLabel="Edit" title={`Edit inventory lot for ${props.componentName}`}>
        <form action={updateInventoryLotAction} className="stack">
          <input type="hidden" name="id" value={props.lot.id} />
          <input type="hidden" name="component_id" value={props.lot.component_id} />
          <input type="hidden" name="returnTo" value={props.returnTo} />
          <div className="field-group">
            <label htmlFor={`lot-received-${props.lot.id}`}>Received at</label>
            <input
              id={`lot-received-${props.lot.id}`}
              className="input"
              type="datetime-local"
              name="received_at"
              defaultValue={toDatetimeLocal(props.lot.received_at)}
            />
          </div>
          <div className="field-group">
            <label htmlFor={`lot-qty-received-${props.lot.id}`}>Quantity received</label>
            <input
              id={`lot-qty-received-${props.lot.id}`}
              className="input"
              type="number"
              min="0.0001"
              step="0.0001"
              name="quantity_received"
              defaultValue={props.lot.quantity_received}
            />
          </div>
          <div className="field-group">
            <label htmlFor={`lot-qty-remaining-${props.lot.id}`}>Quantity remaining</label>
            <input
              id={`lot-qty-remaining-${props.lot.id}`}
              className="input"
              type="number"
              min="0"
              step="0.0001"
              name="quantity_remaining"
              defaultValue={props.lot.quantity_remaining}
            />
          </div>
          <div className="field-group">
            <label htmlFor={`lot-unit-cost-${props.lot.id}`}>Unit cost</label>
            <input
              id={`lot-unit-cost-${props.lot.id}`}
              className="input"
              type="number"
              min="0"
              step="0.0001"
              name="unit_cost"
              defaultValue={props.lot.unit_cost}
            />
          </div>
          <div className="field-group">
            <label htmlFor={`lot-source-${props.lot.id}`}>Source</label>
            <input
              id={`lot-source-${props.lot.id}`}
              className="input"
              name="source"
              defaultValue={props.lot.source ?? ""}
            />
          </div>
          <div className="field-group">
            <label htmlFor={`lot-notes-${props.lot.id}`}>Notes</label>
            <input
              id={`lot-notes-${props.lot.id}`}
              className="input"
              name="notes"
              defaultValue={props.lot.notes ?? ""}
            />
          </div>
          <button className="button primary" type="submit">
            Save changes
          </button>
        </form>
      </ModalTrigger>
      <ModalTrigger
        buttonLabel={
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
          </svg>
        }
        buttonAriaLabel={`Delete inventory lot for ${props.componentName}`}
        buttonClassName="button danger"
        title={`Delete inventory lot for ${props.componentName}?`}
      >
        <form action={deleteInventoryLotAction} className="stack">
          <input type="hidden" name="id" value={props.lot.id} />
          <input type="hidden" name="component_id" value={props.lot.component_id} />
          <input type="hidden" name="returnTo" value={props.returnTo} />
          <div className="notice error">
            This will permanently delete the selected inventory lot and recalculate the component stock summary.
          </div>
          <button className="button danger" type="submit">
            Confirm delete
          </button>
        </form>
      </ModalTrigger>
    </div>
  );
}
