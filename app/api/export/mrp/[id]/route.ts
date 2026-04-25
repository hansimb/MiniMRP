import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/require-admin";
import { rowsToCsv } from "@/lib/mappers/export";
import { buildMrpRows, summarizeMrpRows } from "@/lib/mappers/mrp";
import { getRuntimeQueries } from "@/lib/runtime";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const adminResponse = await requireAdminApiAccess("/api/export/mrp");
  if (adminResponse) {
    return adminResponse;
  }

  const params = await context.params;
  const { searchParams } = new URL(request.url);
  const buildQuantity = Math.max(Number(searchParams.get("quantity") ?? "1") || 1, 1);
  const queries = await getRuntimeQueries();
  const { item } = await queries.getVersionDetail(params.id);
  const rows = buildMrpRows(item?.components ?? [], buildQuantity);
  const summary = summarizeMrpRows(rows);

  const csv = rowsToCsv(
    [
      ...rows.map((row) => ({
        component: row.componentName,
        category: row.category,
        producer: row.producer,
        references: row.references.join(", "),
        qty_per_product: row.quantityPerProduct,
        safety_stock: row.safetyStock,
        available_inventory: row.availableInventory,
        gross_requirement: row.grossRequirement,
        net_requirement: row.netRequirement,
        lead_time: row.leadTime,
        unit_price: row.unitPrice,
        gross_cost: row.grossCost,
        net_cost: row.netCost
      })),
      {
        component: "Total",
        category: null,
        producer: null,
        references: null,
        qty_per_product: summary.quantityPerProduct,
        safety_stock: summary.safetyStock,
        available_inventory: summary.availableInventory,
        gross_requirement: summary.grossRequirement,
        net_requirement: summary.netRequirement,
        lead_time: summary.maxLeadTime,
        unit_price: null,
        gross_cost: summary.grossCost,
        net_cost: summary.netCost
      }
    ]
  );

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="mrp-${params.id}.csv"`
    }
  });
}
