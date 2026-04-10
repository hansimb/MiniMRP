drop policy if exists "admin can read products" on public.products;
drop policy if exists "admin can insert products" on public.products;
drop policy if exists "admin can update products" on public.products;
drop policy if exists "admin can delete products" on public.products;

create policy "admin can read products"
on public.products
for select
to authenticated
using (private.is_admin());

create policy "admin can insert products"
on public.products
for insert
to authenticated
with check (private.is_admin());

create policy "admin can update products"
on public.products
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy "admin can delete products"
on public.products
for delete
to authenticated
using (private.is_admin());

drop policy if exists "admin can read components" on public.components;
drop policy if exists "admin can insert components" on public.components;
drop policy if exists "admin can update components" on public.components;
drop policy if exists "admin can delete components" on public.components;

create policy "admin can read components"
on public.components
for select
to authenticated
using (private.is_admin());

create policy "admin can insert components"
on public.components
for insert
to authenticated
with check (private.is_admin());

create policy "admin can update components"
on public.components
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy "admin can delete components"
on public.components
for delete
to authenticated
using (private.is_admin());

drop policy if exists "admin can read sellers" on public.sellers;
drop policy if exists "admin can insert sellers" on public.sellers;
drop policy if exists "admin can update sellers" on public.sellers;
drop policy if exists "admin can delete sellers" on public.sellers;

create policy "admin can read sellers"
on public.sellers
for select
to authenticated
using (private.is_admin());

create policy "admin can insert sellers"
on public.sellers
for insert
to authenticated
with check (private.is_admin());

create policy "admin can update sellers"
on public.sellers
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy "admin can delete sellers"
on public.sellers
for delete
to authenticated
using (private.is_admin());

drop policy if exists "admin can read component sellers" on public.component_sellers;
drop policy if exists "admin can insert component sellers" on public.component_sellers;
drop policy if exists "admin can update component sellers" on public.component_sellers;
drop policy if exists "admin can delete component sellers" on public.component_sellers;

create policy "admin can read component sellers"
on public.component_sellers
for select
to authenticated
using (private.is_admin());

create policy "admin can insert component sellers"
on public.component_sellers
for insert
to authenticated
with check (private.is_admin());

create policy "admin can update component sellers"
on public.component_sellers
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy "admin can delete component sellers"
on public.component_sellers
for delete
to authenticated
using (private.is_admin());

drop policy if exists "admin can read inventory" on public.inventory;
drop policy if exists "admin can insert inventory" on public.inventory;
drop policy if exists "admin can update inventory" on public.inventory;
drop policy if exists "admin can delete inventory" on public.inventory;

create policy "admin can read inventory"
on public.inventory
for select
to authenticated
using (private.is_admin());

create policy "admin can insert inventory"
on public.inventory
for insert
to authenticated
with check (private.is_admin());

create policy "admin can update inventory"
on public.inventory
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy "admin can delete inventory"
on public.inventory
for delete
to authenticated
using (private.is_admin());

drop policy if exists "admin can read production entries" on public.production_entries;
drop policy if exists "admin can insert production entries" on public.production_entries;
drop policy if exists "admin can update production entries" on public.production_entries;
drop policy if exists "admin can delete production entries" on public.production_entries;

create policy "admin can read production entries"
on public.production_entries
for select
to authenticated
using (private.is_admin());

create policy "admin can insert production entries"
on public.production_entries
for insert
to authenticated
with check (private.is_admin());

create policy "admin can update production entries"
on public.production_entries
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy "admin can delete production entries"
on public.production_entries
for delete
to authenticated
using (private.is_admin());

drop policy if exists "admin can read production requirements" on public.production_requirements;
drop policy if exists "admin can insert production requirements" on public.production_requirements;
drop policy if exists "admin can update production requirements" on public.production_requirements;
drop policy if exists "admin can delete production requirements" on public.production_requirements;

create policy "admin can read production requirements"
on public.production_requirements
for select
to authenticated
using (private.is_admin());

create policy "admin can insert production requirements"
on public.production_requirements
for insert
to authenticated
with check (private.is_admin());

create policy "admin can update production requirements"
on public.production_requirements
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy "admin can delete production requirements"
on public.production_requirements
for delete
to authenticated
using (private.is_admin());
