"use server";

import { parseSpreadsheetFile, normalizeMasterDataRows } from "@/lib/import/master-data";
import { syncInventorySummariesForComponents } from "./inventory-summary";
import { createSupabaseAdminClient } from "../admin-client";
import { APP_SETTINGS_TABLE, INVENTORY_LOTS_TABLE, PRIVATE_SCHEMA } from "../table-names";
import { recordHistory, redirect, revalidatePath, requiredValue, stringifyHistoryValue } from "./shared";

export async function updateDefaultSafetyStockAction(formData: FormData) {
  const supabase = createSupabaseAdminClient();
  const value = Number(requiredValue(formData.get("default_safety_stock"), "Default safety stock"));
  const previous = await supabase
    .schema(PRIVATE_SCHEMA)
    .from(APP_SETTINGS_TABLE)
    .select("id,default_safety_stock")
    .eq("id", true)
    .maybeSingle();

  if (previous.error) {
    throw new Error(previous.error.message);
  }

  const result = await supabase.schema(PRIVATE_SCHEMA).from(APP_SETTINGS_TABLE).upsert({
    id: true,
    default_safety_stock: value
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  await recordHistory({
    entity_type: "settings",
    entity_id: "app_settings",
    action_type: "update",
    summary: `Updated default safety stock to ${value}`,
    old_value: stringifyHistoryValue(previous.data),
    new_value: stringifyHistoryValue({ id: true, default_safety_stock: value })
  });

  revalidatePath("/components");
  revalidatePath("/settings");
  redirect("/settings");
}

export async function importMasterDataAction(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirectImportError("Import file is required.");
  }

  const supabase = createSupabaseAdminClient();
  let parsedRows = [] as ReturnType<typeof normalizeMasterDataRows>;

  try {
    parsedRows = normalizeMasterDataRows(await parseSpreadsheetFile(file));
    if (parsedRows.length === 0) {
      redirectImportError("The selected file did not contain any import rows.");
    }

    const componentRows = Array.from(
      new Map(
        parsedRows.map((row) => [
          row.component_sku,
          {
            sku: row.component_sku,
            name: row.component_name,
            category: row.component_category,
            producer: row.component_producer,
            value: row.component_value,
            safety_stock: row.component_safety_stock
          }
        ])
      ).values()
    );

    const componentUpsert = await supabase.from("components").upsert(componentRows, {
      onConflict: "sku"
    });

    if (componentUpsert.error) {
      throw new Error(componentUpsert.error.message);
    }

    const componentsResult = await supabase
      .from("components")
      .select("id,sku")
      .in(
        "sku",
        componentRows.map((row) => row.sku)
      );

    if (componentsResult.error) {
      throw new Error(componentsResult.error.message);
    }

    const componentIdBySku = new Map(
      (componentsResult.data ?? []).map((row) => [row.sku as string, row.id as string])
    );

    const uniqueSellerRows = Array.from(
      new Map(
        parsedRows.map((row) => [
          row.seller_name,
          {
            name: row.seller_name,
            base_url: row.seller_base_url,
            lead_time: row.seller_lead_time_days
          }
        ])
      ).values()
    );

    const existingSellersResult = await supabase
      .from("sellers")
      .select("id,name")
      .in(
        "name",
        uniqueSellerRows.map((row) => row.name)
      );

    if (existingSellersResult.error) {
      throw new Error(existingSellersResult.error.message);
    }

    const sellerIdByName = new Map<string, string>();
    for (const seller of existingSellersResult.data ?? []) {
      if (!sellerIdByName.has(String(seller.name))) {
        sellerIdByName.set(String(seller.name), String(seller.id));
      }
    }

    for (const sellerRow of uniqueSellerRows) {
      const existingSellerId = sellerIdByName.get(sellerRow.name);
      if (existingSellerId) {
        const updateResult = await supabase
          .from("sellers")
          .update({
            base_url: sellerRow.base_url,
            lead_time: sellerRow.lead_time
          })
          .eq("id", existingSellerId);

        if (updateResult.error) {
          throw new Error(updateResult.error.message);
        }

        continue;
      }

      const insertResult = await supabase
        .from("sellers")
        .insert({
          name: sellerRow.name,
          base_url: sellerRow.base_url,
          lead_time: sellerRow.lead_time
        })
        .select("id,name")
        .single<{ id: string; name: string }>();

      if (insertResult.error || !insertResult.data) {
        throw new Error(insertResult.error?.message ?? `Could not create seller ${sellerRow.name}.`);
      }

      sellerIdByName.set(insertResult.data.name, insertResult.data.id);
    }

    const inventoryLotRows = Array.from(
      new Map(
        parsedRows.map((row) => {
          const componentId = componentIdBySku.get(row.component_sku);
          if (!componentId) {
            throw new Error(`Component import resolution failed for SKU ${row.component_sku}.`);
          }

          return [
            componentId,
            {
              component_id: componentId,
              quantity_received: row.inventory_quantity_available,
              quantity_remaining: row.inventory_quantity_available,
              unit_cost: row.inventory_purchase_price,
              source: row.seller_name,
              notes: `Master data import from ${file.name}`
            }
          ];
        })
      ).values()
    );

    if (inventoryLotRows.length > 0) {
      const inventoryLotsInsert = await supabase.from(INVENTORY_LOTS_TABLE).insert(inventoryLotRows);
      if (inventoryLotsInsert.error) {
        throw new Error(inventoryLotsInsert.error.message);
      }
    }

    const componentSellerRows = parsedRows.map((row) => {
      const componentId = componentIdBySku.get(row.component_sku);
      const sellerId = sellerIdByName.get(row.seller_name);

      if (!componentId || !sellerId) {
        throw new Error(`Seller link import resolution failed for ${row.component_sku} / ${row.seller_name}.`);
      }

      return {
        component_id: componentId,
        seller_id: sellerId,
        product_url: row.seller_product_url
      };
    });

    const sellerLinksUpsert = await supabase.from("component_sellers").upsert(componentSellerRows, {
      onConflict: "component_id,seller_id"
    });

    if (sellerLinksUpsert.error) {
      throw new Error(sellerLinksUpsert.error.message);
    }

    await syncInventorySummariesForComponents(
      supabase,
      componentRows.map((row) => componentIdBySku.get(row.sku)).filter((value): value is string => Boolean(value))
    );

    await recordHistory({
      entity_type: "master_data_import",
      action_type: "import",
      summary: `Imported ${parsedRows.length} master data rows from ${file.name}`,
      new_value: stringifyHistoryValue({
        file_name: file.name,
        imported_rows: parsedRows.length,
        components: componentRows.length,
        sellers: uniqueSellerRows.length
      })
    });
  } catch (error) {
    redirectImportError(error instanceof Error ? error.message : "Could not import the selected file.");
  }

  revalidatePath("/components");
  revalidatePath("/inventory");
  revalidatePath("/purchasing");
  revalidatePath("/settings");
  redirect("/settings");
}

function redirectImportError(message: string): never {
  redirect(`/settings?importError=${encodeURIComponent(message)}`);
}
