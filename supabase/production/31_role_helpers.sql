create or replace function private.handle_user_roles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_roles_set_updated_at on private.user_roles;

create trigger user_roles_set_updated_at
before update on private.user_roles
for each row
execute function private.handle_user_roles_updated_at();

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.user_roles
    where user_id = auth.uid()
      and role = 'admin'
      and is_active = true
  );
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

create or replace function private.assign_admin_role(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.user_roles (user_id, role, is_active)
  values (target_user_id, 'admin', true)
  on conflict (user_id) do update
  set role = excluded.role,
      is_active = true,
      updated_at = now();
end;
$$;

revoke all on function private.assign_admin_role(uuid) from public;
