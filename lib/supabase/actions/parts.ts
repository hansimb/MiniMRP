"use server";

import { normalizeExternalUrl } from "@/lib/mappers/urls";
import { createSupabaseAdminClient } from "../admin-client";
import { APP_SETTINGS_TABLE, PRIVATE_SCHEMA } from "../table-names";
import { recordHistory, optionalValue, redirect, revalidatePath, requiredValue, slugify, stringifyHistoryValue } from "./shared";

export async function updatePartAction(formData: FormData) {
  const supabase = createSupabaseAdminClient();
  const id = requiredValue(formData.get("id"), "Component id");
  const previous = await supabase
    .from("components")
    .select("id,sku,name,category,producer,value,safety_stock")
    .eq("id", id)
    .maybeSingle();

  if (previous.error) {
    throw new Error(previous.error.message);
  }

  const nextComponent = {
    sku: requiredValue(formData.get("sku"), "SKU"),
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

export async function createPartAction(formData: FormData) {
  const supabase = createSupabaseAdminClient();
  const settingsResult = await supabase
    .schema(PRIVATE_SCHEMA)
    .from(APP_SETTINGS_TABLE)
    .select("default_safety_stock")
    .eq("id", true)
    .maybeSingle<{ default_safety_stock: number }>();

  if (settingsResult.error) {
    throw new Error(settingsResult.error.message);
  }

  const defaultSafetyStock = settingsResult.data?.default_safety_stock ?? 25;
  const componentPayload = {
    sku: requiredValue(formData.get("sku"), "SKU"),
    name: requiredValue(formData.get("name"), "Name"),
    category: requiredValue(formData.get("category"), "Category"),
    producer: requiredValue(formData.get("producer"), "Producer"),
    value: optionalValue(formData.get("value")),
    safety_stock: defaultSafetyStock
  };

  const insertResult = await supabase
    .from("components")
    .insert(componentPayload)
    .select("id,sku,name,category,producer,value,safety_stock")
    .single<{ id: string; sku: string; name: string; category: string; producer: string; value: string | null; safety_stock: number }>();

  if (insertResult.error || !insertResult.data) {
    throw new Error(insertResult.error?.message ?? "Could not create component.");
  }

  const baseUrl = normalizeExternalUrl(optionalValue(formData.get("base_url")));
  const sellerName = optionalValue(formData.get("seller_name"));
  const updateLink = normalizeExternalUrl(optionalValue(formData.get("update_link")));
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

export async function deletePartAction(formData: FormData) {
  const supabase = createSupabaseAdminClient();
  const id = requiredValue(formData.get("id"), "Component id");
  const previous = await supabase
    .from("components")
    .select("id,sku,name,category,producer,value,safety_stock")
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

export async function upsertPartSellerLinkAction(formData: FormData) {
  const supabase = createSupabaseAdminClient();
  const componentId = requiredValue(formData.get("component_id"), "Component id");
  const sellerId = requiredValue(formData.get("seller_id"), "Seller id");
  const baseUrl = normalizeExternalUrl(optionalValue(formData.get("base_url")));
  const leadTime = optionalValue(formData.get("lead_time"));
  const explicitUrl = normalizeExternalUrl(optionalValue(formData.get("product_url")));
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
  revalidatePath("/purchasing");
  const returnTo = optionalValue(formData.get("returnTo"));
  redirect(returnTo ?? `/components/${componentId}`);
}

export async function createSellerForPartAction(formData: FormData) {
  const supabase = createSupabaseAdminClient();
  const componentId = requiredValue(formData.get("component_id"), "Component id");
  const componentName = requiredValue(formData.get("component_name"), "Component name");
  const sellerName = requiredValue(formData.get("seller_name"), "Seller name");
  const baseUrl = normalizeExternalUrl(optionalValue(formData.get("base_url")));
  const leadTime = optionalValue(formData.get("lead_time"));
  const explicitUrl = normalizeExternalUrl(optionalValue(formData.get("product_url")));

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

export async function updatePartSafetyStockAction(formData: FormData) {
  const supabase = createSupabaseAdminClient();
  const id = requiredValue(formData.get("id"), "Component id");
  const safetyStock = Number(requiredValue(formData.get("safety_stock"), "Safety stock"));
  const returnTo = optionalValue(formData.get("returnTo"));
  const previous = await supabase
    .from("components")
    .select("id,sku,name,category,producer,value,safety_stock")
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
  revalidatePath("/inventory");
  revalidatePath("/purchasing");
  redirect(returnTo ?? "/purchasing");
}
