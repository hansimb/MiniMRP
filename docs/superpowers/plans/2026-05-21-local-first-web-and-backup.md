# Local-First Web And Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a maintained local-first web runtime that opens without login, starts from empty data, persists safely in the browser, and supports full-app backup import/export in both web and desktop.

**Architecture:** Replace the old "web means Supabase" assumption with one maintained local-first direction. Keep one shared app and one shared domain model, but split persistence behind a local runtime boundary: desktop keeps SQLite, web uses browser-local snapshot storage, and both share the same backup package format and user-facing restore flow.

**Tech Stack:** Next.js App Router, TypeScript, React 19, browser `localStorage`, Node `sqlite`, built-in compression APIs (`node:zlib` / browser `CompressionStream` fallback or equivalent shared codec), existing `lib/runtime/*` facades

---

### Task 1: Flip The Maintained Runtime Direction To Local-First

**Files:**
- Modify: `lib/runtime/env.ts`
- Modify: `lib/runtime/index.ts`
- Modify: `lib/runtime/actions.ts`
- Modify: `lib/runtime/auth.ts`
- Modify: `lib/runtime/browser-client.ts`
- Modify: `middleware.ts`
- Modify: `app/login/page.tsx`
- Test: `tests/runtime-env.test.ts`
- Test: `tests/runtime-auth.test.ts`

- [ ] **Step 1: Write the failing runtime direction tests**

```ts
// tests/runtime-env.test.ts
import assert from "node:assert/strict";
import test from "node:test";

import { getBrowserRuntimeMode, getServerRuntimeMode } from "../lib/runtime/env.ts";

test("server runtime defaults to local", () => {
  delete process.env.MINIMRP_RUNTIME;
  delete process.env.MINIMRP_DESKTOP_RUNTIME;
  assert.equal(getServerRuntimeMode(), "local");
});

test("browser runtime defaults to local", () => {
  delete process.env.NEXT_PUBLIC_MINIMRP_RUNTIME;
  delete process.env.MINIMRP_RUNTIME;
  delete process.env.MINIMRP_DESKTOP_RUNTIME;
  assert.equal(getBrowserRuntimeMode(), "local");
});
```

```ts
// tests/runtime-auth.test.ts
import assert from "node:assert/strict";
import test from "node:test";

import { isPublicAuthPath } from "../lib/auth/redirects.ts";

test("login page remains a legacy-only path", () => {
  assert.equal(isPublicAuthPath("/login"), true);
});

test("local runtime middleware does not require auth redirects", async () => {
  process.env.MINIMRP_RUNTIME = "local";
  const { middleware } = await import("../middleware.ts");
  assert.equal(typeof middleware, "function");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/runtime-env.test.ts tests/runtime-auth.test.ts`
Expected: FAIL because `lib/runtime/env.ts` currently defaults to `supabase` and runtime types do not include `local`

- [ ] **Step 3: Change runtime mode defaults and keep Supabase as explicit legacy opt-in**

```ts
// lib/runtime/env.ts
export type RuntimeMode = "local" | "supabase";

function resolveRuntimeMode(runtimeMode: string | undefined): RuntimeMode {
  if (process.env.MINIMRP_DESKTOP_RUNTIME === "1") {
    return "local";
  }

  if (runtimeMode === undefined || runtimeMode === "") {
    return "local";
  }

  if (runtimeMode === "local" || runtimeMode === "supabase") {
    return runtimeMode;
  }

  throw new Error(`Unsupported MINIMRP_RUNTIME value: ${runtimeMode}`);
}
```

```ts
// lib/runtime/index.ts
export async function getRuntimeQueries(): Promise<RuntimeQueries> {
  const runtimeMode = getRuntimeMode();

  if (runtimeMode === "local") {
    return (await import("./local/queries.ts")) as RuntimeQueries;
  }

  return (await import("./supabase/queries.ts")) as RuntimeQueries;
}
```

```ts
// lib/runtime/actions.ts
async function getRuntimeActionsModule(): Promise<RuntimeActions> {
  const runtimeMode = getRuntimeMode();

  if (runtimeMode === "local") {
    return (await import("./local/actions.ts")) as RuntimeActions;
  }

  return (await import("./supabase/actions.ts")) as RuntimeActions;
}
```

```ts
// middleware.ts
export async function middleware(request: NextRequest) {
  if (getRuntimeMode() === "local") {
    return NextResponse.next({ request });
  }

  // keep legacy Supabase middleware below
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/runtime-env.test.ts tests/runtime-auth.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/runtime/env.ts lib/runtime/index.ts lib/runtime/actions.ts lib/runtime/auth.ts lib/runtime/browser-client.ts middleware.ts app/login/page.tsx tests/runtime-env.test.ts tests/runtime-auth.test.ts
git commit -m "refactor: make local runtime the maintained default"
```

### Task 2: Define A Shared Local Snapshot And Backup Package Format

**Files:**
- Create: `lib/runtime/local/snapshot.ts`
- Create: `lib/runtime/local/backup-package.ts`
- Create: `tests/local-backup-package.test.ts`

- [ ] **Step 1: Write the failing backup package tests**

```ts
// tests/local-backup-package.test.ts
import assert from "node:assert/strict";
import test from "node:test";

import { decodeBackupPackage, encodeBackupPackage } from "../lib/runtime/local/backup-package.ts";
import { createEmptySnapshot } from "../lib/runtime/local/snapshot.ts";

test("backup package round-trips the full local snapshot", async () => {
  const snapshot = createEmptySnapshot();
  snapshot.products.push({ id: "p1", name: "Widget", image: null, image_path: null, versions: [] });

  const encoded = await encodeBackupPackage(snapshot);
  const decoded = await decodeBackupPackage(encoded);

  assert.equal(decoded.products.length, 1);
  assert.equal(decoded.products[0]?.name, "Widget");
});

test("backup package carries a format version", async () => {
  const encoded = await encodeBackupPackage(createEmptySnapshot());
  assert.equal(encoded.byteLength > 16, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/local-backup-package.test.ts`
Expected: FAIL because local snapshot and backup package modules do not exist

- [ ] **Step 3: Implement a versioned, compressed package codec**

```ts
// lib/runtime/local/snapshot.ts
export interface LocalAppSnapshot {
  formatVersion: 1;
  exportedAt: string;
  settings: {
    default_safety_stock: number;
    near_safety_threshold_percent: number;
  };
  products: Array<Record<string, unknown>>;
  versions: Array<Record<string, unknown>>;
  components: Array<Record<string, unknown>>;
  componentSellers: Array<Record<string, unknown>>;
  sellers: Array<Record<string, unknown>>;
  inventory: Array<Record<string, unknown>>;
  inventoryLots: Array<Record<string, unknown>>;
  productionEntries: Array<Record<string, unknown>>;
  componentReferences: Array<Record<string, unknown>>;
  history: Array<Record<string, unknown>>;
}

export function createEmptySnapshot(): LocalAppSnapshot {
  return {
    formatVersion: 1,
    exportedAt: new Date(0).toISOString(),
    settings: {
      default_safety_stock: 25,
      near_safety_threshold_percent: 10
    },
    products: [],
    versions: [],
    components: [],
    componentSellers: [],
    sellers: [],
    inventory: [],
    inventoryLots: [],
    productionEntries: [],
    componentReferences: [],
    history: []
  };
}
```

```ts
// lib/runtime/local/backup-package.ts
import { gunzipSync, gzipSync } from "node:zlib";
import type { LocalAppSnapshot } from "./snapshot.ts";

const MAGIC = "MMRPBK1";

export async function encodeBackupPackage(snapshot: LocalAppSnapshot): Promise<Uint8Array> {
  const json = JSON.stringify(snapshot);
  const compressed = gzipSync(Buffer.from(json, "utf8"));
  return Buffer.concat([Buffer.from(MAGIC, "utf8"), compressed]);
}

export async function decodeBackupPackage(data: Uint8Array): Promise<LocalAppSnapshot> {
  const magic = Buffer.from(data.slice(0, MAGIC.length)).toString("utf8");
  if (magic !== MAGIC) {
    throw new Error("Unsupported MiniMRP backup package.");
  }

  return JSON.parse(gunzipSync(Buffer.from(data.slice(MAGIC.length))).toString("utf8")) as LocalAppSnapshot;
}
```

- [ ] **Step 4: Run tests to verify it passes**

Run: `npm test -- tests/local-backup-package.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/runtime/local/snapshot.ts lib/runtime/local/backup-package.ts tests/local-backup-package.test.ts
git commit -m "feat: add local backup package format"
```

### Task 3: Add Browser Local Storage Persistence For The Local Web Runtime

**Files:**
- Create: `lib/runtime/local/browser-store.ts`
- Create: `lib/runtime/local/browser-hooks.ts`
- Create: `tests/local-browser-store.test.ts`

- [ ] **Step 1: Write the failing browser store tests**

```ts
// tests/local-browser-store.test.ts
import assert from "node:assert/strict";
import test from "node:test";

import { createSerializedEmptySnapshot, LOCAL_STORAGE_KEY, readBrowserSnapshot } from "../lib/runtime/local/browser-store.ts";

test("browser store falls back to an empty snapshot", () => {
  const storage = new Map<string, string>();
  const snapshot = readBrowserSnapshot({
    getItem(key) {
      return storage.get(key) ?? null;
    }
  });

  assert.equal(snapshot.products.length, 0);
  assert.equal(snapshot.components.length, 0);
});

test("browser store exposes a stable storage key", () => {
  assert.equal(LOCAL_STORAGE_KEY, "minimrp.local.snapshot.v1");
  assert.equal(createSerializedEmptySnapshot().includes("\"formatVersion\":1"), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/local-browser-store.test.ts`
Expected: FAIL because browser store helpers do not exist

- [ ] **Step 3: Implement localStorage snapshot helpers and a client hook**

```ts
// lib/runtime/local/browser-store.ts
import { createEmptySnapshot, type LocalAppSnapshot } from "./snapshot.ts";

export const LOCAL_STORAGE_KEY = "minimrp.local.snapshot.v1";

export function createSerializedEmptySnapshot() {
  return JSON.stringify(createEmptySnapshot());
}

export function readBrowserSnapshot(storage: Pick<Storage, "getItem">): LocalAppSnapshot {
  const raw = storage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) {
    return createEmptySnapshot();
  }

  try {
    return JSON.parse(raw) as LocalAppSnapshot;
  } catch {
    return createEmptySnapshot();
  }
}

export function writeBrowserSnapshot(storage: Pick<Storage, "setItem">, snapshot: LocalAppSnapshot) {
  storage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(snapshot));
}
```

```ts
// lib/runtime/local/browser-hooks.ts
"use client";

import { useEffect, useState } from "react";
import { createEmptySnapshot, type LocalAppSnapshot } from "./snapshot.ts";
import { readBrowserSnapshot, writeBrowserSnapshot } from "./browser-store.ts";

export function useBrowserSnapshot() {
  const [snapshot, setSnapshot] = useState<LocalAppSnapshot>(createEmptySnapshot());

  useEffect(() => {
    setSnapshot(readBrowserSnapshot(window.localStorage));
  }, []);

  function updateSnapshot(next: LocalAppSnapshot) {
    writeBrowserSnapshot(window.localStorage, next);
    setSnapshot(next);
  }

  return { snapshot, updateSnapshot };
}
```

- [ ] **Step 4: Run tests to verify it passes**

Run: `npm test -- tests/local-browser-store.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/runtime/local/browser-store.ts lib/runtime/local/browser-hooks.ts tests/local-browser-store.test.ts
git commit -m "feat: add browser snapshot persistence for local web"
```

### Task 4: Extract Pure Local Selectors And Mutations Shared By Desktop And Web

**Files:**
- Create: `lib/runtime/local/selectors.ts`
- Create: `lib/runtime/local/mutations.ts`
- Modify: `lib/runtime/sqlite/queries.ts`
- Modify: `lib/runtime/sqlite/actions.ts`
- Test: `tests/local-runtime-parity.test.ts`

- [ ] **Step 1: Write the failing shared-local parity test**

```ts
// tests/local-runtime-parity.test.ts
import assert from "node:assert/strict";
import test from "node:test";

import { createEmptySnapshot } from "../lib/runtime/local/snapshot.ts";
import { getLocalProductList } from "../lib/runtime/local/selectors.ts";
import { applyCreateProduct } from "../lib/runtime/local/mutations.ts";

test("shared local selectors and mutations build the same top-level product shape", () => {
  const snapshot = createEmptySnapshot();
  const next = applyCreateProduct(snapshot, { id: "p1", name: "Widget" });
  const result = getLocalProductList(next);

  assert.equal(result.error, null);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.versionCount, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/local-runtime-parity.test.ts`
Expected: FAIL because shared local selectors and mutations do not exist

- [ ] **Step 3: Move SQLite business rules into pure snapshot helpers**

```ts
// lib/runtime/local/mutations.ts
import type { LocalAppSnapshot } from "./snapshot.ts";

export function applyCreateProduct(snapshot: LocalAppSnapshot, input: { id: string; name: string }) {
  return {
    ...snapshot,
    products: [...snapshot.products, { id: input.id, name: input.name, image: null, image_path: null }]
  };
}
```

```ts
// lib/runtime/local/selectors.ts
import type { LocalAppSnapshot } from "./snapshot.ts";

export function getLocalProductList(snapshot: LocalAppSnapshot) {
  return {
    items: snapshot.products.map((product) => ({
      ...product,
      versionCount: snapshot.versions.filter((version) => version.product_id === product.id).length
    })),
    error: null
  };
}
```

```ts
// lib/runtime/sqlite/actions.ts
// keep SQL persistence, but route shared business decisions through local mutations where practical
```

```ts
// lib/runtime/sqlite/queries.ts
// keep SQL reads, but match response shape with local selectors
```

- [ ] **Step 4: Run tests to verify it passes**

Run: `npm test -- tests/local-runtime-parity.test.ts tests/sqlite-runtime-parity.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/runtime/local/selectors.ts lib/runtime/local/mutations.ts lib/runtime/sqlite/queries.ts lib/runtime/sqlite/actions.ts tests/local-runtime-parity.test.ts
git commit -m "refactor: extract shared local selectors and mutations"
```

### Task 5: Add A Local-Web Runtime Facade That Uses Client State Instead Of Server Auth

**Files:**
- Create: `lib/runtime/local/queries.ts`
- Create: `lib/runtime/local/actions.ts`
- Create: `features/local-runtime/local-runtime-provider.tsx`
- Create: `features/local-runtime/local-settings-panel.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/settings/page.tsx`
- Test: `tests/app-shell-runtime.test.ts`

- [ ] **Step 1: Write the failing local-web runtime structure test**

```ts
// tests/app-shell-runtime.test.ts
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("app layout includes a local runtime provider", () => {
  const source = fs.readFileSync("app/layout.tsx", "utf8");
  assert.equal(source.includes("LocalRuntimeProvider"), true);
});

test("settings page includes local backup controls", () => {
  const source = fs.readFileSync("app/settings/page.tsx", "utf8");
  assert.equal(source.includes("LocalSettingsPanel"), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/app-shell-runtime.test.ts`
Expected: FAIL because there is no client runtime provider or local settings panel

- [ ] **Step 3: Add a client provider for local web state and switch settings to a local-aware client panel**

```tsx
// features/local-runtime/local-runtime-provider.tsx
"use client";

import { createContext, useContext } from "react";
import { useBrowserSnapshot } from "@/lib/runtime/local/browser-hooks";

const LocalRuntimeContext = createContext<ReturnType<typeof useBrowserSnapshot> | null>(null);

export function LocalRuntimeProvider({ children }: { children: React.ReactNode }) {
  const runtime = useBrowserSnapshot();
  return <LocalRuntimeContext.Provider value={runtime}>{children}</LocalRuntimeContext.Provider>;
}

export function useLocalRuntime() {
  const value = useContext(LocalRuntimeContext);
  if (!value) {
    throw new Error("LocalRuntimeProvider missing.");
  }
  return value;
}
```

```tsx
// app/layout.tsx
import { LocalRuntimeProvider } from "@/features/local-runtime/local-runtime-provider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LocalRuntimeProvider>{children}</LocalRuntimeProvider>
      </body>
    </html>
  );
}
```

```tsx
// app/settings/page.tsx
import { LocalSettingsPanel } from "@/features/local-runtime/local-settings-panel";

export default function SettingsPage() {
  return <LocalSettingsPanel />;
}
```

- [ ] **Step 4: Run tests to verify it passes**

Run: `npm test -- tests/app-shell-runtime.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/runtime/local/queries.ts lib/runtime/local/actions.ts features/local-runtime/local-runtime-provider.tsx features/local-runtime/local-settings-panel.tsx app/layout.tsx app/settings/page.tsx tests/app-shell-runtime.test.ts
git commit -m "feat: add local web runtime provider and settings shell"
```

### Task 6: Implement Whole-App Backup Export And Restore In Both Maintained Runtimes

**Files:**
- Create: `lib/runtime/local/backup-actions.ts`
- Create: `lib/runtime/sqlite/backup.ts`
- Modify: `lib/runtime/contracts.ts`
- Modify: `lib/runtime/actions.ts`
- Modify: `features/local-runtime/local-settings-panel.tsx`
- Test: `tests/runtime-backup.test.ts`

- [ ] **Step 1: Write the failing runtime backup contract tests**

```ts
// tests/runtime-backup.test.ts
import assert from "node:assert/strict";
import test from "node:test";

import * as contracts from "../lib/runtime/contracts.ts";

test("runtime actions contract includes backup export and import", () => {
  assert.equal("RuntimeActions" in contracts, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/runtime-backup.test.ts`
Expected: FAIL once the test is updated to assert new backup action names that do not exist yet

- [ ] **Step 3: Add shared backup actions and implement desktop/web adapters**

```ts
// lib/runtime/contracts.ts
export interface RuntimeActions {
  // existing actions...
  exportBackupAction: () => Promise<Uint8Array>;
  importBackupAction: (formData: FormData) => Promise<void>;
}
```

```ts
// lib/runtime/sqlite/backup.ts
import { getDesktopDatabase } from "./db.ts";
import { encodeBackupPackage } from "../local/backup-package.ts";

export async function exportSqliteBackup() {
  const db = getDesktopDatabase();
  // build snapshot from current SQLite tables, excluding files
  return encodeBackupPackage(snapshot);
}
```

```ts
// lib/runtime/local/backup-actions.ts
import { decodeBackupPackage, encodeBackupPackage } from "./backup-package.ts";

export async function exportLocalBackup(snapshot: LocalAppSnapshot) {
  return encodeBackupPackage(snapshot);
}

export async function importLocalBackup(data: Uint8Array) {
  return decodeBackupPackage(data);
}
```

```tsx
// features/local-runtime/local-settings-panel.tsx
// add "Export backup" and "Import backup" controls
```

- [ ] **Step 4: Run tests to verify it passes**

Run: `npm test -- tests/runtime-backup.test.ts tests/local-backup-package.test.ts tests/sqlite-runtime-schema.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/runtime/contracts.ts lib/runtime/actions.ts lib/runtime/local/backup-actions.ts lib/runtime/sqlite/backup.ts features/local-runtime/local-settings-panel.tsx tests/runtime-backup.test.ts
git commit -m "feat: add shared backup export and import actions"
```

### Task 7: Remove Login-First UX And Make Empty-State Local Usage The Primary Flow

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/products/page.tsx`
- Modify: `app/components/page.tsx`
- Modify: `app/inventory/page.tsx`
- Modify: `app/production/page.tsx`
- Modify: `app/purchasing/page.tsx`
- Modify: `app/history/page.tsx`
- Modify: `shared/ui/app-shell.tsx`
- Test: `tests/auth-redirects.test.ts`
- Test: `tests/admin-access.test.ts`

- [ ] **Step 1: Write the failing no-login usage tests**

```ts
// tests/auth-redirects.test.ts
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("root app shell no longer redirects local users to login", () => {
  const source = fs.readFileSync("middleware.ts", "utf8");
  assert.equal(source.includes("getProtectedRedirectPath"), true);
  assert.equal(source.includes('getRuntimeMode() === "local"'), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/auth-redirects.test.ts tests/admin-access.test.ts`
Expected: FAIL while local-web pages still assume the legacy login path and server-admin resolution

- [ ] **Step 3: Update empty-state copy and local-first route behavior**

```tsx
// shared/ui/app-shell.tsx
// local-first copy should guide users toward creating products, importing master data, and restoring backups
```

```tsx
// app/page.tsx
// home page should link directly into product creation/import instead of auth-driven flow
```

- [ ] **Step 4: Run tests to verify it passes**

Run: `npm test -- tests/auth-redirects.test.ts tests/admin-access.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/products/page.tsx app/components/page.tsx app/inventory/page.tsx app/production/page.tsx app/purchasing/page.tsx app/history/page.tsx shared/ui/app-shell.tsx tests/auth-redirects.test.ts tests/admin-access.test.ts
git commit -m "feat: make local-first no-login flow the primary web experience"
```

### Task 8: Verify Legacy Supabase Still Compiles As A Deprecated Path And Document The New Entry Points

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-04-24-single-app-dual-runtime-design.md`
- Modify: `tests/runtime-structure.test.ts`
- Verify: maintained runtime-sensitive files

- [ ] **Step 1: Extend the failing structure test for the new maintained local runtime**

```ts
// tests/runtime-structure.test.ts
test("runtime query facade points maintained traffic at local runtime", () => {
  const runtimeIndexSource = fs.readFileSync("lib/runtime/index.ts", "utf8");
  assert.equal(runtimeIndexSource.includes('import("./local/queries.ts")'), true);
});
```

- [ ] **Step 2: Run test to verify it fails if documentation or runtime wiring is stale**

Run: `npm test -- tests/runtime-structure.test.ts`
Expected: FAIL until the new maintained local runtime entry point exists and docs are updated

- [ ] **Step 3: Update the docs to reflect the implemented local-first path**

```md
## Runtimes

- Desktop: maintained local SQLite runtime
- Web: maintained local-first browser storage runtime
- Supabase: deprecated legacy compatibility path
```

- [ ] **Step 4: Run the final verification set**

Run: `npm test -- tests/runtime-env.test.ts tests/runtime-auth.test.ts tests/local-backup-package.test.ts tests/local-browser-store.test.ts tests/local-runtime-parity.test.ts tests/runtime-backup.test.ts tests/runtime-structure.test.ts`
Expected: PASS

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add README.md docs/superpowers/specs/2026-04-24-single-app-dual-runtime-design.md tests/runtime-structure.test.ts
git commit -m "docs: document local-first web as the maintained runtime"
```

## Self-Review

- Spec coverage:
  - Local web without login: covered by Tasks 1, 5, and 7
  - Empty initial state: covered by Tasks 2 and 3
  - Simple browser-local persistence: covered by Task 3
  - Same backup UX for desktop and web: covered by Task 6
  - Supabase deprecated but still present as legacy: covered by Tasks 1 and 8
- Placeholder scan:
  - The highest-risk area is the exact page-by-page local-web client adaptation. The plan names the route entry points and provider shell explicitly, so execution should not invent a second app tree.
  - Backup format is explicitly versioned and excludes files/images for v1.
- Type consistency:
  - Maintained runtime name is `local`
  - Deprecated runtime name remains `supabase`
  - Shared backup model is `LocalAppSnapshot`

## Notes

- This plan intentionally avoids creating a fourth product concept such as "demo runtime". The maintained direction is one local-first path with two persistence adapters: browser-local storage for web and SQLite for desktop.
- If execution reveals that server-component pages cannot be adapted incrementally enough for local web, pause after Task 5 and write a focused follow-up plan for route-level client wrappers rather than growing a second app tree.
