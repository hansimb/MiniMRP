import * as XLSX from "xlsx";

export const MASTER_DATA_REQUIRED_COLUMNS = [
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
] as const;

export interface MasterDataImportRow {
  component_sku: string;
  component_name: string;
  component_category: string;
  component_producer: string;
  component_value: string;
  component_safety_stock: number;
  inventory_quantity_available: number;
  inventory_purchase_price: number;
  seller_name: string;
  seller_base_url: string;
  seller_lead_time_days: number;
  seller_product_url: string;
}

type LooseRow = Record<string, unknown>;

export async function parseSpreadsheetFile(file: File) {
  const buffer = await file.arrayBuffer();
  return parseSpreadsheetBuffer(buffer);
}

export function parseSpreadsheetBuffer(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, {
    type: "array"
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return [] as LooseRow[];
  }

  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json<LooseRow>(sheet, {
    defval: "",
    raw: false
  });
}

export function normalizeMasterDataRows(rows: LooseRow[]): MasterDataImportRow[] {
  if (rows.length === 0) {
    return [];
  }

  const columns = new Set(Object.keys(rows[0] ?? {}));
  const missingColumns = MASTER_DATA_REQUIRED_COLUMNS.filter((column) => !columns.has(column));
  if (missingColumns.length > 0) {
    throw new Error(`Missing required columns: ${missingColumns.join(", ")}`);
  }

  return rows.map((row, index) => ({
    component_sku: readText(row, "component_sku", index),
    component_name: readText(row, "component_name", index),
    component_category: readText(row, "component_category", index),
    component_producer: readText(row, "component_producer", index),
    component_value: readText(row, "component_value", index),
    component_safety_stock: readNumber(row, "component_safety_stock", index),
    inventory_quantity_available: readNumber(row, "inventory_quantity_available", index),
    inventory_purchase_price: readNumber(row, "inventory_purchase_price", index),
    seller_name: readText(row, "seller_name", index),
    seller_base_url: readText(row, "seller_base_url", index),
    seller_lead_time_days: readNumber(row, "seller_lead_time_days", index),
    seller_product_url: readText(row, "seller_product_url", index)
  }));
}

function readText(row: LooseRow, key: string, index: number) {
  const value = String(row[key] ?? "").trim();
  if (!value) {
    throw new Error(`Row ${index + 1}: missing value for ${key}`);
  }
  return value;
}

function readNumber(row: LooseRow, key: string, index: number) {
  const raw = String(row[key] ?? "").trim();
  const value = Number(raw);

  if (!raw || Number.isNaN(value)) {
    throw new Error(`Invalid numeric value for ${key} on row ${index + 1}`);
  }

  return value;
}
