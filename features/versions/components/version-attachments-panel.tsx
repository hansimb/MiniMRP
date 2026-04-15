import { deleteVersionAttachmentAction } from "@/lib/supabase/actions";
import type { VersionDetail } from "@/lib/types/domain";
import { EmptyState, Notice, Panel } from "@/shared/ui";
import { VersionAttachmentUploadForm } from "./version-attachment-upload-form";

export function VersionAttachmentsPanel(props: {
  version: VersionDetail | null;
  initialError?: string | null;
}) {
  return (
    <Panel
      title="Attachments"
      description="Upload files for this version. Images show previews and other files open in a new tab."
    >
      {props.version ? <VersionAttachmentUploadForm versionId={props.version.id} /> : null}

      {props.initialError ? <Notice error>{props.initialError}</Notice> : null}

      {props.version?.attachments.length ? (
        <div className="attachment-grid">
          {props.version.attachments.map((attachment) => (
            <div key={attachment.id} className="attachment-card">
              {attachment.is_image && attachment.file_url ? (
                <div className="image-frame attachment-preview">
                  <img src={attachment.file_url} alt={attachment.file_name ?? "Attachment"} />
                </div>
              ) : null}

              <div className="attachment-meta">
                <strong>{attachment.file_name ?? attachment.file_path}</strong>
                <span className="small muted">{attachment.file_path}</span>
              </div>

              <div className="action-row">
                {attachment.file_url ? (
                  <a
                    href={attachment.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="button-link subtle"
                  >
                    Open
                  </a>
                ) : null}
                <form action={deleteVersionAttachmentAction}>
                  <input type="hidden" name="version_id" value={props.version?.id ?? ""} />
                  <input type="hidden" name="attachment_id" value={attachment.id} />
                  <button className="button danger" type="submit">
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState>No attachments found for this version.</EmptyState>
      )}
    </Panel>
  );
}
