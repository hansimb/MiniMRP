"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { uploadProductImageAction } from "@/lib/supabase/actions";
import {
  MAX_UPLOAD_SIZE_LABEL,
  PRODUCT_IMAGE_MAX_BYTES,
  validateUploadedFile
} from "@/lib/uploads/validation";
import { Notice } from "@/shared/ui";

export function ProductImageUploadForm(props: { productId: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  function validateSelectedFile() {
    const message = validateUploadedFile({
      file: fileInputRef.current?.files?.[0] ?? null,
      label: "Product image",
      maxBytes: PRODUCT_IMAGE_MAX_BYTES,
      mustBeImage: true
    });

    setClientError(message);
    return message;
  }

  function handleChange() {
    validateSelectedFile();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (validateSelectedFile()) {
      event.preventDefault();
    }
  }

  return (
    <form action={uploadProductImageAction} className="stack" onSubmit={handleSubmit}>
      <input type="hidden" name="id" value={props.productId} />
      <div className="field-group">
        <label htmlFor={`product-image-file-${props.productId}`}>Product image</label>
        <input
          id={`product-image-file-${props.productId}`}
          ref={fileInputRef}
          className="input"
          type="file"
          name="file"
          accept="image/*"
          required
          onChange={handleChange}
        />
        <div className="small muted">Use an image file up to {MAX_UPLOAD_SIZE_LABEL}.</div>
      </div>
      {clientError ? <Notice error>{clientError}</Notice> : null}
      <button className="button primary" type="submit">
        Save image
      </button>
    </form>
  );
}
