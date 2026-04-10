create index if not exists components_category_idx on public.components(category);
create index if not exists components_name_idx on public.components(name);
create index if not exists components_sku_idx on public.components(sku);

create index if not exists component_sellers_component_id_idx on public.component_sellers(component_id);
create index if not exists component_sellers_seller_id_idx on public.component_sellers(seller_id);

create index if not exists inventory_component_id_idx on public.inventory(component_id);

alter table public.production_entries
drop constraint if exists production_entries_version_id_fkey;

alter table public.production_entries
add constraint production_entries_version_id_fkey
foreign key (version_id) references private.product_versions(id) on delete cascade;

create index if not exists production_entries_version_id_idx on public.production_entries(version_id);
create index if not exists production_entries_created_at_idx on public.production_entries(created_at desc);

create index if not exists production_requirements_entry_id_idx on public.production_requirements(production_entry_id);
create index if not exists production_requirements_component_id_idx on public.production_requirements(component_id);

create index if not exists product_versions_product_id_idx on private.product_versions(product_id);

create index if not exists component_references_version_id_idx on private.component_references(version_id);
create index if not exists component_references_component_master_id_idx on private.component_references(component_master_id);

create index if not exists attachments_version_id_idx on private.attachments(version_id);

create index if not exists history_events_created_at_idx on private.history_events(created_at desc);

create index if not exists user_roles_role_idx on private.user_roles(role);
