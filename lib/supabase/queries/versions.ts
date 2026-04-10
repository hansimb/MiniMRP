import { unstable_noStore as noStore } from "next/cache";
import { summarizeReservedRequirements } from "@/lib/mappers/production";
import type {
  Attachment,
  ComponentMaster,
  ComponentReference,
  InventoryItem,
  Product,
  ProductVersion,
  ProductionEntry,
  ProductionRequirement,
  Seller,
  VersionDetail
} from "@/lib/types/domain";
import { createSupabaseAdminClient } from "../admin-client";
import { createSupabaseClient } from "../client";
import { ATTACHMENTS_TABLE, COMPONENT_REFERENCES_TABLE, PRIVATE_SCHEMA, PRODUCT_VERSIONS_TABLE } from "../table-names";
import { safeSelect } from "./shared";

export async function getVersionDetail(id: string): Promise<{ item: VersionDetail | null; error: string | null }> {
  noStore();
  const supabase = await createSupabaseClient();
  const adminSupabase = createSupabaseAdminClient();
  const versionResult = await adminSupabase
    .schema(PRIVATE_SCHEMA)
    .from(PRODUCT_VERSIONS_TABLE)
    .select("id,product_id,version_number")
    .eq("id", id)
    .maybeSingle<ProductVersion>();

  if (versionResult.error) {
    return { item: null, error: versionResult.error.message };
  }

  if (!versionResult.data) {
    return { item: null, error: null };
  }

  const [productResult, attachmentsResult, referencesResult, componentsResult, inventoryResult, linksResult, sellersResult, activeProductionEntriesResult] =
    await Promise.all([
      supabase
        .from("products")
        .select("id,name,image")
        .eq("id", versionResult.data.product_id)
        .maybeSingle<Product>(),
      safeSelect<Attachment>(
        adminSupabase.schema(PRIVATE_SCHEMA).from(ATTACHMENTS_TABLE).select("id,version_id,file_path").eq("version_id", id)
      ),
      safeSelect<ComponentReference>(
        adminSupabase
          .schema(PRIVATE_SCHEMA)
          .from(COMPONENT_REFERENCES_TABLE)
          .select("version_id,component_master_id,reference")
          .eq("version_id", id)
          .order("reference")
      ),
      safeSelect<ComponentMaster>(
        supabase.from("components").select("id,sku,name,category,producer,value,safety_stock")
      ),
      safeSelect<InventoryItem>(
        supabase.from("inventory").select("id,component_id,quantity_available,purchase_price")
      ),
      safeSelect<{ component_id: string; seller_id: string }>(
        supabase.from("component_sellers").select("component_id,seller_id")
      ),
      safeSelect<Seller>(
        supabase.from("sellers").select("id,name,base_url,lead_time")
      ),
      safeSelect<ProductionEntry>(
        supabase
          .from("production_entries")
          .select("id,version_id,quantity,status,completed_at,created_at")
          .eq("version_id", id)
          .eq("status", "under_production")
      )
    ]);

  const activeProductionEntryIds = activeProductionEntriesResult.data.map((entry) => entry.id);
  const activeProductionQuantity = activeProductionEntriesResult.data.reduce(
    (total, entry) => total + entry.quantity,
    0
  );
  const activeProductionCount = activeProductionEntriesResult.data.length;
  const activeRequirementsResult =
    activeProductionEntryIds.length > 0
      ? await safeSelect<ProductionRequirement>(
          supabase
            .from("production_requirements")
            .select("id,production_entry_id,component_id,gross_requirement,inventory_consumed,net_requirement,created_at")
            .in("production_entry_id", activeProductionEntryIds)
        )
      : { data: [] as ProductionRequirement[], error: null as string | null };

  const componentMap = new Map(componentsResult.data.map((component) => [component.id, component]));
  const inventoryMap = new Map(inventoryResult.data.map((item) => [item.component_id, item]));
  const sellerMap = new Map(sellersResult.data.map((seller) => [seller.id, seller]));
  const leadTimeMap = new Map<string, number | null>();
  const productionQuantityMap = new Map(
    activeProductionEntriesResult.data.map((entry) => [entry.id, entry.quantity])
  );
  const reservedSummary = summarizeReservedRequirements(
    activeRequirementsResult.data.map((item) => ({
      component_id: item.component_id,
      gross_requirement: item.gross_requirement,
      inventory_consumed: item.inventory_consumed,
      net_requirement: item.net_requirement,
      quantity: productionQuantityMap.get(item.production_entry_id) ?? 0
    }))
  );

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

  const groupedComponents = new Map<
    string,
    {
      component: ComponentMaster;
      references: string[];
      quantity: number;
      lead_time: number | null;
      inventory: InventoryItem | null;
      reserved: {
        gross_requirement: number;
        inventory_consumed: number;
        net_requirement: number;
        active_production_quantity: number;
        active_entry_count: number;
      };
    }
  >();

  for (const reference of referencesResult.data) {
    const component = componentMap.get(reference.component_master_id);
    if (!component) {
      continue;
    }

    const existing = groupedComponents.get(component.id);
    if (existing) {
      existing.references.push(reference.reference);
      existing.quantity += 1;
    } else {
      groupedComponents.set(component.id, {
        component,
        references: [reference.reference],
        quantity: 1,
        lead_time: leadTimeMap.get(component.id) ?? null,
        inventory: inventoryMap.get(component.id) ?? null,
        reserved: {
          gross_requirement: reservedSummary[component.id]?.grossRequirement ?? 0,
          inventory_consumed: reservedSummary[component.id]?.inventoryConsumed ?? 0,
          net_requirement: reservedSummary[component.id]?.netRequirement ?? 0,
          active_production_quantity: reservedSummary[component.id]?.activeProductionQuantity ?? 0,
          active_entry_count: reservedSummary[component.id]?.activeEntryCount ?? 0
        }
      });
    }
  }

  return {
    item: {
      ...versionResult.data,
      product: productResult.data ?? null,
      active_production_quantity: activeProductionQuantity,
      active_production_count: activeProductionCount,
      attachments: attachmentsResult.data,
      references: referencesResult.data.map((reference) => ({
        reference: reference.reference,
        component: componentMap.get(reference.component_master_id) ?? null
      })),
      components: Array.from(groupedComponents.values()).sort((left, right) =>
        left.component.name.localeCompare(right.component.name)
      )
    },
    error:
      productResult.error?.message ??
      attachmentsResult.error ??
      referencesResult.error ??
      componentsResult.error ??
      inventoryResult.error ??
      linksResult.error ??
      sellersResult.error ??
      activeProductionEntriesResult.error ??
      activeRequirementsResult.error
  };
}
