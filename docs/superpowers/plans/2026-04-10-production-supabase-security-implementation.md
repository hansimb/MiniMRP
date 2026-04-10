# Production Supabase Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split MiniMRP production SQL into ordered files, move sensitive tables into a `private` schema, enable RLS everywhere, and prepare role-based admin access for one initial production user.

**Architecture:** Keep operational tables in `public` with admin-gated RLS policies, keep BOM and internal tables in `private`, and add helper functions for role checks and admin bootstrap. Preserve demo SQL separately and document the production design in a project-facing docs file.

**Tech Stack:** Supabase, PostgreSQL, SQL migrations run manually in Supabase SQL Editor, Markdown docs

---

### Task 1: Finalize docs placement and approved design

**Files:**
- Create: `docs/production-supabase-security-design.md`
- Create: `docs/superpowers/plans/2026-04-10-production-supabase-security-implementation.md`
- Modify: `docs/superpowers/specs/2026-04-10-production-supabase-security-design.md`

- [ ] Copy the approved design into a stable project-facing docs file under `docs/`
- [ ] Update the design so `component_sellers` is included in the `public` schema because the current app reads it as operational data
- [ ] Remove the temporary spec copy from `docs/superpowers/specs/`

### Task 2: Create production SQL file skeleton

**Files:**
- Create: `supabase/production/README.md`
- Create: `supabase/production/00_extensions.sql`
- Create: `supabase/production/01_schemas.sql`
- Create: `supabase/production/02_grants.sql`

- [ ] Add a README that explains run order and the purpose of each SQL file
- [ ] Add extension setup for UUID generation
- [ ] Add schema creation and baseline schema permissions for `public` and `private`
- [ ] Add explicit grants and default privileges so authenticated access works only where intended

### Task 3: Rebuild data model in schema-qualified files

**Files:**
- Create: `supabase/production/10_public_tables.sql`
- Create: `supabase/production/11_private_tables.sql`
- Create: `supabase/production/20_indexes.sql`

- [ ] Recreate operational tables in `public`
- [ ] Recreate BOM and internal tables in `private`
- [ ] Keep foreign keys valid across schemas
- [ ] Move indexes into a separate file so structure stays easy to scan and run

### Task 4: Add RLS, role helpers, and policies

**Files:**
- Create: `supabase/production/30_rls_enable.sql`
- Create: `supabase/production/31_role_helpers.sql`
- Create: `supabase/production/32_policies_public.sql`
- Create: `supabase/production/33_policies_private.sql`

- [ ] Enable and force RLS on every production table
- [ ] Add a helper function that checks whether the current authenticated user has the `admin` role
- [ ] Add admin-only CRUD policies for all `public` tables
- [ ] Keep `private` tables inaccessible to direct browser access by not adding authenticated client policies there

### Task 5: Add bootstrap support and verify structure

**Files:**
- Create: `supabase/production/40_seed_admin_support.sql`

- [ ] Add default `private.app_settings` seed data
- [ ] Add an idempotent helper to assign the first admin role after creating the first auth user
- [ ] Verify file names, run order, schema qualification, and policy coverage against the approved design
