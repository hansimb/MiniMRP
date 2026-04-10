insert into private.app_settings (id, default_safety_stock)
values (true, 25)
on conflict (id) do nothing;

comment on function private.assign_admin_role(uuid) is
'Run after creating the first Supabase Auth user: select private.assign_admin_role(''<user-uuid>'');';
