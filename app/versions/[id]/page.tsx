import { notFound } from "next/navigation";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/ui";
import { ImportPreview } from "@/features/import/import-preview";
import { getVersionById } from "@/lib/supabase/queries";

export default async function VersionDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const { item, error } = await getVersionById(params.id);

  if (!item && !error) {
    notFound();
  }

  return (
    <div className="page">
      <PageHeader
        title={item ? `${item.product?.name ?? "Product"} - ${item.version_number}` : "Version"}
        description="Version detail page with attachments, BOM references, and BOM import entry point."
      />

      {error ? <Notice error>{error}</Notice> : null}

      <div className="two-column">
        <Panel title="Attachments" description="Files linked to this version.">
          {item?.attachments.length ? (
            <div className="stack">
              {item.attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={attachment.file_path}
                  target="_blank"
                  rel="noreferrer"
                  className="button-link subtle"
                >
                  {attachment.file_path}
                </a>
              ))}
            </div>
          ) : (
            <EmptyState>No attachments found for this version.</EmptyState>
          )}
        </Panel>

        <Panel title="Version info" description="Basic version-specific information.">
          <div className="detail-list">
            <div className="detail-item">
              <span>Product</span>
              <strong>{item?.product?.name ?? "-"}</strong>
            </div>
            <div className="detail-item">
              <span>Version</span>
              <strong>{item?.version_number ?? "-"}</strong>
            </div>
            <div className="detail-item">
              <span>BOM rows</span>
              <strong>{item?.references.length ?? 0}</strong>
            </div>
          </div>
        </Panel>
      </div>

      <Panel
        title="BOM references"
        description="Mapped references for this version. The import workflow should map user-defined source columns into this structure."
      >
        {!item?.references.length ? (
          <EmptyState>No BOM references found yet.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Component</th>
                  <th>Category</th>
                  <th>Producer</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {item.references.map((reference) => (
                  <tr key={reference.reference}>
                    <td>{reference.reference}</td>
                    <td>{reference.component?.name ?? "-"}</td>
                    <td>{reference.component?.category ?? "-"}</td>
                    <td>{reference.component?.producer ?? "-"}</td>
                    <td>{reference.component?.value ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <ImportPreview
        title="Import BOM from CSV or Excel"
        description="This is the first import entry point for version-specific BOM data."
        mappingHint="Expected target fields include version reference, component mapping, and optional user-defined source columns. Next implementation step is persisting mapped rows to Supabase."
      />
    </div>
  );
}

