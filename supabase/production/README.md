# Production Supabase SQL

Run these files in Supabase SQL Editor in this order:

1. `00_extensions.sql`
2. `01_schemas.sql`
3. `02_grants.sql`
4. `10_public_tables.sql`
5. `11_private_tables.sql`
6. `20_indexes.sql`
7. `30_rls_enable.sql`
8. `31_role_helpers.sql`
9. `32_policies_public.sql`
10. `33_policies_private.sql`
11. `40_seed_admin_support.sql`

## Model

- `public`: operational tables the app can read directly through Supabase, still protected by authenticated admin RLS
- `private`: BOM and internal tables that should not be queried directly from the browser
- `auth`: managed by Supabase Auth

## Notes

- This package is production-only.
- Demo SQL stays under `supabase/live-demo/`.
- Current application code still needs a later refactor to fully use the `private` schema and authenticated access flow.
- After creating your first auth user, run the helper in `40_seed_admin_support.sql` to mark that user as the first admin.
