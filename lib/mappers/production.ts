import { consumeInventoryLotsFifo } from "./inventory-lots.ts";
import type { InventoryLot } from "../types/domain.ts";

export interface ReservedRequirementInput {
  component_id: string;
  gross_requirement: number;
  inventory_consumed: number;
  inventory_consumed_cost?: number;
  net_requirement: number;
  quantity: number;
}

export interface ReservedRequirementSummary {
  grossRequirement: number;
  inventoryConsumed: number;
  inventoryConsumedCost: number;
  netRequirement: number;
  activeProductionQuantity: number;
  activeEntryCount: number;
}

export interface CompletionRequirementInput {
  id: string;
  component_id: string;
  gross_requirement: number;
  inventory_consumed: number;
  net_requirement: number;
}

export function planProductionCompletionConsumption(input: {
  requirements: CompletionRequirementInput[];
  lotsByComponent: Record<string, InventoryLot[]>;
  componentNames?: Record<string, string>;
}) {
  const missing: Array<{ componentId: string; componentName: string; missingQuantity: number }> = [];
  const lotUpdates: InventoryLot[] = [];
  const requirementUpdates: Array<{
    id: string;
    inventory_consumed: number;
    inventory_consumed_cost: number;
    net_requirement: number;
  }> = [];
  const affectedComponentIds = new Set<string>();

  for (const requirement of input.requirements) {
    const outstandingRequirement = Math.max(
      requirement.gross_requirement - requirement.inventory_consumed,
      0
    );

    if (outstandingRequirement <= 0) {
      continue;
    }

    const lots = input.lotsByComponent[requirement.component_id] ?? [];
    const consumption = consumeInventoryLotsFifo(lots, outstandingRequirement);

    if (consumption.remainingRequirement > 0) {
      missing.push({
        componentId: requirement.component_id,
        componentName:
          input.componentNames?.[requirement.component_id] ?? requirement.component_id,
        missingQuantity: consumption.remainingRequirement
      });
      continue;
    }

    affectedComponentIds.add(requirement.component_id);
    lotUpdates.push(...consumption.updatedLots);
    requirementUpdates.push({
      id: requirement.id,
      inventory_consumed: requirement.inventory_consumed + consumption.inventoryConsumed,
      inventory_consumed_cost: consumption.consumedValue,
      net_requirement: 0
    });
  }

  if (missing.length > 0) {
    const details = missing
      .map((item) => `${item.componentName} (${item.missingQuantity})`)
      .join(", ");
    return {
      ok: false as const,
      message: `Cannot complete production. Missing stock for: ${details}.`
    };
  }

  return {
    ok: true as const,
    lotUpdates,
    requirementUpdates,
    affectedComponentIds: Array.from(affectedComponentIds)
  };
}

export function summarizeReservedRequirements(items: ReservedRequirementInput[]) {
  return items.reduce<Record<string, ReservedRequirementSummary>>((summary, item) => {
    const existing = summary[item.component_id];
    if (existing) {
      existing.grossRequirement += item.gross_requirement;
      existing.inventoryConsumed += item.inventory_consumed;
      existing.inventoryConsumedCost += item.inventory_consumed_cost ?? 0;
      existing.netRequirement += item.net_requirement;
      existing.activeProductionQuantity += item.quantity;
      existing.activeEntryCount += 1;
      return summary;
    }

    summary[item.component_id] = {
      grossRequirement: item.gross_requirement,
      inventoryConsumed: item.inventory_consumed,
      inventoryConsumedCost: item.inventory_consumed_cost ?? 0,
      netRequirement: item.net_requirement,
      activeProductionQuantity: item.quantity,
      activeEntryCount: 1
    };
    return summary;
  }, {});
}
