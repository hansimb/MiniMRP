import { PartsFiltersPanel } from "@/features/parts/components/parts-filters-panel";
import { PartsListPanel } from "@/features/parts/components/parts-list-panel";
import { getPartCatalog } from "@/lib/supabase/queries/index";
import { Notice, PageHeader } from "@/shared/ui";

export default async function ComponentsPage(props: {
  searchParams?: Promise<{ category?: string; search?: string }>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const { items, error } = await getPartCatalog({
    category: searchParams.category,
    search: searchParams.search
  });

  return (
    <div className="page">
      <PageHeader
        title="Components"
        description="Central component view with filters, categorization, and export entry points."
        actions={
          <>
            <a
              className="button-link subtle"
              href={`/api/export/components?category=${encodeURIComponent(searchParams.category ?? "")}&search=${encodeURIComponent(searchParams.search ?? "")}`}
            >
              Export CSV
            </a>
          </>
        }
      />

      {error ? <Notice error>{error}</Notice> : null}

      <PartsFiltersPanel
        defaultSearch={searchParams.search}
        defaultCategory={searchParams.category}
      />
      <PartsListPanel parts={items} />
    </div>
  );
}
