import { InventoryAdjustForm } from "@/features/inventory/components/inventory-adjust-form";
import Link from "next/link";
import { InventoryEditForm } from "@/features/inventory/components/inventory-edit-form";
import { PartPicker } from "@/features/parts/components/part-picker";
import { addInventoryAction } from "@/lib/runtime/actions";
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
      description="Component-level inventory summary derived from remaining inventory lots."
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
              <label htmlFor="inventory-quantity">Quantity received</label>
              <input id="inventory-quantity" className="input" type="number" step="0.0001" min="0.0001" name="quantity_received" required />
            </div>
            <div className="field-group">
              <label htmlFor="inventory-price">Unit cost</label>
              <input id="inventory-price" className="input" type="number" step="0.0001" min="0" name="unit_cost" required />
            </div>
            <div className="field-group">
              <label htmlFor="inventory-received-at">Received at</label>
              <input id="inventory-received-at" className="input" type="datetime-local" name="received_at" />
            </div>
            <div className="field-group">
              <label htmlFor="inventory-source">Source</label>
              <input id="inventory-source" className="input" name="source" placeholder="Supplier, PO, import" />
            </div>
            <div className="field-group">
              <label htmlFor="inventory-notes">Notes</label>
              <input id="inventory-notes" className="input" name="notes" placeholder="Optional notes" />
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
                <th>SKU</th>
                <th>Component</th>
                <th>Category</th>
                <th>Producer</th>
                <th>Value</th>
                <th>Safety stock</th>
                <th>Quantity</th>
                <th>Weighted avg price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {props.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.component?.sku ?? "-"}</td>
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
                      <ModalTrigger buttonLabel="Use stock" title={`Use stock: ${item.component?.name ?? item.id}`}>
                        <InventoryAdjustForm
                          componentId={item.component_id}
                          componentName={item.component?.name ?? item.id}
                          currentQuantity={item.quantity_available}
                          returnTo="/inventory"
                          formId={`inventory-adjust-${item.id}`}
                        />
                      </ModalTrigger>
                      <ModalTrigger buttonLabel="Edit" title={`Update settings: ${item.component?.name ?? item.id}`}>
                        <InventoryEditForm
                          inventoryId={item.id}
                          componentId={item.component_id}
                          componentName={item.component?.name ?? item.id}
                          currentQuantity={item.quantity_available}
                          currentSafetyStock={item.component?.safety_stock ?? 0}
                        />
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
