import { CurrentShortagesPanel } from "@/features/purchasing/components/current-shortages-panel";
import { NearSafetyPanel } from "@/features/purchasing/components/near-safety-panel";
import { getPurchasingOverview } from "@/lib/supabase/queries/index";
import { Notice, PageHeader } from "@/shared/ui";

export default async function PurchasingPage() {
  const { shortages, nearSafety, error } = await getPurchasingOverview();

  return (
    <div className="page">
      <PageHeader
        title="Purchasing"
        description="Production-driven shortages and near-safety-stock components for purchasing decisions."
      />

      {error ? <Notice error>{error}</Notice> : null}

      <CurrentShortagesPanel shortages={shortages} />
      <NearSafetyPanel items={nearSafety} />
    </div>
  );
}
