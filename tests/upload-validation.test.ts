import test from "node:test";
import assert from "node:assert/strict";
import nextConfig from "../next.config.ts";
import {
  MAX_UPLOAD_SIZE_LABEL,
  PRODUCT_IMAGE_MAX_BYTES,
  SERVER_ACTION_BODY_SIZE_LIMIT,
  validateUploadedFile
} from "../lib/uploads/validation.ts";

test("next config raises the server action body size limit for uploads", () => {
  assert.equal(nextConfig.experimental?.serverActions?.bodySizeLimit, SERVER_ACTION_BODY_SIZE_LIMIT);
});

test("upload validation exposes the shared product image size limit label", () => {
  assert.equal(PRODUCT_IMAGE_MAX_BYTES, 4 * 1024 * 1024);
  assert.equal(MAX_UPLOAD_SIZE_LABEL, "4 MB");
});

test("upload validation rejects product images larger than the supported limit", () => {
  const file = new File([new Uint8Array(PRODUCT_IMAGE_MAX_BYTES + 1)], "hero.png", {
    type: "image/png"
  });

  assert.equal(
    validateUploadedFile({
      file,
      label: "Product image",
      maxBytes: PRODUCT_IMAGE_MAX_BYTES,
      mustBeImage: true
    }),
    "Product image must be 4 MB or smaller."
  );
});

test("upload validation rejects non-image product uploads", () => {
  const file = new File([new Uint8Array([1, 2, 3])], "notes.pdf", {
    type: "application/pdf"
  });

  assert.equal(
    validateUploadedFile({
      file,
      label: "Product image",
      maxBytes: PRODUCT_IMAGE_MAX_BYTES,
      mustBeImage: true
    }),
    "Product image must be an image file."
  );
});
