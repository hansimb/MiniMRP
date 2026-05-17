export function normalizeReferencesInput(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) {
    return ["-"];
  }

  const references = text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return references.length > 0 ? references : ["-"];
}

export function validateVersionComponentReferences(args: {
  componentId: string;
  references: string[];
  existingReferences: Array<{ component_master_id: string; reference: string }>;
}) {
  const seen = new Map<string, string>();

  for (const reference of args.references) {
    const normalizedReference = reference.trim().toUpperCase();
    const existing = seen.get(normalizedReference);

    if (existing) {
      throw new Error(`Duplicate reference "${reference}" in BOM edit.`);
    }

    seen.set(normalizedReference, reference);
  }

  for (const row of args.existingReferences) {
    if (row.component_master_id === args.componentId) {
      continue;
    }

    const conflict = seen.get(row.reference.trim().toUpperCase());
    if (conflict) {
      throw new Error(`Reference "${conflict}" is already assigned to another component in this BOM.`);
    }
  }
}
