# MiniMRP

**MiniMRP** is a small internal MRP (material requirements planning) system for small businesses specializing electronic products. It is designed to manage products, versions, BOMs, components, inventory, production entries, and purchasing needs without the overhead of a full ERP system.

## Main Features

- Product and version management
- BOM management per product version
- Part master data with sellers and safety stock
- Inventory tracking and stock adjustments
- Production queue with MRP-based material consumption
- Purchasing view for shortages and near-safety-stock items
- CSV export for BOM, MRP, parts, inventory, and purchasing
- Import entry points for bulk CSV/Excel workflows
- Change history for UI-driven updates

## How It Works

From a user perspective, the workflow is intentionally straightforward:

- Start from `Products`, where each product contains one or more versions.
- Open a version to view its BOM, attachments, unit cost estimate, and material requirements.
- Manage the shared component catalog in `Components`, including supplier links and safety stock targets.
- Track current stock in `Inventory` and adjust quantities as material arrives or is consumed.
- Add versions to `Production` to reserve available inventory and store production-driven material requirements.
- Review `Purchasing` to see current shortages and parts that are approaching safety stock.
- Use `History` to inspect changes made through the UI and `Export` actions for CSV handoff workflows.

## Project Structure

The project is intentionally simple and split by responsibility:

- [`app`](./app): Next.js routes and thin page-level composition
- [`features`](./features): feature-specific UI and page sections
- [`shared/ui`](./shared/ui): reusable UI building blocks shared across features
- [`lib/supabase/actions`](./lib/supabase/actions): server actions grouped by domain
- [`lib/supabase/queries`](./lib/supabase/queries): read-side data access grouped by domain
- [`lib/mappers`](./lib/mappers): calculation and transformation logic such as MRP
- [`supabase`](./supabase): schema and seed SQL
- [`tests`](./tests): focused logic-level tests

Note about naming: the business domain still uses the `/components` route in the UI, but the internal feature code is named `parts` to avoid confusion with reusable UI components.

## Technical Structure

- Next.js App Router renders the internal admin UI.
- Supabase is the backend and source of truth for relational data.
- Pages stay thin and call feature components plus domain-specific queries/actions.
- MRP, purchasing, inventory, and export logic are kept outside the UI in shared mappers and server modules.

## Architecture

This project uses a pragmatic, lightweight clean structure: UI, data access, and business logic are separated, but without over-engineering.

## Get Started

1. Install dependencies:

```bash
npm install
```

2. Add your Supabase keys to `.env`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=
SUPABASE_SECRET_KEY=

# Optional fixloop integration:
ENABLE_FIXLOOP=false
AGENTIC_FIX_LOOP_PROJECT_NAME=
NEXT_PUBLIC_AGENTIC_FIX_LOOP_SUPABASE_URL=
NEXT_PUBLIC_AGENTIC_FIX_LOOP_SUPABASE_ANON_KEY=
AGENTIC_FIX_LOOP_SUPABASE_SERVICE_ROLE_KEY=
```

3. Run schema sqripts in supabase/production in your Supabase SQL Editor

4. Start the app:

web:

```bash
npm run dev
```

5. Open `http://localhost:3000`

windows desktop:

```bash
npm run dev:desktop
```

5. App opens on your windows desktop

## Storage Setup

- Create private bucket `version-attachments`
- Create private bucket `product-images`

## Useful Scripts

- `npm run dev`
- `npm run dev:desktop`
- `npm run build`
- `npm run build:desktop`
- `npm run dist:desktop`
- `npm run start`
- `npm run lint`
- `npm run typecheck`
- `npm test`

## Desktop Executable

Download the latest Windows portable test build here:

- [MiniMRP Desktop test build](https://drive.google.com/file/d/11cU19wTIwC65R6vVtSnp1RJ5CTnsWhWa/view?usp=sharing)

Build the Windows desktop executable with:

```bash
npm run dist:desktop
```

The generated portable `.exe` is written under [dist/desktop](./dist/desktop). The expected artifact name is `MiniMRP-Desktop-<version>.exe`.

For day-to-day desktop development without packaging, use:

```bash
npm run dev:desktop
```

## Notes

- The app redirects `/` to `/products`.
- Production and purchasing flows depend on the latest Supabase schema being applied.
- Import UI exists already, while some bulk import persistence flows are still designed to be extended further.
- This version is suitable for a live internal demo branch, but production rollout still needs stronger import logic, authentication, and security hardening.

--
