import * as XLSX from "xlsx";

export const VERSION_BOM_REQUIRED_FIELDS = ["sku", "reference"] as const;

const SKU_HEADERS = new Set(["sku", "component_sku"]);
const REFERENCE_HEADERS = new Set(["reference", "references", "ref", "designator"]);

type LooseRow = Record<string, unknown>;
type SheetRow = unknown[];

export interface VersionBomImportRow {
  sku: string;
  reference: string;
}

export async function parseVersionBomFile(file: File) {
  const buffer = await file.arrayBuffer();
  return parseVersionBomBuffer(buffer);
}

export function parseVersionBomBuffer(buffer: ArrayBuffer) {
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
  const headerRowIndex = rows.findIndex((row) => hasLogicalHeaders(row));

  if (headerRowIndex === -1) {
    throw new Error("Could not find BOM columns for SKU and reference.");
  }

  const headers = (rows[headerRowIndex] ?? []).map((cell) => String(cell ?? "").trim());

  return rows
    .slice(headerRowIndex + 1)
    .filter((row) => row.some((cell) => String(cell ?? "").trim().length > 0))
    .map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, String(row[index] ?? "").trim()]))
    );
}

export function normalizeVersionBomRows(rows: LooseRow[]) {
  const normalized: VersionBomImportRow[] = [];
  const skuByReference = new Map<string, string>();

  for (const [index, row] of rows.entries()) {
    const sku = readLogicalValue(row, SKU_HEADERS).trim();
    const references = readLogicalValue(row, REFERENCE_HEADERS)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (!sku) {
      throw new Error(`Import row ${index + 1}: missing required value for sku`);
    }

    if (references.length === 0) {
      throw new Error(`Import row ${index + 1}: missing required value for reference`);
    }

    for (const reference of references) {
      const existingSku = skuByReference.get(reference);

      if (existingSku && existingSku !== sku) {
        throw new Error(`Reference "${reference}" is assigned to more than one SKU.`);
      }

      if (existingSku === sku) {
        throw new Error(`Duplicate reference "${reference}" in BOM import.`);
      }

      skuByReference.set(reference, sku);
      normalized.push({ sku, reference });
    }
  }

  return normalized;
}

export function buildVersionBomReferenceRows(args: {
  versionId: string;
  rows: VersionBomImportRow[];
  components: Array<{ id: string; sku: string }>;
}) {
  const componentIdBySku = buildComponentIdBySku(args.components);

  return args.rows.map((row) => {
    const componentId = componentIdBySku.get(row.sku.trim().toUpperCase());
    if (!componentId) {
      throw new Error(`Unknown SKU in BOM import: ${row.sku}`);
    }

    return {
      version_id: args.versionId,
      component_master_id: componentId,
      reference: row.reference
    };
  });
}

export function findUnknownVersionBomSkus(
  rows: VersionBomImportRow[],
  components: Array<{ sku: string }>
) {
  const knownSkus = new Set(components.map((component) => component.sku.trim().toUpperCase()));

  return Array.from(
    new Set(
      rows
        .map((row) => row.sku.trim())
        .filter((sku) => !knownSkus.has(sku.toUpperCase()))
    )
  ).sort((left, right) => left.localeCompare(right));
}

function hasLogicalHeaders(row: SheetRow) {
  const headers = new Set(row.map((cell) => String(cell ?? "").trim().toLowerCase()));
  return Array.from(SKU_HEADERS).some((header) => headers.has(header))
    && Array.from(REFERENCE_HEADERS).some((header) => headers.has(header));
}

function readLogicalValue(row: LooseRow, acceptedHeaders: Set<string>) {
  for (const [key, value] of Object.entries(row)) {
    if (acceptedHeaders.has(key.trim().toLowerCase())) {
      return String(value ?? "");
    }
  }

  return "";
}

function buildComponentIdBySku(components: Array<{ id: string; sku: string }>) {
  return new Map(components.map((component) => [component.sku.trim().toUpperCase(), component.id]));
}
