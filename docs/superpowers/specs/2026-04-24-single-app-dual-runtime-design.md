# Single-App Dual-Runtime Design

## Goal

MiniMRP must remain one application, edited in one place, while supporting two runtime modes:

- `supabase` for the existing cloud/web deployment
- `sqlite` for a local offline desktop deployment wrapped by Electron

The user-facing application must stay as identical as possible in both modes:

- same `app/` routes
- same `features/`
- same `shared/` UI
- same workflows
- same import/export behavior
- same attachments/images behavior

Only the backend/runtime implementation is allowed to change.

## Current State

The current project already has the correct high-level shape for a single app:

- one root `app/`
- one `features/`
- one `shared/`
- one `lib/`

The main blocker is that the app currently imports Supabase-specific code directly:

- pages read from `@/lib/supabase/queries/*`
- forms/actions call `@/lib/supabase/actions/*`
- auth and middleware assume Supabase
- file storage assumes Supabase Storage

That direct dependency makes the app cloud-specific even though the UI itself is reusable.

## Design Summary

The application will stay exactly where it is today. We will not create a second app tree.

Instead, we will insert one runtime layer between the app and the backend implementation.

The final structure will be:

- `app/` stays shared and runtime-agnostic
- `features/` stays shared
- `shared/` stays shared
- `lib/runtime/` becomes the new backend boundary
- `lib/runtime/supabase/*` contains the existing cloud implementation
- `lib/runtime/sqlite/*` contains the new desktop implementation
- `desktop/electron/*` contains only the Electron wrapper and desktop startup glue

No page copies, no feature copies, no desktop copy of the app.

## Runtime Boundary

The shared app must stop importing Supabase-specific modules directly.

Instead, shared app code will use a runtime facade, for example through:

- `getRuntimeQueries()`
- `getRuntimeActions()`
- `getRuntimeAuth()`
- `getRuntimeFiles()`

The runtime facade will select an implementation using an environment switch:

- `MINIMRP_RUNTIME=supabase`
- `MINIMRP_RUNTIME=sqlite`

Default behavior:

- web uses `supabase`
- Electron desktop uses `sqlite`

This keeps the route tree the same while allowing different persistence/auth/file backends.

## Query and Action Contracts

To minimize churn and reduce breakage risk, the first contract version will mirror the current exported surface.

That means the runtime query layer will support the same operations the app already uses, including:

- product list/detail
- component catalog/detail
- inventory overview
- production overview
- purchasing overview
- settings
- version detail
- history entries

The runtime action layer will mirror current action entry points, including:

- product CRUD/image actions
- version CRUD/BOM/attachment actions
- component CRUD/seller actions
- inventory lot and adjustment actions
- production actions
- settings and import actions

This lets us switch backend implementation first without rewriting the whole UI contract.

## Auth Design

Auth stays visually the same at the app level.

### Web / Supabase

The current secure model stays in place:

- Supabase session
- admin check
- middleware protection
- current page/api redirect behavior

### Desktop / SQLite

Desktop uses a local single-user implementation with the same app-facing contract:

- same login route can remain present
- runtime resolves the desktop user as a local admin user
- no cloud auth dependency
- no network requirement
- works offline

The desktop auth implementation is intentionally simple. Its job is compatibility with the current app structure, not multi-user security.

## Files and Attachments

Both runtimes must support the same attachment and product image workflows.

### Web / Supabase

- keep current Supabase Storage behavior

### Desktop / SQLite

- binary files stored in a local app-data directory
- SQLite stores metadata and relative file paths
- shared app consumes normal file URLs from the runtime file service

The app should not know whether the file came from cloud storage or local disk.

## Electron Design

Electron is not a second application.

Electron only does three things:

1. launches the same Next.js app
2. sets runtime env for desktop mode
3. opens a desktop window

Electron must not contain duplicated routes, components, or business logic.

## Migration Strategy

The safest implementation path is incremental and keeps the web app working throughout.

### Phase 1: Add runtime selection

Add:

- `lib/runtime/env.ts`
- `lib/runtime/contracts.ts`
- `lib/runtime/index.ts`

These files define runtime mode and shared interfaces.

### Phase 2: Move current Supabase implementation behind runtime

Create:

- `lib/runtime/supabase/queries/*`
- `lib/runtime/supabase/actions/*`
- `lib/runtime/supabase/auth/*`
- `lib/runtime/supabase/files/*`

Then convert current `lib/supabase/*` exports into thin compatibility wrappers or move their logic directly under runtime and re-export during migration.

Important: the web app must still pass all existing tests after this phase.

### Phase 3: Introduce SQLite runtime

Create:

- `lib/runtime/sqlite/db.ts`
- `lib/runtime/sqlite/schema.ts`
- `lib/runtime/sqlite/queries/*`
- `lib/runtime/sqlite/actions/*`
- `lib/runtime/sqlite/auth/*`
- `lib/runtime/sqlite/files/*`

This runtime implements the same contracts as the Supabase runtime.

### Phase 4: Point shared app to runtime facade

Replace direct imports from:

- `@/lib/supabase/queries/*`
- `@/lib/supabase/actions/*`

with runtime-level imports.

This is the point where the app becomes truly backend-agnostic.

### Phase 5: Add Electron wrapper

Create a small `desktop/electron/` wrapper that launches the same app with:

- `MINIMRP_RUNTIME=sqlite`

No app duplication is introduced in this phase.

## Error Handling

The runtime layer must normalize backend-specific failures into app-friendly errors.

Rules:

- shared app must not show Supabase-specific wording in desktop mode
- shared app must not show SQLite-specific wording in web mode
- runtime implementations may log backend details internally
- user-visible messages should stay product-oriented

Examples:

- auth required
- admin access required
- schema/data setup missing
- file upload failed
- import failed

## Testing Strategy

The dual-runtime design needs verification at three levels.

### Shared logic

Keep and extend current pure tests for:

- BOM parsing
- MRP calculations
- inventory math
- export formatting
- file naming helpers

### Web runtime

Keep existing Supabase/auth/security tests and ensure the secure web behavior remains unchanged.

### SQLite runtime

Add runtime tests for:

- schema initialization
- CRUD parity for key entities
- inventory lot behavior
- production reservation/completion behavior
- local file storage behavior

### Structural guardrails

Add tests that lock these architecture rules:

- `app/` must not duplicate under desktop
- shared app must not import backend-specific runtime internals directly
- desktop wrapper must not contain copied route code

## Non-Goals

This refactor does not attempt to:

- redesign the UI
- change workflows between web and desktop
- introduce multi-user local auth
- add cloud sync between SQLite and Supabase
- replace Next.js with a second frontend stack

## Recommended Implementation Order

1. Create runtime contracts and env selection
2. Move Supabase implementation behind the runtime facade without changing behavior
3. Update shared app imports to use runtime facade
4. Add SQLite implementation matching the same contracts
5. Add Electron wrapper for desktop mode
6. Add structural tests to prevent app duplication from returning

## Acceptance Criteria

The design is successful when all of the following are true:

- there is still only one shared `app/`
- there is still only one shared UI codebase
- web continues to use Supabase and keep current admin security behavior
- desktop runs offline with SQLite
- desktop uses the same routes and workflows as web
- no copied app tree exists under `desktop/`
- future UI changes are made once and affect both runtimes
