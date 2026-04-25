import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/require-admin";
import { rowsToCsv } from "@/lib/mappers/export";
import { getRuntimeQueries } from "@/lib/runtime";

export async function GET(request: Request) {
  const adminResponse = await requireAdminApiAccess("/api/export/components");
  if (adminResponse) {
    return adminResponse;
  }

  const { searchParams } = new URL(request.url);
  const queries = await getRuntimeQueries();
  const { items } = await queries.getPartCatalog({
    category: searchParams.get("category") ?? undefined,
    search: searchParams.get("search") ?? undefined
  });

  const csv = rowsToCsv(
    items.map((item) => ({
      sku: item.sku,
      name: item.name,
      category: item.category,
      producer: item.producer,
      value: item.value ?? "",
      safety_stock: item.safety_stock
    }))
  );

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="components.csv"'
    }
  });
}
