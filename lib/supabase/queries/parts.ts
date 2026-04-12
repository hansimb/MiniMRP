import { unstable_noStore as noStore } from "next/cache";
import type {
  ComponentDetail,
  ComponentListItem,
  ComponentMaster,
  ComponentReference,
  InventoryItem,
  InventoryLot,
  Product,
  ProductVersion,
  Seller
} from "@/lib/types/domain";
import { createSupabaseAdminClient } from "../admin-client";
import { createSupabaseClient } from "../client";
import { COMPONENT_REFERENCES_TABLE, INVENTORY_LOTS_TABLE, PRIVATE_SCHEMA, PRODUCT_VERSIONS_TABLE } from "../table-names";
import { safeSelect } from "./shared";

export async function getPartCatalog(filters?: {
  category?: string;
  search?: string;
}): Promise<{ items: ComponentListItem[]; error: string | null }> {
  noStore();
  const supabase = await createSupabaseClient();
  const adminSupabase = createSupabaseAdminClient();
  const componentsQuery = supabase
    .from("components")
    .select("id,sku,name,category,producer,value,safety_stock")
    .order("category")
    .order("name");

  if (filters?.category) {
    componentsQuery.eq("category", filters.category);
  }

  if (filters?.search) {
    componentsQuery.or(
      `sku.ilike.%${filters.search}%,name.ilike.%${filters.search}%,producer.ilike.%${filters.search}%,value.ilike.%${filters.search}%`
    );
  }

  const [componentsResult, inventoryResult, referencesResult, versionsResult, productsResult] = await Promise.all([
    safeSelect<ComponentMaster>(componentsQuery),
    safeSelect<InventoryItem>(
      supabase.from("inventory").select("id,component_id,quantity_available,purchase_price")
    ),
    safeSelect<ComponentReference>(
      adminSupabase.schema(PRIVATE_SCHEMA).from(COMPONENT_REFERENCES_TABLE).select("version_id,component_master_id,reference")
    ),
    safeSelect<ProductVersion>(adminSupabase.schema(PRIVATE_SCHEMA).from(PRODUCT_VERSIONS_TABLE).select("id,product_id,version_number")),
    safeSelect<Product>(supabase.from("products").select("id,name,image"))
  ]);

  const versionMap = new Map(versionsResult.data.map((version) => [version.id, version]));
  const productMap = new Map(productsResult.data.map((product) => [product.id, product]));

  return {
    items: componentsResult.data.map((component) => {
      const usedInVersionsMap = new Map<
        string,
        { product_name: string; version_number: string; references: string[]; quantity: number }
      >();

      for (const reference of referencesResult.data.filter(
        (item) => item.component_master_id === component.id
      )) {
        const version = versionMap.get(reference.version_id);
        const product = version ? productMap.get(version.product_id) : null;
        const key = `${version?.id ?? "unknown"}`;
        const existing = usedInVersionsMap.get(key);

        if (existing) {
          existing.references.push(reference.reference);
          existing.quantity += 1;
        } else {
          usedInVersionsMap.set(key, {
            product_name: product?.name ?? "-",
            version_number: version?.version_number ?? "-",
            references: [reference.reference],
            quantity: 1
          });
        }
      }

      return {
        ...component,
        used_in_versions: Array.from(usedInVersionsMap.values())
      };
    }),
    error:
      componentsResult.error ??
      inventoryResult.error ??
      referencesResult.error ??
      versionsResult.error ??
      productsResult.error
  };
}

export async function getPartDetail(id: string): Promise<{ item: ComponentDetail | null; error: string | null }> {
  noStore();
  const supabase = await createSupabaseClient();
  const adminSupabase = createSupabaseAdminClient();
  const componentResult = await supabase
    .from("components")
    .select("id,sku,name,category,producer,value,safety_stock")
    .eq("id", id)
    .maybeSingle<ComponentMaster>();

  if (componentResult.error) {
    return { item: null, error: componentResult.error.message };
  }

  if (!componentResult.data) {
    return { item: null, error: null };
  }

  const [inventoryResult, lotsResult, linksResult, sellersResult, referencesResult, versionsResult, productsResult] = await Promise.all([
    supabase
      .from("inventory")
      .select("id,component_id,quantity_available,purchase_price")
      .eq("component_id", id)
      .maybeSingle<InventoryItem>(),
    safeSelect<InventoryLot>(
      supabase
        .from(INVENTORY_LOTS_TABLE)
        .select("id,component_id,quantity_received,quantity_remaining,unit_cost,received_at,source,notes,created_at")
        .eq("component_id", id)
        .order("received_at", { ascending: false })
        .order("created_at", { ascending: false })
    ),
    safeSelect<{ component_id: string; seller_id: string; product_url: string | null }>(
      supabase
        .from("component_sellers")
        .select("component_id,seller_id,product_url")
        .eq("component_id", id)
    ),
    safeSelect<Seller>(supabase.from("sellers").select("id,name,base_url,lead_time")),
    safeSelect<ComponentReference>(
      adminSupabase
        .schema(PRIVATE_SCHEMA)
        .from(COMPONENT_REFERENCES_TABLE)
        .select("version_id,component_master_id,reference")
        .eq("component_master_id", id)
        .order("reference")
    ),
    safeSelect<ProductVersion>(adminSupabase.schema(PRIVATE_SCHEMA).from(PRODUCT_VERSIONS_TABLE).select("id,product_id,version_number")),
    safeSelect<Product>(supabase.from("products").select("id,name,image"))
  ]);

  const sellerMap = new Map(sellersResult.data.map((seller) => [seller.id, seller]));
  const versionMap = new Map(versionsResult.data.map((version) => [version.id, version]));
  const productMap = new Map(productsResult.data.map((product) => [product.id, product]));

  return {
    item: {
      ...componentResult.data,
      inventory: inventoryResult.data ?? null,
      inventory_lots: lotsResult.data,
      sellers: linksResult.data
        .map((link) => {
          const seller = sellerMap.get(link.seller_id);
          return seller ? { seller, product_url: link.product_url } : null;
        })
        .filter((value): value is { seller: Seller; product_url: string | null } => Boolean(value)),
      references: referencesResult.data.map((reference) => ({
        reference: reference.reference,
        version: versionMap.get(reference.version_id) ?? null,
        product: versionMap.get(reference.version_id)
          ? productMap.get(versionMap.get(reference.version_id)?.product_id ?? "") ?? null
          : null
      }))
    },
    error:
      inventoryResult.error?.message ??
      lotsResult.error ??
      linksResult.error ??
      sellersResult.error ??
      referencesResult.error ??
      versionsResult.error ??
      productsResult.error
  };
}
