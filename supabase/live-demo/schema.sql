create extension if not exists pgcrypto;

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image text
);

create table if not exists product_versions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  version_number text not null
);

create index if not exists product_versions_product_id_idx on product_versions(product_id);

create table if not exists components (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  producer text not null,
  value text,
  safety_stock integer not null default 25
);

create index if not exists components_category_idx on components(category);
create index if not exists components_name_idx on components(name);

create table if not exists sellers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_url text,
  lead_time integer
);

create table if not exists component_sellers (
  component_id uuid not null references components(id) on delete cascade,
  seller_id uuid not null references sellers(id) on delete cascade,
  product_url text,
  primary key (component_id, seller_id)
);

create index if not exists component_sellers_component_id_idx on component_sellers(component_id);
create index if not exists component_sellers_seller_id_idx on component_sellers(seller_id);

create table if not exists component_references (
  version_id uuid not null references product_versions(id) on delete cascade,
  component_master_id uuid not null references components(id) on delete cascade,
  reference text not null,
  primary key (version_id, reference)
);

create index if not exists component_references_version_id_idx on component_references(version_id);
create index if not exists component_references_component_master_id_idx on component_references(component_master_id);

create table if not exists inventory (
  id uuid primary key default gen_random_uuid(),
  component_id uuid not null unique references components(id) on delete cascade,
  quantity_available numeric not null default 0,
  purchase_price numeric(12,4)
);

create index if not exists inventory_component_id_idx on inventory(component_id);

create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references product_versions(id) on delete cascade,
  file_path text not null
);

create index if not exists attachments_version_id_idx on attachments(version_id);

create table if not exists production_entries (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references product_versions(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  status text not null default 'under_production' check (status in ('under_production', 'completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists production_entries_version_id_idx on production_entries(version_id);
create index if not exists production_entries_created_at_idx on production_entries(created_at desc);

create table if not exists production_requirements (
  id uuid primary key default gen_random_uuid(),
  production_entry_id uuid not null references production_entries(id) on delete cascade,
  component_id uuid not null references components(id) on delete cascade,
  gross_requirement integer not null default 0 check (gross_requirement >= 0),
  inventory_consumed integer not null default 0 check (inventory_consumed >= 0),
  net_requirement integer not null default 0 check (net_requirement >= 0),
  created_at timestamptz not null default now()
);

create index if not exists production_requirements_entry_id_idx on production_requirements(production_entry_id);
create index if not exists production_requirements_component_id_idx on production_requirements(component_id);

create table if not exists history_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text,
  action_type text not null,
  summary text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

create index if not exists history_events_created_at_idx on history_events(created_at desc);

create table if not exists app_settings (
  id boolean primary key default true check (id = true),
  default_safety_stock integer not null default 25
);

insert into app_settings (id, default_safety_stock)
values (true, 25)
on conflict (id) do nothing;

alter table components add column if not exists safety_stock integer not null default 25;
alter table history_events add column if not exists old_value text;
alter table history_events add column if not exists new_value text;
alter table production_entries add column if not exists status text not null default 'under_production';
alter table production_entries add column if not exists completed_at timestamptz;

alter table products disable row level security;
alter table product_versions disable row level security;
alter table components disable row level security;
alter table sellers disable row level security;
alter table component_sellers disable row level security;
alter table component_references disable row level security;
alter table inventory disable row level security;
alter table attachments disable row level security;
alter table production_entries disable row level security;
alter table production_requirements disable row level security;
alter table history_events disable row level security;
alter table app_settings disable row level security;
