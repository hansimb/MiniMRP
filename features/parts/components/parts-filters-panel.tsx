import { Panel, SearchFilterForm } from "@/shared/ui";

export function PartsFiltersPanel(props: {
  defaultSearch?: string;
  defaultCategory?: string;
}) {
  return (
    <Panel title="Filters" description="Filter the component list and use the same filter state for export.">
      <div className="toolbar">
        <SearchFilterForm
          defaultSearch={props.defaultSearch}
          defaultCategory={props.defaultCategory}
          searchPlaceholder="Search by SKU, name, producer, value"
        />
      </div>
    </Panel>
  );
}
