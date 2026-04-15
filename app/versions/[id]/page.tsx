import { notFound } from "next/navigation";
import { VersionAttachmentsPanel } from "@/features/versions/components/version-attachments-panel";
import { VersionHeaderActions } from "@/features/versions/components/version-header-actions";
import { VersionInfoPanel } from "@/features/versions/components/version-info-panel";
import { VersionMrpPanel } from "@/features/versions/components/version-mrp-panel";
import { VersionPartsPanel } from "@/features/versions/components/version-parts-panel";
import { buildMrpRows, calculateVersionUnitCost, summarizeMrpRows } from "@/lib/mappers/mrp";
import { getPartCatalog, getVersionDetail } from "@/lib/supabase/queries/index";
import { Notice, PageHeader } from "@/shared/ui";

export default async function VersionDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    quantity?: string;
    entry?: string;
    bomImportError?: string;
    attachmentError?: string;
  }>;
}) {
  const params = await props.params;
  const searchParams = (await props.searchParams) ?? {};
  const { item, error } = await getVersionDetail(params.id, {
    productionEntryId: searchParams.entry ?? null
  });
  const { items: allParts } = await getPartCatalog();
  const requestedQuantity = Math.max(Number(searchParams.quantity ?? "1") || 1, 1);
  const mrpRows = buildMrpRows(item?.components ?? [], requestedQuantity);
  const mrpSummary = summarizeMrpRows(mrpRows);
  const versionUnitCost = calculateVersionUnitCost(item?.components ?? []);

  if (!item && !error) {
    notFound();
  }

  return (
    <div className="page">
      <PageHeader
        title={item ? `${item.product?.name ?? "Product"} - ${item.version_number}` : "Version"}
        description="Version detail page with attachments, BOM references, and BOM import entry point."
        actions={
          <VersionHeaderActions
            version={item}
            versionId={params.id}
            bomImportError={searchParams.bomImportError ?? null}
            allParts={allParts}
          />
        }
      />

      {error ? <Notice error>{error}</Notice> : null}
      {searchParams.bomImportError ? <Notice error>{searchParams.bomImportError}</Notice> : null}

      <div className="two-column">
        <VersionAttachmentsPanel version={item} initialError={searchParams.attachmentError ?? null} />
        <VersionInfoPanel version={item} unitCost={versionUnitCost} />
      </div>
      <VersionPartsPanel versionId={params.id} version={item} allParts={allParts} />
      <VersionMrpPanel
        versionId={params.id}
        requestedQuantity={requestedQuantity}
        hasCalculated={Boolean(searchParams.quantity)}
        rows={mrpRows}
        summary={mrpSummary}
      />
    </div>
  );
}
