# Live Demo Local Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the outdated Supabase-backed `live-demo` branch with the latest `origin/dev` application and a complete, per-browser IndexedDB runtime suitable for a public Vercel portfolio demo.

**Architecture:** The live-demo branch uses client page adapters backed by a typed Dexie repository. Pure selectors and commands preserve the SQLite runtime's business behavior, while browser-only adapters handle IndexedDB, blobs, backup archives, downloads, first-run setup, and cross-tab refresh.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.9, Dexie/IndexedDB, fflate ZIP archives, fake-indexeddb, Node test runner, Playwright browser smoke tests

**Spec:** `docs/superpowers/specs/2026-09-02-live-demo-local-runtime-design.md`

## Global Constraints

- Begin the new `live-demo` implementation at the exact current `origin/dev` commit.
- Do not add demo-only behavior to `dev` or `main`.
- Do not require Supabase environment variables, authentication, or network storage.
- Keep the Electron/SQLite source intact so future `dev` merges remain understandable.
- Browser code must not import `node:sqlite`, `fs`, `path`, `node:zlib`, or Supabase modules.
- Persist business data and binary assets in IndexedDB; never encode attachments into `localStorage`.
- Every data-changing command must be atomic and append the same meaningful history events as SQLite.
- Do not push or trigger Vercel until tests, typecheck, production build, and browser smoke checks pass.

---

### Task 1: Safely Rebase The Live Demo On Latest Development

**Files:**
- Preserve: current user-owned `tsconfig.tsbuildinfo` modification
- Create on `live-demo`: `docs/superpowers/specs/2026-09-02-live-demo-local-runtime-design.md`
- Create on `live-demo`: `docs/superpowers/plans/2026-09-02-live-demo-local-runtime.md`

**Interfaces:**
- Consumes: `origin/dev` commit recorded at execution time
- Produces: local `live-demo` whose parent is that exact commit; backup tag `archive/live-demo-supabase-YYYYMMDD`

- [ ] **Step 1: Record and validate the exact branch tips**

  Run `git -c safe.directory=C:/Users/IMBERI/Desktop/dev/projects2/MiniMRP fetch origin --prune`, then record `git rev-parse origin/dev`, `git rev-parse origin/live-demo`, and `git status --short`. Do not touch the existing modified `tsconfig.tsbuildinfo`.

- [ ] **Step 2: Preserve the old remote demo tip**

  Create annotated tag `archive/live-demo-supabase-YYYYMMDD` at the recorded `origin/live-demo` SHA. Verify `git rev-parse <tag>^{commit}` equals the recorded SHA. Do not push the tag yet.

- [ ] **Step 3: Create an isolated worktree from the latest dev tip**

  Use the `superpowers:using-git-worktrees` skill. Create/recreate the local `live-demo` branch at the recorded `origin/dev` SHA in that worktree; never hard-reset the user's dirty `dev` checkout.

- [ ] **Step 4: Add the approved design and implementation plan**

  Copy these two documents into the isolated branch and commit only them with `docs: plan browser-local live demo runtime`.

- [ ] **Step 5: Prove the baseline**

  Run `npm test`, `npm run typecheck`, and `npm run build` without changing runtime code. Record any baseline failure before proceeding.

### Task 2: Add Browser Runtime Dependencies And Schema

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `lib/runtime/demo/schema.ts`
- Create: `lib/runtime/demo/database.ts`
- Create: `lib/runtime/demo/types.ts`
- Create: `tests/demo-database.test.ts`

**Interfaces:**
- Produces: `DemoDatabase`, `DemoDatabaseRecordMap`, `openDemoDatabase(name?)`, `deleteDemoDatabase(name?)`
- Consumes later: repositories, seed/reset, backup service

- [ ] **Step 1: Write failing schema tests**

  Add `tests/demo-database.test.ts` using `fake-indexeddb/auto`. Assert that `openDemoDatabase("minimrp-test")` creates tables for metadata, settings, products, product versions, components, sellers, component sellers, component references, inventory, inventory lots, production entries, production requirements, attachments, assets, and history. Assert compound keys match the SQLite uniqueness rules.

- [ ] **Step 2: Verify RED**

  Run `node --experimental-strip-types --test tests/demo-database.test.ts`. It must fail because `lib/runtime/demo/database.ts` does not exist.

- [ ] **Step 3: Install and implement the minimal database**

  Add runtime dependencies `dexie` and `fflate`, and dev dependencies `fake-indexeddb`, `@playwright/test`, and `tsx`. Define record types with the existing domain field names plus `DemoAssetRecord { id, blob, mediaType, fileName, size }` and `DemoMetadataRecord { key, value }`. Define Dexie version 1 indexes explicitly and export typed tables.

- [ ] **Step 4: Verify GREEN**

  Re-run the focused database test, then `npm run typecheck`.

- [ ] **Step 5: Commit**

  Commit the dependency lockfile, schema, database, types, and test as `feat(demo): add indexeddb schema`.

### Task 3: Build Deterministic Initialization, Seed, And Reset

**Files:**
- Create: `lib/runtime/demo/demo-seed.ts`
- Create: `lib/runtime/demo/initialize.ts`
- Create: `lib/runtime/demo/validate.ts`
- Test: `tests/demo-initialize.test.ts`

**Interfaces:**
- Produces: `getDemoInitializationState(db)`, `initializeSampleDemo(db)`, `initializeEmptyDemo(db)`, `resetDemo(db, "sample" | "empty")`, `validateDemoSnapshot(snapshot)`
- Consumes: Dexie schema from Task 2 and business records extracted from `lib/runtime/sqlite/dev-seed.ts`

- [ ] **Step 1: Write failing initialization tests**

  Assert a new database reports `uninitialized`; empty initialization reports `ready` after reload while containing no products; sample initialization contains at least two products, multiple versions/components, inventory lots, seller links, an active production entry, purchasing shortages, and history. Assert reset replaces rather than merges data and uses stable seed IDs.

- [ ] **Step 2: Verify RED**

  Run the focused test and confirm missing initialization exports cause the failure.

- [ ] **Step 3: Extract browser-safe sample records**

  Move only static fixture construction—not imports of `node:sqlite` or filesystem APIs—from `lib/runtime/sqlite/dev-seed.ts` into `demo-seed.ts`. Use deterministic IDs and ISO timestamps. Include no private company/customer information.

- [ ] **Step 4: Implement atomic initialization and validation**

  Write all records and `metadata.initializationState = "ready"` in one Dexie read-write transaction. `resetDemo` clears every business and asset table in the same transaction before inserting the selected dataset. Validation checks supported schema version, unique IDs, foreign keys, finite non-negative quantities/costs, and production status values.

- [ ] **Step 5: Verify GREEN and commit**

  Run `tests/demo-initialize.test.ts` and commit as `feat(demo): add sample and empty initialization`.

### Task 4: Implement Pure Selectors With SQLite View Parity

**Files:**
- Create: `lib/runtime/demo/selectors.ts`
- Create: `lib/runtime/demo/repository.ts`
- Create: `tests/demo-query-parity.test.ts`
- Reference: `lib/runtime/sqlite/queries.ts`
- Reuse: `lib/mappers/mrp.ts`, `lib/mappers/inventory.ts`, `lib/mappers/inventory-lots.ts`, `lib/mappers/production.ts`

**Interfaces:**
- Produces: `DemoRepository` query methods matching every method and DTO in `RuntimeQueries`
- Consumes later: `DemoRuntimeProvider` and browser exports

- [ ] **Step 1: Write failing parity tests**

  Load one canonical fixture into an in-memory SQLite database and a fake IndexedDB database. For `getProductList`, `getProductDetail`, `getPartCatalog`, `getPartDetail`, `getInventoryOverview`, `getVersionDetail`, `getProductionOverview`, `getPurchasingOverview`, `getHistoryEntries`, and `getAppSettings`, normalize ordering and object URLs and assert deeply equal results.

- [ ] **Step 2: Verify RED**

  Run `tests/demo-query-parity.test.ts`; confirm it fails on the absent demo repository.

- [ ] **Step 3: Implement selectors incrementally**

  Implement one query at a time by loading the minimum indexed records and passing them through existing pure mappers. Preserve filtering, reserved production snapshots, FIFO-derived costs, version counts, seller resolution, and deterministic ordering from `sqlite/queries.ts`. Return `{ error: null, ... }` on success and typed repository errors on failure.

- [ ] **Step 4: Verify each query before adding the next**

  Re-run the named focused subtest after each selector, then run the complete parity file and existing mapper tests.

- [ ] **Step 5: Commit**

  Commit as `feat(demo): add browser query parity`.

### Task 5: Implement Transactional Commands With SQLite Behavior Parity

**Files:**
- Create: `lib/runtime/demo/commands.ts`
- Create: `lib/runtime/demo/command-inputs.ts`
- Create: `tests/demo-command-parity.test.ts`
- Reference: `lib/runtime/sqlite/actions.ts`
- Reuse: `lib/import/master-data.ts`, `lib/import/version-bom.ts`, `lib/uploads/validation.ts`

**Interfaces:**
- Produces: typed inputs and repository commands for all 28 current `RuntimeActions`
- Produces command result: `{ ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> }`

- [ ] **Step 1: Write the first failing command test**

  Start with create/update/delete product and version flows. Assert persisted rows, deletion guards, cascading dependent demo rows, and history messages against the SQLite reference behavior.

- [ ] **Step 2: Verify RED, then implement the first command group**

  Parse and validate typed input before starting a Dexie transaction. Mutate business rows and append history atomically. Verify the product/version group turns green.

- [ ] **Step 3: Repeat RED/GREEN by independent command group**

  Cover: components and sellers; BOM editing/import; inventory lots and safety stock; production create/complete/cancel with reservation snapshots and FIFO costs; settings; master-data import; images and attachments. Each group gets behavior and rollback tests before implementation.

- [ ] **Step 4: Run full parity and regression tests**

  Run `tests/demo-command-parity.test.ts`, `tests/production*.test.ts`, `tests/inventory*.test.ts`, `tests/mrp.test.ts`, `tests/bom.test.ts`, and both import suites.

- [ ] **Step 5: Commit**

  Commit as `feat(demo): add transactional browser commands`.

### Task 6: Add The Demo Runtime Provider And First-Run Experience

**Files:**
- Create: `features/demo-runtime/demo-runtime-provider.tsx`
- Create: `features/demo-runtime/use-demo-runtime.ts`
- Create: `features/demo-runtime/demo-initializer.tsx`
- Create: `features/demo-runtime/demo-notice.tsx`
- Modify: `app/layout.tsx`
- Modify: `shared/ui/app-shell.tsx`
- Modify: `middleware.ts`
- Modify: `app/login/page.tsx`
- Test: `tests/demo-runtime-provider.test.tsx`

**Interfaces:**
- Produces: `useDemoRuntime()` returning `{ status, queries, commands, revision, initialize, reset }`
- Consumes: repository, initialize/reset services

- [ ] **Step 1: Write failing provider and initialization UI tests**

  Assert loading is shown before the database opens; the three first-run choices are visible only while uninitialized; sample/empty selection opens the app; repository failures show an actionable error; `Local demo` notice replaces logout; middleware does not redirect without cookies.

- [ ] **Step 2: Verify RED**

  Run the provider test and confirm missing components cause failure.

- [ ] **Step 3: Implement provider lifecycle**

  Open one repository after mount, subscribe through `useSyncExternalStore`, publish revisions through `BroadcastChannel("minimrp-demo-revisions")`, and close/revoke resources on unmount. Wrap `AppShell` content in the provider and initializer gate.

- [ ] **Step 4: Remove live-demo authentication UX**

  Make middleware pass through all routes for the demo build, redirect `/login` to `/products`, and render the browser-local-data notice with a Settings link. Do not import the Supabase browser client from any client bundle reachable in live-demo.

- [ ] **Step 5: Verify GREEN and commit**

  Run provider, auth, and runtime tests; commit as `feat(demo): add local runtime shell`.

### Task 7: Convert Every Data-Bound Route And Form To The Client Runtime

**Files:**
- Create: client page components under `features/demo-pages/` for products, product detail, components, component detail, version detail, inventory, production, purchasing, history, and settings
- Modify: all matching route files under `app/`
- Modify: form components under `features/products`, `features/parts`, `features/versions`, `features/inventory`, `features/production`, `features/purchasing`, and `features/import`
- Test: `tests/demo-pages.test.tsx`

**Interfaces:**
- Consumes: `useDemoRuntime()` query and command methods
- Produces: route shells that pass URL params/search params into client page components

- [ ] **Step 1: Write failing route inventory tests**

  Maintain an explicit array of all ten data-bound routes. Assert each route renders its matching client page and no client page imports `@/lib/runtime/actions`, `@/lib/runtime`, or Supabase. Add representative interaction tests for create product, adjust inventory, add production, complete production, and update settings.

- [ ] **Step 2: Verify RED**

  Run `tests/demo-pages.test.tsx` and confirm current server query/action usage fails the inventory assertions.

- [ ] **Step 3: Convert routes in vertical slices**

  Convert in this order: Products → Components/BOM → Inventory → Production/MRP → Purchasing → History/Settings. Route files keep only params/search-param extraction. Client pages query on `revision`; forms call typed commands, show pending/error state, close modals after success, and navigate with `next/navigation` where required.

- [ ] **Step 4: Verify each vertical slice**

  After each slice, run its interaction tests plus the existing mapper/domain tests. Do not defer all UI validation until the end.

- [ ] **Step 5: Verify route completeness and commit**

  Run the full route inventory test and `npm run typecheck`; commit as `feat(demo): connect all pages to indexeddb`.

### Task 8: Move Uploads And CSV Exports Into The Browser

**Files:**
- Create: `lib/runtime/demo/assets.ts`
- Create: `lib/runtime/demo/downloads.ts`
- Create: `features/demo-runtime/demo-export-link.tsx`
- Modify: product image and version attachment components
- Modify: export links in page/panel components
- Test: `tests/demo-assets.test.ts`
- Test: `tests/demo-exports.test.ts`

**Interfaces:**
- Produces: `createAssetUrl`, `revokeAssetUrl`, `downloadCsv`, typed export builders
- Consumes: repository asset table and existing CSV mapper helpers

- [ ] **Step 1: Write failing asset and export tests**

  Assert valid blobs round-trip through IndexedDB, replacement/removal deletes orphaned assets, unsupported/oversize files are rejected before write, and generated CSV matches existing endpoint content/filenames for BOM, MRP, components, inventory, and purchasing.

- [ ] **Step 2: Verify RED**

  Run both focused files and confirm missing browser services cause failure.

- [ ] **Step 3: Implement Blob persistence and URL lifecycle**

  Store original `Blob` objects with metadata, keep only asset IDs in product/attachment rows, create object URLs on query projection, and revoke replaced or unmounted URLs.

- [ ] **Step 4: Replace server export/file paths**

  Generate CSV from browser query results and trigger downloads with temporary object URLs. Ensure live-demo components do not link to `/api/export/*` or `/api/files/*`; leave route files in place for the maintained non-demo branches.

- [ ] **Step 5: Verify GREEN and commit**

  Run asset, upload-validation, export, and page tests; commit as `feat(demo): keep files and exports in browser`.

### Task 9: Add Versioned Full-Workspace Backup And Restore

**Files:**
- Create: `lib/runtime/demo/backup.ts`
- Create: `features/demo-runtime/demo-data-controls.tsx`
- Modify: demo settings client page
- Test: `tests/demo-backup.test.ts`

**Interfaces:**
- Produces: `exportDemoBackup(db): Promise<Blob>`, `inspectDemoBackup(file)`, `restoreDemoBackup(db, file)`
- Backup members: `manifest.json`, `data.json`, `assets/<asset-id>`

- [ ] **Step 1: Write failing backup tests**

  Assert a complete dataset and multiple binary assets survive export/delete/import; manifest format version and checksums are present; corrupt ZIP, missing asset, invalid foreign key, and future schema version are rejected; failed restore leaves the original database byte-for-byte equivalent at the record level.

- [ ] **Step 2: Verify RED**

  Run `tests/demo-backup.test.ts` and confirm missing codec functions fail.

- [ ] **Step 3: Implement archive encoding and inspection**

  Use browser-compatible `fflate` only. Encode JSON as UTF-8, store assets as binary ZIP entries, include application version, schema version, export timestamp, record counts, and SHA-256 checksums via Web Crypto.

- [ ] **Step 4: Implement atomic restore and settings controls**

  Decode, checksum, migrate, and validate into memory before opening one Dexie replacement transaction. Add Export, Restore, Reset to sample, and Reset to empty controls with confirmation and success/error feedback.

- [ ] **Step 5: Verify GREEN and commit**

  Run backup, initialization, and provider tests; commit as `feat(demo): add complete local backup restore`.

### Task 10: Add Production Browser Smoke Coverage And Demo Documentation

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/live-demo.spec.ts`
- Modify: `package.json`
- Modify: `README.md`
- Create: `docs/live-demo-maintenance.md`
- Modify: `.gitignore` if Playwright artifacts require it

**Interfaces:**
- Produces scripts: `test:e2e`, `verify:live-demo`
- Documents: update and rollback commands for future maintainers

- [ ] **Step 1: Write the failing browser journey**

  In a fresh browser context: open `/`, choose sample data, verify products/components/inventory; create a product and verify persistence after reload; open a second tab and verify revision refresh; export backup; reset empty; restore backup; verify the product returns. Record requests and fail if any host contains `supabase`.

- [ ] **Step 2: Verify RED**

  Run the Playwright test against `npm run dev`; it must fail before the client conversion is complete.

- [ ] **Step 3: Add production-mode verification scripts and docs**

  `verify:live-demo` runs the full Node tests, typecheck, `next build`, starts `next start`, and runs Playwright. Document browser-local privacy, storage limitations, reset/backup behavior, branch update procedure, Vercel runtime expectations, and rollback to the archive tag.

- [ ] **Step 4: Run complete verification**

  With every `SUPABASE` variable removed from the command environment, run `npm run verify:live-demo`. Inspect that tests report zero failures, TypeScript exits 0, Next production build exits 0, and Playwright passes in a clean profile.

- [ ] **Step 5: Commit**

  Commit as `test(demo): verify browser-local production flow`.

### Task 11: Review, Publish The Branch, And Verify Vercel

**Files:**
- No source changes expected
- Inspect: complete `origin/dev..live-demo` diff

**Interfaces:**
- Consumes: fully verified local `live-demo`
- Produces: updated `origin/live-demo` and verified public deployment

- [ ] **Step 1: Request two independent reviews**

  Use one subagent for spec/requirements compliance and another for code quality/security review. Resolve findings through new failing tests and focused commits. Review their changes and rerun verification yourself.

- [ ] **Step 2: Audit the final branch**

  Confirm the merge base is the recorded latest `origin/dev`, the only changes are demo runtime/docs/tests, no secrets or `.env` files are tracked, no reachable client code imports Supabase, and the backup tag resolves to the old remote tip.

- [ ] **Step 3: Run the final fresh gate**

  Run `npm run verify:live-demo` again after all review fixes. Do not rely on earlier output.

- [ ] **Step 4: Publish recoverably**

  Push the archive tag first. Re-fetch `origin/live-demo`, confirm it still equals the SHA recorded in Task 1, then use `git push --force-with-lease=live-demo:<old-sha> origin live-demo:live-demo`. Never use an unqualified `--force`.

- [ ] **Step 5: Verify the deployed site**

  Wait for the existing Vercel deployment to become ready. Open the public URL in a clean context and repeat first-run sample initialization, mutation/reload, reset, backup restore, and network inspection. If deployment fails, leave the archive tag intact and either fix forward or restore the old SHA with another lease-protected push.

## Plan Self-Review

- Every design requirement maps to a task: branch safety (1, 11), complete schema (2), seed/empty/reset (3, 6, 9), query parity (4), mutation parity (5), full UI conversion (6–7), binary assets and CSV (8), backup (9), Vercel/browser proof (10–11).
- The browser/server boundary is explicit: no server query or server action is used for visitor-owned data.
- Types flow from schema → repository → provider → client pages; backup imports the same record map and validator.
- The plan contains no destructive unguarded reset and uses a backup tag plus `--force-with-lease`.
- The user's existing dirty `tsconfig.tsbuildinfo` remains outside the isolated implementation worktree.
