import { notFound } from "next/navigation";
import { Badge, EmptyState, Notice, PageHeader, Panel } from "@/components/ui";
import { getComponentById } from "@/lib/supabase/queries";

export default async function ComponentDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const { item, error } = await getComponentById(params.id);

  if (!item && !error) {
    notFound();
  }

  return (
    <div className="page">
      <PageHeader
        title={item?.name ?? "Component"}
        description="Component detail page with inventory, supplier links, and version usage."
        actions={
          <button className="button" disabled>
            Delete component
          </button>
        }
      />

      {error ? <Notice error>{error}</Notice> : null}

      <div className="two-column">
        <Panel title="Component" description="Essential component information.">
          <div className="detail-list">
            <div className="detail-item">
              <span>Name</span>
              <strong>{item?.name ?? "-"}</strong>
            </div>
            <div className="detail-item">
              <span>Category</span>
              <strong>{item?.category ?? "-"}</strong>
            </div>
            <div className="detail-item">
              <span>Producer</span>
              <strong>{item?.producer ?? "-"}</strong>
            </div>
            <div className="detail-item">
              <span>Value</span>
              <strong>{item?.value ?? "-"}</strong>
            </div>
          </div>
        </Panel>

        <Panel title="Inventory" description="Current stock and price for this component.">
          {item?.inventory ? (
            <div className="detail-list">
              <div className="detail-item">
                <span>Quantity available</span>
                <strong>{item.inventory.quantity_available}</strong>
              </div>
              <div className="detail-item">
                <span>Purchase price</span>
                <strong>{item.inventory.purchase_price ?? "-"}</strong>
              </div>
            </div>
          ) : (
            <EmptyState>No inventory row linked to this component.</EmptyState>
          )}
        </Panel>
      </div>

      <Panel title="Suppliers" description="Seller links for the current component.">
        {item?.sellers.length ? (
          <div className="stack">
            {item.sellers.map(({ seller, product_url }) => (
              <div key={seller.id} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div className="stack">
                  <strong>{seller.name}</strong>
                  <span className="muted small">Lead time: {seller.lead_time ?? "-"} days</span>
                </div>
                {product_url ? (
                  <a className="button-link subtle" href={product_url} target="_blank" rel="noreferrer">
                    Open link
                  </a>
                ) : (
                  <Badge>No link</Badge>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>No sellers linked yet.</EmptyState>
        )}
      </Panel>

      <Panel title="Used in versions" description="Where this component appears in BOM references.">
        {item?.references.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {item.references.map((reference) => (
                  <tr key={`${reference.version?.id ?? "unknown"}-${reference.reference}`}>
                    <td>{reference.version?.version_number ?? "-"}</td>
                    <td>{reference.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>This component is not linked to any BOM rows yet.</EmptyState>
        )}
      </Panel>
    </div>
  );
}

