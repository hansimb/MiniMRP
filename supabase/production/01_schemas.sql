create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

grant usage on schema public to anon;
grant usage on schema public to authenticated;
grant usage on schema private to authenticated;
grant usage on schema private to postgres;
grant usage on schema private to service_role;
