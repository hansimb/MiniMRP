import { deleteVersionAction, updateVersionAction } from "@/lib/runtime/actions";
import type { ComponentListItem, VersionDetail } from "@/lib/types/domain";
import { BackLink, ModalTrigger } from "@/shared/ui";
import { VersionBomImportForm } from "./version-bom-import-form";

export function VersionHeaderActions(props: {
  version: VersionDetail | null;
  versionId: string;
  bomImportError?: string | null;
  allParts: ComponentListItem[];
}) {
  const { version, versionId, allParts } = props;

  return (
    <>
      <BackLink href={version?.product ? `/products/${version.product.id}` : "/products"} label="Back to product" />
      {version ? (
        <ModalTrigger buttonLabel="Edit version" title={`Edit ${version.version_number}`}>
          <form action={updateVersionAction} className="stack">
            <input type="hidden" name="id" value={version.id} />
            <div className="field-group">
              <label htmlFor="version-number">Version name</label>
              <input id="version-number" className="input" name="version_number" defaultValue={version.version_number} />
            </div>
            <button className="button primary" type="submit">
              Save version
            </button>
          </form>
        </ModalTrigger>
      ) : null}
      {version?.product ? (
        <ModalTrigger buttonLabel="Delete version" buttonClassName="button danger" title={`Delete ${version.version_number}?`}>
          <form action={deleteVersionAction} className="stack">
            <input type="hidden" name="id" value={version.id} />
            <input type="hidden" name="product_id" value={version.product.id} />
            <div className="notice error">
              This will delete the version and linked BOM references and attachments if cascade rules apply.
            </div>
            <button className="button danger" type="submit">
              Confirm delete
            </button>
          </form>
        </ModalTrigger>
      ) : null}
      <a className="button-link subtle" href={`/api/export/bom/${versionId}`}>
        Export BOM
      </a>
      <ModalTrigger buttonLabel="Import BOM" title="Import BOM from CSV or Excel">
        <VersionBomImportForm
          versionId={versionId}
          initialError={props.bomImportError}
          knownSkus={allParts.map((part) => part.sku)}
        />
      </ModalTrigger>
    </>
  );
}
