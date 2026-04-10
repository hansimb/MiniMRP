# Production Supabase Security Design

## Goal

Define a production-ready Supabase structure for MiniMRP that keeps the live demo/testing SQL clearly separate, enables RLS everywhere in production, and uses a hybrid access model:

- less sensitive operational data can be queried directly from Supabase through RLS
- sensitive BOM and internal data is only fetched through the Next.js backend

## Environment Separation

- `supabase/live-demo*` remains intentionally non-production and must stay separate from production SQL
- `supabase/production` contains the production-only SQL structure
- production SQL should be safe to run in Supabase SQL Editor without bringing along demo shortcuts

## Security Level

Target security level is strong practical production security, not extreme high-friction hardening.

This means:

- RLS enabled on all production tables
- direct client access allowed only where it keeps the app simple and still controlled
- sensitive data moved behind the backend for an extra layer
- roles designed for one initial admin user, but ready for more users later

This does not attempt:

- zero-trust style micro-segmentation
- highly customized enterprise IAM
- complex per-record ownership rules at this stage

## Schema Strategy

### `public`

Tables intended for direct app access through Supabase client, protected by authentication and admin-aware RLS:

- `products`
- `components`
- `inventory`
- `sellers`
- `component_sellers`
- `production_entries`
- `production_requirements`

### `private`

Tables that should not be fetched directly from the browser:

- `product_versions`
- `component_references`
- `attachments`
- `history_events`
- `app_settings`
- `user_roles`

### `auth`

Managed by Supabase Auth. We rely on it for user identities and MFA support, but we do not define its core tables ourselves.

## Access Model

### Direct client reads through Supabase

The browser can query `public` tables only when:

- the user is authenticated
- the user is recognized as an admin through role checks

This keeps `public` practical without making it openly public.

### Backend-only reads for sensitive data

Sensitive data is fetched through Next.js server actions or route handlers:

- BOM structure
- version detail composition
- attachment metadata
- settings
- history and audit information

This gives one more security boundary beyond RLS because the browser never queries those tables directly.

## Initial Role Model

Production starts with one admin user, but the data model should be multi-user ready.

Recommended approach:

- use Supabase Auth users for identity
- store application roles in `private.user_roles`
- write policies around role checks rather than hardcoding one email address into policies

This makes later expansion to more admins or limited users straightforward.

## RLS Direction

All production tables get RLS enabled.

Policy shape for the first production phase:

- `public` tables: authenticated admin can read and write
- `private` tables: no direct browser access
- backend uses privileged execution for controlled reads and writes where needed

The first version is intentionally simple:

- no anonymous access
- no public read access
- no mixed role matrix yet

## SQL Organization in `supabase/production`

Production SQL is split by responsibility instead of one large file.

- `00_extensions.sql`
- `01_schemas.sql`
- `02_grants.sql`
- `10_public_tables.sql`
- `11_private_tables.sql`
- `20_indexes.sql`
- `30_rls_enable.sql`
- `31_role_helpers.sql`
- `32_policies_public.sql`
- `33_policies_private.sql`
- `40_seed_admin_support.sql`

The split should stay easy to run manually in SQL Editor in order.

## App Impact

Current app queries show that most operational pages read directly from Supabase today.

Production refactor direction:

- keep direct Supabase reads for `public` operational data
- move BOM-oriented reads to Next.js backend paths
- later update app-side queries to align with production schema boundaries
- keep `public.components.sku` as the stable import and BOM matching key for component master data

## Non-Goals For This Phase

- full frontend auth implementation
- MFA enrollment UI
- final role matrix for multiple user types
- storage bucket hardening
- audit-grade security logging

## Recommended Next Step

Create the production SQL package under `supabase/production` with:

- separated schema files
- all production tables explicitly schema-qualified
- RLS enabled everywhere
- helper functions for admin role checks
- initial policies matching the one-admin, multi-user-ready model
