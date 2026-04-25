export const ensureSqliteSchemaSql = `
create table if not exists products (
  id text primary key,
  name text not null,
  image text,
  created_at text not null default current_timestamp
);

create table if not exists product_versions (
  id text primary key,
  product_id text not null references products(id) on delete cascade,
  version_number text not null,
  created_at text not null default current_timestamp
);

create index if not exists product_versions_product_id_idx on product_versions(product_id);

create table if not exists components (
  id text primary key,
  sku text not null unique,
  name text not null,
  category text not null,
  producer text not null,
  value text,
  safety_stock integer not null default 25,
  created_at text not null default current_timestamp
);

create index if not exists components_category_idx on components(category);
create index if not exists components_name_idx on components(name);
create index if not exists components_sku_idx on components(sku);

create table if not exists sellers (
  id text primary key,
  name text not null unique,
  base_url text,
  lead_time integer,
  created_at text not null default current_timestamp
);

create table if not exists component_sellers (
  component_id text not null references components(id) on delete cascade,
  seller_id text not null references sellers(id) on delete cascade,
  product_url text,
  primary key (component_id, seller_id)
);

create index if not exists component_sellers_component_id_idx on component_sellers(component_id);
create index if not exists component_sellers_seller_id_idx on component_sellers(seller_id);

create table if not exists component_references (
  version_id text not null references product_versions(id) on delete cascade,
  component_master_id text not null references components(id) on delete cascade,
  reference text not null,
  primary key (version_id, reference)
);

create index if not exists component_references_component_id_idx on component_references(component_master_id);

create table if not exists inventory (
  id text primary key,
  component_id text not null unique references components(id) on delete cascade,
  quantity_available real not null default 0,
  purchase_price real
);

create table if not exists inventory_lots (
  id text primary key,
  component_id text not null references components(id) on delete cascade,
  quantity_received real not null,
  quantity_remaining real not null,
  unit_cost real not null,
  received_at text not null,
  source text,
  notes text,
  created_at text not null default current_timestamp
);

create index if not exists inventory_lots_component_id_idx on inventory_lots(component_id);
create index if not exists inventory_lots_component_received_at_idx on inventory_lots(component_id, received_at asc, created_at asc);

create table if not exists attachments (
  id text primary key,
  version_id text not null references product_versions(id) on delete cascade,
  file_path text not null,
  created_at text not null default current_timestamp
);

create index if not exists attachments_version_id_idx on attachments(version_id);

create table if not exists production_entries (
  id text primary key,
  version_id text not null references product_versions(id) on delete cascade,
  quantity integer not null,
  status text not null default 'under_production',
  completed_at text,
  created_at text not null default current_timestamp
);

create index if not exists production_entries_version_id_idx on production_entries(version_id);
create index if not exists production_entries_created_at_idx on production_entries(created_at desc);

create table if not exists production_requirements (
  id text primary key,
  production_entry_id text not null references production_entries(id) on delete cascade,
  component_id text not null references components(id) on delete cascade,
  gross_requirement real not null,
  inventory_consumed real not null,
  net_requirement real not null,
  created_at text not null default current_timestamp
);

create index if not exists production_requirements_entry_id_idx on production_requirements(production_entry_id);
create index if not exists production_requirements_component_id_idx on production_requirements(component_id);

create table if not exists history_events (
  id text primary key,
  entity_type text not null,
  entity_id text,
  action_type text not null,
  summary text not null,
  old_value text,
  new_value text,
  created_at text not null default current_timestamp
);

create index if not exists history_events_created_at_idx on history_events(created_at desc);

create table if not exists app_settings (
  id integer primary key check (id = 1),
  default_safety_stock integer not null default 25
);

insert into app_settings (id, default_safety_stock)
values (1, 25)
on conflict(id) do nothing;
`;
