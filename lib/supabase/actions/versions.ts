"use server";

import { normalizeReferencesInput } from "@/lib/mappers/bom";
import { createSupabaseAdminClient } from "../admin-client";
import { COMPONENT_REFERENCES_TABLE, PRIVATE_SCHEMA, PRODUCT_VERSIONS_TABLE } from "../table-names";
import { recordHistory, redirect, revalidatePath, requiredValue, stringifyHistoryValue } from "./shared";

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
