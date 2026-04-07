# MiniMRP

MiniMRP is a small internal MRP (material requirements planning) system for small businesses specializing electronic products. It is designed to manage products, versions, BOMs, components, inventory, production entries, and purchasing needs without the overhead of a full ERP system.

This current version (or branch) of the project is at a internal demo stage, while production-ready authentication, tighter security, and more complete import persistence are still planned for the next phases.

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

2. Add your Supabase keys to `.env`.

3. Run the latest schema and seed in Supabase SQL Editor:

- [`supabase/schema.sql`](./supabase/schema.sql)
- [`supabase/seed.sql`](./supabase/seed.sql)

4. Start the app:

```bash
npm run dev
```

5. Open `http://localhost:3000`.

## Useful Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run typecheck`
- `npm test`

## Notes

- The app redirects `/` to `/products`.
- Production and purchasing flows depend on the latest Supabase schema being applied.
- Import UI exists already, while some bulk import persistence flows are still designed to be extended further.
- This version is suitable for a live internal demo branch, but production rollout still needs stronger import logic, authentication, and security hardening.
