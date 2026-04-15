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

export const MASTER_DATA_REQUIRED_VALUE_COLUMNS = [...MASTER_DATA_REQUIRED_COLUMNS] as const;

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
type SheetRow = unknown[];

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
  const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, {
    header: 1,
    defval: "",
    raw: false
  });
  const headerRowIndex = rows.findIndex((row) => hasRequiredColumns(row));

  if (headerRowIndex === -1) {
    throw new Error(`Could not find a header row with required columns: ${MASTER_DATA_REQUIRED_COLUMNS.join(", ")}`);
  }

  const headers = (rows[headerRowIndex] ?? []).map((cell) => String(cell ?? "").trim());

  return rows
    .slice(headerRowIndex + 1)
    .filter((row) => row.some((cell) => String(cell ?? "").trim().length > 0))
    .map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, String(row[index] ?? "").trim()]))
    );
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

  const normalizedRows: MasterDataImportRow[] = [];
  const rowErrors: string[] = [];

  for (const [index, row] of rows.entries()) {
    const missingFields: string[] = [];
    const invalidNumericFields: string[] = [];

    const normalizedRow = {
      component_sku: readRequiredText(row, "component_sku", missingFields),
      component_name: readRequiredText(row, "component_name", missingFields),
      component_category: readRequiredText(row, "component_category", missingFields),
      component_producer: readRequiredText(row, "component_producer", missingFields),
      component_value: readRequiredText(row, "component_value", missingFields),
      component_safety_stock: readRequiredNumber(row, "component_safety_stock", missingFields, invalidNumericFields),
      inventory_quantity_available: readRequiredNumber(row, "inventory_quantity_available", missingFields, invalidNumericFields),
      inventory_purchase_price: readRequiredNumber(row, "inventory_purchase_price", missingFields, invalidNumericFields),
      seller_name: readRequiredText(row, "seller_name", missingFields),
      seller_base_url: normalizeImportedUrl(readRequiredText(row, "seller_base_url", missingFields)) ?? "",
      seller_lead_time_days: readRequiredNumber(row, "seller_lead_time_days", missingFields, invalidNumericFields),
      seller_product_url: normalizeImportedUrl(readRequiredText(row, "seller_product_url", missingFields)) ?? ""
    };

    if (missingFields.length > 0 || invalidNumericFields.length > 0) {
      const messages: string[] = [];
      if (missingFields.length > 0) {
        messages.push(`missing required values for ${missingFields.join(", ")}`);
      }
      if (invalidNumericFields.length > 0) {
        messages.push(`invalid numeric values for ${invalidNumericFields.join(", ")}`);
      }
      rowErrors.push(`Import row ${index + 1}: ${messages.join("; ")}`);
      continue;
    }

    normalizedRows.push(normalizedRow);
  }

  if (rowErrors.length > 0) {
    throw new Error(rowErrors.join(" "));
  }

  return normalizedRows;
}

function hasRequiredColumns(row: SheetRow) {
  const columns = new Set(row.map((cell) => String(cell ?? "").trim()));
  return MASTER_DATA_REQUIRED_COLUMNS.every((column) => columns.has(column));
}

function readRequiredText(row: LooseRow, key: string, missingFields: string[]) {
  const value = String(row[key] ?? "").trim();
  if (!value) {
    missingFields.push(key);
  }
  return value;
}

function normalizeImportedUrl(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }

  if (text.startsWith("//")) {
    return `https:${text}`;
  }

  if (/^[a-z][a-z\d+.-]*:/i.test(text)) {
    return text;
  }

  return `https://${text.replace(/^\/+/, "")}`;
}

function readRequiredNumber(
  row: LooseRow,
  key: string,
  missingFields: string[],
  invalidNumericFields: string[]
) {
  const raw = String(row[key] ?? "").trim();
  if (!raw) {
    missingFields.push(key);
    return 0;
  }

  const value = Number(raw);
  if (Number.isNaN(value)) {
    invalidNumericFields.push(key);
    return 0;
  }

  return value;
}
