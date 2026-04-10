import Link from "next/link";
import { PartPicker } from "@/features/parts/components/part-picker";
import {
  attachPartToVersionAction,
  removePartFromVersionAction,
  updatePartAction
} from "@/lib/supabase/actions/index";
import type { ComponentListItem, VersionDetail } from "@/lib/types/domain";
import { EmptyState, ModalTrigger, Panel } from "@/shared/ui";

export function VersionPartsPanel(props: {
  versionId: string;
  version: VersionDetail | null;
  allParts: ComponentListItem[];
}) {
  return (
    <Panel
      title="Components"
      description="Components used in this version, grouped by component with merged references and calculated quantity."
      actions={
        <ModalTrigger buttonLabel="Add component" buttonClassName="button primary" title="Add component to version">
          <form action={attachPartToVersionAction} className="stack">
            <input type="hidden" name="version_id" value={props.versionId} />
            <PartPicker
              parts={props.allParts.map((part) => ({
                id: part.id,
                name: part.name,
                category: part.category,
                value: part.value
              }))}
            />
            <input
              className="input"
              type="text"
              name="references"
              placeholder="References, e.g. R1, R2, R3"
            />
            <button className="button primary" type="submit">
              Add component
            </button>
          </form>
        </ModalTrigger>
      }
    >
      {!props.version?.components.length ? (
        <EmptyState>No components found for this version.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Component</th>
                <th>Category</th>
                <th>Producer</th>
                <th>Value</th>
                <th>References</th>
                <th>Qty</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {props.version.components.map((row) => (
                <tr key={row.component.id}>
                  <td>{row.component.name}</td>
                  <td>{row.component.category}</td>
                  <td>{row.component.producer}</td>
                  <td>{row.component.value ?? "-"}</td>
                  <td>{row.references.join(", ")}</td>
                  <td>{row.quantity}</td>
                  <td>
                    <div className="action-row">
                      <Link className="button-link subtle" href={`/components/${row.component.id}`}>
                        View
                      </Link>
                      <ModalTrigger buttonLabel="Edit" title={`Edit ${row.component.name}`}>
                        <form action={updatePartAction} className="stack">
                          <input type="hidden" name="id" value={row.component.id} />
                          <input type="hidden" name="versionId" value={props.versionId} />
                          <div className="field-group">
                            <label htmlFor={`version-part-sku-${row.component.id}`}>SKU</label>
                            <input id={`version-part-sku-${row.component.id}`} className="input" name="sku" defaultValue={row.component.sku} />
                          </div>
                          <div className="field-group">
                            <label htmlFor={`version-part-name-${row.component.id}`}>Name</label>
                            <input id={`version-part-name-${row.component.id}`} className="input" name="name" defaultValue={row.component.name} />
                          </div>
                          <div className="field-group">
                            <label htmlFor={`version-part-category-${row.component.id}`}>Category</label>
                            <input id={`version-part-category-${row.component.id}`} className="input" name="category" defaultValue={row.component.category} />
                          </div>
                          <div className="field-group">
                            <label htmlFor={`version-part-producer-${row.component.id}`}>Producer</label>
                            <input id={`version-part-producer-${row.component.id}`} className="input" name="producer" defaultValue={row.component.producer} />
                          </div>
                          <div className="field-group">
                            <label htmlFor={`version-part-value-${row.component.id}`}>Value</label>
                            <input id={`version-part-value-${row.component.id}`} className="input" name="value" defaultValue={row.component.value ?? ""} />
                          </div>
                          <div className="field-group">
                            <label htmlFor={`version-part-safety-${row.component.id}`}>Safety stock</label>
                            <input id={`version-part-safety-${row.component.id}`} className="input" type="number" min="0" step="1" name="safety_stock" defaultValue={row.component.safety_stock} />
                          </div>
                          <button className="button primary" type="submit">
                            Save changes
                          </button>
                        </form>
                      </ModalTrigger>
                      <ModalTrigger buttonLabel="Remove" buttonClassName="button danger" title={`Remove ${row.component.name} from this version?`}>
                        <form action={removePartFromVersionAction} className="stack">
                          <input type="hidden" name="version_id" value={props.versionId} />
                          <input type="hidden" name="component_id" value={row.component.id} />
                          <div className="notice error">
                            This removes all references for this component from the current version.
                          </div>
                          <button className="button danger" type="submit">
                            Confirm remove
                          </button>
                        </form>
                      </ModalTrigger>
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
