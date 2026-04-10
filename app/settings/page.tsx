import { MasterDataImportPanel } from "@/features/import/master-data-import-panel";
import { getAppSettings } from "@/lib/supabase/queries/index";
import { updateDefaultSafetyStockAction } from "@/lib/supabase/actions/index";
import { Notice, PageHeader, Panel } from "@/shared/ui";

export default async function SettingsPage() {
  const { item: settings, error } = await getAppSettings();

  return (
    <div className="page">
      <PageHeader
        title="Settings"
        description="Import master data and maintain application-wide defaults."
      />

      {error ? <Notice error>{error}</Notice> : null}

      <MasterDataImportPanel />

      <Panel
        title="Component defaults"
        description="These defaults are used when new components are created without imported values."
      >
        <form action={updateDefaultSafetyStockAction} className="stack">
          <div className="field-group">
            <label htmlFor="default-safety-stock-settings">Default safety stock</label>
            <input
              id="default-safety-stock-settings"
              className="input"
              type="number"
              min="0"
              step="1"
              name="default_safety_stock"
              defaultValue={settings?.default_safety_stock ?? 25}
            />
          </div>
          <div className="action-row">
            <button className="button primary" type="submit">
              Save settings
            </button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
