import Link from "next/link";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/ui";
import { ImportPreview } from "@/features/import/import-preview";
import { getComponents } from "@/lib/supabase/queries";

export default async function ComponentsPage(props: {
  searchParams?: Promise<{ category?: string; search?: string }>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const { items, error } = await getComponents({
    category: searchParams.category,
    search: searchParams.search
  });

  return (
    <div className="page">
      <PageHeader
        title="Components"
        description="Central component view with filters, categorization, import and export entry points."
        actions={
          <>
            <a
              className="button-link subtle"
              href={`/api/export/components?category=${encodeURIComponent(searchParams.category ?? "")}&search=${encodeURIComponent(searchParams.search ?? "")}`}
            >
              Export CSV
            </a>
            <button className="button primary" disabled>
              Add component
            </button>
          </>
        }
      />

      {error ? <Notice error>{error}</Notice> : null}

      <Panel
        title="Filters"
        description="Filter the component list and use the same filter state for export."
      >
        <div className="toolbar">
          <form>
            <input
              className="input"
              type="text"
              name="search"
              placeholder="Search by name, producer, value"
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

      <Panel title="All components" description="Grouped by simple category field from the schema.">
        {items.length === 0 ? (
          <EmptyState>No components found.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Producer</th>
                  <th>Value</th>
                  <th>Stock</th>
                  <th>Price</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((component) => (
                  <tr key={component.id}>
                    <td>{component.name}</td>
                    <td>{component.category}</td>
                    <td>{component.producer}</td>
                    <td>{component.value ?? "-"}</td>
                    <td>{component.quantity_available ?? "-"}</td>
                    <td>{component.purchase_price ?? "-"}</td>
                    <td>
                      <Link className="button-link subtle" href={`/components/${component.id}`}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <ImportPreview
        title="Import components from CSV or Excel"
        description="Bulk import entry point for component master data."
        mappingHint="Next implementation step is adding field mapping UI and insert/update logic for components, sellers, and inventory rows."
      />
    </div>
  );
}

