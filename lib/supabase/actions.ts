"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { applyInventoryAdjustment } from "@/lib/mappers/inventory";
import { createSupabaseClient } from "./client";

async function recordHistory(args: {
  entity_type: string;
  entity_id?: string | null;
  action_type: string;
  summary: string;
  old_value?: string | null;
  new_value?: string | null;
}) {
  try {
    const supabase = createSupabaseClient();
    await supabase.from("history_events").insert({
      entity_type: args.entity_type,
      entity_id: args.entity_id ?? null,
      action_type: args.action_type,
      summary: args.summary,
      old_value: args.old_value ?? null,
      new_value: args.new_value ?? null
    });
  } catch {
    // Keep UI actions functional even if history table is not yet applied.
  }
}

function optionalValue(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function requiredValue(value: FormDataEntryValue | null, field: string) {
  const text = String(value ?? "").trim();
  if (!text) {
    throw new Error(`${field} is required.`);
  }
  return text;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stringifyHistoryValue(value: unknown) {
  return JSON.stringify(value);
}

export async function updateComponentAction(formData: FormData) {
  const supabase = createSupabaseClient();
  const id = requiredValue(formData.get("id"), "Component id");
  const previous = await supabase
    .from("components")
    .select("id,name,category,producer,value,safety_stock")
    .eq("id", id)
    .maybeSingle();

  if (previous.error) {
    throw new Error(previous.error.message);
  }

  const nextComponent = {
    name: requiredValue(formData.get("name"), "Name"),
    category: requiredValue(formData.get("category"), "Category"),
    producer: requiredValue(formData.get("producer"), "Producer"),
    value: optionalValue(formData.get("value")),
    safety_stock: Number(optionalValue(formData.get("safety_stock")) ?? "0")
  };

  const { error } = await supabase
    .from("components")
    .update(nextComponent)
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await recordHistory({
    entity_type: "component",
    entity_id: id,
    action_type: "update",
    summary: `Updated component "${nextComponent.name}"`,
    old_value: stringifyHistoryValue(previous.data),
    new_value: stringifyHistoryValue({ id, ...nextComponent })
  });

  revalidatePath("/components");
  revalidatePath(`/components/${id}`);

  const versionId = optionalValue(formData.get("versionId"));
  if (versionId) {
    revalidatePath(`/versions/${versionId}`);
    redirect(`/versions/${versionId}`);
  }

  redirect(`/components/${id}`);
}

export async function createComponentAction(formData: FormData) {
  const supabase = createSupabaseClient();
  const settingsResult = await supabase
    .from("app_settings")
    .select("default_safety_stock")
    .eq("id", true)
    .maybeSingle<{ default_safety_stock: number }>();

  if (settingsResult.error) {
    throw new Error(settingsResult.error.message);
  }

  const defaultSafetyStock = settingsResult.data?.default_safety_stock ?? 25;
  const componentPayload = {
    name: requiredValue(formData.get("name"), "Name"),
    category: requiredValue(formData.get("category"), "Category"),
    producer: requiredValue(formData.get("producer"), "Producer"),
    value: optionalValue(formData.get("value")),
    safety_stock: defaultSafetyStock
  };

  const insertResult = await supabase
    .from("components")
    .insert(componentPayload)
    .select("id,name,category,producer,value,safety_stock")
    .single<{ id: string; name: string; category: string; producer: string; value: string | null; safety_stock: number }>();

  if (insertResult.error || !insertResult.data) {
    throw new Error(insertResult.error?.message ?? "Could not create component.");
  }

  const baseUrl = optionalValue(formData.get("base_url"));
  const sellerName = optionalValue(formData.get("seller_name"));
  const updateLink = optionalValue(formData.get("update_link"));
  if (sellerName) {
    let sellerId: string | null = null;
    const sellerResult = await supabase
      .from("sellers")
      .select("id")
      .eq("name", sellerName)
      .maybeSingle<{ id: string }>();

    if (sellerResult.error) {
      throw new Error(sellerResult.error.message);
    }

    if (sellerResult.data) {
      sellerId = sellerResult.data.id;
      if (baseUrl) {
        const updateSellerResult = await supabase
          .from("sellers")
          .update({ base_url: baseUrl })
          .eq("id", sellerId);
        if (updateSellerResult.error) {
          throw new Error(updateSellerResult.error.message);
        }
      }
    } else {
      const createdSeller = await supabase
        .from("sellers")
        .insert({ name: sellerName, base_url: baseUrl })
        .select("id")
        .single<{ id: string }>();

      if (createdSeller.error || !createdSeller.data) {
        throw new Error(createdSeller.error?.message ?? "Could not create seller.");
      }

      sellerId = createdSeller.data.id;
    }

    const guessedUrl = updateLink ?? (baseUrl ? `${baseUrl.replace(/\/$/, "")}/${slugify(insertResult.data.name)}` : null);

    const linkResult = await supabase.from("component_sellers").upsert(
      {
        component_id: insertResult.data.id,
        seller_id: sellerId,
        product_url: guessedUrl
      },
      { onConflict: "component_id,seller_id" }
    );

    if (linkResult.error) {
      throw new Error(linkResult.error.message);
    }
  }

  await recordHistory({
    entity_type: "component",
    entity_id: insertResult.data.id,
    action_type: "create",
    summary: `Created component "${insertResult.data.name}"`,
    new_value: stringifyHistoryValue(insertResult.data)
  });

  revalidatePath("/components");
  redirect(`/components/${insertResult.data.id}`);
}

export async function deleteComponentAction(formData: FormData) {
  const supabase = createSupabaseClient();
  const id = requiredValue(formData.get("id"), "Component id");
  const previous = await supabase
    .from("components")
    .select("id,name,category,producer,value,safety_stock")
    .eq("id", id)
    .maybeSingle();

  if (previous.error) {
    throw new Error(previous.error.message);
  }

  const result = await supabase.from("components").delete().eq("id", id);
  if (result.error) {
    throw new Error(result.error.message);
  }

  await recordHistory({
    entity_type: "component",
    entity_id: id,
    action_type: "delete",
    summary: `Deleted component ${id}`,
    old_value: stringifyHistoryValue(previous.data)
  });

  revalidatePath("/components");
  redirect("/components");
}

export async function attachComponentToVersionAction(formData: FormData) {
  const supabase = createSupabaseClient();
  const versionId = requiredValue(formData.get("version_id"), "Version id");
  const componentId = requiredValue(formData.get("component_id"), "Component id");
  const referencesRaw = requiredValue(formData.get("references"), "References");

  const references = referencesRaw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  for (const reference of references) {
    const result = await supabase.from("component_references").upsert(
      {
        version_id: versionId,
        component_master_id: componentId,
        reference
      },
      { onConflict: "version_id,reference" }
    );

    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  await recordHistory({
    entity_type: "version",
    entity_id: versionId,
    action_type: "attach_component",
    summary: `Attached component ${componentId} to version ${versionId} with references ${references.join(", ")}`,
    new_value: stringifyHistoryValue({ component_id: componentId, references })
  });

  revalidatePath(`/versions/${versionId}`);
  redirect(`/versions/${versionId}`);
}

export async function removeComponentFromVersionAction(formData: FormData) {
  const supabase = createSupabaseClient();
  const versionId = requiredValue(formData.get("version_id"), "Version id");
  const componentId = requiredValue(formData.get("component_id"), "Component id");
  const previous = await supabase
    .from("component_references")
    .select("version_id,component_master_id,reference")
    .eq("version_id", versionId)
    .eq("component_master_id", componentId);

  if (previous.error) {
    throw new Error(previous.error.message);
  }

  const result = await supabase
    .from("component_references")
    .delete()
    .eq("version_id", versionId)
    .eq("component_master_id", componentId);

  if (result.error) {
    throw new Error(result.error.message);
  }

  await recordHistory({
    entity_type: "version",
    entity_id: versionId,
    action_type: "remove_component",
    summary: `Removed component ${componentId} from version ${versionId}`,
    old_value: stringifyHistoryValue(previous.data)
  });

  revalidatePath(`/versions/${versionId}`);
  redirect(`/versions/${versionId}`);
}

export async function upsertComponentLinkAction(formData: FormData) {
  const supabase = createSupabaseClient();
  const componentId = requiredValue(formData.get("component_id"), "Component id");
  const sellerId = requiredValue(formData.get("seller_id"), "Seller id");
  const baseUrl = optionalValue(formData.get("base_url"));
  const leadTime = optionalValue(formData.get("lead_time"));
  const explicitUrl = optionalValue(formData.get("product_url"));
  const componentName = requiredValue(formData.get("component_name"), "Component name");

  const sellerUpdate = await supabase
    .from("sellers")
    .update({
      base_url: baseUrl,
      lead_time: leadTime ? Number(leadTime) : null
    })
    .eq("id", sellerId);
  if (sellerUpdate.error) {
    throw new Error(sellerUpdate.error.message);
  }

  const guessedUrl = explicitUrl ?? (baseUrl ? `${baseUrl.replace(/\/$/, "")}/${slugify(componentName)}` : null);
  const linkResult = await supabase.from("component_sellers").upsert(
    {
      component_id: componentId,
      seller_id: sellerId,
      product_url: guessedUrl
    },
    { onConflict: "component_id,seller_id" }
  );

  if (linkResult.error) {
    throw new Error(linkResult.error.message);
  }

  await recordHistory({
    entity_type: "seller_link",
    entity_id: componentId,
    action_type: "update",
    summary: `Updated seller link for component ${componentId}`,
    new_value: stringifyHistoryValue({ seller_id: sellerId, base_url: baseUrl, lead_time: leadTime, product_url: guessedUrl })
  });

  revalidatePath(`/components/${componentId}`);
  redirect(`/components/${componentId}`);
}

export async function createSellerForComponentAction(formData: FormData) {
  const supabase = createSupabaseClient();
  const componentId = requiredValue(formData.get("component_id"), "Component id");
  const componentName = requiredValue(formData.get("component_name"), "Component name");
  const sellerName = requiredValue(formData.get("seller_name"), "Seller name");
  const baseUrl = optionalValue(formData.get("base_url"));
  const leadTime = optionalValue(formData.get("lead_time"));
  const explicitUrl = optionalValue(formData.get("product_url"));

  const sellerResult = await supabase
    .from("sellers")
    .insert({
      name: sellerName,
      base_url: baseUrl,
      lead_time: leadTime ? Number(leadTime) : null
    })
    .select("id")
    .single<{ id: string }>();

  if (sellerResult.error || !sellerResult.data) {
    throw new Error(sellerResult.error?.message ?? "Could not create seller.");
  }

  const guessedUrl = explicitUrl ?? (baseUrl ? `${baseUrl.replace(/\/$/, "")}/${slugify(componentName)}` : null);
  const linkResult = await supabase.from("component_sellers").insert({
    component_id: componentId,
    seller_id: sellerResult.data.id,
    product_url: guessedUrl
  });

  if (linkResult.error) {
    throw new Error(linkResult.error.message);
  }

  await recordHistory({
    entity_type: "seller",
    entity_id: sellerResult.data.id,
    action_type: "create",
    summary: `Added seller "${sellerName}" for component ${componentId}`,
    new_value: stringifyHistoryValue({ id: sellerResult.data.id, name: sellerName, base_url: baseUrl, lead_time: leadTime, product_url: guessedUrl })
  });

  revalidatePath(`/components/${componentId}`);
  redirect(`/components/${componentId}`);
}

export async function addInventoryAction(formData: FormData) {
  const supabase = createSupabaseClient();
  const componentId = requiredValue(formData.get("component_id"), "Component id");
  const quantity = Number(requiredValue(formData.get("quantity_available"), "Quantity"));
  const purchasePrice = optionalValue(formData.get("purchase_price"));

  const result = await supabase.from("inventory").insert({
    component_id: componentId,
    quantity_available: quantity,
    purchase_price: purchasePrice ? Number(purchasePrice) : null
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  await recordHistory({
    entity_type: "inventory",
    entity_id: componentId,
    action_type: "create",
    summary: `Added inventory for component ${componentId} with quantity ${quantity}`,
    new_value: stringifyHistoryValue({
      component_id: componentId,
      quantity_available: quantity,
      purchase_price: purchasePrice ? Number(purchasePrice) : null
    })
  });

  revalidatePath("/inventory");
  revalidatePath("/components");
  redirect("/inventory");
}

export async function updateInventoryAction(formData: FormData) {
  const supabase = createSupabaseClient();
  const id = requiredValue(formData.get("id"), "Inventory id");
  const quantity = Number(requiredValue(formData.get("quantity_available"), "Quantity"));
  const previous = await supabase
    .from("inventory")
    .select("id,component_id,quantity_available,purchase_price")
    .eq("id", id)
    .maybeSingle();

  if (previous.error) {
    throw new Error(previous.error.message);
  }

  const result = await supabase
    .from("inventory")
    .update({
      quantity_available: quantity
    })
    .eq("id", id);

  if (result.error) {
    throw new Error(result.error.message);
  }

  await recordHistory({
    entity_type: "inventory",
    entity_id: id,
    action_type: "update",
    summary: `Updated inventory row ${id} to quantity ${quantity}`,
    old_value: stringifyHistoryValue(previous.data),
    new_value: stringifyHistoryValue(previous.data ? { ...previous.data, quantity_available: quantity } : { id, quantity_available: quantity })
  });

  revalidatePath("/inventory");
  revalidatePath("/components");
  redirect("/inventory");
}

export async function adjustInventoryDeltaAction(formData: FormData) {
  const supabase = createSupabaseClient();
  const componentId = requiredValue(formData.get("component_id"), "Component id");
  const mode = requiredValue(formData.get("mode"), "Mode") as "add" | "remove";
  const amount = Number(requiredValue(formData.get("amount"), "Amount"));
  const currentQuantity = Number(requiredValue(formData.get("current_quantity"), "Current quantity"));
  const nextQuantity = applyInventoryAdjustment(currentQuantity, mode, amount);

  const result = await supabase.from("inventory").upsert(
    {
      component_id: componentId,
      quantity_available: nextQuantity
    },
    { onConflict: "component_id" }
  );

  if (result.error) {
    throw new Error(result.error.message);
  }

  await recordHistory({
    entity_type: "inventory",
    entity_id: componentId,
    action_type: "adjust",
    summary: `${mode === "add" ? "Added" : "Removed"} ${amount} for component ${componentId}, new quantity ${nextQuantity}`,
    old_value: stringifyHistoryValue({ component_id: componentId, quantity_available: currentQuantity }),
    new_value: stringifyHistoryValue({ component_id: componentId, quantity_available: nextQuantity })
  });

  revalidatePath("/components");
  revalidatePath("/inventory");
  revalidatePath("/purchasing");
  redirect("/inventory");
}

export async function deleteInventoryAction(formData: FormData) {
  const supabase = createSupabaseClient();
  const id = requiredValue(formData.get("id"), "Inventory id");
  const previous = await supabase
    .from("inventory")
    .select("id,component_id,quantity_available,purchase_price")
    .eq("id", id)
    .maybeSingle();

  if (previous.error) {
    throw new Error(previous.error.message);
  }

  const result = await supabase.from("inventory").delete().eq("id", id);
  if (result.error) {
    throw new Error(result.error.message);
  }

  await recordHistory({
    entity_type: "inventory",
    entity_id: id,
    action_type: "delete",
    summary: `Deleted inventory row ${id}`,
    old_value: stringifyHistoryValue(previous.data)
  });

  revalidatePath("/inventory");
  revalidatePath("/components");
  redirect("/inventory");
}

export async function createVersionAction(formData: FormData) {
  const supabase = createSupabaseClient();
  const productId = requiredValue(formData.get("product_id"), "Product id");
  const versionNumber = requiredValue(formData.get("version_number"), "Version number");

  const result = await supabase
    .from("product_versions")
    .insert({
      product_id: productId,
      version_number: versionNumber
    })
    .select("id")
    .single<{ id: string }>();

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Could not create version.");
  }

  await recordHistory({
    entity_type: "version",
    entity_id: result.data.id,
    action_type: "create",
    summary: `Created version "${versionNumber}" for product ${productId}`,
    new_value: stringifyHistoryValue({ id: result.data.id, product_id: productId, version_number: versionNumber })
  });

  revalidatePath(`/products/${productId}`);
  redirect(`/products/${productId}`);
}

export async function updateProductAction(formData: FormData) {
  const supabase = createSupabaseClient();
  const id = requiredValue(formData.get("id"), "Product id");
  const name = requiredValue(formData.get("name"), "Product name");
  const previous = await supabase.from("products").select("id,name,image").eq("id", id).maybeSingle();
  if (previous.error) {
    throw new Error(previous.error.message);
  }

  const result = await supabase.from("products").update({ name }).eq("id", id);
  if (result.error) {
    throw new Error(result.error.message);
  }

  await recordHistory({
    entity_type: "product",
    entity_id: id,
    action_type: "update",
    summary: `Updated product name to "${name}"`,
    old_value: stringifyHistoryValue(previous.data),
    new_value: stringifyHistoryValue(previous.data ? { ...previous.data, name } : { id, name })
  });

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  redirect(`/products/${id}`);
}

export async function updateVersionAction(formData: FormData) {
  const supabase = createSupabaseClient();
  const id = requiredValue(formData.get("id"), "Version id");
  const versionNumber = requiredValue(formData.get("version_number"), "Version number");
  const previous = await supabase
    .from("product_versions")
    .select("id,product_id,version_number")
    .eq("id", id)
    .maybeSingle();
  if (previous.error) {
    throw new Error(previous.error.message);
  }

  const result = await supabase
    .from("product_versions")
    .update({ version_number: versionNumber })
    .eq("id", id);
  if (result.error) {
    throw new Error(result.error.message);
  }

  await recordHistory({
    entity_type: "version",
    entity_id: id,
    action_type: "update",
    summary: `Updated version name to "${versionNumber}"`,
    old_value: stringifyHistoryValue(previous.data),
    new_value: stringifyHistoryValue(previous.data ? { ...previous.data, version_number: versionNumber } : { id, version_number: versionNumber })
  });

  revalidatePath(`/versions/${id}`);
  redirect(`/versions/${id}`);
}

export async function deleteVersionAction(formData: FormData) {
  const supabase = createSupabaseClient();
  const id = requiredValue(formData.get("id"), "Version id");
  const productId = requiredValue(formData.get("product_id"), "Product id");
  const previous = await supabase
    .from("product_versions")
    .select("id,product_id,version_number")
    .eq("id", id)
    .maybeSingle();
  if (previous.error) {
    throw new Error(previous.error.message);
  }

  const result = await supabase.from("product_versions").delete().eq("id", id);
  if (result.error) {
    throw new Error(result.error.message);
  }

  await recordHistory({
    entity_type: "version",
    entity_id: id,
    action_type: "delete",
    summary: `Deleted version ${id}`,
    old_value: stringifyHistoryValue(previous.data)
  });

  revalidatePath(`/products/${productId}`);
  redirect(`/products/${productId}`);
}

export async function updateDefaultSafetyStockAction(formData: FormData) {
  const supabase = createSupabaseClient();
  const value = Number(requiredValue(formData.get("default_safety_stock"), "Default safety stock"));
  const previous = await supabase
    .from("app_settings")
    .select("id,default_safety_stock")
    .eq("id", true)
    .maybeSingle();

  if (previous.error) {
    throw new Error(previous.error.message);
  }

  const result = await supabase.from("app_settings").upsert({
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
  redirect("/components");
}

export async function updateComponentSafetyStockAction(formData: FormData) {
  const supabase = createSupabaseClient();
  const id = requiredValue(formData.get("id"), "Component id");
  const safetyStock = Number(requiredValue(formData.get("safety_stock"), "Safety stock"));
  const previous = await supabase
    .from("components")
    .select("id,name,category,producer,value,safety_stock")
    .eq("id", id)
    .maybeSingle();

  if (previous.error) {
    throw new Error(previous.error.message);
  }

  const result = await supabase
    .from("components")
    .update({ safety_stock: safetyStock })
    .eq("id", id);

  if (result.error) {
    throw new Error(result.error.message);
  }

  await recordHistory({
    entity_type: "component",
    entity_id: id,
    action_type: "update_safety_stock",
    summary: `Updated safety stock for component ${id} to ${safetyStock}`,
    old_value: stringifyHistoryValue(previous.data),
    new_value: stringifyHistoryValue(previous.data ? { ...previous.data, safety_stock: safetyStock } : { id, safety_stock: safetyStock })
  });

  revalidatePath("/components");
  revalidatePath(`/components/${id}`);
  revalidatePath("/purchasing");
  redirect("/purchasing");
}

export async function consumeVersionInventoryAction(formData: FormData) {
  const supabase = createSupabaseClient();
  const versionId = requiredValue(formData.get("version_id"), "Version id");
  const buildQuantity = Math.max(Number(requiredValue(formData.get("quantity"), "Quantity")), 1);

  const referencesResult = await supabase
    .from("component_references")
    .select("component_master_id")
    .eq("version_id", versionId);

  if (referencesResult.error) {
    throw new Error(referencesResult.error.message);
  }

  const grossMap = new Map<string, number>();
  for (const reference of referencesResult.data ?? []) {
    grossMap.set(
      reference.component_master_id,
      (grossMap.get(reference.component_master_id) ?? 0) + buildQuantity
    );
  }

  const componentIds = Array.from(grossMap.keys());
  if (componentIds.length === 0) {
    revalidatePath(`/versions/${versionId}`);
    redirect(`/versions/${versionId}`);
  }

  const inventoryResult = await supabase
    .from("inventory")
    .select("id,component_id,quantity_available,purchase_price")
    .in("component_id", componentIds);

  if (inventoryResult.error) {
    throw new Error(inventoryResult.error.message);
  }

  const previousRows = inventoryResult.data ?? [];
  for (const row of previousRows) {
    const gross = grossMap.get(row.component_id) ?? 0;
    const nextQuantity = Math.max(Number(row.quantity_available) - gross, 0);
    const updateResult = await supabase
      .from("inventory")
      .update({ quantity_available: nextQuantity })
      .eq("id", row.id);

    if (updateResult.error) {
      throw new Error(updateResult.error.message);
    }
  }

  await recordHistory({
    entity_type: "version",
    entity_id: versionId,
    action_type: "consume_inventory",
    summary: `Consumed inventory for version ${versionId} using build quantity ${buildQuantity}`,
    old_value: stringifyHistoryValue(previousRows),
    new_value: stringifyHistoryValue(
      previousRows.map((row) => ({
        ...row,
        quantity_available: Math.max(Number(row.quantity_available) - (grossMap.get(row.component_id) ?? 0), 0)
      }))
    )
  });

  revalidatePath(`/versions/${versionId}`);
  revalidatePath("/inventory");
  revalidatePath("/purchasing");
  revalidatePath("/history");
  redirect(`/versions/${versionId}?quantity=${buildQuantity}`);
}
