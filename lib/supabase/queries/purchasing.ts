import { unstable_noStore as noStore } from "next/cache";
import { aggregateProductionRequirements, buildProductionShortageMetrics, buildPurchasingBuckets } from "@/lib/mappers/mrp";
import type {
  ComponentMaster,
  InventoryItem,
  Product,
  ProductVersion,
  ProductionShortageGroup,
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
  productionShortages: ProductionShortageGroup[];
  nearSafety: PurchasingItem[];
  outOfStock: PurchasingItem[];
  error: string | null;
}> {
  noStore();
  const supabase = await createSupabaseClient();
  const adminSupabase = createSupabaseAdminClient();
  const [componentsResult, inventoryResult, linksResult, sellerLinksResult, sellersResult, productionRequirementsResult, productionEntriesResult, versionsResult, productsResult] = await Promise.all([
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
    ),
    safeSelect<{ id: string; name: string; image: string | null }>(
      supabase.from("products").select("id,name,image")
    )
  ]);

  const inventoryMap = new Map(inventoryResult.data.map((item) => [item.component_id, item]));
  const componentMap = new Map(componentsResult.data.map((component) => [component.id, component]));
  const sellerMap = new Map(sellersResult.data.map((seller) => [seller.id, seller]));
  const versionMap = new Map(versionsResult.data.map((version) => [version.id, version]));
  const productMap = new Map(productsResult.data.map((product) => [product.id, product]));
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

  const productionShortages: ProductionShortageGroup[] = [];
  const productionShortageIds = new Set<string>();

  if (productionRequirementsResult.data.length > 0) {
    for (const entry of productionEntriesResult.data) {
      const version = versionMap.get(entry.version_id);
      const product = version ? productMap.get(version.product_id) : null;
      const items = productionRequirementsResult.data
        .filter((item) => item.production_entry_id === entry.id && item.net_requirement > 0)
        .map((item) => {
          const component = componentMap.get(item.component_id);
          if (!component) {
            return null;
          }
          const sellerLink = sellerLinkMap.get(item.component_id);
          productionShortageIds.add(component.id);
          return {
            id: component.id,
            sku: component.sku,
            name: component.name,
            category: component.category,
            producer: component.producer,
            value: component.value,
            safety_stock: component.safety_stock,
            gross_requirement: item.gross_requirement,
            reserved_inventory: item.inventory_consumed,
            quantity_available: inventoryMap.get(component.id)?.quantity_available ?? 0,
            purchase_price: inventoryMap.get(component.id)?.purchase_price ?? null,
            lead_time: leadTimeMap.get(component.id) ?? null,
            net_need: item.net_requirement,
            seller_id: sellerLink?.seller_id ?? null,
            seller_name: sellerLink?.seller_name ?? null,
            seller_base_url: sellerLink?.seller_base_url ?? null,
            seller_product_url: sellerLink?.seller_product_url ?? null,
            recommended_order_quantity: item.net_requirement + component.safety_stock,
            production_entry_id: entry.id,
            product_name: product?.name ?? "Unknown product",
            version_number: version?.version_number ?? "-",
            build_quantity: entry.quantity
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null)
        .sort((left, right) => right.net_need - left.net_need);

      if (items.length > 0) {
        productionShortages.push({
          production_entry_id: entry.id,
          product_name: product?.name ?? "Unknown product",
          version_number: version?.version_number ?? "-",
          build_quantity: entry.quantity,
          label: `${product?.name ?? "Unknown product"} - ${entry.quantity} pcs`,
          items
        });
      }
    }
  } else if (productionEntriesResult.data.length > 0) {
    for (const entry of productionEntriesResult.data) {
      const version = versionMap.get(entry.version_id);
      const product = version ? productMap.get(version.product_id) : null;
      const versionDetail = await getVersionDetail(entry.version_id);
      const items = (versionDetail.item?.components ?? [])
        .map((component) => {
          const row = {
            componentId: component.component.id,
            sku: component.component.sku,
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
            netRequirement: Math.max(component.quantity * entry.quantity - (component.inventory?.quantity_available ?? 0), 0),
            grossCost: null,
            netCost: null,
            reservedForThisCalculation: 0,
            reservedForEntry: null
          };
          if (row.netRequirement <= 0) {
            return null;
          }
          const sellerLink = sellerLinkMap.get(component.component.id);
          productionShortageIds.add(component.component.id);
          return {
            id: component.component.id,
            sku: component.component.sku,
            name: component.component.name,
            category: component.component.category,
            producer: component.component.producer,
            value: component.component.value,
            safety_stock: component.component.safety_stock,
            gross_requirement: row.grossRequirement,
            reserved_inventory: row.grossRequirement - row.netRequirement,
            quantity_available: component.inventory?.quantity_available ?? 0,
            purchase_price: component.inventory?.purchase_price ?? null,
            lead_time: component.lead_time ?? null,
            net_need: row.netRequirement,
            seller_id: sellerLink?.seller_id ?? null,
            seller_name: sellerLink?.seller_name ?? null,
            seller_base_url: sellerLink?.seller_base_url ?? null,
            seller_product_url: sellerLink?.seller_product_url ?? null,
            recommended_order_quantity: row.netRequirement + component.component.safety_stock,
            production_entry_id: entry.id,
            product_name: product?.name ?? "Unknown product",
            version_number: version?.version_number ?? "-",
            build_quantity: entry.quantity
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null)
        .sort((left, right) => right.net_need - left.net_need);

      if (items.length > 0) {
        productionShortages.push({
          production_entry_id: entry.id,
          product_name: product?.name ?? "Unknown product",
          version_number: version?.version_number ?? "-",
          build_quantity: entry.quantity,
          label: `${product?.name ?? "Unknown product"} - ${entry.quantity} pcs`,
          items
        });
      }
    }
  }

  productionShortages.sort((left, right) =>
    left.product_name.localeCompare(right.product_name)
    || left.build_quantity - right.build_quantity
    || left.version_number.localeCompare(right.version_number)
  );

  const buckets = buildPurchasingBuckets(
    componentsResult.data.map((component) => {
      const inventory = inventoryMap.get(component.id);
      const sellerLink = sellerLinkMap.get(component.id);
      return {
        ...component,
        quantity_available: inventory?.quantity_available ?? 0,
        purchase_price: inventory?.purchase_price ?? null,
        lead_time: leadTimeMap.get(component.id) ?? null,
        seller_id: sellerLink?.seller_id ?? null,
        seller_name: sellerLink?.seller_name ?? null,
        seller_base_url: sellerLink?.seller_base_url ?? null,
        seller_product_url: sellerLink?.seller_product_url ?? null
      };
    })
  );

  const nearSafety: PurchasingItem[] = buckets.nearSafety
    .map((component) => {
      return {
        ...component,
        gross_requirement: 0,
        reserved_inventory: 0,
        net_need: 0,
        recommended_order_quantity: 0
      };
    })
    .filter((item) => !productionShortageIds.has(item.id))
    .filter((item) => item.quantity_available > 0 && item.quantity_available < item.safety_stock * 1.5)
    .sort((left, right) => left.quantity_available - right.quantity_available);

  const outOfStock: PurchasingItem[] = buckets.outOfStock
    .map((component) => ({
      ...component,
      gross_requirement: 0,
      reserved_inventory: 0,
      net_need: 0
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    productionShortages,
    nearSafety,
    outOfStock,
    error:
      componentsResult.error ??
      inventoryResult.error ??
      linksResult.error ??
      sellerLinksResult.error ??
      sellersResult.error ??
      productionRequirementsResult.error ??
      productionEntriesResult.error ??
      versionsResult.error ??
      productsResult.error
  };
}
