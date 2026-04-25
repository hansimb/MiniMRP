"use server";

import { PRODUCT_IMAGE_MAX_BYTES, validateUploadedFile, VERSION_ATTACHMENT_MAX_BYTES } from "../../uploads/validation.ts";
import { buildMrpRows, reserveInventoryForProduction } from "../../mappers/mrp.ts";
import { consumeInventoryLotsFifo } from "../../mappers/inventory-lots.ts";
import { planProductionCompletionConsumption } from "../../mappers/production.ts";
import { normalizeExternalUrl } from "../../mappers/urls.ts";
import { buildVersionBomReferenceRows, normalizeVersionBomRows, parseVersionBomFile } from "../../import/version-bom.ts";
import { normalizeMasterDataRows, parseSpreadsheetFile } from "../../import/master-data.ts";
import { getVersionDetail } from "./queries.ts";
import { syncInventorySummaryForComponent } from "./inventory-summary.ts";
import {
  createId,
  deleteDesktopStoredFileIfPresent,
  getRow,
  getRows,
  optionalValue,
  recordHistory,
  redirect,
  requiredValue,
  revalidatePath,
  run,
  slugify,
  stringifyHistoryValue,
  writeDesktopStoredFile
} from "./shared.ts";

const QUANTITY_EPSILON = 0.000001;

function parseNonNegativeNumber(value: FormDataEntryValue | null, field: string) {
  const raw = requiredValue(value, field);
  const parsed = Number(raw);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${field} must be a valid number.`);
  }

  if (parsed < 0) {
    throw new Error(`${field} cannot be negative.`);
  }

  return parsed;
}

function parsePositiveNumber(value: FormDataEntryValue | null, field: string) {
  const parsed = parseNonNegativeNumber(value, field);
  if (parsed <= 0) {
    throw new Error(`${field} must be greater than zero.`);
  }
  return parsed;
}

function normalizeReferencesInput(value: FormDataEntryValue | null) {
  const text = String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return text.length > 0 ? text : ["-"];
}

function revalidateAppViews(paths: string[]) {
  for (const currentPath of paths) {
    revalidatePath(currentPath);
  }
}

export async function createProductAction(formData: FormData) {
  const id = createId();
  const name = requiredValue(formData.get("name"), "Product name");

  run(
    "insert into products (id, name, image) values (:id, :name, null)",
    { id, name }
  );

  await recordHistory({
    entity_type: "product",
    entity_id: id,
    action_type: "create",
    summary: `Created product "${name}"`,
    new_value: stringifyHistoryValue({ id, name, image: null })
  });

  revalidateAppViews(["/products", "/history"]);
  redirect(`/products/${id}`);
}

export async function createVersionAction(formData: FormData) {
  const id = createId();
  const productId = requiredValue(formData.get("product_id"), "Product id");
  const versionNumber = requiredValue(formData.get("version_number"), "Version number");

  run(
    "insert into product_versions (id, product_id, version_number) values (:id, :product_id, :version_number)",
    { id, product_id: productId, version_number: versionNumber }
  );

  await recordHistory({
    entity_type: "version",
    entity_id: id,
    action_type: "create",
    summary: `Created version "${versionNumber}" for product ${productId}`,
    new_value: stringifyHistoryValue({ id, product_id: productId, version_number: versionNumber })
  });

  revalidateAppViews([`/products/${productId}`, "/history"]);
  redirect(`/products/${productId}`);
}

export async function updateProductAction(formData: FormData) {
  const id = requiredValue(formData.get("id"), "Product id");
  const name = requiredValue(formData.get("name"), "Product name");
  const previous = getRow<{ id: string; name: string; image: string | null }>(
    "select id, name, image from products where id = :id",
    { id }
  );

  run("update products set name = :name where id = :id", { id, name });

  await recordHistory({
    entity_type: "product",
    entity_id: id,
    action_type: "update",
    summary: `Updated product name to "${name}"`,
    old_value: stringifyHistoryValue(previous),
    new_value: stringifyHistoryValue(previous ? { ...previous, name } : { id, name })
  });

  revalidateAppViews(["/products", `/products/${id}`, "/history"]);
  redirect(`/products/${id}`);
}

export async function uploadProductImageAction(formData: FormData) {
  const id = requiredValue(formData.get("id"), "Product id");
  const file = formData.get("file");
  const uploadFile = file instanceof File ? file : null;
  const validationError = validateUploadedFile({
    file: uploadFile,
    label: "Product image",
    maxBytes: PRODUCT_IMAGE_MAX_BYTES,
    mustBeImage: true
  });

  if (validationError || !uploadFile) {
    redirect(`/products/${id}?imageError=${encodeURIComponent(validationError ?? "Product image file is required.")}`);
  }

  const previous = getRow<{ id: string; name: string; image: string | null }>(
    "select id, name, image from products where id = :id",
    { id }
  );
  if (!previous) {
    throw new Error("Product not found.");
  }

  let storedPath: string | null = null;
  try {
    storedPath = await writeDesktopStoredFile({ scope: "products", entityId: id, file: uploadFile });
    deleteDesktopStoredFileIfPresent(previous.image);
    run("update products set image = :image where id = :id", { id, image: storedPath });

    await recordHistory({
      entity_type: "product",
      entity_id: id,
      action_type: "upload_image",
      summary: `Uploaded product image for ${previous.name}`,
      old_value: stringifyHistoryValue(previous),
      new_value: stringifyHistoryValue({ ...previous, image: storedPath })
    });
  } catch (error) {
    if (storedPath) {
      deleteDesktopStoredFileIfPresent(storedPath);
    }
    redirect(`/products/${id}?imageError=${encodeURIComponent(error instanceof Error ? error.message : "Could not upload product image.")}`);
  }

  revalidateAppViews(["/products", `/products/${id}`, "/history"]);
  redirect(`/products/${id}`);
}

export async function removeProductImageAction(formData: FormData) {
  const id = requiredValue(formData.get("id"), "Product id");
  const previous = getRow<{ id: string; name: string; image: string | null }>(
    "select id, name, image from products where id = :id",
    { id }
  );
  if (!previous) {
    throw new Error("Product not found.");
  }

  deleteDesktopStoredFileIfPresent(previous.image);
  run("update products set image = null where id = :id", { id });

  await recordHistory({
    entity_type: "product",
    entity_id: id,
    action_type: "remove_image",
    summary: `Removed product image from ${previous.name}`,
    old_value: stringifyHistoryValue(previous),
    new_value: stringifyHistoryValue({ ...previous, image: null })
  });

  revalidateAppViews(["/products", `/products/${id}`, "/history"]);
  redirect(`/products/${id}`);
}

export async function updateVersionAction(formData: FormData) {
  const id = requiredValue(formData.get("id"), "Version id");
  const versionNumber = requiredValue(formData.get("version_number"), "Version number");
  const previous = getRow<{ id: string; product_id: string; version_number: string }>(
    "select id, product_id, version_number from product_versions where id = :id",
    { id }
  );

  run("update product_versions set version_number = :version_number where id = :id", {
    id,
    version_number: versionNumber
  });

  await recordHistory({
    entity_type: "version",
    entity_id: id,
    action_type: "update",
    summary: `Updated version name to "${versionNumber}"`,
    old_value: stringifyHistoryValue(previous),
    new_value: stringifyHistoryValue(previous ? { ...previous, version_number: versionNumber } : { id, version_number: versionNumber })
  });

  revalidateAppViews([`/versions/${id}`, "/history"]);
  redirect(`/versions/${id}`);
}

export async function deleteVersionAction(formData: FormData) {
  const id = requiredValue(formData.get("id"), "Version id");
  const productId = requiredValue(formData.get("product_id"), "Product id");
  const previous = getRow<{ id: string; product_id: string; version_number: string }>(
    "select id, product_id, version_number from product_versions where id = :id",
    { id }
  );
  const attachments = getRows<{ file_path: string }>(
    "select file_path from attachments where version_id = :id",
    { id }
  );

  for (const attachment of attachments) {
    deleteDesktopStoredFileIfPresent(attachment.file_path);
  }

  run("delete from product_versions where id = :id", { id });

  await recordHistory({
    entity_type: "version",
    entity_id: id,
    action_type: "delete",
    summary: `Deleted version ${id}`,
    old_value: stringifyHistoryValue(previous)
  });

  revalidateAppViews([`/products/${productId}`, "/history"]);
  redirect(`/products/${productId}`);
}

export async function attachPartToVersionAction(formData: FormData) {
  const versionId = requiredValue(formData.get("version_id"), "Version id");
  const componentId = requiredValue(formData.get("component_id"), "Component id");
  const references = normalizeReferencesInput(formData.get("references"));

  for (const reference of references) {
    run(
      `
        insert into component_references (version_id, component_master_id, reference)
        values (:version_id, :component_id, :reference)
        on conflict(version_id, reference)
        do update set component_master_id = excluded.component_master_id
      `,
      {
        version_id: versionId,
        component_id: componentId,
        reference
      }
    );
  }

  await recordHistory({
    entity_type: "version",
    entity_id: versionId,
    action_type: "attach_component",
    summary: `Attached component ${componentId} to version ${versionId} with references ${references.join(", ")}`,
    new_value: stringifyHistoryValue({ component_id: componentId, references })
  });

  revalidateAppViews([`/versions/${versionId}`, "/history"]);
  redirect(`/versions/${versionId}`);
}

export async function removePartFromVersionAction(formData: FormData) {
  const versionId = requiredValue(formData.get("version_id"), "Version id");
  const componentId = requiredValue(formData.get("component_id"), "Component id");
  const previous = getRows<{ version_id: string; component_master_id: string; reference: string }>(
    "select version_id, component_master_id, reference from component_references where version_id = :version_id and component_master_id = :component_id",
    { version_id: versionId, component_id: componentId }
  );

  run(
    "delete from component_references where version_id = :version_id and component_master_id = :component_id",
    { version_id: versionId, component_id: componentId }
  );

  await recordHistory({
    entity_type: "version",
    entity_id: versionId,
    action_type: "remove_component",
    summary: `Removed component ${componentId} from version ${versionId}`,
    old_value: stringifyHistoryValue(previous)
  });

  revalidateAppViews([`/versions/${versionId}`, "/history"]);
  redirect(`/versions/${versionId}`);
}

export async function updateVersionComponentReferencesAction(formData: FormData) {
  const versionId = requiredValue(formData.get("version_id"), "Version id");
  const componentId = requiredValue(formData.get("component_id"), "Component id");
  const references = normalizeReferencesInput(formData.get("references"));
  const previous = getRows<{ version_id: string; component_master_id: string; reference: string }>(
    "select version_id, component_master_id, reference from component_references where version_id = :version_id and component_master_id = :component_id",
    { version_id: versionId, component_id: componentId }
  );

  run(
    "delete from component_references where version_id = :version_id and component_master_id = :component_id",
    { version_id: versionId, component_id: componentId }
  );

  for (const reference of references) {
    run(
      "insert into component_references (version_id, component_master_id, reference) values (:version_id, :component_id, :reference)",
      { version_id: versionId, component_id: componentId, reference }
    );
  }

  await recordHistory({
    entity_type: "version",
    entity_id: versionId,
    action_type: "update_component_references",
    summary: `Updated BOM references for component ${componentId} in version ${versionId}`,
    old_value: stringifyHistoryValue(previous),
    new_value: stringifyHistoryValue({ component_id: componentId, references })
  });

  revalidateAppViews([`/versions/${versionId}`, "/history"]);
  redirect(`/versions/${versionId}`);
}

export async function importVersionBomAction(formData: FormData) {
  const versionId = requiredValue(formData.get("version_id"), "Version id");
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    redirect(`/versions/${versionId}?bomImportError=${encodeURIComponent("Import file is required.")}`);
  }

  try {
    const normalizedRows = normalizeVersionBomRows(await parseVersionBomFile(file));
    if (normalizedRows.length === 0) {
      redirect(`/versions/${versionId}?bomImportError=${encodeURIComponent("The selected file did not contain any import rows.")}`);
    }

    const components = getRows<{ id: string; sku: string }>(
      "select id, sku from components"
    );
    const referenceRows = buildVersionBomReferenceRows({
      versionId,
      rows: normalizedRows,
      components
    });
    const skuCount = new Set(normalizedRows.map((row) => row.sku.trim().toUpperCase())).size;
    const previous = getRows<{ version_id: string; component_master_id: string; reference: string }>(
      "select version_id, component_master_id, reference from component_references where version_id = :versionId",
      { versionId }
    );

    run("delete from component_references where version_id = :versionId", { versionId });
    for (const row of referenceRows) {
      run(
        "insert into component_references (version_id, component_master_id, reference) values (:version_id, :component_master_id, :reference)",
        row
      );
    }

    await recordHistory({
      entity_type: "version",
      entity_id: versionId,
      action_type: "import_bom",
      summary: `Replaced BOM by import for version ${versionId}`,
      old_value: stringifyHistoryValue(previous),
      new_value: stringifyHistoryValue({
        file_name: file.name,
        references: referenceRows.length,
        skus: skuCount
      })
    });
  } catch (error) {
    redirect(`/versions/${versionId}?bomImportError=${encodeURIComponent(error instanceof Error ? error.message : "Could not import BOM.")}`);
  }

  revalidateAppViews([`/versions/${versionId}`, "/history"]);
  redirect(`/versions/${versionId}`);
}

export async function uploadVersionAttachmentAction(formData: FormData) {
  const versionId = requiredValue(formData.get("version_id"), "Version id");
  const file = formData.get("file");
  const uploadFile = file instanceof File ? file : null;
  const validationError = validateUploadedFile({
    file: uploadFile,
    label: "Attachment",
    maxBytes: VERSION_ATTACHMENT_MAX_BYTES
  });

  if (validationError || !uploadFile) {
    redirect(`/versions/${versionId}?attachmentError=${encodeURIComponent(validationError ?? "Attachment file is required.")}`);
  }

  let storedPath: string | null = null;
  try {
    storedPath = await writeDesktopStoredFile({ scope: "versions", entityId: versionId, file: uploadFile });
    run(
      "insert into attachments (id, version_id, file_path) values (:id, :version_id, :file_path)",
      { id: createId(), version_id: versionId, file_path: storedPath }
    );

    await recordHistory({
      entity_type: "attachment",
      entity_id: versionId,
      action_type: "upload",
      summary: `Uploaded attachment ${uploadFile.name} for version ${versionId}`,
      new_value: stringifyHistoryValue({ version_id: versionId, file_path: storedPath })
    });
  } catch (error) {
    if (storedPath) {
      deleteDesktopStoredFileIfPresent(storedPath);
    }

    redirect(`/versions/${versionId}?attachmentError=${encodeURIComponent(error instanceof Error ? error.message : "Could not upload attachment.")}`);
  }

  revalidateAppViews([`/versions/${versionId}`, "/history"]);
  redirect(`/versions/${versionId}`);
}

export async function deleteVersionAttachmentAction(formData: FormData) {
  const versionId = requiredValue(formData.get("version_id"), "Version id");
  const attachmentId = requiredValue(formData.get("attachment_id"), "Attachment id");
  const previous = getRow<{ id: string; version_id: string; file_path: string }>(
    "select id, version_id, file_path from attachments where id = :id",
    { id: attachmentId }
  );
  if (!previous) {
    throw new Error("Attachment not found.");
  }

  deleteDesktopStoredFileIfPresent(previous.file_path);
  run("delete from attachments where id = :id", { id: attachmentId });

  await recordHistory({
    entity_type: "attachment",
    entity_id: versionId,
    action_type: "delete",
    summary: `Deleted attachment ${attachmentId} from version ${versionId}`,
    old_value: stringifyHistoryValue(previous)
  });

  revalidateAppViews([`/versions/${versionId}`, "/history"]);
  redirect(`/versions/${versionId}`);
}

export async function createPartAction(formData: FormData) {
  const id = createId();
  const settings = getRow<{ default_safety_stock: number }>(
    "select default_safety_stock from app_settings where id = 1"
  );
  const componentPayload = {
    id,
    sku: requiredValue(formData.get("sku"), "SKU"),
    name: requiredValue(formData.get("name"), "Name"),
    category: requiredValue(formData.get("category"), "Category"),
    producer: requiredValue(formData.get("producer"), "Producer"),
    value: optionalValue(formData.get("value")),
    safety_stock: settings?.default_safety_stock ?? 25
  };

  run(
    `
      insert into components (id, sku, name, category, producer, value, safety_stock)
      values (:id, :sku, :name, :category, :producer, :value, :safety_stock)
    `,
    componentPayload
  );

  const baseUrl = normalizeExternalUrl(optionalValue(formData.get("base_url")));
  const sellerName = optionalValue(formData.get("seller_name"));
  const updateLink = normalizeExternalUrl(optionalValue(formData.get("update_link")));
  if (sellerName) {
    let sellerId = getRow<{ id: string }>(
      "select id from sellers where name = :name",
      { name: sellerName }
    )?.id ?? null;

    if (sellerId) {
      if (baseUrl) {
        run("update sellers set base_url = :base_url where id = :id", { id: sellerId, base_url: baseUrl });
      }
    } else {
      sellerId = createId();
      run(
        "insert into sellers (id, name, base_url) values (:id, :name, :base_url)",
        { id: sellerId, name: sellerName, base_url: baseUrl }
      );
    }

    const guessedUrl = updateLink ?? (baseUrl ? `${baseUrl.replace(/\/$/, "")}/${slugify(componentPayload.name)}` : null);
    run(
      `
        insert into component_sellers (component_id, seller_id, product_url)
        values (:component_id, :seller_id, :product_url)
        on conflict(component_id, seller_id)
        do update set product_url = excluded.product_url
      `,
      {
        component_id: id,
        seller_id: sellerId,
        product_url: guessedUrl
      }
    );
  }

  await recordHistory({
    entity_type: "component",
    entity_id: id,
    action_type: "create",
    summary: `Created component "${componentPayload.name}"`,
    new_value: stringifyHistoryValue(componentPayload)
  });

  revalidateAppViews(["/components", "/history"]);
  redirect(`/components/${id}`);
}

export async function updatePartAction(formData: FormData) {
  const id = requiredValue(formData.get("id"), "Component id");
  const previous = getRow<{ id: string; sku: string; name: string; category: string; producer: string; value: string | null; safety_stock: number }>(
    "select id, sku, name, category, producer, value, safety_stock from components where id = :id",
    { id }
  );
  const nextComponent = {
    sku: requiredValue(formData.get("sku"), "SKU"),
    name: requiredValue(formData.get("name"), "Name"),
    category: requiredValue(formData.get("category"), "Category"),
    producer: requiredValue(formData.get("producer"), "Producer"),
    value: optionalValue(formData.get("value")),
    safety_stock: Number(optionalValue(formData.get("safety_stock")) ?? "0")
  };

  run(
    `
      update components
      set sku = :sku,
          name = :name,
          category = :category,
          producer = :producer,
          value = :value,
          safety_stock = :safety_stock
      where id = :id
    `,
    { id, ...nextComponent }
  );

  await recordHistory({
    entity_type: "component",
    entity_id: id,
    action_type: "update",
    summary: `Updated component "${nextComponent.name}"`,
    old_value: stringifyHistoryValue(previous),
    new_value: stringifyHistoryValue({ id, ...nextComponent })
  });

  revalidateAppViews(["/components", `/components/${id}`, "/inventory", "/purchasing", "/history"]);
  const versionId = optionalValue(formData.get("versionId"));
  if (versionId) {
    revalidatePath(`/versions/${versionId}`);
    redirect(`/versions/${versionId}`);
  }
  redirect(`/components/${id}`);
}

export async function deletePartAction(formData: FormData) {
  const id = requiredValue(formData.get("id"), "Component id");
  const previous = getRow<{ id: string; sku: string; name: string; category: string; producer: string; value: string | null; safety_stock: number }>(
    "select id, sku, name, category, producer, value, safety_stock from components where id = :id",
    { id }
  );

  run("delete from components where id = :id", { id });

  await recordHistory({
    entity_type: "component",
    entity_id: id,
    action_type: "delete",
    summary: `Deleted component ${id}`,
    old_value: stringifyHistoryValue(previous)
  });

  revalidateAppViews(["/components", "/inventory", "/purchasing", "/history"]);
  redirect("/components");
}

export async function updatePartSafetyStockAction(formData: FormData) {
  const id = requiredValue(formData.get("id"), "Component id");
  const safetyStock = Number(requiredValue(formData.get("safety_stock"), "Safety stock"));
  const returnTo = optionalValue(formData.get("returnTo"));
  const previous = getRow<{ id: string; sku: string; name: string; category: string; producer: string; value: string | null; safety_stock: number }>(
    "select id, sku, name, category, producer, value, safety_stock from components where id = :id",
    { id }
  );

  run("update components set safety_stock = :safety_stock where id = :id", { id, safety_stock: safetyStock });

  await recordHistory({
    entity_type: "component",
    entity_id: id,
    action_type: "update_safety_stock",
    summary: `Updated safety stock for component ${id} to ${safetyStock}`,
    old_value: stringifyHistoryValue(previous),
    new_value: stringifyHistoryValue(previous ? { ...previous, safety_stock: safetyStock } : { id, safety_stock: safetyStock })
  });

  revalidateAppViews(["/components", `/components/${id}`, "/inventory", "/purchasing", "/history"]);
  redirect(returnTo ?? "/purchasing");
}

export async function upsertPartSellerLinkAction(formData: FormData) {
  const componentId = requiredValue(formData.get("component_id"), "Component id");
  const sellerId = requiredValue(formData.get("seller_id"), "Seller id");
  const baseUrl = normalizeExternalUrl(optionalValue(formData.get("base_url")));
  const leadTime = optionalValue(formData.get("lead_time"));
  const explicitUrl = normalizeExternalUrl(optionalValue(formData.get("product_url")));
  const componentName = requiredValue(formData.get("component_name"), "Component name");
  const guessedUrl = explicitUrl ?? (baseUrl ? `${baseUrl.replace(/\/$/, "")}/${slugify(componentName)}` : null);

  run(
    "update sellers set base_url = :base_url, lead_time = :lead_time where id = :id",
    { id: sellerId, base_url: baseUrl, lead_time: leadTime ? Number(leadTime) : null }
  );
  run(
    `
      insert into component_sellers (component_id, seller_id, product_url)
      values (:component_id, :seller_id, :product_url)
      on conflict(component_id, seller_id)
      do update set product_url = excluded.product_url
    `,
    { component_id: componentId, seller_id: sellerId, product_url: guessedUrl }
  );

  await recordHistory({
    entity_type: "seller_link",
    entity_id: componentId,
    action_type: "update",
    summary: `Updated seller link for component ${componentId}`,
    new_value: stringifyHistoryValue({ seller_id: sellerId, base_url: baseUrl, lead_time: leadTime, product_url: guessedUrl })
  });

  revalidateAppViews([`/components/${componentId}`, "/purchasing", "/history"]);
  redirect(optionalValue(formData.get("returnTo")) ?? `/components/${componentId}`);
}

export async function createSellerForPartAction(formData: FormData) {
  const componentId = requiredValue(formData.get("component_id"), "Component id");
  const componentName = requiredValue(formData.get("component_name"), "Component name");
  const sellerName = requiredValue(formData.get("seller_name"), "Seller name");
  const baseUrl = normalizeExternalUrl(optionalValue(formData.get("base_url")));
  const leadTime = optionalValue(formData.get("lead_time"));
  const explicitUrl = normalizeExternalUrl(optionalValue(formData.get("product_url")));
  const sellerId = createId();
  const guessedUrl = explicitUrl ?? (baseUrl ? `${baseUrl.replace(/\/$/, "")}/${slugify(componentName)}` : null);

  run(
    "insert into sellers (id, name, base_url, lead_time) values (:id, :name, :base_url, :lead_time)",
    { id: sellerId, name: sellerName, base_url: baseUrl, lead_time: leadTime ? Number(leadTime) : null }
  );
  run(
    "insert into component_sellers (component_id, seller_id, product_url) values (:component_id, :seller_id, :product_url)",
    { component_id: componentId, seller_id: sellerId, product_url: guessedUrl }
  );

  await recordHistory({
    entity_type: "seller",
    entity_id: sellerId,
    action_type: "create",
    summary: `Added seller "${sellerName}" for component ${componentId}`,
    new_value: stringifyHistoryValue({ id: sellerId, name: sellerName, base_url: baseUrl, lead_time: leadTime, product_url: guessedUrl })
  });

  revalidateAppViews([`/components/${componentId}`, "/purchasing", "/history"]);
  redirect(`/components/${componentId}`);
}

export async function addInventoryAction(formData: FormData) {
  const componentId = requiredValue(formData.get("component_id"), "Component id");
  const quantity = parsePositiveNumber(formData.get("quantity_received"), "Quantity");
  const purchasePrice = parseNonNegativeNumber(formData.get("unit_cost"), "Unit cost");
  const receivedAt = optionalValue(formData.get("received_at")) ?? new Date().toISOString();
  const source = optionalValue(formData.get("source"));
  const notes = optionalValue(formData.get("notes"));

  run(
    `
      insert into inventory_lots (
        id, component_id, quantity_received, quantity_remaining, unit_cost, received_at, source, notes
      ) values (
        :id, :component_id, :quantity_received, :quantity_remaining, :unit_cost, :received_at, :source, :notes
      )
    `,
    {
      id: createId(),
      component_id: componentId,
      quantity_received: quantity,
      quantity_remaining: quantity,
      unit_cost: purchasePrice,
      received_at: receivedAt,
      source,
      notes
    }
  );

  syncInventorySummaryForComponent(componentId);

  await recordHistory({
    entity_type: "inventory_lot",
    entity_id: componentId,
    action_type: "create",
    summary: `Added inventory lot for component ${componentId} with quantity ${quantity}`,
    new_value: stringifyHistoryValue({
      component_id: componentId,
      quantity_received: quantity,
      quantity_remaining: quantity,
      unit_cost: purchasePrice,
      received_at: receivedAt,
      source,
      notes
    })
  });

  revalidateAppViews(["/inventory", "/components", `/components/${componentId}`, "/purchasing", "/history"]);
  redirect("/inventory");
}

export async function adjustInventoryDeltaAction(formData: FormData) {
  const componentId = requiredValue(formData.get("component_id"), "Component id");
  const mode = requiredValue(formData.get("mode"), "Mode") as "add" | "remove";
  const amount = parsePositiveNumber(formData.get("amount"), "Amount");
  const source = optionalValue(formData.get("source"));
  const notes = optionalValue(formData.get("notes"));
  const returnTo = optionalValue(formData.get("returnTo")) ?? "/inventory";

  if (mode === "add") {
    const unitCost = parseNonNegativeNumber(formData.get("unit_cost"), "Unit cost");
    const receivedAt = optionalValue(formData.get("received_at")) ?? new Date().toISOString();
    run(
      `
        insert into inventory_lots (
          id, component_id, quantity_received, quantity_remaining, unit_cost, received_at, source, notes
        ) values (
          :id, :component_id, :quantity_received, :quantity_remaining, :unit_cost, :received_at, :source, :notes
        )
      `,
      {
        id: createId(),
        component_id: componentId,
        quantity_received: amount,
        quantity_remaining: amount,
        unit_cost: unitCost,
        received_at: receivedAt,
        source,
        notes
      }
    );

    syncInventorySummaryForComponent(componentId);
    revalidateAppViews(["/components", "/inventory", "/purchasing", `/components/${componentId}`, "/history"]);
    redirect(returnTo);
  }

  const lots = getRows<{
    id: string;
    component_id: string;
    quantity_received: number;
    quantity_remaining: number;
    unit_cost: number;
    received_at: string;
    source: string | null;
    notes: string | null;
    created_at: string;
  }>(
    `
      select id, component_id, quantity_received, quantity_remaining, unit_cost, received_at, source, notes, created_at
      from inventory_lots
      where component_id = :component_id and quantity_remaining > 0
      order by received_at asc, created_at asc
    `,
    { component_id: componentId }
  );
  const consumption = consumeInventoryLotsFifo(lots, amount);

  for (const lot of consumption.updatedLots) {
    run(
      "update inventory_lots set quantity_remaining = :quantity_remaining where id = :id",
      { id: lot.id, quantity_remaining: lot.quantity_remaining }
    );
  }

  syncInventorySummaryForComponent(componentId);

  await recordHistory({
    entity_type: "inventory_lot",
    entity_id: componentId,
    action_type: "remove",
    summary: `Removed ${consumption.inventoryConsumed} from component ${componentId} using FIFO${consumption.remainingRequirement > 0 ? `, shortage ${consumption.remainingRequirement}` : ""}`,
    new_value: stringifyHistoryValue({
      component_id: componentId,
      requested_amount: amount,
      inventory_consumed: consumption.inventoryConsumed,
      remaining_requirement: consumption.remainingRequirement,
      source,
      notes
    })
  });

  revalidateAppViews(["/components", "/inventory", "/purchasing", `/components/${componentId}`, "/history"]);
  redirect(returnTo);
}

export async function updateInventoryLotAction(formData: FormData) {
  const id = requiredValue(formData.get("id"), "Inventory lot id");
  const componentId = requiredValue(formData.get("component_id"), "Component id");
  const quantityReceived = parsePositiveNumber(formData.get("quantity_received"), "Quantity received");
  const quantityRemaining = parseNonNegativeNumber(formData.get("quantity_remaining"), "Quantity remaining");
  const unitCost = parseNonNegativeNumber(formData.get("unit_cost"), "Unit cost");
  const receivedAt = requiredValue(formData.get("received_at"), "Received at");
  const source = optionalValue(formData.get("source"));
  const notes = optionalValue(formData.get("notes"));
  const returnTo = optionalValue(formData.get("returnTo")) ?? `/components/${componentId}`;

  if (quantityRemaining < 0 || quantityRemaining - quantityReceived > QUANTITY_EPSILON) {
    throw new Error("Quantity remaining must be between zero and quantity received.");
  }

  const previous = getRow<{
    id: string;
    component_id: string;
    quantity_received: number;
    quantity_remaining: number;
    unit_cost: number;
    received_at: string;
    source: string | null;
    notes: string | null;
    created_at: string;
  }>(
    `
      select id, component_id, quantity_received, quantity_remaining, unit_cost, received_at, source, notes, created_at
      from inventory_lots
      where id = :id
    `,
    { id }
  );

  run(
    `
      update inventory_lots
      set quantity_received = :quantity_received,
          quantity_remaining = :quantity_remaining,
          unit_cost = :unit_cost,
          received_at = :received_at,
          source = :source,
          notes = :notes
      where id = :id
    `,
    {
      id,
      quantity_received: quantityReceived,
      quantity_remaining: quantityRemaining,
      unit_cost: unitCost,
      received_at: receivedAt,
      source,
      notes
    }
  );

  syncInventorySummaryForComponent(componentId);

  await recordHistory({
    entity_type: "inventory_lot",
    entity_id: id,
    action_type: "update",
    summary: `Updated inventory lot ${id}`,
    old_value: stringifyHistoryValue(previous),
    new_value: stringifyHistoryValue({
      id,
      component_id: componentId,
      quantity_received: quantityReceived,
      quantity_remaining: quantityRemaining,
      unit_cost: unitCost,
      received_at: receivedAt,
      source,
      notes
    })
  });

  revalidateAppViews(["/inventory", "/components", "/purchasing", `/components/${componentId}`, "/history"]);
  redirect(returnTo);
}

export async function deleteInventoryLotAction(formData: FormData) {
  const id = requiredValue(formData.get("id"), "Inventory lot id");
  const componentId = requiredValue(formData.get("component_id"), "Component id");
  const returnTo = optionalValue(formData.get("returnTo")) ?? `/components/${componentId}`;
  const previous = getRow<{
    id: string;
    component_id: string;
    quantity_received: number;
    quantity_remaining: number;
    unit_cost: number;
    received_at: string;
    source: string | null;
    notes: string | null;
    created_at: string;
  }>(
    `
      select id, component_id, quantity_received, quantity_remaining, unit_cost, received_at, source, notes, created_at
      from inventory_lots
      where id = :id
    `,
    { id }
  );

  run("delete from inventory_lots where id = :id", { id });
  syncInventorySummaryForComponent(componentId);

  await recordHistory({
    entity_type: "inventory_lot",
    entity_id: id,
    action_type: "delete",
    summary: `Deleted inventory lot ${id}`,
    old_value: stringifyHistoryValue(previous)
  });

  revalidateAppViews(["/inventory", "/components", "/purchasing", `/components/${componentId}`, "/history"]);
  redirect(returnTo);
}

export async function updateDefaultSafetyStockAction(formData: FormData) {
  const value = Number(requiredValue(formData.get("default_safety_stock"), "Default safety stock"));
  const previous = getRow<{ id: number; default_safety_stock: number }>(
    "select id, default_safety_stock from app_settings where id = 1"
  );
  run(
    `
      insert into app_settings (id, default_safety_stock)
      values (1, :default_safety_stock)
      on conflict(id)
      do update set default_safety_stock = excluded.default_safety_stock
    `,
    { default_safety_stock: value }
  );

  await recordHistory({
    entity_type: "settings",
    entity_id: "app_settings",
    action_type: "update",
    summary: `Updated default safety stock to ${value}`,
    old_value: stringifyHistoryValue(previous),
    new_value: stringifyHistoryValue({ id: true, default_safety_stock: value })
  });

  revalidateAppViews(["/components", "/settings", "/history"]);
  redirect("/settings");
}

export async function importMasterDataAction(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/settings?importError=${encodeURIComponent("Import file is required.")}`);
  }

  try {
    const parsedRows = normalizeMasterDataRows(await parseSpreadsheetFile(file));
    if (parsedRows.length === 0) {
      redirect(`/settings?importError=${encodeURIComponent("The selected file did not contain any import rows.")}`);
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

    for (const row of componentRows) {
      const existing = getRow<{ id: string }>("select id from components where sku = :sku", { sku: row.sku });
      if (existing) {
        run(
          `
            update components
            set name = :name, category = :category, producer = :producer, value = :value, safety_stock = :safety_stock
            where id = :id
          `,
          { id: existing.id, ...row }
        );
      } else {
        run(
          `
            insert into components (id, sku, name, category, producer, value, safety_stock)
            values (:id, :sku, :name, :category, :producer, :value, :safety_stock)
          `,
          { id: createId(), ...row }
        );
      }
    }

    const components = getRows<{ id: string; sku: string }>("select id, sku from components");
    const componentIdBySku = new Map(components.map((row) => [row.sku, row.id]));

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

    const sellerIdByName = new Map<string, string>();
    for (const sellerRow of uniqueSellerRows) {
      const existing = getRow<{ id: string }>("select id from sellers where name = :name", { name: sellerRow.name });
      if (existing) {
        sellerIdByName.set(sellerRow.name, existing.id);
        run(
          "update sellers set base_url = :base_url, lead_time = :lead_time where id = :id",
          { id: existing.id, base_url: sellerRow.base_url, lead_time: sellerRow.lead_time }
        );
      } else {
        const sellerId = createId();
        sellerIdByName.set(sellerRow.name, sellerId);
        run(
          "insert into sellers (id, name, base_url, lead_time) values (:id, :name, :base_url, :lead_time)",
          { id: sellerId, name: sellerRow.name, base_url: sellerRow.base_url, lead_time: sellerRow.lead_time }
        );
      }
    }

    for (const row of parsedRows) {
      const componentId = componentIdBySku.get(row.component_sku);
      const sellerId = sellerIdByName.get(row.seller_name);
      if (!componentId || !sellerId) {
        throw new Error(`Seller link import resolution failed for ${row.component_sku} / ${row.seller_name}.`);
      }

      run(
        `
          insert into inventory_lots (
            id, component_id, quantity_received, quantity_remaining, unit_cost, received_at, source, notes
          ) values (
            :id, :component_id, :quantity_received, :quantity_remaining, :unit_cost, :received_at, :source, :notes
          )
        `,
        {
          id: createId(),
          component_id: componentId,
          quantity_received: row.inventory_quantity_available,
          quantity_remaining: row.inventory_quantity_available,
          unit_cost: row.inventory_purchase_price,
          received_at: new Date().toISOString(),
          source: row.seller_name,
          notes: `Master data import from ${file.name}`
        }
      );

      run(
        `
          insert into component_sellers (component_id, seller_id, product_url)
          values (:component_id, :seller_id, :product_url)
          on conflict(component_id, seller_id)
          do update set product_url = excluded.product_url
        `,
        {
          component_id: componentId,
          seller_id: sellerId,
          product_url: row.seller_product_url
        }
      );
    }

    for (const componentId of componentRows.map((row) => componentIdBySku.get(row.sku)).filter((value): value is string => Boolean(value))) {
      syncInventorySummaryForComponent(componentId);
    }

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
    redirect(`/settings?importError=${encodeURIComponent(error instanceof Error ? error.message : "Could not import the selected file.")}`);
  }

  revalidateAppViews(["/components", "/inventory", "/purchasing", "/settings", "/history"]);
  redirect("/settings");
}

export async function addProductionEntryAction(formData: FormData) {
  const versionId = requiredValue(formData.get("version_id"), "Version id");
  const quantity = Math.max(Number(requiredValue(formData.get("quantity"), "Quantity")), 1);
  const versionDetail = await getVersionDetail(versionId);
  if (versionDetail.error) {
    throw new Error(versionDetail.error);
  }
  if (!versionDetail.item) {
    throw new Error("Version not found.");
  }

  const entryId = createId();
  const mrpRows = buildMrpRows(versionDetail.item.components, quantity);
  const reservedRequirements = reserveInventoryForProduction(mrpRows);

  run(
    "insert into production_entries (id, version_id, quantity, status) values (:id, :version_id, :quantity, 'under_production')",
    { id: entryId, version_id: versionId, quantity }
  );

  for (const row of reservedRequirements) {
    run(
      `
        insert into production_requirements (
          id, production_entry_id, component_id, gross_requirement, inventory_consumed, net_requirement
        ) values (
          :id, :production_entry_id, :component_id, :gross_requirement, :inventory_consumed, :net_requirement
        )
      `,
      {
        id: createId(),
        production_entry_id: entryId,
        component_id: row.componentId,
        gross_requirement: row.grossRequirement,
        inventory_consumed: row.inventoryConsumed,
        net_requirement: row.netRequirement
      }
    );
  }

  for (const component of versionDetail.item.components) {
    const reservation = reservedRequirements.find((row) => row.componentId === component.component.id);
    if (!reservation || reservation.inventoryConsumed <= 0) {
      continue;
    }

    const lots = getRows<{
      id: string;
      component_id: string;
      quantity_received: number;
      quantity_remaining: number;
      unit_cost: number;
      received_at: string;
      source: string | null;
      notes: string | null;
      created_at: string;
    }>(
      `
        select id, component_id, quantity_received, quantity_remaining, unit_cost, received_at, source, notes, created_at
        from inventory_lots
        where component_id = :component_id and quantity_remaining > 0
        order by received_at asc, created_at asc
      `,
      { component_id: component.component.id }
    );
    const consumption = consumeInventoryLotsFifo(lots, reservation.inventoryConsumed);

    for (const lot of consumption.updatedLots) {
      run("update inventory_lots set quantity_remaining = :quantity_remaining where id = :id", {
        id: lot.id,
        quantity_remaining: lot.quantity_remaining
      });
    }

    syncInventorySummaryForComponent(component.component.id);
  }

  await recordHistory({
    entity_type: "production",
    entity_id: entryId,
    action_type: "create",
    summary: `Added version ${versionId} to production with quantity ${quantity} and consumed available inventory`,
    new_value: stringifyHistoryValue({
      id: entryId,
      version_id: versionId,
      quantity,
      status: "under_production",
      requirements: reservedRequirements
    })
  });

  revalidateAppViews([`/versions/${versionId}`, "/inventory", "/components", "/production", "/purchasing", "/history"]);
  redirect("/production");
}

export async function cancelProductionEntryAction(formData: FormData) {
  const productionEntryId = requiredValue(formData.get("production_entry_id"), "Production entry id");
  const entry = getRow<{ id: string; version_id: string; quantity: number; status: string; completed_at: string | null; created_at: string }>(
    "select id, version_id, quantity, status, completed_at, created_at from production_entries where id = :id",
    { id: productionEntryId }
  );
  const requirements = getRows<{ component_id: string; inventory_consumed: number }>(
    "select component_id, inventory_consumed from production_requirements where production_entry_id = :id",
    { id: productionEntryId }
  );
  if (!entry) {
    throw new Error("Production entry not found.");
  }

  for (const requirement of requirements) {
    if (requirement.inventory_consumed <= 0) {
      continue;
    }

    const inventory = getRow<{ purchase_price: number | null }>(
      "select purchase_price from inventory where component_id = :component_id",
      { component_id: requirement.component_id }
    );
    run(
      `
        insert into inventory_lots (
          id, component_id, quantity_received, quantity_remaining, unit_cost, received_at, source, notes
        ) values (
          :id, :component_id, :quantity_received, :quantity_remaining, :unit_cost, :received_at, :source, :notes
        )
      `,
      {
        id: createId(),
        component_id: requirement.component_id,
        quantity_received: requirement.inventory_consumed,
        quantity_remaining: requirement.inventory_consumed,
        unit_cost: Number(inventory?.purchase_price ?? 0),
        received_at: new Date().toISOString(),
        source: "production_cancel",
        notes: `Returned from cancelled production entry ${productionEntryId}`
      }
    );
    syncInventorySummaryForComponent(requirement.component_id);
  }

  run("delete from production_entries where id = :id", { id: productionEntryId });

  await recordHistory({
    entity_type: "production",
    entity_id: productionEntryId,
    action_type: "cancel",
    summary: `Cancelled production entry ${productionEntryId} and returned reserved inventory`,
    old_value: stringifyHistoryValue({ entry, requirements })
  });

  revalidateAppViews(["/inventory", "/components", "/production", "/purchasing", "/history"]);
  redirect("/production");
}

export async function completeProductionEntryAction(formData: FormData) {
  const productionEntryId = requiredValue(formData.get("production_entry_id"), "Production entry id");
  const previous = getRow<{ id: string; version_id: string; quantity: number; status: string; completed_at: string | null; created_at: string }>(
    "select id, version_id, quantity, status, completed_at, created_at from production_entries where id = :id",
    { id: productionEntryId }
  );
  const requirements = getRows<{
    id: string;
    component_id: string;
    gross_requirement: number;
    inventory_consumed: number;
    net_requirement: number;
  }>(
    "select id, component_id, gross_requirement, inventory_consumed, net_requirement from production_requirements where production_entry_id = :id",
    { id: productionEntryId }
  );
  if (!previous) {
    throw new Error("Production entry not found.");
  }

  const openRequirements = requirements.filter((item) => item.net_requirement > 0);
  let completionRequirementUpdates: Array<{ id: string; inventory_consumed: number; net_requirement: number }> = [];

  if (openRequirements.length > 0) {
    const componentIds = Array.from(new Set(openRequirements.map((item) => item.component_id)));
    const components = getRows<{ id: string; name: string }>(
      `select id, name from components where id in (${componentIds.map((_, index) => `:component${index}`).join(", ")})`,
      Object.fromEntries(componentIds.map((componentId, index) => [`component${index}`, componentId]))
    );
    const lots = getRows<{
      id: string;
      component_id: string;
      quantity_received: number;
      quantity_remaining: number;
      unit_cost: number;
      received_at: string;
      source: string | null;
      notes: string | null;
      created_at: string;
    }>(
      `
        select id, component_id, quantity_received, quantity_remaining, unit_cost, received_at, source, notes, created_at
        from inventory_lots
        where component_id in (${componentIds.map((_, index) => `:lotComponent${index}`).join(", ")})
          and quantity_remaining > 0
        order by received_at asc, created_at asc
      `,
      Object.fromEntries(componentIds.map((componentId, index) => [`lotComponent${index}`, componentId]))
    );
    const componentNames = Object.fromEntries(components.map((item) => [item.id, item.name]));
    const lotsByComponent = lots.reduce<Record<string, typeof lots>>((groups, lot) => {
      if (!groups[lot.component_id]) {
        groups[lot.component_id] = [];
      }
      groups[lot.component_id]?.push(lot);
      return groups;
    }, {});

    const completionPlan = planProductionCompletionConsumption({
      requirements: openRequirements,
      lotsByComponent,
      componentNames
    });

    if (!completionPlan.ok) {
      redirect(`/production?error=${encodeURIComponent(completionPlan.message)}`);
    }

    completionRequirementUpdates = completionPlan.requirementUpdates;

    for (const lot of completionPlan.lotUpdates) {
      run("update inventory_lots set quantity_remaining = :quantity_remaining where id = :id", {
        id: lot.id,
        quantity_remaining: lot.quantity_remaining
      });
    }
    for (const requirement of completionPlan.requirementUpdates) {
      run(
        "update production_requirements set inventory_consumed = :inventory_consumed, net_requirement = :net_requirement where id = :id",
        requirement
      );
    }
    for (const componentId of completionPlan.affectedComponentIds) {
      syncInventorySummaryForComponent(componentId);
    }
  }

  const completedAt = new Date().toISOString();
  run(
    "update production_entries set status = 'completed', completed_at = :completed_at where id = :id",
    { id: productionEntryId, completed_at: completedAt }
  );

  await recordHistory({
    entity_type: "production",
    entity_id: productionEntryId,
    action_type: "complete",
    summary:
      completionRequirementUpdates.length > 0
        ? `Marked production entry ${productionEntryId} as completed and consumed remaining net requirements from inventory`
        : `Marked production entry ${productionEntryId} as completed`,
    old_value: stringifyHistoryValue(previous),
    new_value: stringifyHistoryValue({
      ...previous,
      status: "completed",
      completed_at: completedAt,
      completed_requirement_updates: completionRequirementUpdates
    })
  });

  revalidateAppViews(["/inventory", "/components", "/production", "/purchasing", "/history"]);
  redirect("/production");
}
