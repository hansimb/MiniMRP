import test from "node:test";
import assert from "node:assert/strict";
import {
  MASTER_DATA_REQUIRED_COLUMNS,
  normalizeMasterDataRows
} from "../lib/import/master-data.ts";

test("master data import exposes the required columns from the spec", () => {
  assert.deepEqual(MASTER_DATA_REQUIRED_COLUMNS, [
    "component_sku",
    "component_name",
    "component_category",
    "component_producer",
    "component_value",
    "component_safety_stock",
    "inventory_quantity_available",
    "inventory_purchase_price",
    "seller_name",
    "seller_base_url",
    "seller_lead_time_days",
    "seller_product_url"
  ]);
});

test("normalizeMasterDataRows trims values and parses numeric fields", () => {
  const rows = normalizeMasterDataRows([
    {
      component_sku: " RES-10K-0603 ",
      component_name: "Resistor 10k 0603",
      component_category: "Resistor",
      component_producer: "Yageo",
      component_value: "10k",
      component_safety_stock: "200",
      inventory_quantity_available: "5200",
      inventory_purchase_price: "0.004",
      seller_name: "Mouser",
      seller_base_url: "https://www.mouser.com",
      seller_lead_time_days: "7",
      seller_product_url: "https://www.mouser.com/res-10k"
    }
  ]);

  assert.deepEqual(rows, [
    {
      component_sku: "RES-10K-0603",
      component_name: "Resistor 10k 0603",
      component_category: "Resistor",
      component_producer: "Yageo",
      component_value: "10k",
      component_safety_stock: 200,
      inventory_quantity_available: 5200,
      inventory_purchase_price: 0.004,
      seller_name: "Mouser",
      seller_base_url: "https://www.mouser.com",
      seller_lead_time_days: 7,
      seller_product_url: "https://www.mouser.com/res-10k"
    }
  ]);
});

test("normalizeMasterDataRows rejects rows missing required columns", () => {
  assert.throws(
    () =>
      normalizeMasterDataRows([
        {
          component_sku: "RES-10K-0603"
        }
      ]),
    /Missing required columns/
  );
});

test("normalizeMasterDataRows rejects invalid numeric values", () => {
  assert.throws(
    () =>
      normalizeMasterDataRows([
        {
          component_sku: "RES-10K-0603",
          component_name: "Resistor 10k 0603",
          component_category: "Resistor",
          component_producer: "Yageo",
          component_value: "10k",
          component_safety_stock: "oops",
          inventory_quantity_available: "5200",
          inventory_purchase_price: "0.004",
          seller_name: "Mouser",
          seller_base_url: "https://www.mouser.com",
          seller_lead_time_days: "7",
          seller_product_url: "https://www.mouser.com/res-10k"
        }
      ]),
    /Invalid numeric value/
  );
});
