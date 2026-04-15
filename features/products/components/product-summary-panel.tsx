/* eslint-disable @next/next/no-img-element */
import { removeProductImageAction } from "@/lib/supabase/actions";
import { Panel } from "@/shared/ui";
import type { ProductDetail } from "@/lib/types/domain";
import { ModalTrigger, Notice } from "@/shared/ui";
import { ProductImageUploadForm } from "./product-image-upload-form";

export function ProductSummaryPanel(props: {
  product: ProductDetail | null;
  imageError?: string | null;
}) {
  const { product } = props;

  return (
    <Panel
      title="Product"
      description="Basic product information and the current main image."
      actions={
        product ? (
          <ModalTrigger
            buttonLabel={product.image_path ? "Replace image" : "Upload image"}
            buttonClassName="button primary"
            title={`Update image for ${product.name}`}
          >
            <ProductImageUploadForm productId={product.id} />
          </ModalTrigger>
        ) : null
      }
    >
      <div className="stack">
        {props.imageError ? <Notice error>{props.imageError}</Notice> : null}
        <div className="image-frame">
          {product?.image ? (
            <img src={product.image} alt={product.name} />
          ) : (
            <span className="muted">No image</span>
          )}
        </div>
        {product?.image ? (
          <a className="button-link subtle" href={product.image} target="_blank" rel="noreferrer">
            Open image
          </a>
        ) : null}
        {product?.image_path ? (
          <form action={removeProductImageAction}>
            <input type="hidden" name="id" value={product.id} />
            <button className="button danger" type="submit">
              Remove image
            </button>
          </form>
        ) : null}
        <div className="detail-list">
          <div className="detail-item">
            <span>Name</span>
            <strong>{product?.name ?? "Unknown product"}</strong>
          </div>
          <div className="detail-item">
            <span>Versions</span>
            <strong>{product?.versions.length ?? 0}</strong>
          </div>
        </div>
      </div>
    </Panel>
  );
}
