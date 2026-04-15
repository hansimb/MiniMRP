const MB = 1024 * 1024;

export const SERVER_ACTION_BODY_SIZE_LIMIT = "4.5mb";
export const PRODUCT_IMAGE_MAX_BYTES = 4 * MB;
export const VERSION_ATTACHMENT_MAX_BYTES = 4 * MB;
export const MAX_UPLOAD_SIZE_LABEL = "4 MB";

export function validateUploadedFile(args: {
  file: File | null | undefined;
  label: string;
  maxBytes: number;
  mustBeImage?: boolean;
}) {
  const file = args.file;

  if (!(file instanceof File) || file.size === 0) {
    return `${args.label} file is required.`;
  }

  if (file.size > args.maxBytes) {
    return `${args.label} must be ${formatUploadLimit(args.maxBytes)} or smaller.`;
  }

  if (args.mustBeImage && !isImageUpload(file)) {
    return `${args.label} must be an image file.`;
  }

  return null;
}

function formatUploadLimit(bytes: number) {
  if (bytes % MB === 0) {
    return `${bytes / MB} MB`;
  }

  return `${Math.round((bytes / MB) * 10) / 10} MB`;
}

function isImageUpload(file: File) {
  const type = file.type.trim().toLowerCase();
  if (type.startsWith("image/")) {
    return true;
  }

  return /\.(png|jpe?g|gif|webp|svg|avif|bmp|tiff?)$/i.test(file.name);
}
