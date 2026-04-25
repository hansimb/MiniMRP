import { notFound } from "next/navigation";
import { PartDetailSummaryPanel } from "@/features/parts/components/part-detail-summary-panel";
import { PartInventoryPanel } from "@/features/parts/components/part-inventory-panel";
import { PartInventoryLotsPanel } from "@/features/parts/components/part-inventory-lots-panel";
import { PartSellersPanel } from "@/features/parts/components/part-sellers-panel";
import { PartUsagePanel } from "@/features/parts/components/part-usage-panel";
import { deletePartAction } from "@/lib/runtime/actions";
import { getRuntimeQueries } from "@/lib/runtime";
import { BackLink, ModalTrigger, Notice, PageHeader } from "@/shared/ui";

export default async function ComponentDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const queries = await getRuntimeQueries();
  const { item, error } = await queries.getPartDetail(params.id);

  if (!item && !error) {
    notFound();
  }

  return (
    <div className="page">
      <PageHeader
        title={item?.name ?? "Component"}
        description="Component detail page with inventory, supplier links, and version usage."
        actions={
          <>
            <BackLink href="/components" label="Back to components" />
            {item ? (
              <ModalTrigger buttonLabel="Delete component" buttonClassName="button danger" title={`Delete ${item.name}?`}>
                <form action={deletePartAction} className="stack">
                  <input type="hidden" name="id" value={item.id} />
                  <div className="notice error">
                    This will remove the component and linked rows that depend on database cascade rules.
                  </div>
                  <button className="button danger" type="submit">
                    Confirm delete
                  </button>
                </form>
              </ModalTrigger>
            ) : null}
          </>
        }
      />

      {error ? <Notice error>{error}</Notice> : null}

      <div className="two-column">
        <PartDetailSummaryPanel part={item} />
        <PartInventoryPanel part={item} />
      </div>
      <PartSellersPanel part={item} />
      <PartUsagePanel part={item} />
      <PartInventoryLotsPanel part={item} />
    </div>
  );
}
