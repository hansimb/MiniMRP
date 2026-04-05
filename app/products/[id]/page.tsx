/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState, Notice, PageHeader, Panel, Badge } from "@/components/ui";
import { getProductById } from "@/lib/supabase/queries";

export default async function ProductDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const { item, error } = await getProductById(params.id);

  if (!item && !error) {
    notFound();
  }

  return (
    <div className="page">
      <PageHeader
        title={item?.name ?? "Product"}
        description="Product detail view with the product image and list of versions."
      />

      {error ? <Notice error>{error}</Notice> : null}

      <div className="two-column">
        <Panel title="Product" description="Basic product information.">
          <div className="stack">
            <div className="image-frame">
              {item?.image ? (
                <img src={item.image} alt={item.name} />
              ) : (
                <span className="muted">No image</span>
              )}
            </div>
            <div className="detail-list">
              <div className="detail-item">
                <span>Name</span>
                <strong>{item?.name ?? "Unknown product"}</strong>
              </div>
              <div className="detail-item">
                <span>Versions</span>
                <strong>{item?.versions.length ?? 0}</strong>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Versions" description="Open a version to view attachments and BOM related data.">
          {!item?.versions.length ? (
            <EmptyState>No versions found for this product.</EmptyState>
          ) : (
            <div className="stack">
              {item.versions.map((version) => (
                <div
                  key={version.id}
                  style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
                >
                  <Badge>{version.version_number}</Badge>
                  <Link className="button-link subtle" href={`/versions/${version.id}`}>
                    Open version
                  </Link>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
