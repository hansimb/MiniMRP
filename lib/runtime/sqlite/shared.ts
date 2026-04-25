import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { SQLInputValue } from "node:sqlite";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildStorageObjectPath } from "../../mappers/file-storage.ts";
import { getDesktopDatabase } from "./db.ts";
import { getDesktopDataDirectory } from "./files.ts";

export { revalidatePath, redirect };

export function createId() {
  return randomUUID();
}

export function optionalValue(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

export function requiredValue(value: FormDataEntryValue | null, field: string) {
  const text = String(value ?? "").trim();
  if (!text) {
    throw new Error(`${field} is required.`);
  }
  return text;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function stringifyHistoryValue(value: unknown) {
  return JSON.stringify(value);
}

export function run(sql: string, params: Record<string, SQLInputValue> = {}) {
  return getDesktopDatabase().prepare(sql).run(params);
}

export function getRow<T>(sql: string, params: Record<string, SQLInputValue> = {}) {
  return (getDesktopDatabase().prepare(sql).get(params) as T | undefined) ?? null;
}

export function getRows<T>(sql: string, params: Record<string, SQLInputValue> = {}) {
  return getDesktopDatabase().prepare(sql).all(params) as T[];
}

export async function recordHistory(args: {
  entity_type: string;
  entity_id?: string | null;
  action_type: string;
  summary: string;
  old_value?: string | null;
  new_value?: string | null;
}) {
  try {
    run(
      `
        insert into history_events (
          id,
          entity_type,
          entity_id,
          action_type,
          summary,
          old_value,
          new_value
        ) values (
          :id,
          :entity_type,
          :entity_id,
          :action_type,
          :summary,
          :old_value,
          :new_value
        )
      `,
      {
        id: createId(),
        entity_type: args.entity_type,
        entity_id: args.entity_id ?? null,
        action_type: args.action_type,
        summary: args.summary,
        old_value: args.old_value ?? null,
        new_value: args.new_value ?? null
      }
    );
  } catch {
    // Keep UI actions functional even if history persistence fails.
  }
}

export async function writeDesktopStoredFile(args: {
  scope: "products" | "versions";
  entityId: string;
  file: File;
}) {
  const relativePath = buildStorageObjectPath(args.scope, args.entityId, args.file.name);
  const absolutePath = path.join(getDesktopDataDirectory(), relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  const arrayBuffer = await args.file.arrayBuffer();
  fs.writeFileSync(absolutePath, Buffer.from(arrayBuffer));
  return relativePath.replace(/\\/g, "/");
}

export function deleteDesktopStoredFileIfPresent(storedPath: string | null | undefined) {
  const normalized = String(storedPath ?? "").trim();
  if (!normalized) {
    return;
  }

  const absolutePath = path.join(getDesktopDataDirectory(), normalized);
  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
}
