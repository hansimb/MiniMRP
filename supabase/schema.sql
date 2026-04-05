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
  value text
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

alter table products disable row level security;
alter table product_versions disable row level security;
alter table components disable row level security;
alter table sellers disable row level security;
alter table component_sellers disable row level security;
alter table component_references disable row level security;
alter table inventory disable row level security;
alter table attachments disable row level security;
