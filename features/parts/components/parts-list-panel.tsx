import Link from "next/link";
import { createPartAction } from "@/lib/runtime/actions";
import type { ComponentListItem } from "@/lib/types/domain";
import { EmptyState, ModalTrigger, Panel } from "@/shared/ui";

export function PartsListPanel(props: {
  parts: ComponentListItem[];
}) {
  return (
    <Panel
      title="All components"
      description="Grouped by simple category field from the schema."
      actions={
        <ModalTrigger buttonLabel="Add component" buttonClassName="button primary" title="Add component">
          <form action={createPartAction} className="stack">
            <div className="toolbar">
              <input className="input" name="sku" placeholder="SKU" />
              <input className="input" name="name" placeholder="Component name" />
              <input className="input" name="category" placeholder="Category" />
              <input className="input" name="producer" placeholder="Producer" />
              <input className="input" name="value" placeholder="Value" />
            </div>
            <div className="toolbar">
              <input className="input" name="seller_name" placeholder="Seller name (optional)" />
              <input className="input" name="base_url" placeholder="Base URL (optional)" />
              <input className="input" name="update_link" placeholder="Exact product URL (optional)" />
            </div>
            <button className="button primary" type="submit">
              Add component
            </button>
          </form>
        </ModalTrigger>
      }
    >
      {props.parts.length === 0 ? (
        <EmptyState>No components found.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>Category</th>
                <th>Producer</th>
                <th>Value</th>
                <th>Safety stock</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {props.parts.map((part) => (
                <tr key={part.id}>
                  <td>{part.sku}</td>
                  <td>{part.name}</td>
                  <td>{part.category}</td>
                  <td>{part.producer}</td>
                  <td>{part.value ?? "-"}</td>
                  <td>{part.safety_stock}</td>
                  <td>
                    <Link className="button-link subtle" href={`/components/${part.id}`}>
                      Open
                    </Link>
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
