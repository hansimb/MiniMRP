revoke all on all tables in schema public from anon;
revoke all on all tables in schema private from anon;
revoke all on all tables in schema private from authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter default privileges in schema public
grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
grant usage, select on sequences to authenticated;

alter default privileges in schema public
revoke all on tables from anon;

alter default privileges in schema private
revoke all on tables from anon;

alter default privileges in schema private
revoke all on tables from authenticated;

alter default privileges in schema private
revoke all on sequences from anon;

alter default privileges in schema private
revoke all on sequences from authenticated;

alter default privileges in schema private
revoke execute on functions from public;

alter default privileges in schema private
revoke execute on functions from anon;

alter default privileges in schema private
revoke execute on functions from authenticated;
