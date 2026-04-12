import type { PurchasingItem } from "@/lib/types/domain";
import { normalizeExternalUrl } from "@/lib/mappers/urls";
import { updatePartSafetyStockAction, upsertPartSellerLinkAction } from "@/lib/supabase/actions/index";
import { EmptyState, ModalTrigger, Panel } from "@/shared/ui";

export function NearSafetyPanel(props: { items: PurchasingItem[] }) {
  return (
    <Panel
      title="Near safety stock"
      description="Components with inventory above zero but below 1.5x safety stock, excluding active shortages."
    >
      {props.items.length === 0 ? (
        <EmptyState>No components near safety stock.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Component</th>
                <th>Category</th>
                <th>Available</th>
                <th>Safety stock</th>
                <th>Lead time</th>
                <th>Seller</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {props.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div>{item.name}</div>
                    <div className="small muted">{item.sku}</div>
                  </td>
                  <td>{item.category}</td>
                  <td>{item.quantity_available}</td>
                  <td>{item.safety_stock}</td>
                  <td>{item.lead_time ?? "-"}</td>
                  <td>
                    {normalizeExternalUrl(item.seller_product_url ?? item.seller_base_url) ? (
                      <a
                        className="button-link subtle"
                        href={normalizeExternalUrl(item.seller_product_url ?? item.seller_base_url) ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {item.seller_name ?? "View seller"}
                      </a>
                    ) : (
                      item.seller_name ?? "-"
                    )}
                  </td>
                  <td>
                    <div className="action-row">
                      <ModalTrigger buttonLabel="Edit safety stock" title={`Edit safety stock: ${item.name}`}>
                        <form action={updatePartSafetyStockAction} className="stack">
                          <input type="hidden" name="id" value={item.id} />
                          <div className="field-group">
                            <label htmlFor={`purchasing-safety-${item.id}`}>Safety stock</label>
                            <input
                              id={`purchasing-safety-${item.id}`}
                              className="input"
                              type="number"
                              min="0"
                              step="1"
                              name="safety_stock"
                              defaultValue={item.safety_stock}
                            />
                          </div>
                          <button className="button primary" type="submit">
                            Save safety stock
                          </button>
                        </form>
                      </ModalTrigger>
                      {item.seller_id ? (
                        <ModalTrigger buttonLabel="Edit seller" title={`Edit seller link: ${item.name}`}>
                          <form action={upsertPartSellerLinkAction} className="stack">
                            <input type="hidden" name="component_id" value={item.id} />
                            <input type="hidden" name="seller_id" value={item.seller_id} />
                            <input type="hidden" name="component_name" value={item.name} />
                            <input type="hidden" name="returnTo" value="/purchasing" />
                            <div className="field-group">
                              <label htmlFor={`near-safety-base-url-${item.id}`}>Base URL</label>
                              <input id={`near-safety-base-url-${item.id}`} className="input" name="base_url" defaultValue={item.seller_base_url ?? ""} />
                            </div>
                            <div className="field-group">
                              <label htmlFor={`near-safety-lead-time-${item.id}`}>Lead time</label>
                              <input id={`near-safety-lead-time-${item.id}`} className="input" type="number" min="0" step="1" name="lead_time" defaultValue={item.lead_time ?? ""} />
                            </div>
                            <div className="field-group">
                              <label htmlFor={`near-safety-product-url-${item.id}`}>Product URL</label>
                              <input id={`near-safety-product-url-${item.id}`} className="input" name="product_url" defaultValue={item.seller_product_url ?? ""} />
                            </div>
                            <button className="button primary" type="submit">
                              Save seller
                            </button>
                          </form>
                        </ModalTrigger>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
