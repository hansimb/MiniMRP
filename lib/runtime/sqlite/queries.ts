import type { SQLInputValue } from "node:sqlite";
import { getStoredFileName, isImageFilePath } from "../../mappers/file-storage.ts";
import { buildMrpRows, buildProductionShortageMetrics, buildPurchasingBuckets, calculateProductionLongestLeadTime } from "../../mappers/mrp.ts";
import { summarizeReservedRequirements } from "../../mappers/production.ts";
import type {
  AppSettings,
  Attachment,
  ComponentDetail,
  ComponentListItem,
  ComponentMaster,
  ComponentReference,
  HistoryEvent,
  InventoryItem,
  InventoryLot,
  Product,
  ProductDetail,
  ProductListItem,
  ProductVersion,
  ProductionShortageGroup,
  ProductionEntry,
  ProductionListItem,
  ProductionRequirement,
  PurchasingItem,
  Seller,
  VersionDetail
} from "../../types/domain.ts";
import { getDesktopDatabase } from "./db.ts";

type ComponentSellerLink = {
  component_id: string;
  seller_id: string;
  product_url: string | null;
};

type SqliteComponentReferenceRow = ComponentReference & {
  version_number: string | null;
  product_id: string | null;
  product_name: string | null;
};

type SqliteAttachmentRow = {
  id: string;
  version_id: string;
  file_path: string;
};

type SqliteVersionRow = ProductVersion;

type SqliteQueryResult<T> = {
  items?: T[];
  item?: T | null;
  error: string | null;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "SQLite query failed.";
}

function allRows<T>(sql: string, params: Record<string, SQLInputValue> = {}) {
  return getDesktopDatabase().prepare(sql).all(params) as T[];
}

function oneRow<T>(sql: string, params: Record<string, SQLInputValue> = {}) {
  return (getDesktopDatabase().prepare(sql).get(params) as T | undefined) ?? null;
}

function resolveStoredFileUrl(storedPath: string | null) {
  if (!storedPath) {
    return null;
  }

  return `/api/files/${storedPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

function getAllProducts() {
  return allRows<Product & { image_path: string | null }>(
    "select id, name, image as image_path from products order by name"
  ).map((product) => ({
    id: product.id,
    name: product.name,
    image: resolveStoredFileUrl(product.image_path),
    image_path: product.image_path
  }));
}

function getAllVersions() {
  return allRows<SqliteVersionRow>(
    "select id, product_id, version_number from product_versions order by version_number"
  );
}

function getAllComponents() {
  return allRows<ComponentMaster>(
    "select id, sku, name, category, producer, value, safety_stock from components order by category, name"
  );
}

function getAllInventory() {
  return allRows<InventoryItem>(
    "select id, component_id, quantity_available, purchase_price from inventory"
  );
}

function getAllSellers() {
  return allRows<Seller>(
    "select id, name, base_url, lead_time from sellers"
  );
}

function getAllComponentSellerLinks() {
  return allRows<ComponentSellerLink>(
    "select component_id, seller_id, product_url from component_sellers"
  );
}

function getVersionReferences(versionId: string) {
  return allRows<ComponentReference>(
    "select version_id, component_master_id, reference from component_references where version_id = :versionId order by reference",
    { versionId }
  );
}

function getAllVersionReferencesWithContext() {
  return allRows<SqliteComponentReferenceRow>(
    `
      select
        cr.version_id,
        cr.component_master_id,
        cr.reference,
        pv.version_number,
        pv.product_id,
        p.name as product_name
      from component_references cr
      join product_versions pv on pv.id = cr.version_id
      join products p on p.id = pv.product_id
      order by cr.reference
    `
  );
}

export async function getProductList(): Promise<{ items: ProductListItem[]; error: string | null }> {
  try {
    const products = getAllProducts();
    const versions = getAllVersions();

    return {
      items: products.map((product) => ({
        ...product,
        versionCount: versions.filter((version) => version.product_id === product.id).length
      })),
      error: null
    };
  } catch (error) {
    return { items: [], error: getErrorMessage(error) };
  }
}

export async function getProductDetail(id: string): Promise<{ item: ProductDetail | null; error: string | null }> {
  try {
    const product = oneRow<{ id: string; name: string; image_path: string | null }>(
      "select id, name, image as image_path from products where id = :id",
      { id }
    );

    if (!product) {
      return { item: null, error: null };
    }

    const versions = allRows<ProductVersion>(
      "select id, product_id, version_number from product_versions where product_id = :id order by version_number",
      { id }
    );

    return {
      item: {
        id: product.id,
        name: product.name,
        image: resolveStoredFileUrl(product.image_path),
        image_path: product.image_path,
        versions
      },
      error: null
    };
  } catch (error) {
    return { item: null, error: getErrorMessage(error) };
  }
}

export async function getPartCatalog(filters?: {
  category?: string;
  search?: string;
}): Promise<{ items: ComponentListItem[]; error: string | null }> {
  try {
    let components = getAllComponents();
    const references = getAllVersionReferencesWithContext();

    if (filters?.category) {
      components = components.filter((component) => component.category === filters.category);
    }

    if (filters?.search) {
      const needle = filters.search.toLowerCase();
      components = components.filter((component) =>
        [component.sku, component.name, component.producer, component.value ?? ""].some((value) =>
          value.toLowerCase().includes(needle)
        )
      );
    }

    return {
      items: components.map((component) => {
        const usedInVersionsMap = new Map<
          string,
          { product_name: string; version_number: string; references: string[]; quantity: number }
        >();

        for (const reference of references.filter((row) => row.component_master_id === component.id)) {
          const key = `${reference.version_id}`;
          const existing = usedInVersionsMap.get(key);

          if (existing) {
            existing.references.push(reference.reference);
            existing.quantity += 1;
          } else {
            usedInVersionsMap.set(key, {
              product_name: reference.product_name ?? "-",
              version_number: reference.version_number ?? "-",
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
      error: null
    };
  } catch (error) {
    return { items: [], error: getErrorMessage(error) };
  }
}

export async function getPartDetail(id: string): Promise<{ item: ComponentDetail | null; error: string | null }> {
  try {
    const component = oneRow<ComponentMaster>(
      "select id, sku, name, category, producer, value, safety_stock from components where id = :id",
      { id }
    );

    if (!component) {
      return { item: null, error: null };
    }

    const inventory = oneRow<InventoryItem>(
      "select id, component_id, quantity_available, purchase_price from inventory where component_id = :id",
      { id }
    );
    const lots = allRows<InventoryLot>(
      `
        select id, component_id, quantity_received, quantity_remaining, unit_cost, received_at, source, notes, created_at
        from inventory_lots
        where component_id = :id
        order by received_at desc, created_at desc
      `,
      { id }
    );
    const sellers = getAllSellers();
    const sellerMap = new Map(sellers.map((seller) => [seller.id, seller]));
    const links = allRows<ComponentSellerLink>(
      "select component_id, seller_id, product_url from component_sellers where component_id = :id",
      { id }
    );
    const references = allRows<SqliteComponentReferenceRow>(
      `
        select
          cr.version_id,
          cr.component_master_id,
          cr.reference,
          pv.version_number,
          pv.product_id,
          p.name as product_name
        from component_references cr
        left join product_versions pv on pv.id = cr.version_id
        left join products p on p.id = pv.product_id
        where cr.component_master_id = :id
        order by cr.reference
      `,
      { id }
    );

    return {
      item: {
        ...component,
        inventory,
        inventory_lots: lots,
        sellers: links
          .map((link) => {
            const seller = sellerMap.get(link.seller_id);
            return seller ? { seller, product_url: link.product_url } : null;
          })
          .filter((value): value is { seller: Seller; product_url: string | null } => value !== null),
        references: references.map((reference) => ({
          reference: reference.reference,
          version: reference.version_id
            ? {
                id: reference.version_id,
                product_id: reference.product_id ?? "",
                version_number: reference.version_number ?? "-"
              }
            : null,
          product: reference.product_id
            ? {
                id: reference.product_id,
                name: reference.product_name ?? "-",
                image: null,
                image_path: null
              }
            : null
        }))
      },
      error: null
    };
  } catch (error) {
    return { item: null, error: getErrorMessage(error) };
  }
}

export async function getInventoryOverview(filters?: {
  category?: string;
  search?: string;
}): Promise<{ items: Array<InventoryItem & { component: ComponentMaster | null }>; error: string | null }> {
  try {
    let components = getAllComponents();
    const inventory = getAllInventory();

    if (filters?.category) {
      components = components.filter((component) => component.category === filters.category);
    }

    if (filters?.search) {
      const needle = filters.search.toLowerCase();
      components = components.filter((component) =>
        [component.sku, component.name, component.producer, component.value ?? ""].some((value) =>
          value.toLowerCase().includes(needle)
        )
      );
    }

    const componentMap = new Map(components.map((component) => [component.id, component]));

    return {
      items: inventory
        .map((item) => ({
          ...item,
          component: componentMap.get(item.component_id) ?? null
        }))
        .filter((item) => item.component !== null),
      error: null
    };
  } catch (error) {
    return { items: [], error: getErrorMessage(error) };
  }
}

export async function getProductionOverview(): Promise<{
  underProduction: ProductionListItem[];
  completed: ProductionListItem[];
  error: string | null;
}> {
  try {
    const entries = allRows<ProductionEntry>(
      "select id, version_id, quantity, status, completed_at, created_at from production_entries order by created_at desc"
    );
    const versions = getAllVersions();
    const versionMap = new Map(versions.map((version) => [version.id, version]));
    const products = getAllProducts();
    const productMap = new Map(products.map((product) => [product.id, product]));

    const items = await Promise.all(
      entries.map(async (entry) => {
        const version = versionMap.get(entry.version_id) ?? null;
        const product = version ? productMap.get(version.product_id) ?? null : null;
        const versionDetail = await getVersionDetail(entry.version_id);
        const mrpRows = buildMrpRows(versionDetail.item?.components ?? [], entry.quantity);

        return {
          ...entry,
          version,
          product,
          longest_lead_time: calculateProductionLongestLeadTime(mrpRows) || null
        };
      })
    );

    return {
      underProduction: items.filter((item) => item.status === "under_production"),
      completed: items.filter((item) => item.status === "completed"),
      error: null
    };
  } catch (error) {
    return { underProduction: [], completed: [], error: getErrorMessage(error) };
  }
}

export async function getPurchasingOverview(): Promise<{
  productionShortages: ProductionShortageGroup[];
  nearSafety: PurchasingItem[];
  outOfStock: PurchasingItem[];
  error: string | null;
}> {
  try {
    const components = getAllComponents();
    const inventory = getAllInventory();
    const inventoryMap = new Map(inventory.map((item) => [item.component_id, item]));
    const links = getAllComponentSellerLinks();
    const sellers = getAllSellers();
    const sellerMap = new Map(sellers.map((seller) => [seller.id, seller]));
    const requirements = allRows<ProductionRequirement>(
      "select id, production_entry_id, component_id, gross_requirement, inventory_consumed, inventory_consumed_cost, net_requirement, created_at from production_requirements order by created_at desc"
    );
    const activeEntries = allRows<ProductionEntry>(
      "select id, version_id, quantity, status, completed_at, created_at from production_entries where status = 'under_production' order by created_at desc"
    );
    const versions = getAllVersions();
    const versionMap = new Map(versions.map((version) => [version.id, version]));
    const products = getAllProducts();
    const productMap = new Map(products.map((product) => [product.id, product]));
    const activeEntryIds = new Set(activeEntries.map((entry) => entry.id));

    const sellerLinkMap = new Map<
      string,
      { seller_id: string; seller_name: string | null; seller_base_url: string | null; seller_product_url: string | null; lead_time: number | null }
    >();
    for (const link of links) {
      const seller = sellerMap.get(link.seller_id);
      if (!seller) {
        continue;
      }

      const candidate = {
        seller_id: link.seller_id,
        seller_name: seller.name,
        seller_base_url: seller.base_url,
        seller_product_url: link.product_url,
        lead_time: seller.lead_time
      };
      const existing = sellerLinkMap.get(link.component_id);
      if (!existing || (candidate.lead_time ?? Number.MAX_SAFE_INTEGER) < (existing.lead_time ?? Number.MAX_SAFE_INTEGER)) {
        sellerLinkMap.set(link.component_id, candidate);
      }
    }

    const leadTimeMap = new Map<string, number | null>();
    for (const link of links) {
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

    if (requirements.length > 0) {
      for (const entry of activeEntries) {
        const version = versionMap.get(entry.version_id);
        const product = version ? productMap.get(version.product_id) ?? null : null;
        const items = requirements
          .filter((item) => item.production_entry_id === entry.id && item.net_requirement > 0)
          .map((item) => {
            const component = components.find((candidate) => candidate.id === item.component_id);
            if (!component) {
              return null;
            }
            const metrics = buildProductionShortageMetrics({
              totalGrossRequirement: item.gross_requirement,
              totalNetRequirement: item.net_requirement,
              availableInventory: inventoryMap.get(component.id)?.quantity_available ?? 0,
              safetyStock: component.safety_stock
            });
            if (metrics.netNeed <= 0) {
              return null;
            }
            const sellerLink = sellerLinkMap.get(component.id);
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
              net_need: metrics.netNeed,
              seller_id: sellerLink?.seller_id ?? null,
              seller_name: sellerLink?.seller_name ?? null,
              seller_base_url: sellerLink?.seller_base_url ?? null,
              seller_product_url: sellerLink?.seller_product_url ?? null,
              recommended_order_quantity: metrics.recommendedOrderQuantity,
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
    } else if (activeEntries.length > 0) {
      for (const entry of activeEntries) {
        const version = versionMap.get(entry.version_id);
        const product = version ? productMap.get(version.product_id) ?? null : null;
        const versionDetail = await getVersionDetail(entry.version_id);
        const items = (versionDetail.item?.components ?? [])
          .map((component) => {
            const grossRequirement = component.quantity * entry.quantity;
            const quantityAvailable = component.inventory?.quantity_available ?? 0;
            const netNeed = Math.max(grossRequirement - quantityAvailable, 0);
            if (netNeed <= 0) {
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
              gross_requirement: grossRequirement,
              reserved_inventory: grossRequirement - netNeed,
              quantity_available: quantityAvailable,
              purchase_price: component.inventory?.purchase_price ?? null,
              lead_time: component.lead_time ?? null,
              net_need: netNeed,
              seller_id: sellerLink?.seller_id ?? null,
              seller_name: sellerLink?.seller_name ?? null,
              seller_base_url: sellerLink?.seller_base_url ?? null,
              seller_product_url: sellerLink?.seller_product_url ?? null,
              recommended_order_quantity: netNeed + component.component.safety_stock,
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

    const settings = oneRow<{ near_safety_threshold_percent: number }>(
      "select near_safety_threshold_percent from app_settings where id = 1"
    );

    const buckets = buildPurchasingBuckets(
      components.map((component) => {
        const itemInventory = inventoryMap.get(component.id);
        const sellerLink = sellerLinkMap.get(component.id);
        return {
          ...component,
          quantity_available: itemInventory?.quantity_available ?? 0,
          purchase_price: itemInventory?.purchase_price ?? null,
          lead_time: leadTimeMap.get(component.id) ?? null,
          seller_id: sellerLink?.seller_id ?? null,
          seller_name: sellerLink?.seller_name ?? null,
          seller_base_url: sellerLink?.seller_base_url ?? null,
          seller_product_url: sellerLink?.seller_product_url ?? null
        };
      }),
      { nearSafetyThresholdPercent: settings?.near_safety_threshold_percent ?? 10 }
    );

    const nearSafety: PurchasingItem[] = buckets.nearSafety
      .map((component) => ({
        ...component,
        gross_requirement: 0,
        reserved_inventory: 0,
        net_need: 0,
        recommended_order_quantity: 0
      }))
      .filter((item) => !productionShortageIds.has(item.id))
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
      error: null
    };
  } catch (error) {
    return { productionShortages: [], nearSafety: [], outOfStock: [], error: getErrorMessage(error) };
  }
}

export async function getAppSettings(): Promise<{ item: AppSettings | null; error: string | null }> {
  try {
    const item = oneRow<{ id: number; default_safety_stock: number; near_safety_threshold_percent: number }>(
      "select id, default_safety_stock, near_safety_threshold_percent from app_settings where id = 1"
    );

    return {
      item: item
        ? {
            id: true,
            default_safety_stock: item.default_safety_stock,
            near_safety_threshold_percent: item.near_safety_threshold_percent
          }
        : { id: true, default_safety_stock: 25, near_safety_threshold_percent: 10 },
      error: null
    };
  } catch (error) {
    return { item: null, error: getErrorMessage(error) };
  }
}

export async function getVersionDetail(
  id: string,
  options?: { productionEntryId?: string | null }
): Promise<{ item: VersionDetail | null; error: string | null }> {
  try {
    const version = oneRow<SqliteVersionRow>(
      "select id, product_id, version_number from product_versions where id = :id",
      { id }
    );

    if (!version) {
      return { item: null, error: null };
    }

    const product = oneRow<{ id: string; name: string; image_path: string | null }>(
      "select id, name, image as image_path from products where id = :productId",
      { productId: version.product_id }
    );
    const attachmentRows = allRows<SqliteAttachmentRow>(
      "select id, version_id, file_path from attachments where version_id = :id",
      { id }
    );
    const references = getVersionReferences(id);
    const components = getAllComponents();
    const componentMap = new Map(components.map((component) => [component.id, component]));
    const inventory = getAllInventory();
    const inventoryMap = new Map(inventory.map((item) => [item.component_id, item]));
    const links = getAllComponentSellerLinks();
    const sellers = getAllSellers();
    const sellerMap = new Map(sellers.map((seller) => [seller.id, seller]));
    const activeEntries = allRows<ProductionEntry>(
      `
        select id, version_id, quantity, status, completed_at, created_at
        from production_entries
        where version_id = :id and status = 'under_production'
      `,
      { id }
    );
    const activeEntryIds = activeEntries.map((entry) => entry.id);
    const activeRequirements = activeEntryIds.length > 0
      ? allRows<ProductionRequirement>(
          `
            select id, production_entry_id, component_id, gross_requirement, inventory_consumed, inventory_consumed_cost, net_requirement, created_at
            from production_requirements
            where production_entry_id in (${activeEntryIds.map((_, index) => `:entry${index}`).join(", ")})
          `,
          Object.fromEntries(activeEntryIds.map((entryId, index) => [`entry${index}`, entryId]))
        )
      : [];

    const activeProductionQuantity = activeEntries.reduce((total, entry) => total + entry.quantity, 0);
    const productionQuantityMap = new Map(activeEntries.map((entry) => [entry.id, entry.quantity]));
    const reservedSummary = summarizeReservedRequirements(
      activeRequirements.map((item) => ({
        component_id: item.component_id,
        gross_requirement: item.gross_requirement,
        inventory_consumed: item.inventory_consumed,
        net_requirement: item.net_requirement,
        quantity: productionQuantityMap.get(item.production_entry_id) ?? 0
      }))
    );
    const entryRequirementMap = new Map<string, number>();
    const entryRequirementCostMap = new Map<string, number>();
    if (options?.productionEntryId) {
      for (const item of activeRequirements.filter((requirement) => requirement.production_entry_id === options.productionEntryId)) {
        entryRequirementMap.set(
          item.component_id,
          (entryRequirementMap.get(item.component_id) ?? 0) + item.inventory_consumed
        );
        entryRequirementCostMap.set(
          item.component_id,
          (entryRequirementCostMap.get(item.component_id) ?? 0) + (item.inventory_consumed_cost ?? 0)
        );
      }
    }

    const leadTimeMap = new Map<string, number | null>();
    for (const link of links) {
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
          inventory_consumed_cost: number;
          net_requirement: number;
          entry_inventory_consumed: number | null;
          entry_inventory_consumed_cost: number | null;
          active_production_quantity: number;
          active_entry_count: number;
        };
      }
    >();

    for (const reference of references) {
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
            entry_inventory_consumed: entryRequirementMap.get(component.id) ?? null,
            entry_inventory_consumed_cost: entryRequirementCostMap.get(component.id) ?? null,
            active_production_quantity: reservedSummary[component.id]?.activeProductionQuantity ?? 0,
            active_entry_count: reservedSummary[component.id]?.activeEntryCount ?? 0
          }
        });
      }
    }

    const attachments: Attachment[] = attachmentRows.map((attachment) => ({
      id: attachment.id,
      version_id: attachment.version_id,
      file_path: attachment.file_path,
      file_url: resolveStoredFileUrl(attachment.file_path),
      file_name: getStoredFileName(attachment.file_path),
      is_image: isImageFilePath(attachment.file_path)
    }));

    return {
      item: {
        ...version,
        product: product
          ? {
              id: product.id,
              name: product.name,
              image: resolveStoredFileUrl(product.image_path),
              image_path: product.image_path
            }
          : null,
        attachments,
        active_production_quantity: activeProductionQuantity,
        active_production_count: activeEntries.length,
        references: references.map((reference) => ({
          reference: reference.reference,
          component: componentMap.get(reference.component_master_id) ?? null
        })),
        components: Array.from(groupedComponents.values()).sort((left, right) =>
          left.component.name.localeCompare(right.component.name)
        )
      },
      error: null
    };
  } catch (error) {
    return { item: null, error: getErrorMessage(error) };
  }
}

export async function getHistoryEntries(): Promise<{ items: HistoryEvent[]; error: string | null }> {
  try {
    return {
      items: allRows<HistoryEvent>(
        "select id, entity_type, entity_id, action_type, summary, old_value, new_value, created_at from history_events order by created_at desc"
      ),
      error: null
    };
  } catch (error) {
    return { items: [], error: getErrorMessage(error) };
  }
}
