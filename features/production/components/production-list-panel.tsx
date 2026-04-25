import Link from "next/link";
import {
  cancelProductionEntryAction,
  completeProductionEntryAction
} from "@/lib/runtime/actions";
import type { ProductionListItem } from "@/lib/types/domain";
import { EmptyState, ModalTrigger, Panel } from "@/shared/ui";

export function ProductionListPanel(props: {
  items: ProductionListItem[];
  title: string;
  description: string;
  completed?: boolean;
}) {
  return (
    <Panel
      title={props.title}
      description={props.description}
    >
      {props.items.length === 0 ? (
        <EmptyState>
          {props.completed ? "No completed production rows yet." : "No versions are currently under production."}
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Version</th>
                <th>Qty</th>
                <th>Longest lead time</th>
                <th>{props.completed ? "Completed" : "Created"}</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {props.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.product?.name ?? "-"}</td>
                  <td>{item.version?.version_number ?? "-"}</td>
                  <td>{item.quantity}</td>
                  <td>{item.longest_lead_time ?? "-"}</td>
                  <td>{new Date(props.completed ? item.completed_at ?? item.created_at : item.created_at).toLocaleString()}</td>
                  <td>
                    <div className="action-row">
                      <Link className="button-link subtle" href={`/versions/${item.version_id}?quantity=${item.quantity}&entry=${item.id}`}>
                        Open
                      </Link>
                      <a className="button-link subtle" href={`/api/export/mrp/${item.version_id}?quantity=${item.quantity}`}>
                        Export MRP
                      </a>
                      {!props.completed ? (
                        <>
                          <ModalTrigger
                            buttonLabel="Ready"
                            buttonClassName="button primary"
                            title={`Mark ${item.product?.name ?? "production"} ready?`}
                          >
                            <form action={completeProductionEntryAction} className="stack">
                              <input type="hidden" name="production_entry_id" value={item.id} />
                              <div className="notice">
                                This will move the production entry to completed production. Any remaining net need will be consumed from inventory lots using FIFO first. If stock is still missing, completion will be blocked.
                              </div>
                              <button className="button primary" type="submit">
                                Confirm ready
                              </button>
                            </form>
                          </ModalTrigger>
                          <ModalTrigger
                            buttonLabel="Cancel"
                            buttonClassName="button danger"
                            title={`Cancel ${item.product?.name ?? "production"}?`}
                          >
                            <form action={cancelProductionEntryAction} className="stack">
                              <input type="hidden" name="production_entry_id" value={item.id} />
                              <div className="notice error">
                                This will cancel the production entry and return reserved inventory back to stock.
                              </div>
                              <button className="button danger" type="submit">
                                Confirm cancel
                              </button>
                            </form>
                          </ModalTrigger>
                        </>
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
