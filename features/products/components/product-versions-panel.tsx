import Link from "next/link";
import { createVersionAction } from "@/lib/runtime/actions";
import type { ProductDetail } from "@/lib/types/domain";
import { Badge, EmptyState, ModalTrigger, Panel } from "@/shared/ui";

export function ProductVersionsPanel(props: { product: ProductDetail | null }) {
  const { product } = props;

  return (
    <Panel
      title="Versions"
      description="Open a version to view attachments and BOM related data."
      actions={
        product ? (
          <ModalTrigger buttonLabel="Add version" buttonClassName="button primary" title="Add version">
            <form action={createVersionAction} className="stack">
              <input type="hidden" name="product_id" value={product.id} />
              <input className="input" name="version_number" placeholder="Version number, e.g. v3" />
              <button className="button primary" type="submit">
                Create version
              </button>
            </form>
          </ModalTrigger>
        ) : null
      }
    >
      {!product?.versions.length ? (
        <EmptyState>No versions found for this product.</EmptyState>
      ) : (
        <div className="stack">
          {product.versions.map((version) => (
            <div key={version.id} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <Badge>{version.version_number}</Badge>
              <Link className="button-link subtle" href={`/versions/${version.id}`}>
                Open version
              </Link>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
