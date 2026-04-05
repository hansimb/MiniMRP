import { EmptyState, Notice, PageHeader, Panel } from "@/components/ui";
import { ModalTrigger } from "@/components/modal-trigger";
import { ImportPreview } from "@/features/import/import-preview";
import Link from "next/link";
import { addInventoryAction, adjustInventoryDeltaAction, deleteInventoryAction } from "@/lib/supabase/actions";
import { getComponents, getInventory } from "@/lib/supabase/queries";

export default async function InventoryPage(props: {
  searchParams?: Promise<{ category?: string; search?: string }>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const { items, error } = await getInventory({
    category: searchParams.category,
    search: searchParams.search
  });
  const { items: components } = await getComponents();

  return (
    <div className="page">
      <PageHeader
        title="Inventory"
        description="Inventory view with simple filtering and export."
        actions={
          <>
            <a
              className="button-link subtle"
              href={`/api/export/inventory?category=${encodeURIComponent(searchParams.category ?? "")}&search=${encodeURIComponent(searchParams.search ?? "")}`}
            >
              Export CSV
            </a>
            <ModalTrigger buttonLabel="Import CSV" title="Import inventory from CSV or Excel">
              <ImportPreview
                plain
                title="Import inventory from CSV or Excel"
                description="Bulk inventory import entry point."
                mappingHint="Expected target fields include component match, quantity_available and purchase_price. Next implementation step is persisting inventory rows to Supabase."
              />
            </ModalTrigger>
          </>
        }
      />

      {error ? <Notice error>{error}</Notice> : null}

      <Panel title="Filters" description="Filter inventory rows by category or search term.">
        <div className="toolbar">
          <form>
            <input
              className="input"
              type="text"
              name="search"
              placeholder="Search by component, producer, value"
              defaultValue={searchParams.search ?? ""}
            />
            <input
              className="input"
              type="text"
              name="category"
              placeholder="Category"
              defaultValue={searchParams.category ?? ""}
            />
            <button className="button subtle" type="submit">
              Apply filters
            </button>
          </form>
        </div>
      </Panel>

      <Panel
        title="Inventory rows"
        description="Essential inventory data from the current schema."
        actions={
          <ModalTrigger buttonLabel="Add inventory" buttonClassName="button primary" title="Add inventory">
            <form action={addInventoryAction} className="stack">
              <div className="field-group">
                <label htmlFor="inventory-component">Component</label>
                <select id="inventory-component" className="select" name="component_id" defaultValue="">
                  <option value="" disabled>
                    Select component
                  </option>
                  {components.map((component) => (
                    <option key={component.id} value={component.id}>
                      {component.name} - {component.category}
                    </option>
                  ))}
                </select>
              </div>
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
        {items.length === 0 ? (
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
                {items.map((item) => (
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
                        <ModalTrigger buttonLabel="X" buttonClassName="button danger" title={`Delete inventory row: ${item.component?.name ?? item.id}?`}>
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

    </div>
  );
}
