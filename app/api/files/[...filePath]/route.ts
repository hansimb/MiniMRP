import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/require-admin";
import { getRuntimeMode } from "@/lib/runtime";
import { getDesktopDataDirectory } from "@/lib/runtime/sqlite/files";

const MIME_TYPES = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"],
  [".avif", "image/avif"],
  [".pdf", "application/pdf"],
  [".txt", "text/plain; charset=utf-8"],
  [".csv", "text/csv; charset=utf-8"]
]);

function getMimeType(filePath: string) {
  return MIME_TYPES.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream";
}

export async function GET(
  _: Request,
  context: { params: Promise<{ filePath: string[] }> }
) {
  const adminResponse = await requireAdminApiAccess("/api/files");
  if (adminResponse) {
    return adminResponse;
  }

  if (getRuntimeMode() !== "sqlite") {
    return NextResponse.json({ error: "Local files are only available in sqlite runtime." }, { status: 404 });
  }

  const params = await context.params;
  const relativePath = params.filePath.join("/");
  const baseDirectory = path.resolve(getDesktopDataDirectory());
  const absolutePath = path.resolve(baseDirectory, relativePath);

  if (!absolutePath.startsWith(baseDirectory)) {
    return NextResponse.json({ error: "Invalid file path." }, { status: 400 });
  }

  try {
    const fileBuffer = await fs.readFile(absolutePath);
    return new NextResponse(fileBuffer, {
      headers: {
        "content-type": getMimeType(absolutePath),
        "cache-control": "no-store"
      }
    });
  } catch {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
}
