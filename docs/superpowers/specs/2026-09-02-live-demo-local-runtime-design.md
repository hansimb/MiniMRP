# Live Demo Local Runtime Design

## Goal

Create a portfolio-ready `live-demo` branch from the latest `origin/dev` state. The deployed demo must run on Vercel without Supabase, login credentials, or any shared backend. Each visitor gets an isolated, persistent browser-local workspace and can explore the complete current MiniMRP workflow.

## Branch Strategy

- Preserve the old remote tip with an annotated backup tag before replacement.
- Create the new `live-demo` history from the exact current `origin/dev` commit.
- Keep all demo-only commits on `live-demo`; do not merge demo seed/reset UX into `dev` or `main`.
- Bring future product work into the demo by merging `dev` into `live-demo` and retaining the browser runtime during conflict resolution.
- Update `origin/live-demo` with `--force-with-lease` only after local verification. This is the branch watched by the existing Vercel project.

## Runtime Architecture

The browser demo is a real client-side runtime, not a server runtime pretending to use local storage. Next.js route files remain thin server shells where route parameters are useful, while each data-bound screen renders a client page component under a `DemoRuntimeProvider`.

The provider owns one `DemoRepository` instance. The repository exposes typed queries and commands corresponding to the existing `RuntimeQueries` and `RuntimeActions` behavior, but commands accept typed objects rather than `FormData` server actions. React components subscribe to repository revisions and re-read selectors after each committed transaction.

IndexedDB is the persistence engine. The implementation uses Dexie because MiniMRP has related tables, multi-table mutations, blobs, indexes, and atomic reset/import requirements. Plain `localStorage` is not suitable for attachments, transaction safety, or data volume. Browser runtime code must never import `node:sqlite`, Node filesystem modules, Supabase clients, or server-only modules.

## Data Model

The IndexedDB schema mirrors all maintained SQLite entities rather than inventing a reduced demo model:

- settings
- products and product versions
- components, sellers, and component-seller links
- component references (BOM)
- inventory summary records and inventory lots
- production entries and snapshotted production requirements
- version attachment metadata
- history events
- binary assets for product images and version attachments
- runtime metadata, including schema version and initialization state

IDs remain strings and timestamps remain ISO strings so existing domain DTOs and mapper logic can be reused. Schema migrations are monotonic Dexie versions. Import is validated fully before a single read-write transaction replaces the active database.

## Initialization And Demo UX

On the first visit, an initialization screen offers three choices:

1. `Explore sample company` loads a deterministic, realistic dataset.
2. `Start empty` initializes all tables without business records.
3. `Restore backup` validates and imports a MiniMRP backup file.

The recommended sample option is visually primary. Settings exposes export, restore, reset to sample, and reset to empty. Destructive reset/restore actions require confirmation. Initialization state is explicit; an intentionally empty database must not be mistaken for a first visit.

The app shell displays a concise `Local demo` notice explaining that data stays in this browser and can be reset or exported. Login/logout UI is absent in the demo runtime, and middleware permits all application routes.

## Queries, Commands, And Business Rules

Pure browser-safe domain modules contain selectors and transactional commands. The existing SQLite implementation is the behavioral reference for:

- product/version CRUD and deletion guards
- BOM replacement and import validation
- seller links and safety-stock updates
- inventory lot creation/edit/delete and derived available quantity
- production reservation snapshots, FIFO consumption, completion, cancellation, and cost history
- purchasing shortages, near-safety, and out-of-stock calculations
- history events
- master-data import

Existing pure functions under `lib/mappers` are reused. Node-specific SQLite code remains desktop-only. Shared view components receive DTO data and command callbacks, so the live-demo implementation does not duplicate the visual application.

## Files, Exports, And Backups

Product images and version attachments are stored as IndexedDB `Blob` rows. Object URLs are created for display and revoked when no longer needed. Existing size/type validation remains in force.

CSV exports are generated in the browser from repository query results and downloaded with `Blob` URLs. Vercel API routes cannot read a visitor's IndexedDB, so the live-demo UI must not call `/api/export/*` or `/api/files/*`.

The backup format is a versioned `.minimrp-backup` ZIP archive containing `manifest.json`, `data.json`, and binary asset entries. Import rejects malformed, unsupported, or referentially invalid packages before changing the active database. Exported backups contain the whole local workspace, including attachments.

## Error Handling And Browser Behavior

- Repository initialization exposes loading, ready, and failed states.
- IndexedDB unavailability or quota failures produce actionable UI and do not silently discard writes.
- Each command is atomic and surfaces a user-facing result; failed commands do not partially mutate data.
- A `BroadcastChannel` revision message refreshes other tabs after commits. IndexedDB remains the source of truth.
- Future-version backups are rejected; older supported schema versions migrate before validation.
- The first production scope targets current evergreen desktop and mobile browsers. Private browsing limitations are disclosed when persistence fails.

## Verification And Deployment

The implementation follows test-driven development. Pure commands/selectors receive fixture-based parity tests against current SQLite behavior. Fake IndexedDB tests cover initialization, transactions, reset, migrations, blobs, and backup rollback. Component tests cover the first-run chooser and representative form flows. The full existing test suite, TypeScript check, Next production build, and an automated browser smoke journey must pass with all Supabase environment variables absent.

Only then is `origin/live-demo` replaced using `git push --force-with-lease`. The deployed Vercel URL is checked in a clean browser context for first-run initialization, persistence after reload, cross-tab refresh, reset, backup round-trip, and absence of Supabase network calls.
