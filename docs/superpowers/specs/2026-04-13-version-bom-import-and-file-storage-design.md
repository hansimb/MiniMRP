# Version BOM Import And File Storage Design

## Goal

Finish the remaining incomplete version workflow features in MiniMRP by:

- making version-level BOM import actually persist data
- making the replace-all behavior explicit to the user
- supporting version attachment upload, preview, open, and delete
- supporting product main image upload and rendering through Supabase Storage

The end result should let an internal admin manage a product version from a KiCad-style BOM file and attach the related documentation and images without needing manual URL entry.

## Scope

Included in this design:

- version page BOM import from CSV, XLSX, XLS, and ODS
- BOM parsing rules for `sku` and `reference`
- replace-all BOM import semantics
- version attachment upload, listing, preview, open, and delete
- product main image upload and rendering
- Supabase Storage usage for uploaded files
- user-facing instructions and warnings in the UI

Not included:

- product image gallery support
- attachment folders or categories
- attachment versioning
- partial or merge-style BOM imports
- direct browser writes to private Supabase data

## Current Constraints

The current app already has:

- a version detail page and BOM table
- a visual BOM import entry point that only previews files
- attachment rows in `private.attachments` with a single `file_path` field
- a `products.image` text field already used by the product detail page
- server-side privileged Supabase access patterns for sensitive data

The current gaps are:

- BOM import does not write anything
- users are not told clearly what the accepted BOM format is
- attachments are only rendered as raw `file_path` links
- there is no upload or delete flow for version files
- product image rendering assumes the database already contains a directly usable image URL

## Option Review

### Option 1: Replace-all import plus Storage-backed file flows

Importing a BOM replaces all current references for the selected version after the file passes validation. Uploaded files are stored in Supabase Storage, while database rows keep the storage path.

Pros:

- matches how KiCad and similar exports are usually used
- gives users a simple mental model
- keeps sensitive version file access in backend-controlled paths
- uses the current schema with minimal churn

Cons:

- import is destructive by design if the wrong file is selected
- requires strong warning text and pre-submit validation

### Option 2: Merge/upsert import plus Storage-backed file flows

Importing only updates matching references and preserves unrelated existing BOM rows.

Pros:

- less destructive

Cons:

- users cannot easily predict the final BOM
- stale references may remain silently
- does not fit snapshot-style KiCad export workflows

### Option 3: Replace-all import plus manual URL-based files

Importing replaces the BOM, but file handling stays as manually entered URLs or paths.

Pros:

- lower implementation effort

Cons:

- leaves one of the last unfinished features still unfinished
- does not solve upload, preview, or delete
- gives inconsistent user experience

## Recommended Approach

Use Option 1.

BOM import will be an explicit replace-all action with a clear warning in the modal and a strict validation step before any database write. Version attachments and product images will use Supabase Storage, while MiniMRP stores storage paths in existing text columns and resolves them to signed URLs or direct URLs in the query layer.

## BOM Import Design

### Accepted File Shape

The version BOM import accepts CSV, XLSX, XLS, and ODS files using the first sheet only for spreadsheet formats.

The required logical fields are:

- `sku`
- `reference`

Accepted header aliases:

- `sku`, `SKU`, `component_sku`
- `reference`, `Reference`, `references`, `ref`, `designator`

The import instructions shown to the user must say all of the following clearly:

- the file needs only `SKU` and `reference`
- one row may contain one reference or many references
- multiple references in one cell must be comma-separated
- the same SKU may appear on multiple rows
- quantity is not imported as a column and is calculated from the number of references
- importing replaces the entire BOM of the current version

### Supported Reference Shapes

The import parser must support both of these source patterns:

1. Repeated SKU rows

```text
SKU,reference
RES-10K,R1
RES-10K,R2
IC-4558,U1
```

2. Comma-separated references in a single cell

```text
SKU,reference
RES-10K,"R1, R2, R3"
IC-4558,U1
```

Both formats normalize to one stored row per physical reference in `private.component_references`.

### Import Semantics

The import is scoped to one version.

Flow:

1. User opens the version page import modal.
2. User sees the accepted format and the replace-all warning before uploading.
3. Selected file is parsed client-side for preview and validation feedback.
4. On submit, the server parses the uploaded file again and validates it.
5. Every imported SKU must resolve to an existing component in the shared component catalog.
6. If any required column is missing, any row is malformed, any reference list is empty after normalization, or any SKU is unknown, the import stops and nothing is written.
7. If validation succeeds, all existing `component_references` rows for that version are deleted.
8. New reference rows are inserted for the imported data.
9. A history event records that the version BOM was replaced by import.
10. The version page is revalidated and reloaded.

### Data Rules

Rules:

- matching is done by component `sku`
- SKU matching is trimmed and case-insensitive during import lookup
- references are trimmed
- comma-separated references are split on commas
- duplicate blank references are discarded during parsing
- duplicate final references for the same version are rejected before writing, because `(version_id, reference)` must stay unique
- one reference cannot point to two different SKUs in the same imported file

### UX Notes

The modal should show:

- supported file types
- required columns
- explicit replace-all warning
- short examples of valid rows
- preview table
- detected row count and unique SKU count
- blocking validation errors before submit

Suggested warning copy:

`This import replaces the entire BOM of the current version. MiniMRP will delete the current references and rebuild the BOM from this file.`

## Attachment Design

### Storage Model

Version attachments will use a dedicated Supabase Storage bucket, recommended name:

- `version-attachments`

`private.attachments.file_path` will store the storage object path, not a public URL.

Recommended storage path pattern:

- `versions/<version-id>/<timestamp>-<safe-file-name>`

The query layer will convert the storage path into a signed URL for rendering and download. Existing rows that already contain a direct `http` or `https` URL should still render as-is for backward compatibility.

### Attachment UX

The version attachments panel will support:

- file upload
- image preview for image MIME types or common image extensions
- open/download link
- delete action

For image files, the panel should show a thumbnail or inline preview card. For non-image files, it should show a compact file row with the file name and open action.

Displayed label behavior:

- preferred label is the basename from the stored path
- if the row contains a direct external URL, display the last path segment
- if neither is readable, fall back to the raw stored value

### Attachment Write Flow

1. User uploads a file from the version page.
2. Server action stores the object in the `version-attachments` bucket using the admin client.
3. Server action inserts an attachment row in `private.attachments`.
4. History event records the upload.
5. Version page revalidates.

Delete flow:

1. User chooses delete on an attachment.
2. Server action deletes the Storage object when the stored value is a Storage path.
3. Server action removes the matching row from `private.attachments`.
4. History event records the deletion.
5. Version page revalidates.

## Product Image Design

### Storage Model

Product main images will use a dedicated Supabase Storage bucket, recommended name:

- `product-images`

`products.image` will store the storage object path for uploaded images. Existing direct image URLs must still keep working.

Recommended storage path pattern:

- `products/<product-id>/<timestamp>-<safe-file-name>`

### Rendering Model

The product query layer will resolve `products.image` into a displayable URL:

- if the value is already an absolute `http` or `https` URL, use it directly
- otherwise treat it as a Storage path and generate a signed URL from `product-images`

This keeps the current `Product` type usable by the UI while allowing new uploads to use private Storage instead of hardcoded public links.

### Product Image UX

The product page should allow:

- image upload or replacement
- image removal
- current image preview in the summary panel

When a new image is uploaded for a product:

- the old Storage object should be deleted if the previous `products.image` value is a path from the same bucket
- the database should be updated with the new storage path
- history should record the change

When the image is removed:

- the Storage object should be deleted when applicable
- `products.image` should be set to `null`

## Query And Mapping Changes

### Read Layer

Add small file-resolution helpers that:

- detect whether a stored value is an external URL or a Storage path
- build signed URLs for private Storage objects
- derive a user-friendly file name from a path
- detect image-like attachments for preview rendering

These helpers will be used in:

- product queries for `products.image`
- version queries for `attachments`

### Types

The domain types should be extended carefully so the UI receives what it actually needs:

- raw storage path for mutation operations
- resolved display URL for rendering
- optional display name
- optional `isImage`

The database columns do not need to be expanded in this phase if the UI-facing types carry the resolved values built in the query layer.

## Error Handling

### BOM Import Errors

The server should reject import with a clear error when:

- required columns are missing
- the file cannot be parsed
- a row has no SKU
- a row has no usable reference after normalization
- the same reference appears more than once in the final import set
- one reference maps to more than one SKU
- one or more SKUs do not exist in the component catalog

The UI should stop submission when client-side validation already knows the file is invalid, but the server remains the source of truth.

### File Errors

The server should reject upload when:

- no file was selected
- the file is empty
- the bucket operation fails
- the database row write fails

If a Storage upload succeeds but the database write fails, the server action should attempt cleanup of the uploaded object before surfacing the error.

## Testing Strategy

This work should be implemented with test-first coverage for the non-trivial logic.

Add tests for:

- BOM import header alias detection
- BOM import parsing of repeated-SKU rows
- BOM import parsing of comma-separated reference cells
- duplicate reference detection
- conflicting reference-to-SKU detection
- unknown SKU detection in the import mapping stage
- file path helper behavior for direct URLs vs Storage paths
- file name extraction
- image detection

The UI upload widgets themselves do not need full browser-level tests in this phase, but the parsing and mapper logic should be covered by unit-style tests in `tests/*.test.ts`.

## Implementation Notes

### Files Expected To Change

Likely areas:

- `features/versions/components/version-parts-panel.tsx`
- `features/versions/components/version-attachments-panel.tsx`
- `features/versions/components/version-header-actions.tsx`
- `features/products/components/product-summary-panel.tsx`
- `app/products/[id]/page.tsx`
- `lib/import/*`
- `lib/mappers/*`
- `lib/supabase/actions/versions.ts`
- `lib/supabase/actions/products.ts`
- `lib/supabase/queries/versions.ts`
- `lib/supabase/queries/products.ts`
- `lib/types/domain.ts`
- `tests/*.test.ts`

### Supabase Setup Required From The User

The user will need to do the following in Supabase:

1. Create bucket `version-attachments`
2. Create bucket `product-images`
3. Keep both buckets private
4. Ensure the service-role key used by the app is present in `.env.development`

No schema migration is required for the core implementation if existing text columns keep storing Storage paths.

## Success Criteria

The work is complete when:

- BOM import on a version page accepts files with `sku` and `reference`
- users can import either repeated rows or comma-separated references
- the UI clearly warns that import replaces the entire version BOM
- unknown SKUs block import before any write
- version attachments can be uploaded, previewed, opened, and deleted
- product main image can be uploaded, rendered, replaced, and removed
- files are stored in Supabase Storage and rendered through resolved URLs
- the user gets a short Supabase checklist for bucket creation and env verification
