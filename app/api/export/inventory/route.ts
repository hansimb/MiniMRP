import { NextResponse } from "next/server";
import { rowsToCsv } from "@/lib/mappers/export";
import { getInventoryOverview } from "@/lib/supabase/queries/index";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const { items } = await getInventoryOverview({
    category: searchParams.get("category") ?? undefined,
    search: searchParams.get("search") ?? undefined
  });

  const csv = rowsToCsv(
    items.map((item) => ({
      sku: item.component?.sku ?? "",
      component: item.component?.name ?? "",
      category: item.component?.category ?? "",
      producer: item.component?.producer ?? "",
      value: item.component?.value ?? "",
      quantity_available: item.quantity_available,
      purchase_price: item.purchase_price ?? ""
    }))
  );

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="inventory.csv"'
    }
  });
}
