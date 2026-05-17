import type { ProductionShortageGroup } from "@/lib/types/domain";
import { normalizeExternalUrl } from "@/lib/mappers/urls";
import { upsertPartSellerLinkAction } from "@/lib/runtime/actions";
import { EmptyState, ModalTrigger, Panel } from "@/shared/ui";

export function CurrentShortagesPanel(props: { shortages: ProductionShortageGroup[] }) {
  return (
    <Panel
      title="Production shortages"
      description="Shortages grouped by active production entry. Net need is the missing quantity for that specific build."
    >
      {props.shortages.length === 0 ? (
        <EmptyState>No production shortages.</EmptyState>
      ) : (
        <div className="production-shortage-groups">
          {props.shortages.map((group) => (
            <section key={group.production_entry_id} className="production-shortage-card">
              <div className="production-shortage-card-head">
                <div className="production-shortage-card-titleblock">
                  <strong className="production-shortage-card-title">{group.product_name}</strong>
                  <div className="small muted">Version {group.version_number}</div>
                </div>
                <div className="production-shortage-card-meta">
                  <span className="badge">{group.build_quantity} pcs</span>
                  <span className="badge">{group.items.length} shortage items</span>
                </div>
              </div>
              <div className="production-shortage-card-subhead small muted">{group.label}</div>
              <div className="table-wrap production-shortage-table-wrap">
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
                    {group.items.map((item) => (
                      <tr key={`${group.production_entry_id}-${item.id}`}>
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
                                  <label htmlFor={`purchasing-base-url-${group.production_entry_id}-${item.id}`}>Base URL</label>
                                  <input id={`purchasing-base-url-${group.production_entry_id}-${item.id}`} className="input" name="base_url" defaultValue={item.seller_base_url ?? ""} />
                                </div>
                                <div className="field-group">
                                  <label htmlFor={`purchasing-lead-time-${group.production_entry_id}-${item.id}`}>Lead time</label>
                                  <input id={`purchasing-lead-time-${group.production_entry_id}-${item.id}`} className="input" type="number" min="0" step="1" name="lead_time" defaultValue={item.lead_time ?? ""} />
                                </div>
                                <div className="field-group">
                                  <label htmlFor={`purchasing-product-url-${group.production_entry_id}-${item.id}`}>Product URL</label>
                                  <input id={`purchasing-product-url-${group.production_entry_id}-${item.id}`} className="input" name="product_url" defaultValue={item.seller_product_url ?? ""} />
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
            </section>
          ))}
        </div>
      )}
    </Panel>
  );
}
