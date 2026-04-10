import type { ComponentDetail } from "@/lib/types/domain";
import { updatePartAction } from "@/lib/supabase/actions/index";
import { ModalTrigger, Panel } from "@/shared/ui";

export function PartDetailSummaryPanel(props: { part: ComponentDetail | null }) {
  const { part } = props;

  return (
    <Panel title="Component" description="Edit the component master here to update the same component everywhere.">
      <div className="detail-list">
        <div className="detail-item">
          <span>SKU</span>
          <strong>{part?.sku ?? "-"}</strong>
        </div>
        <div className="detail-item">
          <span>Name</span>
          <strong>{part?.name ?? "-"}</strong>
        </div>
        <div className="detail-item">
          <span>Category</span>
          <strong>{part?.category ?? "-"}</strong>
        </div>
        <div className="detail-item">
          <span>Producer</span>
          <strong>{part?.producer ?? "-"}</strong>
        </div>
        <div className="detail-item">
          <span>Value</span>
          <strong>{part?.value ?? "-"}</strong>
        </div>
        {part ? (
          <ModalTrigger buttonLabel="Edit" title={`Edit ${part.name}`}>
            <form action={updatePartAction} className="stack">
              <input type="hidden" name="id" value={part.id} />
              <div className="field-group">
                <label htmlFor="component-sku">SKU</label>
                <input id="component-sku" className="input" name="sku" defaultValue={part.sku} />
              </div>
              <div className="field-group">
                <label htmlFor="component-name">Name</label>
                <input id="component-name" className="input" name="name" defaultValue={part.name} />
              </div>
              <div className="field-group">
                <label htmlFor="component-category">Category</label>
                <input id="component-category" className="input" name="category" defaultValue={part.category} />
              </div>
              <div className="field-group">
                <label htmlFor="component-producer">Producer</label>
                <input id="component-producer" className="input" name="producer" defaultValue={part.producer} />
              </div>
              <div className="field-group">
                <label htmlFor="component-value">Value</label>
                <input id="component-value" className="input" name="value" defaultValue={part.value ?? ""} />
              </div>
              <div className="field-group">
                <label htmlFor="component-safety-stock">Safety stock</label>
                <input id="component-safety-stock" className="input" type="number" min="0" step="1" name="safety_stock" defaultValue={part.safety_stock} />
              </div>
              <button className="button primary" type="submit">
                Save changes
              </button>
            </form>
          </ModalTrigger>
        ) : null}
      </div>
    </Panel>
  );
}
