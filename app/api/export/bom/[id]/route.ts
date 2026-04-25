import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/require-admin";
import { rowsToCsv } from "@/lib/mappers/export";
import { getRuntimeQueries } from "@/lib/runtime";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const adminResponse = await requireAdminApiAccess("/api/export/bom");
  if (adminResponse) {
    return adminResponse;
  }

  const params = await context.params;
  const queries = await getRuntimeQueries();
  const { item } = await queries.getVersionDetail(params.id);

  const csv = rowsToCsv(
    (item?.components ?? []).map((row) => ({
      component: row.component.name,
      category: row.component.category,
      producer: row.component.producer,
      value: row.component.value ?? "",
      references: row.references.join(", "),
      quantity: row.quantity
    }))
  );

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="bom-${params.id}.csv"`
    }
  });
}
