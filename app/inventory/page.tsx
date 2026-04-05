import { EmptyState, Notice, PageHeader, Panel } from "@/components/ui";
import { ImportPreview } from "@/features/import/import-preview";
import { getInventory } from "@/lib/supabase/queries";

export default async function InventoryPage(props: {
  searchParams?: Promise<{ category?: string; search?: string }>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const { items, error } = await getInventory({
    category: searchParams.category,
    search: searchParams.search
  });

  return (
    <div className="page">
      <PageHeader
        title="Inventory"
        description="Inventory view with simple filtering and export."
        actions={
          <a
            className="button-link subtle"
            href={`/api/export/inventory?category=${encodeURIComponent(searchParams.category ?? "")}&search=${encodeURIComponent(searchParams.search ?? "")}`}
          >
            Export CSV
          </a>
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

      <Panel title="Inventory rows" description="Essential inventory data from the current schema.">
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
                  <th>Quantity</th>
                  <th>Purchase price</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.component?.name ?? "-"}</td>
                    <td>{item.component?.category ?? "-"}</td>
                    <td>{item.component?.producer ?? "-"}</td>
                    <td>{item.component?.value ?? "-"}</td>
                    <td>{item.quantity_available}</td>
                    <td>{item.purchase_price ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <ImportPreview
        title="Import inventory from CSV or Excel"
        description="Bulk inventory import entry point."
        mappingHint="Expected target fields include component match, quantity_available and purchase_price. Next implementation step is persisting inventory rows to Supabase."
      />
    </div>
  );
}

