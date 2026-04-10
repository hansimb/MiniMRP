create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image text
);

create table if not exists public.components (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  category text not null,
  producer text not null,
  value text,
  safety_stock integer not null default 25
);

create table if not exists public.sellers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_url text,
  lead_time integer
);

create table if not exists public.component_sellers (
  component_id uuid not null references public.components(id) on delete cascade,
  seller_id uuid not null references public.sellers(id) on delete cascade,
  product_url text,
  primary key (component_id, seller_id)
);

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  component_id uuid not null unique references public.components(id) on delete cascade,
  quantity_available numeric not null default 0,
  purchase_price numeric(12,4)
);

create table if not exists public.production_entries (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null,
  quantity integer not null check (quantity > 0),
  status text not null default 'under_production' check (status in ('under_production', 'completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.production_requirements (
  id uuid primary key default gen_random_uuid(),
  production_entry_id uuid not null references public.production_entries(id) on delete cascade,
  component_id uuid not null references public.components(id) on delete cascade,
  gross_requirement integer not null default 0 check (gross_requirement >= 0),
  inventory_consumed integer not null default 0 check (inventory_consumed >= 0),
  net_requirement integer not null default 0 check (net_requirement >= 0),
  created_at timestamptz not null default now()
);
