/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { ProductSummaryPanel } from "@/features/products/components/product-summary-panel";
import { ProductVersionsPanel } from "@/features/products/components/product-versions-panel";
import { deleteProductAction, updateProductAction } from "@/lib/runtime/actions";
import { getRuntimeQueries } from "@/lib/runtime";
import { BackLink, ModalTrigger, Notice, PageHeader } from "@/shared/ui";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ imageError?: string; deleteError?: string }>;
}) {
  const params = await props.params;
  const searchParams = (await props.searchParams) ?? {};
  const queries = await getRuntimeQueries();
  const { item, error } = await queries.getProductDetail(params.id);

  if (!item && !error) {
    notFound();
  }

  return (
    <div className="page">
      <PageHeader
        title={item?.name ?? "Product"}
        description="Product detail view with the product image and list of versions."
        actions={
          <>
            <BackLink href="/products" label="Back to products" />
            {item ? (
              <ModalTrigger buttonLabel="Edit product name" title={`Edit ${item.name}`}>
                <form action={updateProductAction} className="stack">
                  <input type="hidden" name="id" value={item.id} />
                  <input className="input" name="name" defaultValue={item.name} />
                  <button className="button primary" type="submit">
                    Save product
                  </button>
                </form>
              </ModalTrigger>
            ) : null}
            {item ? (
              <ModalTrigger buttonLabel="Delete product" buttonClassName="button danger" title={`Delete ${item.name}?`}>
                <form action={deleteProductAction} className="stack">
                  <input type="hidden" name="id" value={item.id} />
                  <div className="notice error">
                    This will permanently delete the product. Deletion is blocked if the product still has versions or production history.
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
      {searchParams.deleteError ? <Notice error>{searchParams.deleteError}</Notice> : null}

      <div className="two-column">
        <ProductSummaryPanel product={item} imageError={searchParams.imageError ?? null} />
        <ProductVersionsPanel product={item} />
      </div>
    </div>
  );
}
