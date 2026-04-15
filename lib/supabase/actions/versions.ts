"use server";

import { buildVersionBomReferenceRows, normalizeVersionBomRows, parseVersionBomFile } from "@/lib/import/version-bom";
import { normalizeReferencesInput } from "@/lib/mappers/bom";
import { VERSION_ATTACHMENT_MAX_BYTES, validateUploadedFile } from "@/lib/uploads/validation";
import { createSupabaseAdminClient } from "../admin-client";
import { deleteStoredFileIfPresent, uploadStoredFile, VERSION_ATTACHMENTS_BUCKET } from "../storage";
import { ATTACHMENTS_TABLE, COMPONENT_REFERENCES_TABLE, PRIVATE_SCHEMA, PRODUCT_VERSIONS_TABLE } from "../table-names";
import { recordHistory, redirect, revalidatePath, requiredValue, stringifyHistoryValue } from "./shared";

export async function importVersionBomAction(formData: FormData) {
  const supabase = createSupabaseAdminClient();
  const versionId = requiredValue(formData.get("version_id"), "Version id");
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    redirectVersionError(versionId, "bomImportError", "Import file is required.");
  }

  try {
    const normalizedRows = normalizeVersionBomRows(await parseVersionBomFile(file));
    if (normalizedRows.length === 0) {
      redirectVersionError(versionId, "bomImportError", "The selected file did not contain any import rows.");
    }

    const componentsResult = await supabase.from("components").select("id,sku");
    if (componentsResult.error) {
      throw new Error(componentsResult.error.message);
    }

    const referenceRows = buildVersionBomReferenceRows({
      versionId,
      rows: normalizedRows,
      components: (componentsResult.data ?? []).map((row) => ({
        id: String(row.id),
        sku: String(row.sku)
      }))
    });
    const skuCount = new Set(normalizedRows.map((row) => row.sku.trim().toUpperCase())).size;
    const previous = await supabase
      .schema(PRIVATE_SCHEMA)
      .from(COMPONENT_REFERENCES_TABLE)
      .select("version_id,component_master_id,reference")
      .eq("version_id", versionId);

    if (previous.error) {
      throw new Error(previous.error.message);
    }

    const deleteResult = await supabase
      .schema(PRIVATE_SCHEMA)
      .from(COMPONENT_REFERENCES_TABLE)
      .delete()
      .eq("version_id", versionId);

    if (deleteResult.error) {
      throw new Error(deleteResult.error.message);
    }

    const insertResult = await supabase
      .schema(PRIVATE_SCHEMA)
      .from(COMPONENT_REFERENCES_TABLE)
      .insert(referenceRows);

    if (insertResult.error) {
      throw new Error(insertResult.error.message);
    }

    await recordHistory({
      entity_type: "version",
      entity_id: versionId,
      action_type: "import_bom",
      summary: `Replaced BOM by import for version ${versionId}`,
      old_value: stringifyHistoryValue(previous.data),
      new_value: stringifyHistoryValue({
        file_name: file.name,
        references: referenceRows.length,
        skus: skuCount
      })
    });
  } catch (error) {
    redirectVersionError(versionId, "bomImportError", error instanceof Error ? error.message : "Could not import BOM.");
  }

  revalidatePath(`/versions/${versionId}`);
  redirect(`/versions/${versionId}`);
}

export async function attachPartToVersionAction(formData: FormData) {
  const supabase = createSupabaseAdminClient();
  const versionId = requiredValue(formData.get("version_id"), "Version id");
  const componentId = requiredValue(formData.get("component_id"), "Component id");
  const references = normalizeReferencesInput(formData.get("references"));

  for (const reference of references) {
    const result = await supabase.schema(PRIVATE_SCHEMA).from(COMPONENT_REFERENCES_TABLE).upsert(
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

export async function removePartFromVersionAction(formData: FormData) {
  const supabase = createSupabaseAdminClient();
  const versionId = requiredValue(formData.get("version_id"), "Version id");
  const componentId = requiredValue(formData.get("component_id"), "Component id");
  const previous = await supabase
    .schema(PRIVATE_SCHEMA)
    .from(COMPONENT_REFERENCES_TABLE)
    .select("version_id,component_master_id,reference")
    .eq("version_id", versionId)
    .eq("component_master_id", componentId);

  if (previous.error) {
    throw new Error(previous.error.message);
  }

  const result = await supabase
    .schema(PRIVATE_SCHEMA)
    .from(COMPONENT_REFERENCES_TABLE)
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

export async function updateVersionComponentReferencesAction(formData: FormData) {
  const supabase = createSupabaseAdminClient();
  const versionId = requiredValue(formData.get("version_id"), "Version id");
  const componentId = requiredValue(formData.get("component_id"), "Component id");
  const references = normalizeReferencesInput(formData.get("references"));
  const previous = await supabase
    .schema(PRIVATE_SCHEMA)
    .from(COMPONENT_REFERENCES_TABLE)
    .select("version_id,component_master_id,reference")
    .eq("version_id", versionId)
    .eq("component_master_id", componentId);

  if (previous.error) {
    throw new Error(previous.error.message);
  }

  const deleteResult = await supabase
    .schema(PRIVATE_SCHEMA)
    .from(COMPONENT_REFERENCES_TABLE)
    .delete()
    .eq("version_id", versionId)
    .eq("component_master_id", componentId);

  if (deleteResult.error) {
    throw new Error(deleteResult.error.message);
  }

  const insertResult = await supabase.schema(PRIVATE_SCHEMA).from(COMPONENT_REFERENCES_TABLE).upsert(
    references.map((reference) => ({
      version_id: versionId,
      component_master_id: componentId,
      reference
    })),
    { onConflict: "version_id,reference" }
  );

  if (insertResult.error) {
    throw new Error(insertResult.error.message);
  }

  await recordHistory({
    entity_type: "version",
    entity_id: versionId,
    action_type: "update_component_references",
    summary: `Updated BOM references for component ${componentId} in version ${versionId}`,
    old_value: stringifyHistoryValue(previous.data),
    new_value: stringifyHistoryValue({ component_id: componentId, references })
  });

  revalidatePath(`/versions/${versionId}`);
  redirect(`/versions/${versionId}`);
}

export async function updateVersionAction(formData: FormData) {
  const supabase = createSupabaseAdminClient();
  const id = requiredValue(formData.get("id"), "Version id");
  const versionNumber = requiredValue(formData.get("version_number"), "Version number");
  const previous = await supabase
    .schema(PRIVATE_SCHEMA)
    .from(PRODUCT_VERSIONS_TABLE)
    .select("id,product_id,version_number")
    .eq("id", id)
    .maybeSingle();
  if (previous.error) {
    throw new Error(previous.error.message);
  }

  const result = await supabase
    .schema(PRIVATE_SCHEMA)
    .from(PRODUCT_VERSIONS_TABLE)
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

export async function uploadVersionAttachmentAction(formData: FormData) {
  const supabase = createSupabaseAdminClient();
  const versionId = requiredValue(formData.get("version_id"), "Version id");
  const file = formData.get("file");
  const uploadFile = file instanceof File ? file : null;
  const validationError = validateUploadedFile({
    file: uploadFile,
    label: "Attachment",
    maxBytes: VERSION_ATTACHMENT_MAX_BYTES
  });

  if (validationError) {
    redirectVersionError(versionId, "attachmentError", validationError);
  }

  if (!uploadFile) {
    redirectVersionError(versionId, "attachmentError", "Attachment file is required.");
  }

  let storedPath: string | null = null;

  try {
    storedPath = await uploadStoredFile({
      supabase,
      bucket: VERSION_ATTACHMENTS_BUCKET,
      scope: "versions",
      entityId: versionId,
      file: uploadFile
    });

    const insertResult = await supabase.schema(PRIVATE_SCHEMA).from(ATTACHMENTS_TABLE).insert({
      version_id: versionId,
      file_path: storedPath
    });

    if (insertResult.error) {
      throw new Error(insertResult.error.message);
    }

    await recordHistory({
      entity_type: "attachment",
      entity_id: versionId,
      action_type: "upload",
      summary: `Uploaded attachment ${uploadFile.name} for version ${versionId}`,
      new_value: stringifyHistoryValue({ version_id: versionId, file_path: storedPath })
    });
  } catch (error) {
    if (storedPath) {
      await deleteStoredFileIfPresent({
        supabase,
        bucket: VERSION_ATTACHMENTS_BUCKET,
        storedValue: storedPath
      }).catch(() => undefined);
    }

    redirectVersionError(
      versionId,
      "attachmentError",
      error instanceof Error ? error.message : "Could not upload attachment."
    );
  }

  revalidatePath(`/versions/${versionId}`);
  redirect(`/versions/${versionId}`);
}

export async function deleteVersionAttachmentAction(formData: FormData) {
  const supabase = createSupabaseAdminClient();
  const versionId = requiredValue(formData.get("version_id"), "Version id");
  const attachmentId = requiredValue(formData.get("attachment_id"), "Attachment id");
  const previous = await supabase
    .schema(PRIVATE_SCHEMA)
    .from(ATTACHMENTS_TABLE)
    .select("id,version_id,file_path")
    .eq("id", attachmentId)
    .maybeSingle<{ id: string; version_id: string; file_path: string }>();

  if (previous.error || !previous.data) {
    throw new Error(previous.error?.message ?? "Attachment not found.");
  }

  await deleteStoredFileIfPresent({
    supabase,
    bucket: VERSION_ATTACHMENTS_BUCKET,
    storedValue: previous.data.file_path
  });

  const deleteResult = await supabase
    .schema(PRIVATE_SCHEMA)
    .from(ATTACHMENTS_TABLE)
    .delete()
    .eq("id", attachmentId);

  if (deleteResult.error) {
    throw new Error(deleteResult.error.message);
  }

  await recordHistory({
    entity_type: "attachment",
    entity_id: versionId,
    action_type: "delete",
    summary: `Deleted attachment ${attachmentId} from version ${versionId}`,
    old_value: stringifyHistoryValue(previous.data)
  });

  revalidatePath(`/versions/${versionId}`);
  redirect(`/versions/${versionId}`);
}

export async function deleteVersionAction(formData: FormData) {
  const supabase = createSupabaseAdminClient();
  const id = requiredValue(formData.get("id"), "Version id");
  const productId = requiredValue(formData.get("product_id"), "Product id");
  const previous = await supabase
    .schema(PRIVATE_SCHEMA)
    .from(PRODUCT_VERSIONS_TABLE)
    .select("id,product_id,version_number")
    .eq("id", id)
    .maybeSingle();
  if (previous.error) {
    throw new Error(previous.error.message);
  }

  const result = await supabase.schema(PRIVATE_SCHEMA).from(PRODUCT_VERSIONS_TABLE).delete().eq("id", id);
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

function redirectVersionError(
  versionId: string,
  key: "bomImportError" | "attachmentError",
  message: string
): never {
  redirect(`/versions/${versionId}?${key}=${encodeURIComponent(message)}`);
}
