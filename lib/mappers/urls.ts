export function normalizeExternalUrl(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }

  if (text.startsWith("//")) {
    return `https:${text}`;
  }

  if (/^[a-z][a-z\d+.-]*:/i.test(text)) {
    return text;
  }

  return `https://${text.replace(/^\/+/, "")}`;
}
