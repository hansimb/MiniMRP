import type { PurchasingItem } from "@/lib/types/domain";
import { normalizeExternalUrl } from "@/lib/mappers/urls";
import { upsertPartSellerLinkAction } from "@/lib/supabase/actions/index";
import { EmptyState, ModalTrigger, Panel } from "@/shared/ui";

export function CurrentShortagesPanel(props: { shortages: PurchasingItem[] }) {
  return (
    <Panel
      title="Current shortages"
      description="Gross requirement shows total active production demand. Net need is the remaining uncovered shortage after current inventory is considered."
    >
      {props.shortages.length === 0 ? (
        <EmptyState>No current shortages.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Component</th>
                <th>Category</th>
                <th>Gross requirement</th>
                <th>Reserved</th>
                <th>Net need</th>
                <th>Available</th>
                <th>Safety stock</th>
                <th>Recommended order</th>
                <th>Lead time</th>
                <th>Seller</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {props.shortages.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div>{item.name}</div>
                    <div className="small muted">{item.sku}</div>
                  </td>
                  <td>{item.category}</td>
                  <td>{item.gross_requirement}</td>
                  <td>{item.reserved_inventory}</td>
                  <td>{item.net_need}</td>
                  <td>{item.quantity_available}</td>
                  <td>{item.safety_stock}</td>
                  <td>{item.recommended_order_quantity}</td>
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
                    {item.seller_id ? (
                      <ModalTrigger buttonLabel="Edit seller" title={`Edit seller link: ${item.name}`}>
                        <form action={upsertPartSellerLinkAction} className="stack">
                          <input type="hidden" name="component_id" value={item.id} />
                          <input type="hidden" name="seller_id" value={item.seller_id} />
                          <input type="hidden" name="component_name" value={item.name} />
                          <input type="hidden" name="returnTo" value="/purchasing" />
                          <div className="field-group">
                            <label htmlFor={`purchasing-base-url-${item.id}`}>Base URL</label>
                            <input id={`purchasing-base-url-${item.id}`} className="input" name="base_url" defaultValue={item.seller_base_url ?? ""} />
                          </div>
                          <div className="field-group">
                            <label htmlFor={`purchasing-lead-time-${item.id}`}>Lead time</label>
                            <input id={`purchasing-lead-time-${item.id}`} className="input" type="number" min="0" step="1" name="lead_time" defaultValue={item.lead_time ?? ""} />
                          </div>
                          <div className="field-group">
                            <label htmlFor={`purchasing-product-url-${item.id}`}>Product URL</label>
                            <input id={`purchasing-product-url-${item.id}`} className="input" name="product_url" defaultValue={item.seller_product_url ?? ""} />
                          </div>
                          <button className="button primary" type="submit">
                            Save seller
                          </button>
                        </form>
                      </ModalTrigger>
                    ) : (
                      "-"
                    )}
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
