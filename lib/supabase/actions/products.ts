"use server";

import { createSupabaseAdminClient } from "../admin-client";
import { createSupabaseClient } from "../client";
import { PRIVATE_SCHEMA, PRODUCT_VERSIONS_TABLE } from "../table-names";
import { recordHistory, redirect, revalidatePath, requiredValue, stringifyHistoryValue } from "./shared";

export async function createProductAction(formData: FormData) {
  const supabase = await createSupabaseClient();
  const name = requiredValue(formData.get("name"), "Product name");

  const result = await supabase
    .from("products")
    .insert({
      name,
      image: null
    })
    .select("id,name,image")
    .single<{ id: string; name: string; image: string | null }>();

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Could not create product.");
  }

  await recordHistory({
    entity_type: "product",
    entity_id: result.data.id,
    action_type: "create",
    summary: `Created product "${name}"`,
    new_value: stringifyHistoryValue(result.data)
  });

  revalidatePath("/products");
  redirect(`/products/${result.data.id}`);
}

export async function createVersionAction(formData: FormData) {
  const supabase = createSupabaseAdminClient();
  const productId = requiredValue(formData.get("product_id"), "Product id");
  const versionNumber = requiredValue(formData.get("version_number"), "Version number");

  const result = await supabase
    .schema(PRIVATE_SCHEMA)
    .from(PRODUCT_VERSIONS_TABLE)
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
  const supabase = await createSupabaseClient();
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
