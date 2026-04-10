import { NextResponse } from "next/server";
import { rowsToCsv } from "@/lib/mappers/export";
import { getPurchasingOverview } from "@/lib/supabase/queries/index";

export async function GET() {
  const { shortages } = await getPurchasingOverview();

  const csv = rowsToCsv(
    shortages.map((item) => ({
      sku: item.sku,
      component: item.name,
      category: item.category,
      producer: item.producer,
      value: item.value ?? "",
      available_inventory: item.quantity_available,
      safety_stock: item.safety_stock,
      net_need: item.net_need,
      recommended_order: item.recommended_order_quantity,
      lead_time: item.lead_time,
      seller_name: item.seller_name ?? "",
      seller_url: item.seller_product_url ?? item.seller_base_url ?? ""
    }))
  );

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="purchasing-shortages.csv"'
    }
  });
}
