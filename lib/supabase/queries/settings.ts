import { unstable_noStore as noStore } from "next/cache";
import { isMissingColumnError } from "@/lib/mappers/supabase-errors";
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
    if (isMissingColumnError(result.error.message, APP_SETTINGS_TABLE, "near_safety_threshold_percent")) {
      const fallback = await supabase
        .schema(PRIVATE_SCHEMA)
        .from(APP_SETTINGS_TABLE)
        .select("id,default_safety_stock")
        .eq("id", true)
        .maybeSingle<{ id: true; default_safety_stock: number }>();

      if (fallback.error) {
        return { item: null, error: fallback.error.message };
      }

      return {
        item: fallback.data
          ? {
              id: fallback.data.id,
              default_safety_stock: fallback.data.default_safety_stock,
              near_safety_threshold_percent: 10
            }
          : { id: true, default_safety_stock: 25, near_safety_threshold_percent: 10 },
        error: null
      };
    }

    return { item: null, error: result.error.message };
  }

  return {
    item: result.data ?? { id: true, default_safety_stock: 25, near_safety_threshold_percent: 10 },
    error: null
  };
}
