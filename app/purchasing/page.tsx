import { CurrentShortagesPanel } from "@/features/purchasing/components/current-shortages-panel";
import { NearSafetyPanel } from "@/features/purchasing/components/near-safety-panel";
import { OutOfStockPanel } from "@/features/purchasing/components/out-of-stock-panel";
import { getRuntimeQueries } from "@/lib/runtime";
import { Notice, PageHeader } from "@/shared/ui";

export const dynamic = "force-dynamic";

export default async function PurchasingPage() {
  const queries = await getRuntimeQueries();
  const { productionShortages, nearSafety, outOfStock, error } = await queries.getPurchasingOverview();

  return (
    <div className="page">
      <PageHeader
        title="Purchasing"
        description="Production-driven shortages and near-safety-stock components for purchasing decisions."
      />

      {error ? <Notice error>{error}</Notice> : null}

      <CurrentShortagesPanel shortages={productionShortages} />
      <NearSafetyPanel items={nearSafety} />
      <OutOfStockPanel items={outOfStock} />
    </div>
  );
}
