import Link from "next/link";
import { PartPicker } from "@/features/parts/components/part-picker";
import {
  attachPartToVersionAction,
  removePartFromVersionAction,
  updateVersionComponentReferencesAction
} from "@/lib/runtime/actions";
import type { ComponentListItem, VersionDetail } from "@/lib/types/domain";
import { EmptyState, ModalTrigger, Panel } from "@/shared/ui";

export function VersionPartsPanel(props: {
  versionId: string;
  version: VersionDetail | null;
  allParts: ComponentListItem[];
}) {
  return (
    <Panel
      title="BOM list"
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
                <th>SKU</th>
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
                  <td>{row.component.sku}</td>
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
                      <ModalTrigger buttonLabel="Edit references" title={`Edit references for ${row.component.name}`}>
                        <form action={updateVersionComponentReferencesAction} className="stack">
                          <input type="hidden" name="version_id" value={props.versionId} />
                          <input type="hidden" name="component_id" value={row.component.id} />
                          <div className="field-group">
                            <label htmlFor={`version-part-references-${row.component.id}`}>References</label>
                            <input
                              id={`version-part-references-${row.component.id}`}
                              className="input"
                              name="references"
                              defaultValue={row.references.join(", ")}
                              placeholder="References, e.g. R1, R2, R3"
                            />
                          </div>
                          <div className="small muted">Quantity is derived from the number of references in this list.</div>
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
