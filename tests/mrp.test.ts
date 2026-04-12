import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMrpRows,
  summarizeMrpRows,
  calculateVersionUnitCost,
  calculateWeightedAveragePrice,
  buildProductionShortageMetrics,
  calculateProductionLongestLeadTime
} from "../lib/mappers/mrp.ts";

test("buildMrpRows calculates quantities and costs", () => {
  const rows = buildMrpRows(
    [
      {
        component: {
          id: "1",
          sku: "RES-10K-0603",
          name: "Resistor",
          category: "Resistor",
          producer: "Yageo",
          value: "10k",
          safety_stock: 2
        },
        references: ["R1", "R2"],
        quantity: 2,
        lead_time: null,
        inventory: {
          id: "inv-1",
          component_id: "1",
          quantity_available: 3,
          purchase_price: 0.5
        }
      }
    ],
    4
  );

  assert.equal(rows[0]?.grossRequirement, 8);
  assert.equal(rows[0]?.netRequirement, 5);
  assert.equal(rows[0]?.reservedForThisCalculation, 3);
  assert.equal(rows[0]?.reservedForEntry, null);
  assert.equal(rows[0]?.grossCost, 4);
  assert.equal(rows[0]?.netCost, 2.5);
});

test("calculateVersionUnitCost sums one product cost", () => {
  const total = calculateVersionUnitCost([
    {
        component: {
          id: "1",
          sku: "CAP-100NF-0603",
          name: "Cap",
          category: "Capacitor",
          producer: "Murata",
          value: "100nF",
          safety_stock: 10
        },
        references: ["C1", "C2", "C3"],
        quantity: 3,
        lead_time: null,
      inventory: {
        id: "inv-1",
        component_id: "1",
        quantity_available: 100,
        purchase_price: 0.2
      }
    }
  ]);

  assert.equal(total, 0.6);
});

test("calculateWeightedAveragePrice returns null when no priced stock exists", () => {
  assert.equal(calculateWeightedAveragePrice([]), null);
});

test("summarizeMrpRows returns totals for numeric columns", () => {
  const summary = summarizeMrpRows([
    {
      componentId: "1",
      sku: "SKU-1",
      componentName: "A",
      category: "IC",
      producer: "X",
      value: null,
      references: ["U1"],
      quantityPerProduct: 2,
      buildQuantity: 5,
      safetyStock: 25,
      leadTime: 7,
      availableInventory: 3,
      unitPrice: 1.5,
      grossRequirement: 10,
      netRequirement: 7,
      grossCost: 15,
      netCost: 10.5,
      reservedForThisCalculation: 3,
      reservedForEntry: 2,
      reservedInventory: 2
    },
    {
      componentId: "2",
      sku: "SKU-2",
      componentName: "B",
      category: "IC",
      producer: "Y",
      value: null,
      references: ["U2"],
      quantityPerProduct: 1,
      buildQuantity: 5,
      safetyStock: 10,
      leadTime: 14,
      availableInventory: 6,
      unitPrice: 2,
      grossRequirement: 5,
      netRequirement: 0,
      grossCost: 10,
      netCost: 0,
      reservedForThisCalculation: 5,
      reservedForEntry: null,
      reservedInventory: 1
    }
  ]);

  assert.equal(summary.quantityPerProduct, 3);
  assert.equal(summary.safetyStock, 35);
  assert.equal(summary.maxLeadTime, 14);
  assert.equal(summary.availableInventory, 9);
  assert.equal(summary.grossRequirement, 15);
  assert.equal(summary.netRequirement, 7);
  assert.equal(summary.reservedInventory, 3);
  assert.equal(summary.grossCost, 25);
  assert.equal(summary.netCost, 10.5);
});

test("buildMrpRows carries lead time through to results", () => {
  const rows = buildMrpRows(
    [
      {
        component: {
          id: "1",
          sku: "MCU-STM32F4",
          name: "MCU",
          category: "IC",
          producer: "ST",
          value: "STM32",
          safety_stock: 5
        },
        references: ["U1"],
        quantity: 1,
        lead_time: 21,
        inventory: {
          id: "inv-1",
          component_id: "1",
          quantity_available: 1,
          purchase_price: 3.2
        }
      }
    ],
    3
  );

  assert.equal(rows[0]?.netRequirement, 2);
  assert.equal(rows[0]?.leadTime, 21);
});

test("buildPurchasingBuckets separates shortages and near-safety components", async () => {
  const { buildPurchasingBuckets } = await import("../lib/mappers/mrp.ts");

  const result = buildPurchasingBuckets([
    {
      id: "1",
      sku: "IC-LOW-STOCK",
      name: "Low stock IC",
      category: "IC",
      producer: "TI",
      value: "ABC",
      safety_stock: 20,
      quantity_available: 8,
      purchase_price: 1.5,
      lead_time: 14
    },
    {
      id: "2",
      sku: "CAP-NEAR-STOCK",
      name: "Near stock cap",
      category: "Capacitor",
      producer: "Murata",
      value: "10uF",
      safety_stock: 20,
      quantity_available: 26,
      purchase_price: 0.2,
      lead_time: 7
    },
    {
      id: "3",
      sku: "RES-HEALTHY",
      name: "Healthy resistor",
      category: "Resistor",
      producer: "Yageo",
      value: "10k",
      safety_stock: 20,
      quantity_available: 80,
      purchase_price: 0.01,
      lead_time: 5
    }
  ]);

  assert.equal(result.shortages.length, 1);
  assert.equal(result.shortages[0]?.recommended_order_quantity, 32);
  assert.equal(result.nearSafety.length, 2);
  assert.equal(result.nearSafety[0]?.id, "1");
  assert.equal(result.nearSafety[1]?.id, "2");
});

test("buildProductionShortageMetrics clears current shortage when available inventory now covers the stored net need", () => {
  const metrics = buildProductionShortageMetrics({
    totalGrossRequirement: 40,
    totalNetRequirement: 12,
    availableInventory: 28,
    safetyStock: 25
  });

  assert.equal(metrics.netNeed, 0);
  assert.equal(metrics.recommendedOrderQuantity, 0);
});

test("buildProductionShortageMetrics hides shortages when current inventory exceeds the stored net requirement", () => {
  const metrics = buildProductionShortageMetrics({
    totalGrossRequirement: 40,
    totalNetRequirement: 12,
    availableInventory: 35,
    safetyStock: 25
  });

  assert.equal(metrics.netNeed, 0);
  assert.equal(metrics.recommendedOrderQuantity, 0);
});

test("buildProductionShortageMetrics does not recommend an order when current inventory already covers the stored net requirement", () => {
  const metrics = buildProductionShortageMetrics({
    totalGrossRequirement: 40,
    totalNetRequirement: 12,
    availableInventory: 45,
    safetyStock: 25
  });

  assert.equal(metrics.netNeed, 0);
  assert.equal(metrics.recommendedOrderQuantity, 0);
});

test("buildProductionShortageMetrics subtracts currently available stock from the current net need", () => {
  const metrics = buildProductionShortageMetrics({
    totalGrossRequirement: 200,
    totalNetRequirement: 100,
    availableInventory: 16,
    safetyStock: 40
  });

  assert.equal(metrics.netNeed, 84);
  assert.equal(metrics.recommendedOrderQuantity, 124);
});

test("calculateProductionLongestLeadTime ignores covered rows", () => {
  const longestLeadTime = calculateProductionLongestLeadTime([
    {
      componentId: "1",
      sku: "SKU-1",
      componentName: "Covered part",
      category: "IC",
      producer: "X",
      value: null,
      references: ["U1"],
      quantityPerProduct: 1,
      buildQuantity: 5,
      safetyStock: 10,
      leadTime: 21,
      availableInventory: 10,
      unitPrice: 1,
      grossRequirement: 5,
      netRequirement: 0,
      grossCost: 5,
      netCost: 0,
      reservedForThisCalculation: 5,
      reservedForEntry: null
    },
    {
      componentId: "2",
      sku: "SKU-2",
      componentName: "Short part",
      category: "IC",
      producer: "Y",
      value: null,
      references: ["U2"],
      quantityPerProduct: 1,
      buildQuantity: 5,
      safetyStock: 10,
      leadTime: 14,
      availableInventory: 1,
      unitPrice: 2,
      grossRequirement: 5,
      netRequirement: 4,
      grossCost: 10,
      netCost: 8,
      reservedForThisCalculation: 1,
      reservedForEntry: null
    }
  ]);

  assert.equal(longestLeadTime, 14);
});

test("calculateProductionLongestLeadTime returns zero when all parts are covered by inventory", () => {
  const longestLeadTime = calculateProductionLongestLeadTime([
    {
      componentId: "1",
      sku: "SKU-1",
      componentName: "Covered part",
      category: "IC",
      producer: "X",
      value: null,
      references: ["U1"],
      quantityPerProduct: 1,
      buildQuantity: 5,
      safetyStock: 10,
      leadTime: 21,
      availableInventory: 10,
      unitPrice: 1,
      grossRequirement: 5,
      netRequirement: 0,
      grossCost: 5,
      netCost: 0,
      reservedForThisCalculation: 5,
      reservedForEntry: null
    }
  ]);

  assert.equal(longestLeadTime, 0);
});
