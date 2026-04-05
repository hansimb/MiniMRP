import { NextResponse } from "next/server";
import { rowsToCsv } from "@/lib/mappers/export";
import { getComponents } from "@/lib/supabase/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const { items } = await getComponents({
    category: searchParams.get("category") ?? undefined,
    search: searchParams.get("search") ?? undefined
  });

  const csv = rowsToCsv(
    items.map((item) => ({
      name: item.name,
      category: item.category,
      producer: item.producer,
      value: item.value ?? "",
      quantity_available: item.quantity_available ?? "",
      purchase_price: item.purchase_price ?? ""
    }))
  );

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="components.csv"'
    }
  });
}

