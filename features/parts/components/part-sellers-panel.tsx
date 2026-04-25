import type { ComponentDetail } from "@/lib/types/domain";
import { normalizeExternalUrl } from "@/lib/mappers/urls";
import {
  createSellerForPartAction,
  upsertPartSellerLinkAction
} from "@/lib/runtime/actions";
import { Badge, EmptyState, ModalTrigger, Panel } from "@/shared/ui";

export function PartSellersPanel(props: { part: ComponentDetail | null }) {
  const { part } = props;

  return (
    <Panel
      title="Sellers"
      description="Seller schema data relevant to this component: name, base URL, lead time, and generated or explicit product link."
      actions={
        part ? (
          <ModalTrigger buttonLabel="Add seller" buttonClassName="button primary" title="Add seller">
            <form action={createSellerForPartAction} className="stack">
              <input type="hidden" name="component_id" value={part.id} />
              <input type="hidden" name="component_name" value={part.name} />
              <div className="field-group">
                <label htmlFor="new-seller-name">Seller name</label>
                <input id="new-seller-name" className="input" name="seller_name" />
              </div>
              <div className="field-group">
                <label htmlFor="new-seller-base-url">Base URL</label>
                <input id="new-seller-base-url" className="input" name="base_url" />
              </div>
              <div className="field-group">
                <label htmlFor="new-seller-lead-time">Lead time</label>
                <input id="new-seller-lead-time" className="input" type="number" min="0" step="1" name="lead_time" />
              </div>
              <div className="field-group">
                <label htmlFor="new-seller-product-url">Explicit product URL</label>
                <input id="new-seller-product-url" className="input" name="product_url" />
              </div>
              <button className="button primary" type="submit">
                Add seller
              </button>
            </form>
          </ModalTrigger>
        ) : null
      }
    >
      {part?.sellers.length ? (
        <div className="stack">
          {part.sellers.map(({ seller, product_url }) => (
            <div key={seller.id} className="stack">
              <strong>{seller.name}</strong>
              <span className="muted small">Base URL: {seller.base_url ?? "-"}</span>
              <span className="muted small">Lead time: {seller.lead_time ?? "-"} days</span>
              <div className="action-row">
                <ModalTrigger buttonLabel="Edit" title={`Edit seller link: ${seller.name}`}>
                  <form action={upsertPartSellerLinkAction} className="stack">
                    <input type="hidden" name="component_id" value={part.id} />
                    <input type="hidden" name="seller_id" value={seller.id} />
                    <input type="hidden" name="component_name" value={part.name} />
                    <div className="field-group">
                      <label htmlFor={`seller-base-url-${seller.id}`}>Base URL</label>
                      <input id={`seller-base-url-${seller.id}`} className="input" name="base_url" defaultValue={seller.base_url ?? ""} />
                    </div>
                    <div className="field-group">
                      <label htmlFor={`seller-lead-time-${seller.id}`}>Lead time</label>
                      <input id={`seller-lead-time-${seller.id}`} className="input" type="number" min="0" step="1" name="lead_time" defaultValue={seller.lead_time ?? ""} />
                    </div>
                    <div className="field-group">
                      <label htmlFor={`seller-product-url-${seller.id}`}>Product URL</label>
                      <input id={`seller-product-url-${seller.id}`} className="input" name="product_url" defaultValue={product_url ?? ""} />
                    </div>
                    <button className="button primary" type="submit">
                      Save seller
                    </button>
                  </form>
                </ModalTrigger>
                {normalizeExternalUrl(product_url ?? seller.base_url) ? (
                  <a
                    className="button-link subtle"
                    href={normalizeExternalUrl(product_url ?? seller.base_url) ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View
                  </a>
                ) : (
                  <Badge>No link</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState>No sellers linked yet.</EmptyState>
      )}
    </Panel>
  );
}
