import { unstable_noStore as noStore } from "next/cache";
import { getStoredFileName, isImageFilePath } from "@/lib/mappers/file-storage";
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
import { PRODUCT_IMAGES_BUCKET, resolveStoredFileUrl, VERSION_ATTACHMENTS_BUCKET } from "../storage";
import { ATTACHMENTS_TABLE, COMPONENT_REFERENCES_TABLE, PRIVATE_SCHEMA, PRODUCT_VERSIONS_TABLE } from "../table-names";
import { safeSelect } from "./shared";

export async function getVersionDetail(
  id: string,
  options?: { productionEntryId?: string | null }
): Promise<{ item: VersionDetail | null; error: string | null }> {
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

  const [productResult, attachmentsResult, referencesResult, componentsResult, inventoryResult, linksResult, sellersResult, activeProductionEntriesResult, selectedEntryResult] =
    await Promise.all([
      supabase
        .from("products")
        .select("id,name,image")
        .eq("id", versionResult.data.product_id)
        .maybeSingle<{ id: string; name: string; image: string | null }>(),
      safeSelect<{ id: string; version_id: string; file_path: string }>(
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
      ,
      options?.productionEntryId
        ? safeSelect<ProductionEntry>(
            supabase
              .from("production_entries")
              .select("id,version_id,quantity,status,completed_at,created_at")
              .eq("id", options.productionEntryId)
              .eq("version_id", id)
          )
        : Promise.resolve({ data: [] as ProductionEntry[], error: null as string | null })
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
            .select("id,production_entry_id,component_id,gross_requirement,inventory_consumed,inventory_consumed_cost,net_requirement,created_at")
            .in("production_entry_id", activeProductionEntryIds)
        )
      : { data: [] as ProductionRequirement[], error: null as string | null };
  const selectedEntry = selectedEntryResult.data[0] ?? null;
  const selectedEntryRequirementsResult =
    selectedEntry
      ? await safeSelect<ProductionRequirement>(
          supabase
            .from("production_requirements")
            .select("id,production_entry_id,component_id,gross_requirement,inventory_consumed,inventory_consumed_cost,net_requirement,created_at")
            .eq("production_entry_id", selectedEntry.id)
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
      inventory_consumed_cost: item.inventory_consumed_cost ?? 0,
      net_requirement: item.net_requirement,
      quantity: productionQuantityMap.get(item.production_entry_id) ?? 0
    }))
  );
  const entryRequirementMap = new Map<string, number>();
  const entryRequirementCostMap = new Map<string, number>();
  const entryRequirementGrossMap = new Map<string, number>();
  const entryRequirementNetMap = new Map<string, number>();
  if (selectedEntry) {
    for (const item of selectedEntryRequirementsResult.data) {
      entryRequirementMap.set(
        item.component_id,
        (entryRequirementMap.get(item.component_id) ?? 0) + item.inventory_consumed
      );
      entryRequirementCostMap.set(
        item.component_id,
        (entryRequirementCostMap.get(item.component_id) ?? 0) + (item.inventory_consumed_cost ?? 0)
      );
      entryRequirementGrossMap.set(
        item.component_id,
        (entryRequirementGrossMap.get(item.component_id) ?? 0) + item.gross_requirement
      );
      entryRequirementNetMap.set(
        item.component_id,
        (entryRequirementNetMap.get(item.component_id) ?? 0) + item.net_requirement
      );
    }
  }

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
          inventory_consumed_cost?: number;
          net_requirement: number;
          entry_gross_requirement?: number | null;
          entry_inventory_consumed: number | null;
          entry_inventory_consumed_cost?: number | null;
          entry_net_requirement?: number | null;
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
          inventory_consumed_cost: reservedSummary[component.id]?.inventoryConsumedCost ?? 0,
          net_requirement: reservedSummary[component.id]?.netRequirement ?? 0,
          entry_gross_requirement: entryRequirementGrossMap.get(component.id) ?? null,
          entry_inventory_consumed: entryRequirementMap.get(component.id) ?? null,
          entry_inventory_consumed_cost: entryRequirementCostMap.get(component.id) ?? null,
          entry_net_requirement: entryRequirementNetMap.get(component.id) ?? null,
          active_production_quantity: reservedSummary[component.id]?.activeProductionQuantity ?? 0,
          active_entry_count: reservedSummary[component.id]?.activeEntryCount ?? 0
        }
      });
    }
  }

  const error =
    productResult.error?.message ??
    attachmentsResult.error ??
    referencesResult.error ??
    componentsResult.error ??
    inventoryResult.error ??
    linksResult.error ??
    sellersResult.error ??
    activeProductionEntriesResult.error ??
    activeRequirementsResult.error ??
    selectedEntryResult.error ??
    selectedEntryRequirementsResult.error;

  if (error) {
    return {
      item: null,
      error
    };
  }

  try {
    const product = productResult.data
      ? {
          id: productResult.data.id,
          name: productResult.data.name,
          image: await resolveStoredFileUrl(adminSupabase, PRODUCT_IMAGES_BUCKET, productResult.data.image),
          image_path: productResult.data.image
        }
      : null;

    const attachments: Attachment[] = await Promise.all(
      attachmentsResult.data.map(async (attachment) => ({
        id: attachment.id,
        version_id: attachment.version_id,
        file_path: attachment.file_path,
        file_url: await resolveStoredFileUrl(adminSupabase, VERSION_ATTACHMENTS_BUCKET, attachment.file_path),
        file_name: getStoredFileName(attachment.file_path),
        is_image: isImageFilePath(attachment.file_path)
      }))
    );

    return {
      item: {
        ...versionResult.data,
        product,
        active_production_quantity: activeProductionQuantity,
        active_production_count: activeProductionCount,
        attachments,
        references: referencesResult.data.map((reference) => ({
          reference: reference.reference,
          component: componentMap.get(reference.component_master_id) ?? null
        })),
        components: Array.from(groupedComponents.values()).sort((left, right) =>
          left.component.name.localeCompare(right.component.name)
        )
      },
      error: null
    };
  } catch (reason) {
    return {
      item: null,
      error: reason instanceof Error ? reason.message : "Could not resolve file URLs."
    };
  }
}
