create table if not exists private.product_versions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  version_number text not null
);

create table if not exists private.component_references (
  version_id uuid not null references private.product_versions(id) on delete cascade,
  component_master_id uuid not null references public.components(id) on delete cascade,
  reference text not null,
  primary key (version_id, reference)
);

create table if not exists private.attachments (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references private.product_versions(id) on delete cascade,
  file_path text not null
);

create table if not exists private.history_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text,
  action_type text not null,
  summary text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

create table if not exists private.app_settings (
  id boolean primary key default true check (id = true),
  default_safety_stock integer not null default 25
);

create table if not exists private.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
