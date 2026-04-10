import { unstable_noStore as noStore } from "next/cache";
import type { ComponentMaster, InventoryItem } from "@/lib/types/domain";
import { createSupabaseClient } from "../client";
import { safeSelect } from "./shared";

export async function getInventoryOverview(filters?: {
  category?: string;
  search?: string;
}): Promise<{ items: Array<InventoryItem & { component: ComponentMaster | null }>; error: string | null }> {
  noStore();
  const supabase = await createSupabaseClient();
  const [inventoryResult, componentsResult] = await Promise.all([
    safeSelect<InventoryItem>(
      supabase.from("inventory").select("id,component_id,quantity_available,purchase_price")
    ),
    safeSelect<ComponentMaster>(
      supabase.from("components").select("id,sku,name,category,producer,value,safety_stock").order("category").order("name")
    )
  ]);

  let components = componentsResult.data;
  if (filters?.category) {
    components = components.filter((component) => component.category === filters.category);
  }

  if (filters?.search) {
    const needle = filters.search.toLowerCase();
    components = components.filter((component) =>
      [component.sku, component.name, component.producer, component.value ?? ""].some((value) =>
        value.toLowerCase().includes(needle)
      )
    );
  }

  const componentMap = new Map(components.map((component) => [component.id, component]));

  return {
    items: inventoryResult.data
      .map((item) => ({
        ...item,
        component: componentMap.get(item.component_id) ?? null
      }))
      .filter((item) => item.component !== null),
    error: inventoryResult.error ?? componentsResult.error
  };
}
