import { unstable_noStore as noStore } from "next/cache";
import { aggregateProductionRequirements, buildProductionShortageMetrics } from "@/lib/mappers/mrp";
import type {
  ComponentMaster,
  InventoryItem,
  ProductVersion,
  ProductionEntry,
  ProductionRequirement,
  PurchasingItem,
  Seller
} from "@/lib/types/domain";
import { createSupabaseAdminClient } from "../admin-client";
import { createSupabaseClient } from "../client";
import { PRIVATE_SCHEMA, PRODUCT_VERSIONS_TABLE } from "../table-names";
import { safeSelect } from "./shared";
import { getVersionDetail } from "./versions";

export async function getPurchasingOverview(): Promise<{
  shortages: PurchasingItem[];
  nearSafety: PurchasingItem[];
  error: string | null;
}> {
  noStore();
  const supabase = await createSupabaseClient();
  const adminSupabase = createSupabaseAdminClient();
  const [componentsResult, inventoryResult, linksResult, sellerLinksResult, sellersResult, productionRequirementsResult, productionEntriesResult, versionsResult] = await Promise.all([
    safeSelect<ComponentMaster>(
      supabase.from("components").select("id,sku,name,category,producer,value,safety_stock").order("category").order("name")
    ),
    safeSelect<InventoryItem>(
      supabase.from("inventory").select("id,component_id,quantity_available,purchase_price")
    ),
    safeSelect<{ component_id: string; seller_id: string }>(
      supabase.from("component_sellers").select("component_id,seller_id")
    ),
    safeSelect<{ component_id: string; seller_id: string; product_url: string | null }>(
      supabase.from("component_sellers").select("component_id,seller_id,product_url")
    ),
    safeSelect<Seller>(
      supabase.from("sellers").select("id,name,base_url,lead_time")
    ),
    safeSelect<ProductionRequirement>(
      supabase
        .from("production_requirements")
        .select("id,production_entry_id,component_id,gross_requirement,inventory_consumed,net_requirement,created_at")
        .order("created_at", { ascending: false })
    ),
    safeSelect<ProductionEntry>(
      supabase
        .from("production_entries")
        .select("id,version_id,quantity,status,completed_at,created_at")
        .eq("status", "under_production")
        .order("created_at", { ascending: false })
    ),
    safeSelect<ProductVersion>(
      adminSupabase.schema(PRIVATE_SCHEMA).from(PRODUCT_VERSIONS_TABLE).select("id,product_id,version_number")
    )
  ]);

  const inventoryMap = new Map(inventoryResult.data.map((item) => [item.component_id, item]));
  const componentMap = new Map(componentsResult.data.map((component) => [component.id, component]));
  const sellerMap = new Map(sellersResult.data.map((seller) => [seller.id, seller]));
  const versionMap = new Map(versionsResult.data.map((version) => [version.id, version]));
  const activeProductionEntryIds = new Set(productionEntriesResult.data.map((entry) => entry.id));

  const sellerLinkMap = new Map<
    string,
    { seller_id: string; seller_name: string | null; seller_base_url: string | null; seller_product_url: string | null; lead_time: number | null }
  >();
  for (const link of sellerLinksResult.data) {
    const seller = sellerMap.get(link.seller_id);
    if (!seller) {
      continue;
    }
    const existing = sellerLinkMap.get(link.component_id);
    const candidate = {
      seller_id: link.seller_id,
      seller_name: seller.name,
      seller_base_url: seller.base_url,
      seller_product_url: link.product_url,
      lead_time: seller.lead_time
    };
    if (!existing || (candidate.lead_time ?? Number.MAX_SAFE_INTEGER) < (existing.lead_time ?? Number.MAX_SAFE_INTEGER)) {
      sellerLinkMap.set(link.component_id, candidate);
    }
  }

  const leadTimeMap = new Map<string, number | null>();
  for (const link of linksResult.data) {
    const leadTime = sellerMap.get(link.seller_id)?.lead_time ?? null;
    const existing = leadTimeMap.get(link.component_id);
    if (leadTime === null) {
      continue;
    }
    leadTimeMap.set(
      link.component_id,
      existing === null || existing === undefined ? leadTime : Math.min(existing, leadTime)
    );
  }

  const aggregatedRequirements = new Map<string, { totalGrossRequirement: number; totalNetRequirement: number }>();
  if (productionRequirementsResult.data.length > 0) {
    for (const row of productionRequirementsResult.data.filter((item) =>
      activeProductionEntryIds.has(item.production_entry_id)
    )) {
      const existing = aggregatedRequirements.get(row.component_id);
      if (existing) {
        existing.totalGrossRequirement += row.gross_requirement;
        existing.totalNetRequirement += row.net_requirement;
      } else {
        aggregatedRequirements.set(row.component_id, {
          totalGrossRequirement: row.gross_requirement,
          totalNetRequirement: row.net_requirement
        });
      }
    }
  } else if (productionEntriesResult.data.length > 0) {
    const productionRows = await Promise.all(
      productionEntriesResult.data.map(async (entry) => {
        const version = versionMap.get(entry.version_id);
        if (!version) {
          return [];
        }
        const versionDetail = await getVersionDetail(entry.version_id);
        return versionDetail.item
          ? versionDetail.item.components.map((component) => ({
              componentId: component.component.id,
              componentName: component.component.name,
              category: component.component.category,
              producer: component.component.producer,
              value: component.component.value,
              references: component.references,
              quantityPerProduct: component.quantity,
              buildQuantity: entry.quantity,
              safetyStock: component.component.safety_stock,
              leadTime: component.lead_time,
              availableInventory: component.inventory?.quantity_available ?? 0,
              unitPrice: component.inventory?.purchase_price ?? null,
              grossRequirement: component.quantity * entry.quantity,
              netRequirement: 0,
              grossCost: null,
              netCost: null
            }))
          : [];
      })
    );

    for (const item of aggregateProductionRequirements(productionRows.flat())) {
      aggregatedRequirements.set(item.componentId, {
        totalGrossRequirement: item.totalGrossRequirement,
        totalNetRequirement: item.totalNetRequirement
      });
    }
  }

  const shortageIds = new Set<string>();
  const shortageCandidates = Array.from(aggregatedRequirements.entries()).map(([componentId, totals]) => {
    const component = componentMap.get(componentId);
    if (!component) {
      return null;
    }
    const sellerLink = sellerLinkMap.get(componentId);
    const metrics = buildProductionShortageMetrics({
      totalGrossRequirement: totals.totalGrossRequirement,
      totalNetRequirement: totals.totalNetRequirement,
      availableInventory: inventoryMap.get(componentId)?.quantity_available ?? 0,
      safetyStock: component.safety_stock
    });
    return {
      id: component.id,
      sku: component.sku,
      name: component.name,
      category: component.category,
      producer: component.producer,
      value: component.value,
      safety_stock: component.safety_stock,
      quantity_available: inventoryMap.get(componentId)?.quantity_available ?? 0,
      purchase_price: inventoryMap.get(componentId)?.purchase_price ?? null,
      lead_time: leadTimeMap.get(componentId) ?? null,
      net_need: metrics.netNeed,
      seller_id: sellerLink?.seller_id ?? null,
      seller_name: sellerLink?.seller_name ?? null,
      seller_base_url: sellerLink?.seller_base_url ?? null,
      seller_product_url: sellerLink?.seller_product_url ?? null,
      recommended_order_quantity: metrics.recommendedOrderQuantity
    };
  });

  const shortages: PurchasingItem[] = shortageCandidates
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .filter((item) => item.net_need > 0)
    .sort((left, right) => right.net_need - left.net_need);

  for (const item of shortages) {
    shortageIds.add(item.id);
  }

  const nearSafety: PurchasingItem[] = componentsResult.data
    .map((component) => {
      const inventory = inventoryMap.get(component.id);
      const quantityAvailable = inventory?.quantity_available ?? 0;
      const sellerLink = sellerLinkMap.get(component.id);
      return {
        ...component,
        quantity_available: quantityAvailable,
        purchase_price: inventory?.purchase_price ?? null,
        lead_time: leadTimeMap.get(component.id) ?? null,
        net_need: 0,
        seller_id: sellerLink?.seller_id ?? null,
        seller_name: sellerLink?.seller_name ?? null,
        seller_base_url: sellerLink?.seller_base_url ?? null,
        seller_product_url: sellerLink?.seller_product_url ?? null,
        recommended_order_quantity: 0
      };
    })
    .filter((item) => !shortageIds.has(item.id))
    .filter((item) => item.quantity_available > 0 && item.quantity_available < item.safety_stock * 1.5)
    .sort((left, right) => left.quantity_available - right.quantity_available);

  return {
    shortages,
    nearSafety,
    error:
      componentsResult.error ??
      inventoryResult.error ??
      linksResult.error ??
      sellerLinksResult.error ??
      sellersResult.error ??
      productionRequirementsResult.error ??
      productionEntriesResult.error ??
      versionsResult.error
  };
}
