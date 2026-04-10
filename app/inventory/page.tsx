import { InventoryFiltersPanel } from "@/features/inventory/components/inventory-filters-panel";
import { InventoryRowsPanel } from "@/features/inventory/components/inventory-rows-panel";
import { getInventoryOverview, getPartCatalog } from "@/lib/supabase/queries/index";
import { Notice, PageHeader } from "@/shared/ui";

export default async function InventoryPage(props: {
  searchParams?: Promise<{ category?: string; search?: string }>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const { items, error } = await getInventoryOverview({
    category: searchParams.category,
    search: searchParams.search
  });
  const { items: parts } = await getPartCatalog();

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
          </>
        }
      />

      {error ? <Notice error>{error}</Notice> : null}

      <InventoryFiltersPanel
        defaultSearch={searchParams.search}
        defaultCategory={searchParams.category}
      />
      <InventoryRowsPanel items={items} parts={parts} />

    </div>
  );
}
