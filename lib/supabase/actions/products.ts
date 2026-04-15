"use server";

import { PRODUCT_IMAGE_MAX_BYTES, validateUploadedFile } from "@/lib/uploads/validation";
import { createSupabaseAdminClient } from "../admin-client";
import { createSupabaseClient } from "../client";
import { deleteStoredFileIfPresent, PRODUCT_IMAGES_BUCKET, uploadStoredFile } from "../storage";
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

export async function uploadProductImageAction(formData: FormData) {
  const supabase = createSupabaseAdminClient();
  const id = requiredValue(formData.get("id"), "Product id");
  const file = formData.get("file");
  const uploadFile = file instanceof File ? file : null;
  const validationError = validateUploadedFile({
    file: uploadFile,
    label: "Product image",
    maxBytes: PRODUCT_IMAGE_MAX_BYTES,
    mustBeImage: true
  });

  if (validationError) {
    redirectProductImageError(id, validationError);
  }

  if (!uploadFile) {
    redirectProductImageError(id, "Product image file is required.");
  }

  const previous = await supabase.from("products").select("id,name,image").eq("id", id).maybeSingle();
  if (previous.error || !previous.data) {
    throw new Error(previous.error?.message ?? "Product not found.");
  }

  let storedPath: string | null = null;

  try {
    storedPath = await uploadStoredFile({
      supabase,
      bucket: PRODUCT_IMAGES_BUCKET,
      scope: "products",
      entityId: id,
      file: uploadFile
    });

    await deleteStoredFileIfPresent({
      supabase,
      bucket: PRODUCT_IMAGES_BUCKET,
      storedValue: previous.data.image
    });

    const updateResult = await supabase.from("products").update({ image: storedPath }).eq("id", id);
    if (updateResult.error) {
      throw new Error(updateResult.error.message);
    }

    await recordHistory({
      entity_type: "product",
      entity_id: id,
      action_type: "upload_image",
      summary: `Uploaded product image for ${previous.data.name}`,
      old_value: stringifyHistoryValue(previous.data),
      new_value: stringifyHistoryValue({ ...previous.data, image: storedPath })
    });
  } catch (error) {
    if (storedPath) {
      await deleteStoredFileIfPresent({
        supabase,
        bucket: PRODUCT_IMAGES_BUCKET,
        storedValue: storedPath
      }).catch(() => undefined);
    }

    redirectProductImageError(
      id,
      error instanceof Error ? error.message : "Could not upload product image."
    );
  }

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  redirect(`/products/${id}`);
}

export async function removeProductImageAction(formData: FormData) {
  const supabase = createSupabaseAdminClient();
  const id = requiredValue(formData.get("id"), "Product id");
  const previous = await supabase.from("products").select("id,name,image").eq("id", id).maybeSingle();

  if (previous.error || !previous.data) {
    throw new Error(previous.error?.message ?? "Product not found.");
  }

  await deleteStoredFileIfPresent({
    supabase,
    bucket: PRODUCT_IMAGES_BUCKET,
    storedValue: previous.data.image
  });

  const updateResult = await supabase.from("products").update({ image: null }).eq("id", id);
  if (updateResult.error) {
    throw new Error(updateResult.error.message);
  }

  await recordHistory({
    entity_type: "product",
    entity_id: id,
    action_type: "remove_image",
    summary: `Removed product image from ${previous.data.name}`,
    old_value: stringifyHistoryValue(previous.data),
    new_value: stringifyHistoryValue({ ...previous.data, image: null })
  });

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  redirect(`/products/${id}`);
}

function redirectProductImageError(productId: string, message: string): never {
  redirect(`/products/${productId}?imageError=${encodeURIComponent(message)}`);
}
