alter table public.products enable row level security;
alter table public.components enable row level security;
alter table public.sellers enable row level security;
alter table public.component_sellers enable row level security;
alter table public.inventory enable row level security;
alter table public.production_entries enable row level security;
alter table public.production_requirements enable row level security;

alter table private.product_versions enable row level security;
alter table private.component_references enable row level security;
alter table private.attachments enable row level security;
alter table private.history_events enable row level security;
alter table private.app_settings enable row level security;
alter table private.user_roles enable row level security;

alter table public.products force row level security;
alter table public.components force row level security;
alter table public.sellers force row level security;
alter table public.component_sellers force row level security;
alter table public.inventory force row level security;
alter table public.production_entries force row level security;
alter table public.production_requirements force row level security;

alter table private.product_versions force row level security;
alter table private.component_references force row level security;
alter table private.attachments force row level security;
alter table private.history_events force row level security;
alter table private.app_settings force row level security;
alter table private.user_roles force row level security;
