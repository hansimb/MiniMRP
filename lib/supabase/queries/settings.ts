import { unstable_noStore as noStore } from "next/cache";
import type { AppSettings } from "@/lib/types/domain";
import { createSupabaseAdminClient } from "../admin-client";
import { APP_SETTINGS_TABLE, PRIVATE_SCHEMA } from "../table-names";

export async function getAppSettings(): Promise<{ item: AppSettings | null; error: string | null }> {
  noStore();
  const supabase = createSupabaseAdminClient();
  const result = await supabase
    .schema(PRIVATE_SCHEMA)
    .from(APP_SETTINGS_TABLE)
    .select("id,default_safety_stock,near_safety_threshold_percent")
    .eq("id", true)
    .maybeSingle<AppSettings>();

  if (result.error) {
    return { item: null, error: result.error.message };
  }

  return {
    item: result.data ?? { id: true, default_safety_stock: 25, near_safety_threshold_percent: 10 },
    error: null
  };
}
