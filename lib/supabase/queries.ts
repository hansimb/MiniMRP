import { createSupabaseClient } from "./client";
import type {
  Attachment,
  ComponentDetail,
  ComponentListItem,
  ComponentMaster,
  ComponentReference,
  InventoryItem,
  Product,
  ProductDetail,
  ProductListItem,
  ProductVersion,
  Seller,
  VersionDetail
} from "@/lib/types/domain";

async function safeSelect<T>(query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const result = await query;
  if (result.error) {
    return { data: [] as T[], error: result.error.message };
  }
  return { data: result.data ?? ([] as T[]), error: null };
}

export async function getProducts(): Promise<{ items: ProductListItem[]; error: string | null }> {
  const supabase = createSupabaseClient();
  const productsResult = await safeSelect<Product>(
    supabase.from("products").select("id,name,image").order("name")
  );
  const versionsResult = await safeSelect<ProductVersion>(
    supabase.from("product_versions").select("id,product_id,version_number")
  );

  const items = productsResult.data.map((product) => ({
    ...product,
    versionCount: versionsResult.data.filter((version) => version.product_id === product.id).length
  }));

  return {
    items,
    error: productsResult.error ?? versionsResult.error
  };
}

export async function getProductById(id: string): Promise<{ item: ProductDetail | null; error: string | null }> {
  const supabase = createSupabaseClient();
  const productResult = await supabase
    .from("products")
    .select("id,name,image")
    .eq("id", id)
    .maybeSingle<Product>();

  if (productResult.error) {
    return { item: null, error: productResult.error.message };
  }

  if (!productResult.data) {
    return { item: null, error: null };
  }

  const versionsResult = await safeSelect<ProductVersion>(
    supabase
      .from("product_versions")
      .select("id,product_id,version_number")
      .eq("product_id", id)
      .order("version_number")
  );

  return {
    item: {
      ...productResult.data,
      versions: versionsResult.data
    },
    error: versionsResult.error
  };
}

export async function getVersionById(id: string): Promise<{ item: VersionDetail | null; error: string | null }> {
  const supabase = createSupabaseClient();
  const versionResult = await supabase
    .from("product_versions")
    .select("id,product_id,version_number")
    .eq("id", id)
    .maybeSingle<ProductVersion>();

  if (versionResult.error) {
    return { item: null, error: versionResult.error.message };
  }

  if (!versionResult.data) {
    return { item: null, error: null };
  }

  const [productResult, attachmentsResult, referencesResult, componentsResult] = await Promise.all([
    supabase
      .from("products")
      .select("id,name,image")
      .eq("id", versionResult.data.product_id)
      .maybeSingle<Product>(),
    safeSelect<Attachment>(
      supabase.from("attachments").select("id,version_id,file_path").eq("version_id", id)
    ),
    safeSelect<ComponentReference>(
      supabase
        .from("component_references")
        .select("version_id,component_master_id,reference")
        .eq("version_id", id)
        .order("reference")
    ),
    safeSelect<ComponentMaster>(
      supabase.from("components").select("id,name,category,producer,value")
    )
  ]);

  const componentMap = new Map(componentsResult.data.map((component) => [component.id, component]));

  return {
    item: {
      ...versionResult.data,
      product: productResult.data ?? null,
      attachments: attachmentsResult.data,
      references: referencesResult.data.map((reference) => ({
        reference: reference.reference,
        component: componentMap.get(reference.component_master_id) ?? null
      }))
    },
    error:
      productResult.error?.message ??
      attachmentsResult.error ??
      referencesResult.error ??
      componentsResult.error
  };
}

export async function getComponents(filters?: {
  category?: string;
  search?: string;
}): Promise<{ items: ComponentListItem[]; error: string | null }> {
  const supabase = createSupabaseClient();
  const componentsQuery = supabase
    .from("components")
    .select("id,name,category,producer,value")
    .order("category")
    .order("name");

  if (filters?.category) {
    componentsQuery.eq("category", filters.category);
  }

  if (filters?.search) {
    componentsQuery.or(
      `name.ilike.%${filters.search}%,producer.ilike.%${filters.search}%,value.ilike.%${filters.search}%`
    );
  }

  const [componentsResult, inventoryResult] = await Promise.all([
    safeSelect<ComponentMaster>(componentsQuery),
    safeSelect<InventoryItem>(
      supabase.from("inventory").select("id,component_id,quantity_available,purchase_price")
    )
  ]);

  const inventoryMap = new Map(inventoryResult.data.map((item) => [item.component_id, item]));

  return {
    items: componentsResult.data.map((component) => {
      const inventory = inventoryMap.get(component.id);
      return {
        ...component,
        quantity_available: inventory?.quantity_available ?? null,
        purchase_price: inventory?.purchase_price ?? null
      };
    }),
    error: componentsResult.error ?? inventoryResult.error
  };
}

export async function getComponentById(id: string): Promise<{ item: ComponentDetail | null; error: string | null }> {
  const supabase = createSupabaseClient();
  const componentResult = await supabase
    .from("components")
    .select("id,name,category,producer,value")
    .eq("id", id)
    .maybeSingle<ComponentMaster>();

  if (componentResult.error) {
    return { item: null, error: componentResult.error.message };
  }

  if (!componentResult.data) {
    return { item: null, error: null };
  }

  const [inventoryResult, linksResult, sellersResult, referencesResult, versionsResult] = await Promise.all([
    supabase
      .from("inventory")
      .select("id,component_id,quantity_available,purchase_price")
      .eq("component_id", id)
      .maybeSingle<InventoryItem>(),
    safeSelect<{ component_id: string; seller_id: string; product_url: string | null }>(
      supabase
        .from("component_sellers")
        .select("component_id,seller_id,product_url")
        .eq("component_id", id)
    ),
    safeSelect<Seller>(supabase.from("sellers").select("id,name,base_url,lead_time")),
    safeSelect<ComponentReference>(
      supabase
        .from("component_references")
        .select("version_id,component_master_id,reference")
        .eq("component_master_id", id)
        .order("reference")
    ),
    safeSelect<ProductVersion>(supabase.from("product_versions").select("id,product_id,version_number"))
  ]);

  const sellerMap = new Map(sellersResult.data.map((seller) => [seller.id, seller]));
  const versionMap = new Map(versionsResult.data.map((version) => [version.id, version]));

  return {
    item: {
      ...componentResult.data,
      inventory: inventoryResult.data ?? null,
      sellers: linksResult.data
        .map((link) => {
          const seller = sellerMap.get(link.seller_id);
          return seller ? { seller, product_url: link.product_url } : null;
        })
        .filter((value): value is { seller: Seller; product_url: string | null } => Boolean(value)),
      references: referencesResult.data.map((reference) => ({
        reference: reference.reference,
        version: versionMap.get(reference.version_id) ?? null
      }))
    },
    error:
      inventoryResult.error?.message ??
      linksResult.error ??
      sellersResult.error ??
      referencesResult.error ??
      versionsResult.error
  };
}

export async function getInventory(filters?: {
  category?: string;
  search?: string;
}): Promise<{ items: Array<InventoryItem & { component: ComponentMaster | null }>; error: string | null }> {
  const supabase = createSupabaseClient();
  const [inventoryResult, componentsResult] = await Promise.all([
    safeSelect<InventoryItem>(
      supabase.from("inventory").select("id,component_id,quantity_available,purchase_price")
    ),
    safeSelect<ComponentMaster>(
      supabase.from("components").select("id,name,category,producer,value").order("category").order("name")
    )
  ]);

  let components = componentsResult.data;
  if (filters?.category) {
    components = components.filter((component) => component.category === filters.category);
  }

  if (filters?.search) {
    const needle = filters.search.toLowerCase();
    components = components.filter((component) =>
      [component.name, component.producer, component.value ?? ""].some((value) =>
        value.toLowerCase().includes(needle)
      )
    );
  }

  const componentMap = new Map(components.map((component) => [component.id, component]));

  return {
    items: inventoryResult.data
      .map((item) => ({
        ...item,
        component: componentMap.get(item.component_id) ?? null
      }))
      .filter((item) => item.component !== null),
    error: inventoryResult.error ?? componentsResult.error
  };
}

