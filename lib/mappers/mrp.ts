import type { InventoryItem, VersionDetail } from "@/lib/types/domain";

type VersionComponent = VersionDetail["components"][number];

export interface MrpRow {
  componentId: string;
  sku: string;
  componentName: string;
  category: string;
  producer: string;
  value: string | null;
  references: string[];
  quantityPerProduct: number;
  buildQuantity: number;
  safetyStock: number;
  leadTime: number | null;
  availableInventory: number;
  unitPrice: number | null;
  grossRequirement: number;
  netRequirement: number;
  grossCost: number | null;
  netCost: number | null;
  reservedForThisCalculation: number;
  reservedForEntry: number | null;
  reservedInventory?: number;
  activeProductionQuantity?: number;
}

function roundCurrency(value: number) {
  return Math.round(value * 10000) / 10000;
}

export function calculateWeightedAveragePrice(items: Array<InventoryItem | null | undefined>) {
  let weightedCost = 0;
  let totalQuantity = 0;

  for (const item of items) {
    if (!item || item.purchase_price === null || item.quantity_available <= 0) {
      continue;
    }

    weightedCost += item.quantity_available * item.purchase_price;
    totalQuantity += item.quantity_available;
  }

  if (totalQuantity === 0) {
    return null;
  }

  return roundCurrency(weightedCost / totalQuantity);
}

export function calculateInventoryValue(item: InventoryItem | null | undefined) {
  if (!item || item.purchase_price === null) {
    return null;
  }

  return roundCurrency(item.quantity_available * item.purchase_price);
}

export function calculateVersionUnitCost(components: VersionComponent[]) {
  return roundCurrency(
    components.reduce((total, row) => {
      const unitPrice = row.inventory?.purchase_price;
      if (unitPrice === null || unitPrice === undefined) {
        return total;
      }

      return total + row.quantity * unitPrice;
    }, 0)
  );
}

export function buildMrpRows(components: VersionComponent[], buildQuantity: number): MrpRow[] {
  return components.map((row) => {
    const unitPrice = row.inventory?.purchase_price ?? null;
    const grossRequirement = row.quantity * buildQuantity;
    const availableInventory = row.inventory?.quantity_available ?? 0;
    const safetyStock = row.component.safety_stock ?? 0;
    const netRequirement = Math.max(grossRequirement - availableInventory, 0);
    const reservedForThisCalculation = Math.min(availableInventory, grossRequirement);
    const grossCost = unitPrice === null ? null : roundCurrency(grossRequirement * unitPrice);
    const netCost = unitPrice === null ? null : roundCurrency(netRequirement * unitPrice);

    return {
      componentId: row.component.id,
      sku: row.component.sku,
      componentName: row.component.name,
      category: row.component.category,
      producer: row.component.producer,
      value: row.component.value,
      references: row.references,
      quantityPerProduct: row.quantity,
      buildQuantity,
      safetyStock,
      leadTime: row.lead_time ?? null,
      availableInventory,
      unitPrice,
      grossRequirement,
      netRequirement,
      grossCost,
      netCost,
      reservedForThisCalculation,
      reservedForEntry: row.reserved?.entry_inventory_consumed ?? null,
      reservedInventory: row.reserved?.inventory_consumed ?? 0,
      activeProductionQuantity: row.reserved?.active_production_quantity ?? 0
    };
  });
}

export function summarizeMrpRows(rows: MrpRow[]) {
  return rows.reduce(
    (summary, row) => ({
      quantityPerProduct: summary.quantityPerProduct + row.quantityPerProduct,
      safetyStock: summary.safetyStock + row.safetyStock,
      maxLeadTime:
        row.leadTime === null
          ? summary.maxLeadTime
          : Math.max(summary.maxLeadTime ?? 0, row.leadTime),
      availableInventory: summary.availableInventory + row.availableInventory,
      grossRequirement: summary.grossRequirement + row.grossRequirement,
      netRequirement: summary.netRequirement + row.netRequirement,
      reservedInventory: summary.reservedInventory + (row.reservedInventory ?? 0),
      grossCost: roundCurrency(summary.grossCost + (row.grossCost ?? 0)),
      netCost: roundCurrency(summary.netCost + (row.netCost ?? 0))
    }),
    {
      quantityPerProduct: 0,
      safetyStock: 0,
      maxLeadTime: null as number | null,
      availableInventory: 0,
      grossRequirement: 0,
      netRequirement: 0,
      reservedInventory: 0,
      grossCost: 0,
      netCost: 0
    }
  );
}

export function calculateProductionLongestLeadTime(rows: MrpRow[]) {
  const shortageLeadTimes = rows
    .filter((row) => row.netRequirement > 0 && row.leadTime !== null)
    .map((row) => row.leadTime ?? 0);

  return shortageLeadTimes.length > 0 ? Math.max(...shortageLeadTimes) : 0;
}

export function buildPurchasingBuckets<T extends {
  id: string;
  name: string;
  category: string;
  producer: string;
  value: string | null;
  safety_stock: number;
  quantity_available: number;
  purchase_price: number | null;
  lead_time: number | null;
}>(items: T[]) {
  const shortages = items
    .filter((item) => item.quantity_available < item.safety_stock)
    .map((item) => ({
      ...item,
      recommended_order_quantity:
        Math.max(item.safety_stock - item.quantity_available, 0) + item.safety_stock
    }))
    .sort((left, right) => left.quantity_available - right.quantity_available);

  const nearSafety = items
    .filter(
      (item) =>
        item.quantity_available <= item.safety_stock + 10
    )
    .map((item) => ({
      ...item,
      recommended_order_quantity: 0
    }))
    .sort((left, right) => left.quantity_available - right.quantity_available);

  return { shortages, nearSafety };
}

export interface ProductionRequirementItem {
  componentId: string;
  componentName: string;
  category: string;
  producer: string;
  value: string | null;
  safetyStock: number;
  leadTime: number | null;
  availableInventory: number;
  totalGrossRequirement: number;
  totalNetRequirement: number;
}

export interface ReservedProductionRequirement {
  componentId: string;
  grossRequirement: number;
  inventoryConsumed: number;
  netRequirement: number;
  remainingInventory: number;
}

export function reserveInventoryForProduction(rows: MrpRow[]): ReservedProductionRequirement[] {
  return rows.map((row) => {
    const inventoryConsumed = Math.min(row.availableInventory, row.grossRequirement);
    return {
      componentId: row.componentId,
      grossRequirement: row.grossRequirement,
      inventoryConsumed,
      netRequirement: Math.max(row.grossRequirement - inventoryConsumed, 0),
      remainingInventory: Math.max(row.availableInventory - row.grossRequirement, 0)
    };
  });
}

export function buildProductionShortageMetrics(input: {
  totalGrossRequirement: number;
  totalNetRequirement: number;
  availableInventory: number;
  safetyStock: number;
}) {
  const currentNetNeed = Math.max(input.totalNetRequirement - input.availableInventory, 0);
  const recommendedOrderQuantity = currentNetNeed > 0 ? currentNetNeed + input.safetyStock : 0;

  return {
    netNeed: currentNetNeed,
    recommendedOrderQuantity
  };
}

export function aggregateProductionRequirements(rows: MrpRow[]) {
  const grouped = new Map<string, ProductionRequirementItem>();

  for (const row of rows) {
    const existing = grouped.get(row.componentId);
    if (existing) {
      existing.totalGrossRequirement += row.grossRequirement;
      existing.totalNetRequirement += row.grossRequirement;
      existing.leadTime =
        row.leadTime === null
          ? existing.leadTime
          : existing.leadTime === null
            ? row.leadTime
            : Math.min(existing.leadTime, row.leadTime);
      continue;
    }

    grouped.set(row.componentId, {
      componentId: row.componentId,
      componentName: row.componentName,
      category: row.category,
      producer: row.producer,
      value: row.value,
      safetyStock: row.safetyStock,
      leadTime: row.leadTime,
      availableInventory: row.availableInventory,
      totalGrossRequirement: row.grossRequirement,
      totalNetRequirement: row.grossRequirement
    });
  }

  return Array.from(grouped.values()).map((item) => ({
    ...item,
    totalNetRequirement: Math.max(item.totalGrossRequirement - item.availableInventory, 0)
  }));
}
