import { Panel, SearchFilterForm } from "@/shared/ui";

export function InventoryFiltersPanel(props: {
  defaultSearch?: string;
  defaultCategory?: string;
}) {
  return (
    <Panel title="Filters" description="Filter inventory rows by category or search term.">
      <div className="toolbar">
        <SearchFilterForm
          defaultSearch={props.defaultSearch}
          defaultCategory={props.defaultCategory}
          searchPlaceholder="Search by SKU, component, producer, value"
        />
      </div>
    </Panel>
  );
}
