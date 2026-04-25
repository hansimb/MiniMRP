"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { uploadVersionAttachmentAction } from "@/lib/runtime/actions";
import {
  MAX_UPLOAD_SIZE_LABEL,
  VERSION_ATTACHMENT_MAX_BYTES,
  validateUploadedFile
} from "@/lib/uploads/validation";
import { Notice } from "@/shared/ui";

export function VersionAttachmentUploadForm(props: { versionId: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  function validateSelectedFile() {
    const message = validateUploadedFile({
      file: fileInputRef.current?.files?.[0] ?? null,
      label: "Attachment",
      maxBytes: VERSION_ATTACHMENT_MAX_BYTES
    });

    setClientError(message);
    return message;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (validateSelectedFile()) {
      event.preventDefault();
    }
  }

  return (
    <form action={uploadVersionAttachmentAction} className="stack" onSubmit={handleSubmit}>
      <input type="hidden" name="version_id" value={props.versionId} />
      <div className="field-group">
        <label htmlFor={`version-attachment-file-${props.versionId}`}>Attachment file</label>
        <input
          id={`version-attachment-file-${props.versionId}`}
          ref={fileInputRef}
          className="input"
          type="file"
          name="file"
          required
          onChange={validateSelectedFile}
        />
        <div className="small muted">Use a file up to {MAX_UPLOAD_SIZE_LABEL}.</div>
      </div>
      {clientError ? <Notice error>{clientError}</Notice> : null}
      <button className="button primary" type="submit">
        Upload attachment
      </button>
    </form>
  );
}
