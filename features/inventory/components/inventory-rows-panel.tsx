import Link from "next/link";
import { PartPicker } from "@/features/parts/components/part-picker";
import {
  addInventoryAction,
  adjustInventoryDeltaAction,
  deleteInventoryAction
} from "@/lib/supabase/actions/index";
import type { ComponentListItem, ComponentMaster, InventoryItem } from "@/lib/types/domain";
import { EmptyState, ModalTrigger, Panel } from "@/shared/ui";

type InventoryRow = InventoryItem & { component: ComponentMaster | null };

export function InventoryRowsPanel(props: {
  items: InventoryRow[];
  parts: ComponentListItem[];
}) {
  return (
    <Panel
      title="Inventory rows"
      description="Essential inventory data from the current schema."
      actions={
        <ModalTrigger buttonLabel="Add inventory" buttonClassName="button primary" title="Add inventory">
          <form action={addInventoryAction} className="stack">
            <PartPicker
              parts={props.parts.map((part) => ({
                id: part.id,
                name: part.name,
                category: part.category,
                value: part.value
              }))}
              categoryFieldId="inventory-part-category-filter"
              componentFieldId="inventory-component"
            />
            <div className="field-group">
              <label htmlFor="inventory-quantity">Quantity available</label>
              <input id="inventory-quantity" className="input" type="number" step="1" min="0" name="quantity_available" />
            </div>
            <div className="field-group">
              <label htmlFor="inventory-price">Purchase price</label>
              <input id="inventory-price" className="input" type="number" step="0.0001" min="0" name="purchase_price" />
            </div>
            <button className="button primary" type="submit">
              Add inventory
            </button>
          </form>
        </ModalTrigger>
      }
    >
      {props.items.length === 0 ? (
        <EmptyState>No inventory rows found.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Component</th>
                <th>Category</th>
                <th>Producer</th>
                <th>Value</th>
                <th>Safety stock</th>
                <th>Quantity</th>
                <th>Purchase price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {props.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.component?.name ?? "-"}</td>
                  <td>{item.component?.category ?? "-"}</td>
                  <td>{item.component?.producer ?? "-"}</td>
                  <td>{item.component?.value ?? "-"}</td>
                  <td>{item.component?.safety_stock ?? "-"}</td>
                  <td>{item.quantity_available}</td>
                  <td>{item.purchase_price ?? "-"}</td>
                  <td>
                    <div className="action-row">
                      <Link className="button-link subtle" href={`/components/${item.component_id}`}>
                        View
                      </Link>
                      <ModalTrigger buttonLabel="Edit" title={`Adjust stock: ${item.component?.name ?? item.id}`}>
                        <form action={adjustInventoryDeltaAction} className="stack">
                          <input type="hidden" name="component_id" value={item.component_id} />
                          <input type="hidden" name="current_quantity" value={item.quantity_available} />
                          <div className="small muted">Current quantity: {item.quantity_available}</div>
                          <div className="field-group">
                            <label htmlFor={`inventory-mode-${item.id}`}>Action</label>
                            <select id={`inventory-mode-${item.id}`} className="select" name="mode" defaultValue="add">
                              <option value="add">Add</option>
                              <option value="remove">Remove</option>
                            </select>
                          </div>
                          <div className="field-group">
                            <label htmlFor={`inventory-amount-${item.id}`}>Amount</label>
                            <input id={`inventory-amount-${item.id}`} className="input" type="number" min="0" step="1" name="amount" placeholder="Enter quantity" />
                          </div>
                          <button className="button primary" type="submit">
                            Update stock
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
                        buttonAriaLabel={`Delete inventory row for ${item.component?.name ?? item.id}`}
                        buttonClassName="button danger"
                        title={`Delete inventory row: ${item.component?.name ?? item.id}?`}
                      >
                        <form action={deleteInventoryAction} className="stack">
                          <input type="hidden" name="id" value={item.id} />
                          <div className="notice error">
                            This removes the inventory row for this component.
                          </div>
                          <button className="button danger" type="submit">
                            Confirm delete
                          </button>
                        </form>
                      </ModalTrigger>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
