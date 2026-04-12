import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import {
  MASTER_DATA_REQUIRED_COLUMNS,
  normalizeMasterDataRows,
  parseSpreadsheetBuffer
} from "../lib/import/master-data.ts";

function buildWorkbookBuffer(rows: Array<Array<string | number>>) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "Masterlist");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

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
    /invalid numeric values for component_safety_stock/i
  );
});

test("parseSpreadsheetBuffer finds the required header row below introductory rows", () => {
  const buffer = buildWorkbookBuffer([
    ["Spectrum Audio Instruments; Component Masterlist"],
    [""],
    ["Pedal parts"],
    [...MASTER_DATA_REQUIRED_COLUMNS],
    [
      "RES-1M",
      "Metal film resistor",
      "Metal film resistors 0.25W",
      "Vishay",
      "1M",
      100,
      2500,
      0.01,
      "MUSIK",
      "www.musikding.de",
      10,
      "www.musikding.de/pr05"
    ]
  ]);

  const rows = parseSpreadsheetBuffer(buffer);

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.component_sku, "RES-1M");
  assert.equal(rows[0]?.seller_name, "MUSIK");
});

test("normalizeMasterDataRows reports every missing required value on an import row", () => {
  assert.throws(
    () =>
      normalizeMasterDataRows([
        {
          component_sku: "",
          component_name: "",
          component_category: "Metal film resistors 0.25W",
          component_producer: "Vishay",
          component_value: "1M",
          component_safety_stock: "",
          inventory_quantity_available: "",
          inventory_purchase_price: "",
          seller_name: "",
          seller_base_url: "",
          seller_lead_time_days: "",
          seller_product_url: ""
        }
      ]),
    /component_sku, component_name, component_safety_stock, inventory_quantity_available, inventory_purchase_price, seller_name, seller_base_url, seller_lead_time_days, seller_product_url/
  );
});

test("normalizeMasterDataRows normalizes seller URLs without a protocol", () => {
  const rows = normalizeMasterDataRows([
    {
      component_sku: "RES-10K-0603",
      component_name: "Resistor 10k 0603",
      component_category: "Resistor",
      component_producer: "Yageo",
      component_value: "10k",
      component_safety_stock: "200",
      inventory_quantity_available: "5200",
      inventory_purchase_price: "0.004",
      seller_name: "Mouser",
      seller_base_url: "www.mouser.com",
      seller_lead_time_days: "7",
      seller_product_url: "www.mouser.com/res-10k"
    }
  ]);

  assert.equal(rows[0]?.seller_base_url, "https://www.mouser.com");
  assert.equal(rows[0]?.seller_product_url, "https://www.mouser.com/res-10k");
});
