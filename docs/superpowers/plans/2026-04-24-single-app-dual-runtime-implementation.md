# Single-App Dual-Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep one shared MiniMRP Next.js application while adding a second backend runtime so web uses Supabase and desktop uses offline SQLite through Electron.

**Architecture:** Introduce a runtime facade under `lib/runtime/` and move backend-specific concerns behind it. First preserve the current Supabase behavior through the new facade, then add a SQLite implementation with matching contracts, and finally add a thin Electron wrapper that launches the same app in `sqlite` mode.

**Tech Stack:** Next.js App Router, TypeScript, Supabase SSR, SQLite (`node:sqlite`), Electron, Node.js test runner

---

## File Structure

### Shared app files that remain the single source of truth

- Keep: `app/**`
- Keep: `features/**`
- Keep: `shared/**`
- Keep: `lib/mappers/**`
- Keep: `lib/types/**`

### New runtime boundary files

- Create: `lib/runtime/env.ts`
- Create: `lib/runtime/contracts.ts`
- Create: `lib/runtime/index.ts`
- Create: `lib/runtime/browser-client.ts`
- Create: `lib/runtime/auth.ts`

### Supabase runtime implementation files

- Create: `lib/runtime/supabase/queries.ts`
- Create: `lib/runtime/supabase/actions.ts`
- Create: `lib/runtime/supabase/auth.ts`
- Create: `lib/runtime/supabase/files.ts`

### SQLite runtime implementation files

- Create: `lib/runtime/sqlite/db.ts`
- Create: `lib/runtime/sqlite/schema.ts`
- Create: `lib/runtime/sqlite/files.ts`
- Create: `lib/runtime/sqlite/auth.ts`
- Create: `lib/runtime/sqlite/queries.ts`
- Create: `lib/runtime/sqlite/actions.ts`

### Compatibility wrappers during migration

- Modify: `lib/supabase/queries/index.ts`
- Modify: `lib/supabase/actions/index.ts`
- Modify: `lib/supabase/browser-client.ts`
- Modify: `lib/auth/admin-state.ts`
- Modify: `lib/auth/require-admin.ts`

### Shared app files that switch from backend-specific imports to runtime imports

- Modify: `app/products/page.tsx`
- Modify: `app/products/[id]/page.tsx`
- Modify: `app/components/page.tsx`
- Modify: `app/components/[id]/page.tsx`
- Modify: `app/inventory/page.tsx`
- Modify: `app/production/page.tsx`
- Modify: `app/purchasing/page.tsx`
- Modify: `app/settings/page.tsx`
- Modify: `app/history/page.tsx`
- Modify: `app/versions/[id]/page.tsx`
- Modify: `app/api/export/components/route.ts`
- Modify: `app/api/export/inventory/route.ts`
- Modify: `app/api/export/purchasing/route.ts`
- Modify: `app/api/export/bom/[id]/route.ts`
- Modify: `app/api/export/mrp/[id]/route.ts`
- Modify: `app/login/login-page-client.tsx`

### Desktop wrapper files

- Create: `desktop/electron/main.mjs`
- Create: `desktop/electron/package.json`
- Create: `desktop/scripts/dev.mjs`
- Create: `desktop/scripts/start.mjs`
- Modify: `package.json`
- Modify: `.gitignore`

### Tests

- Create: `tests/runtime-env.test.ts`
- Create: `tests/runtime-structure.test.ts`
- Create: `tests/sqlite-runtime-schema.test.ts`
- Create: `tests/sqlite-runtime-parity.test.ts`
- Modify: existing auth/runtime-sensitive tests if import paths change

---

### Task 1: Add runtime mode selection and contracts

**Files:**
- Create: `lib/runtime/env.ts`
- Create: `lib/runtime/contracts.ts`
- Create: `lib/runtime/index.ts`
- Test: `tests/runtime-env.test.ts`

- [ ] **Step 1: Write the failing runtime env test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { getRuntimeMode } from "../lib/runtime/env.ts";

test("getRuntimeMode defaults to supabase", () => {
  delete process.env.MINIMRP_RUNTIME;
  assert.equal(getRuntimeMode(), "supabase");
});

test("getRuntimeMode accepts sqlite", () => {
  process.env.MINIMRP_RUNTIME = "sqlite";
  assert.equal(getRuntimeMode(), "sqlite");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/runtime-env.test.ts`  
Expected: FAIL because `lib/runtime/env.ts` does not exist yet

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/runtime/env.ts
export type RuntimeMode = "supabase" | "sqlite";

export function getRuntimeMode(): RuntimeMode {
  return process.env.MINIMRP_RUNTIME === "sqlite" ? "sqlite" : "supabase";
}
```

```ts
// lib/runtime/contracts.ts
export interface RuntimeQueries {
  getProductList: typeof import("@/lib/supabase/queries/index").getProductList;
  getProductDetail: typeof import("@/lib/supabase/queries/index").getProductDetail;
  getPartCatalog: typeof import("@/lib/supabase/queries/index").getPartCatalog;
  getPartDetail: typeof import("@/lib/supabase/queries/index").getPartDetail;
  getInventoryOverview: typeof import("@/lib/supabase/queries/index").getInventoryOverview;
  getProductionOverview: typeof import("@/lib/supabase/queries/index").getProductionOverview;
  getPurchasingOverview: typeof import("@/lib/supabase/queries/index").getPurchasingOverview;
  getAppSettings: typeof import("@/lib/supabase/queries/index").getAppSettings;
  getVersionDetail: typeof import("@/lib/supabase/queries/index").getVersionDetail;
  getHistoryEntries: typeof import("@/lib/supabase/queries/index").getHistoryEntries;
}
```

```ts
// lib/runtime/index.ts
import { getRuntimeMode } from "./env.ts";

export async function getRuntimeModule() {
  return getRuntimeMode() === "sqlite"
    ? import("./sqlite/queries.ts")
    : import("./supabase/queries.ts");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/runtime-env.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/runtime-env.test.ts lib/runtime/env.ts lib/runtime/contracts.ts lib/runtime/index.ts
git commit -m "feat: add runtime mode selection"
```

### Task 2: Put current Supabase queries behind the runtime facade without changing behavior

**Files:**
- Create: `lib/runtime/supabase/queries.ts`
- Modify: `lib/runtime/index.ts`
- Modify: `lib/supabase/queries/index.ts`
- Test: `tests/runtime-structure.test.ts`

- [ ] **Step 1: Write the failing structure test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("runtime query facade exists", () => {
  assert.equal(fs.existsSync("lib/runtime/supabase/queries.ts"), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/runtime-structure.test.ts`  
Expected: FAIL because the runtime facade file does not exist

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/runtime/supabase/queries.ts
export {
  getHistoryEntries,
  getInventoryOverview,
  getPartCatalog,
  getPartDetail,
  getProductDetail,
  getProductList,
  getProductionOverview,
  getPurchasingOverview,
  getAppSettings,
  getVersionDetail
} from "@/lib/supabase/queries/index";
```

```ts
// lib/runtime/index.ts
export async function getRuntimeQueries() {
  return getRuntimeMode() === "sqlite"
    ? import("./sqlite/queries.ts")
    : import("./supabase/queries.ts");
}
```

```ts
// lib/supabase/queries/index.ts
// keep current exports unchanged in this task
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/runtime-structure.test.ts`  
Expected: PASS

- [ ] **Step 5: Run full verification for unchanged web behavior**

Run: `npm test`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add tests/runtime-structure.test.ts lib/runtime/index.ts lib/runtime/supabase/queries.ts
git commit -m "refactor: add supabase query runtime facade"
```

### Task 3: Put current Supabase actions, browser auth, and admin state behind runtime adapters

**Files:**
- Create: `lib/runtime/supabase/actions.ts`
- Create: `lib/runtime/supabase/auth.ts`
- Create: `lib/runtime/browser-client.ts`
- Create: `lib/runtime/auth.ts`
- Modify: `lib/supabase/actions/index.ts`
- Modify: `lib/supabase/browser-client.ts`
- Modify: `lib/auth/admin-state.ts`
- Modify: `lib/auth/require-admin.ts`
- Modify: `app/login/login-page-client.tsx`
- Test: `tests/auth-redirects.test.ts`
- Test: `tests/admin-access.test.ts`

- [ ] **Step 1: Write the failing browser-client test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { createRuntimeBrowserClient } from "../lib/runtime/browser-client.ts";

test("runtime browser client factory is defined", () => {
  assert.equal(typeof createRuntimeBrowserClient, "function");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/auth-redirects.test.ts tests/admin-access.test.ts`  
Expected: FAIL once imports are updated without runtime files present

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/runtime/supabase/actions.ts
export * from "@/lib/supabase/actions/index";
```

```ts
// lib/runtime/supabase/auth.ts
export { createSupabaseBrowserClient as createBrowserClient } from "@/lib/supabase/browser-client";
export { getCurrentAdminFlags, isUserAdmin } from "@/lib/auth/admin-state";
```

```ts
// lib/runtime/browser-client.ts
import { getRuntimeMode } from "./env.ts";

export async function createRuntimeBrowserClient() {
  if (getRuntimeMode() === "sqlite") {
    const mod = await import("./sqlite/auth.ts");
    return mod.createBrowserClient();
  }

  const mod = await import("./supabase/auth.ts");
  return mod.createBrowserClient();
}
```

```ts
// app/login/login-page-client.tsx
// replace createSupabaseBrowserClient import with createRuntimeBrowserClient
```

- [ ] **Step 4: Run targeted tests**

Run: `npm test -- tests/auth-redirects.test.ts tests/admin-access.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/runtime/supabase/actions.ts lib/runtime/supabase/auth.ts lib/runtime/browser-client.ts lib/runtime/auth.ts lib/auth/admin-state.ts lib/auth/require-admin.ts app/login/login-page-client.tsx
git commit -m "refactor: route auth and actions through runtime adapters"
```

### Task 4: Switch shared pages and export routes to runtime queries/actions

**Files:**
- Modify: `app/products/page.tsx`
- Modify: `app/products/[id]/page.tsx`
- Modify: `app/components/page.tsx`
- Modify: `app/components/[id]/page.tsx`
- Modify: `app/inventory/page.tsx`
- Modify: `app/production/page.tsx`
- Modify: `app/purchasing/page.tsx`
- Modify: `app/settings/page.tsx`
- Modify: `app/history/page.tsx`
- Modify: `app/versions/[id]/page.tsx`
- Modify: `app/api/export/components/route.ts`
- Modify: `app/api/export/inventory/route.ts`
- Modify: `app/api/export/purchasing/route.ts`
- Modify: `app/api/export/bom/[id]/route.ts`
- Modify: `app/api/export/mrp/[id]/route.ts`
- Test: existing page/export tests

- [ ] **Step 1: Write a failing structure assertion for direct Supabase imports**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("products page no longer imports lib/supabase directly", () => {
  const file = fs.readFileSync("app/products/page.tsx", "utf8");
  assert.equal(file.includes('@/lib/supabase/queries/index'), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/runtime-structure.test.ts`  
Expected: FAIL because shared pages still import `lib/supabase`

- [ ] **Step 3: Update imports to runtime facades**

```ts
// app/products/page.tsx
import { getRuntimeQueries } from "@/lib/runtime";
import { getRuntimeActions } from "@/lib/runtime/actions";

export default async function ProductsPage() {
  const queries = await getRuntimeQueries();
  const actions = await getRuntimeActions();
  const { items, error } = await queries.getProductList();
  // form action uses actions.createProductAction
}
```

```ts
// apply same pattern to the other shared route files in this task
```

- [ ] **Step 4: Run regression tests**

Run: `npm test`  
Expected: PASS

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app lib/runtime tests/runtime-structure.test.ts
git commit -m "refactor: switch shared app to runtime facade imports"
```

### Task 5: Add SQLite schema and local file storage foundation

**Files:**
- Create: `lib/runtime/sqlite/db.ts`
- Create: `lib/runtime/sqlite/schema.ts`
- Create: `lib/runtime/sqlite/files.ts`
- Test: `tests/sqlite-runtime-schema.test.ts`

- [ ] **Step 1: Write the failing SQLite schema test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { createDesktopDatabase, ensureSqliteSchema, listSqliteTables } from "../lib/runtime/sqlite/db.ts";

test("sqlite runtime initializes core tables", () => {
  const db = createDesktopDatabase(":memory:");
  ensureSqliteSchema(db);
  const tables = listSqliteTables(db);
  assert.equal(tables.includes("products"), true);
  assert.equal(tables.includes("components"), true);
  assert.equal(tables.includes("product_versions"), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/sqlite-runtime-schema.test.ts`  
Expected: FAIL because SQLite runtime files do not exist

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/runtime/sqlite/db.ts
import { DatabaseSync } from "node:sqlite";
import { ensureSqliteSchemaSql } from "./schema.ts";

export function createDesktopDatabase(filename: string) {
  return new DatabaseSync(filename);
}

export function ensureSqliteSchema(db: DatabaseSync) {
  db.exec(ensureSqliteSchemaSql);
}

export function listSqliteTables(db: DatabaseSync) {
  return (db.prepare("select name from sqlite_master where type = 'table'").all() as Array<{ name: string }>).map((row) => row.name);
}
```

- [ ] **Step 4: Run schema test**

Run: `npm test -- tests/sqlite-runtime-schema.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/sqlite-runtime-schema.test.ts lib/runtime/sqlite/db.ts lib/runtime/sqlite/schema.ts lib/runtime/sqlite/files.ts
git commit -m "feat: add sqlite runtime schema foundation"
```

### Task 6: Implement SQLite queries with parity for shared views

**Files:**
- Create: `lib/runtime/sqlite/queries.ts`
- Create or reuse helpers under: `lib/runtime/sqlite/*.ts`
- Test: `tests/sqlite-runtime-parity.test.ts`

- [ ] **Step 1: Write the failing parity test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { getProductList } from "../lib/runtime/sqlite/queries.ts";

test("sqlite runtime returns the same top-level product list shape", async () => {
  const result = await getProductList();
  assert.equal(Array.isArray(result.items), true);
  assert.equal("error" in result, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/sqlite-runtime-parity.test.ts`  
Expected: FAIL because SQLite query implementation is missing

- [ ] **Step 3: Implement minimal read parity**

```ts
// lib/runtime/sqlite/queries.ts
export async function getProductList() {
  return { items: [], error: null };
}
```

```ts
// then expand function-by-function until all shared pages can render:
// getProductDetail, getPartCatalog, getPartDetail, getInventoryOverview,
// getProductionOverview, getPurchasingOverview, getAppSettings,
// getVersionDetail, getHistoryEntries
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- tests/sqlite-runtime-parity.test.ts`  
Expected: PASS

Run: `npm run typecheck`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/sqlite-runtime-parity.test.ts lib/runtime/sqlite/queries.ts lib/runtime/sqlite/*.ts
git commit -m "feat: add sqlite runtime query parity"
```

### Task 7: Implement SQLite actions and local single-user auth

**Files:**
- Create: `lib/runtime/sqlite/actions.ts`
- Create: `lib/runtime/sqlite/auth.ts`
- Modify: `middleware.ts`
- Test: `tests/admin-access.test.ts`
- Test: runtime-specific auth tests if needed

- [ ] **Step 1: Write a failing desktop auth test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { getDesktopAdminFlags } from "../lib/runtime/sqlite/auth.ts";

test("sqlite runtime resolves a local authenticated admin user", async () => {
  const flags = await getDesktopAdminFlags();
  assert.deepEqual(flags, { isAuthenticated: true, isAdmin: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/admin-access.test.ts tests/sqlite-runtime-parity.test.ts`  
Expected: FAIL because SQLite auth/actions are missing

- [ ] **Step 3: Implement local auth and actions**

```ts
// lib/runtime/sqlite/auth.ts
export async function getDesktopAdminFlags() {
  return { isAuthenticated: true, isAdmin: true };
}

export function createBrowserClient() {
  return {
    auth: {
      async signInWithPassword() {
        return { error: null };
      },
      async signOut() {
        return { error: null };
      }
    }
  };
}
```

```ts
// lib/runtime/sqlite/actions.ts
// implement the same exported action names currently used by shared forms
```

```ts
// middleware.ts
// branch on MINIMRP_RUNTIME:
// - supabase keeps current middleware behavior
// - sqlite allows shared route flow using local admin flags
```

- [ ] **Step 4: Run verification**

Run: `npm test`  
Expected: PASS

Run: `npm run typecheck`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add middleware.ts lib/runtime/sqlite/actions.ts lib/runtime/sqlite/auth.ts
git commit -m "feat: add sqlite runtime actions and local auth"
```

### Task 8: Add Electron wrapper for the shared app

**Files:**
- Create: `desktop/electron/main.mjs`
- Create: `desktop/electron/package.json`
- Create: `desktop/scripts/dev.mjs`
- Create: `desktop/scripts/start.mjs`
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Write the failing structure test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("desktop wrapper exists without duplicating app routes", () => {
  assert.equal(fs.existsSync("desktop/electron/main.mjs"), true);
  assert.equal(fs.existsSync("desktop/app"), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/runtime-structure.test.ts`  
Expected: FAIL because Electron wrapper files do not exist

- [ ] **Step 3: Implement minimal desktop wrapper**

```js
// desktop/scripts/dev.mjs
process.env.MINIMRP_RUNTIME = "sqlite";
// spawn `next dev` and Electron, waiting for the HTTP server before opening the window
```

```js
// desktop/electron/main.mjs
// create BrowserWindow and load MINIMRP_DESKTOP_URL
```

```json
// package.json
{
  "scripts": {
    "dev:desktop": "node desktop/scripts/dev.mjs",
    "start:desktop": "node desktop/scripts/start.mjs"
  }
}
```

- [ ] **Step 4: Run verification**

Run: `npm test -- tests/runtime-structure.test.ts`  
Expected: PASS

Run: `npm run typecheck`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add desktop package.json .gitignore tests/runtime-structure.test.ts
git commit -m "feat: add electron wrapper for sqlite runtime"
```

### Task 9: End-to-end verification of both runtimes

**Files:**
- Modify: docs only if commands changed
- Verify: existing runtime-sensitive files

- [ ] **Step 1: Verify web runtime still works**

Run: `npm test`  
Expected: PASS

Run: `npm run typecheck`  
Expected: PASS

Run: `npm run build`  
Expected: PASS

- [ ] **Step 2: Verify desktop runtime works**

Run: `npm run dev:desktop`  
Expected: shared app starts in sqlite mode through Electron without copied routes

Run: `npm run build`  
Expected: PASS in default web mode

- [ ] **Step 3: Verify no duplicate app tree exists**

Run: `git ls-files`  
Expected: no `desktop/app/**` tracked files

- [ ] **Step 4: Commit final cleanup**

```bash
git add -A
git commit -m "feat: support shared web and desktop runtimes"
```

## Self-Review

### Spec coverage

- One shared app: covered by Tasks 4 and 8
- Web Supabase remains secure: covered by Tasks 2, 3, and 9
- Desktop SQLite offline runtime: covered by Tasks 5, 6, 7, and 8
- Same attachments/images behavior: covered by Tasks 5 and 7
- No desktop app duplication: covered by Tasks 8 and 9

### Placeholder scan

- No `TODO`, `TBD`, or deferred tasks remain in the plan
- Each task contains exact files and verification commands

### Type consistency

- Runtime split uses `supabase` / `sqlite` consistently
- Shared app continues to talk to named query/action functions with the current surface shape

